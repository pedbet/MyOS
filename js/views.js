// View controllers for MyOS

import { 
    Checkin, Task, Habit, HabitLog, Prayer, PrayerLog, JournalEntry 
} from './models.js';
import { 
    Modal, Card, StatusIndicator, Label, EmptyState, FormFields, Toast, LoadingSpinner 
} from './components.js';
import { dateUtils, stringUtils } from './utils.js';

class BaseView {
    constructor(elementId) {
        this.element = document.getElementById(elementId);
        this.isLoading = false;
    }

    show() {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        this.element.classList.add('active');
    }

    setLoading(loading) {
        this.isLoading = loading;
        if (loading) {
            this.element.innerHTML = '<div class="text-center">' + LoadingSpinner.render('large') + '</div>';
        }
    }

    renderError(message) {
        this.element.innerHTML = `
            <div class="text-center">
                <p class="text-danger">${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            </div>
        `;
    }
}

export class TodayView extends BaseView {
    constructor() {
        super('today-view');
    }

    async render() {
        this.setLoading(true);
        
        try {
            // Get data for all domains
            const [checkins, tasks, habits, prayers, journal] = await Promise.all([
                Checkin.findAll(),
                Task.findAll({ status: 'OPEN' }),
                Habit.findAll(),
                Prayer.findAll(),
                JournalEntry.getOrCreateForDate()
            ]);

            // Render each section in canonical order
            this.element.innerHTML = `
                <h2>Today</h2>
                <div class="today-sections">
                    ${this.renderCheckinsSection(checkins)}
                    ${this.renderTasksSection(tasks)}
                    ${this.renderHabitsSection(habits)}
                    ${this.renderPrayersSection(prayers)}
                    ${this.renderJournalSection(journal)}
                </div>
            `;

            this.attachEventListeners();
        } catch (error) {
            console.error('Error rendering Today view:', error);
            this.renderError('Failed to load today\'s data');
        } finally {
            this.setLoading(false);
        }
    }

    renderCheckinsSection(checkins) {
        // Sort by status (RED, YELLOW, GREEN) then by days since anchor
        const sorted = checkins.sort((a, b) => {
            const statusOrder = { RED: 0, YELLOW: 1, GREEN: 2 };
            const aStatus = statusOrder[a.getStatus()];
            const bStatus = statusOrder[b.getStatus()];
            
            if (aStatus !== bStatus) {
                return aStatus - bStatus;
            }
            
            return b.getDaysSinceAnchor() - a.getDaysSinceAnchor();
        });

        const checkinsHtml = sorted.length > 0 
            ? sorted.map(checkin => this.renderCheckinCard(checkin)).join('')
            : EmptyState.render('No check-ins due', {
                label: 'Add Check-in',
                action: 'add-checkin'
            });

        return `
            <section id="today-checkins" class="today-section">
                <h3>Check-ins</h3>
                <div class="section-content">${checkinsHtml}</div>
            </section>
        `;
    }

    renderCheckinCard(checkin) {
        const status = checkin.getStatus();
        const daysSince = checkin.getDaysSinceAnchor();
        
        return new Card({
            title: checkin.title,
            subtitle: `${daysSince} days since last check-in`,
            content: StatusIndicator.render(status),
            actions: [
                { label: 'Check-in', action: 'checkin', className: 'btn btn-success btn-sm' },
                { label: 'Edit', action: 'edit', className: 'btn btn-secondary btn-sm' }
            ],
            className: 'checkin-card',
            onClick: () => this.handleCheckinClick(checkin)
        }).render();
    }

    renderTasksSection(tasks) {
        // Sort: overdue first, then oldest created
        const sorted = tasks.sort((a, b) => {
            const aOverdue = a.isOverdue();
            const bOverdue = b.isOverdue();
            
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            
            return new Date(a.created_at) - new Date(b.created_at);
        });

        const tasksHtml = sorted.length > 0
            ? sorted.map(task => this.renderTaskCard(task)).join('')
            : EmptyState.render('No open tasks', {
                label: 'Add Task',
                action: 'add-task'
            });

        return `
            <section id="today-tasks" class="today-section">
                <h3>Tasks</h3>
                <div class="section-content">${tasksHtml}</div>
            </section>
        `;
    }

    renderTaskCard(task) {
        const daysOpen = task.getDaysOpen();
        const overdueInfo = task.isOverdue() ? '<span class="text-danger">Overdue</span>' : '';
        
        return new Card({
            title: task.title,
            subtitle: `${daysOpen} days open ${overdueInfo}`,
            content: task.notes ? `<p class="text-sm">${task.notes}</p>` : '',
            actions: [
                { label: 'Complete', action: 'complete', className: 'btn btn-success btn-sm' },
                { label: 'Edit', action: 'edit', className: 'btn btn-secondary btn-sm' }
            ],
            className: 'task-card',
            onClick: () => this.handleTaskClick(task)
        }).render();
    }

    renderHabitsSection(habits) {
        const activeHabits = habits.filter(h => !h.isArchived());
        const today = dateUtils.getLocalDateString();
        
        // Get today's logs for all habits
        const habitPromises = activeHabits.map(async habit => {
            const log = await habit.getLogForDate(new Date());
            return { habit, log };
        });

        // For now, render without logs (will be updated async)
        const habitsHtml = activeHabits.length > 0
            ? activeHabits.map(habit => this.renderHabitCard(habit, null)).join('')
            : EmptyState.render('No active habits', {
                label: 'Add Habit',
                action: 'add-habit'
            });

        return `
            <section id="today-habits" class="today-section">
                <h3>Habits</h3>
                <div class="section-content">${habitsHtml}</div>
            </section>
        `;
    }

    renderHabitCard(habit, todaysLog) {
        const status = todaysLog ? todaysLog.status : 'pending';
        const statusClass = status === 'SUCCESS' ? 'status-green' : 
                          status === 'FAIL' ? 'status-red' : 'text-secondary';
        
        return new Card({
            title: habit.title,
            subtitle: habit.description,
            content: `<span class="${statusClass}">${status || 'Not logged'}</span>`,
            actions: [
                { label: 'Success', action: 'log-success', className: 'btn btn-success btn-sm' },
                { label: 'Fail', action: 'log-fail', className: 'btn btn-secondary btn-sm' },
                { label: 'Edit', action: 'edit', className: 'btn btn-secondary btn-sm' }
            ],
            className: 'habit-card',
            onClick: () => this.handleHabitClick(habit)
        }).render();
    }

    renderPrayersSection(prayers) {
        const prayersHtml = prayers.length > 0
            ? prayers.map(prayer => this.renderPrayerCard(prayer)).join('')
            : EmptyState.render('No prayers', {
                label: 'Add Prayer',
                action: 'add-prayer'
            });

        return `
            <section id="today-prayers" class="today-section">
                <h3>Prayers</h3>
                <div class="section-content">${prayersHtml}</div>
            </section>
        `;
    }

    renderPrayerCard(prayer) {
        return new Card({
            title: prayer.title,
            content: `<p class="text-sm">${stringUtils.truncate(prayer.text, 100)}</p>`,
            actions: [
                { label: 'Pray', action: 'pray', className: 'btn btn-primary btn-sm' },
                { label: 'Edit', action: 'edit', className: 'btn btn-secondary btn-sm' }
            ],
            className: 'prayer-card',
            onClick: () => this.handlePrayerClick(prayer)
        }).render();
    }

    renderJournalSection(journal) {
        const hasContent = journal.body && journal.body.trim().length > 0;
        
        return `
            <section id="today-journal" class="today-section">
                <h3>Journal</h3>
                <div class="section-content">
                    ${hasContent 
                        ? new Card({
                            title: journal.title,
                            content: `<p class="text-sm">${stringUtils.truncate(journal.body, 200)}</p>`,
                            actions: [
                                { label: 'Continue', action: 'edit-journal', className: 'btn btn-primary btn-sm' }
                            ],
                            onClick: () => this.handleJournalClick(journal)
                          }).render()
                        : new Card({
                            title: "Today's Journal",
                            content: '<p class="text-secondary">No entry yet today</p>',
                            actions: [
                                { label: 'Start Writing', action: 'edit-journal', className: 'btn btn-primary btn-sm' }
                            ],
                            onClick: () => this.handleJournalClick(journal)
                          }).render()
                    }
                </div>
            </section>
        `;
    }

    attachEventListeners() {
        // Add buttons
        this.element.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
            switch (action) {
                case 'add-checkin':
                    this.showAddCheckinModal();
                    break;
                case 'add-task':
                    this.showAddTaskModal();
                    break;
                case 'add-habit':
                    this.showAddHabitModal();
                    break;
                case 'add-prayer':
                    this.showAddPrayerModal();
                    break;
                case 'edit-journal':
                    this.showJournalModal();
                    break;
            }
        });
    }

    async handleCheckinClick(checkin) {
        await checkin.checkin();
        Toast.success('Check-in completed!');
        this.render();
    }

    async handleTaskClick(task) {
        await task.complete();
        Toast.success('Task completed!');
        this.render();
    }

    async handleHabitClick(habit) {
        // Show habit logging modal
        this.showHabitLogModal(habit);
    }

    async handlePrayerClick(prayer) {
        await prayer.logPrayer();
        Toast.success('Prayer logged!');
        this.render();
    }

    handleJournalClick(journal) {
        this.showJournalModal(journal);
    }

    showAddCheckinModal() {
        const fields = [
            FormFields.text('title', 'Title', { required: true }),
            ...FormFields.duration('frequency_value', 'frequency_unit', 'Frequency'),
            ...FormFields.duration('yellow_value', 'yellow_unit', 'Yellow Threshold'),
            ...FormFields.duration('red_value', 'red_unit', 'Red Threshold')
        ];

        Modal.createFormModal({
            title: 'Add Check-in',
            fields,
            onSubmit: async (data) => {
                await Checkin.create(data);
                Toast.success('Check-in added!');
                this.render();
            }
        });
    }

    showAddTaskModal() {
        const fields = [
            FormFields.text('title', 'Title', { required: true }),
            FormFields.textarea('notes', 'Notes'),
            FormFields.date('due_at', 'Due Date')
        ];

        Modal.createFormModal({
            title: 'Add Task',
            fields,
            onSubmit: async (data) => {
                await Task.create(data);
                Toast.success('Task added!');
                this.render();
            }
        });
    }

    showAddHabitModal() {
        const fields = [
            FormFields.text('title', 'Title', { required: true }),
            FormFields.textarea('description', 'Description')
        ];

        Modal.createFormModal({
            title: 'Add Habit',
            fields,
            onSubmit: async (data) => {
                await Habit.create(data);
                Toast.success('Habit added!');
                this.render();
            }
        });
    }

    showAddPrayerModal() {
        const fields = [
            FormFields.text('title', 'Title', { required: true }),
            FormFields.textarea('text', 'Prayer Text', { required: true })
        ];

        Modal.createFormModal({
            title: 'Add Prayer',
            fields,
            onSubmit: async (data) => {
                await Prayer.create(data);
                Toast.success('Prayer added!');
                this.render();
            }
        });
    }

    showJournalModal(journal = null) {
        const fields = [
            FormFields.text('title', 'Title', { value: journal?.title || '', required: true }),
            FormFields.textarea('body', 'Entry', { value: journal?.body || '' })
        ];

        Modal.createFormModal({
            title: 'Journal Entry',
            fields,
            onSubmit: async (data) => {
                if (journal) {
                    await journal.save();
                } else {
                    await JournalEntry.create({
                        date: dateUtils.getLocalDateString(),
                        ...data
                    });
                }
                Toast.success('Journal saved!');
                this.render();
            }
        });
    }

    showHabitLogModal(habit) {
        const fields = [
            FormFields.status('status', 'Today\'s Status')
        ];

        Modal.createFormModal({
            title: `Log Habit: ${habit.title}`,
            fields,
            onSubmit: async (data) => {
                await HabitLog.create({
                    habit_id: habit.id,
                    date: dateUtils.getLocalDateString(),
                    status: data.status
                });
                Toast.success('Habit logged!');
                this.render();
            }
        });
    }
}

export class CheckinsView extends BaseView {
    constructor() {
        super('checkins-view');
    }

    async render() {
        this.setLoading(true);
        
        try {
            const checkins = await Checkin.findAll();
            
            this.element.innerHTML = `
                <div class="view-header">
                    <h2>Check-ins</h2>
                    <button class="btn btn-primary" data-action="add">Add Check-in</button>
                </div>
                <div class="checkins-list">
                    ${checkins.length > 0 
                        ? checkins.map(checkin => this.renderCheckinItem(checkin)).join('')
                        : EmptyState.render('No check-ins yet', {
                            label: 'Add Check-in',
                            action: 'add'
                        })
                    }
                </div>
            `;

            this.attachEventListeners();
        } catch (error) {
            console.error('Error rendering Checkins view:', error);
            this.renderError('Failed to load check-ins');
        } finally {
            this.setLoading(false);
        }
    }

    renderCheckinItem(checkin) {
        const status = checkin.getStatus();
        const lastCheckin = checkin.last_checkin_at 
            ? dateUtils.getLocalDateString(new Date(checkin.last_checkin_at))
            : 'Never';
        
        return new Card({
            title: checkin.title,
            subtitle: `Last check-in: ${lastCheckin}`,
            content: StatusIndicator.render(status),
            actions: [
                { label: 'Check-in', action: 'checkin', className: 'btn btn-success btn-sm' },
                { label: 'Edit', action: 'edit', className: 'btn btn-secondary btn-sm' },
                { label: 'Delete', action: 'delete', className: 'btn btn-secondary btn-sm' }
            ]
        }).render();
    }

    attachEventListeners() {
        this.element.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            
            if (action === 'add') {
                // Show add modal (similar to Today view)
                Toast.info('Add check-in modal coming soon');
            }
        });
    }
}

// Other view classes would follow similar patterns...
export class TasksView extends BaseView {
    constructor() {
        super('tasks-view');
    }

    async render() {
        this.setLoading(true);
        
        try {
            const tasks = await Task.findAll();
            
            this.element.innerHTML = `
                <h2>Tasks</h2>
                <div class="tasks-list">
                    ${tasks.length > 0 
                        ? tasks.map(task => this.renderTaskItem(task)).join('')
                        : EmptyState.render('No tasks yet')
                    }
                </div>
            `;
        } catch (error) {
            console.error('Error rendering Tasks view:', error);
            this.renderError('Failed to load tasks');
        } finally {
            this.setLoading(false);
        }
    }

    renderTaskItem(task) {
        const statusClass = task.status === 'DONE' ? 'status-green' : '';
        return new Card({
            title: task.title,
            subtitle: task.due_at ? `Due: ${dateUtils.getLocalDateString(new Date(task.due_at))}` : '',
            content: task.notes ? `<p class="text-sm">${task.notes}</p>` : '',
            actions: [
                { label: task.status === 'DONE' ? 'Reopen' : 'Complete', action: 'toggle', className: 'btn btn-success btn-sm' }
            ]
        }).render();
    }
}

export class HabitsView extends BaseView {
    constructor() {
        super('habits-view');
    }

    async render() {
        this.setLoading(true);
        
        try {
            const habits = await Habit.findAll();
            
            this.element.innerHTML = `
                <h2>Habits</h2>
                <div class="habits-list">
                    ${habits.length > 0 
                        ? habits.map(habit => this.renderHabitItem(habit)).join('')
                        : EmptyState.render('No habits yet')
                    }
                </div>
            `;
        } catch (error) {
            console.error('Error rendering Habits view:', error);
            this.renderError('Failed to load habits');
        } finally {
            this.setLoading(false);
        }
    }

    renderHabitItem(habit) {
        return new Card({
            title: habit.title,
            subtitle: habit.description,
            content: habit.isArchived() ? '<span class="text-secondary">Archived</span>' : '',
            actions: [
                { label: 'Log', action: 'log', className: 'btn btn-primary btn-sm' }
            ]
        }).render();
    }
}

export class PrayersView extends BaseView {
    constructor() {
        super('prayers-view');
    }

    async render() {
        this.setLoading(true);
        
        try {
            const prayers = await Prayer.findAll();
            
            this.element.innerHTML = `
                <h2>Prayers</h2>
                <div class="prayers-list">
                    ${prayers.length > 0 
                        ? prayers.map(prayer => this.renderPrayerItem(prayer)).join('')
                        : EmptyState.render('No prayers yet')
                    }
                </div>
            `;
        } catch (error) {
            console.error('Error rendering Prayers view:', error);
            this.renderError('Failed to load prayers');
        } finally {
            this.setLoading(false);
        }
    }

    renderPrayerItem(prayer) {
        return new Card({
            title: prayer.title,
            content: `<p class="text-sm">${stringUtils.truncate(prayer.text, 100)}</p>`,
            actions: [
                { label: 'Pray', action: 'pray', className: 'btn btn-primary btn-sm' }
            ]
        }).render();
    }
}

export class JournalView extends BaseView {
    constructor() {
        super('journal-view');
    }

    async render() {
        this.setLoading(true);
        
        try {
            const entries = await JournalEntry.findAll();
            
            this.element.innerHTML = `
                <h2>Journal</h2>
                <div class="journal-list">
                    ${entries.length > 0 
                        ? entries.map(entry => this.renderJournalItem(entry)).join('')
                        : EmptyState.render('No journal entries yet')
                    }
                </div>
            `;
        } catch (error) {
            console.error('Error rendering Journal view:', error);
            this.renderError('Failed to load journal');
        } finally {
            this.setLoading(false);
        }
    }

    renderJournalItem(entry) {
        return new Card({
            title: entry.title,
            subtitle: entry.date,
            content: `<p class="text-sm">${stringUtils.truncate(entry.body, 150)}</p>`,
            actions: [
                { label: 'Edit', action: 'edit', className: 'btn btn-secondary btn-sm' }
            ]
        }).render();
    }
}

export class SearchView extends BaseView {
    constructor() {
        super('search-view');
    }

    async render() {
        this.element.innerHTML = `
            <h2>Search</h2>
            <div class="search-container">
                <input type="text" class="form-input" placeholder="Search everything..." id="search-input">
                <div id="search-results"></div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            this.performSearch(e.target.value);
        });
    }

    async performSearch(query) {
        if (!query.trim()) {
            document.getElementById('search-results').innerHTML = '';
            return;
        }

        // Search implementation would go here
        document.getElementById('search-results').innerHTML = '<p>Search coming soon...</p>';
    }
}

export class SettingsView extends BaseView {
    constructor() {
        super('settings-view');
    }

    async render() {
        this.element.innerHTML = `
            <h2>Settings</h2>
            <div class="settings-sections">
                <div class="settings-section">
                    <h3>Sync Settings</h3>
                    <div class="form-group">
                        <label class="form-label">Supabase URL</label>
                        <input type="text" class="form-input" id="supabase-url" placeholder="https://your-project.supabase.co">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Supabase Anon Key</label>
                        <input type="text" class="form-input" id="supabase-key" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...">
                    </div>
                    <button class="btn btn-primary" id="save-sync-settings">Save Settings</button>
                </div>
                
                <div class="settings-section">
                    <h3>Data Management</h3>
                    <button class="btn btn-secondary" id="export-data">Export Data</button>
                    <button class="btn btn-secondary" id="import-data">Import Data</button>
                    <button class="btn btn-secondary" id="clear-data">Clear All Data</button>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        document.getElementById('save-sync-settings').addEventListener('click', () => {
            Toast.info('Sync settings coming soon');
        });

        document.getElementById('export-data').addEventListener('click', () => {
            Toast.info('Export coming soon');
        });

        document.getElementById('import-data').addEventListener('click', () => {
            Toast.info('Import coming soon');
        });

        document.getElementById('clear-data').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                Toast.info('Clear data coming soon');
            }
        });
    }
}
