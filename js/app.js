// Main application controller for MyOS

import { 
    TodayView, CheckinsView, TasksView, HabitsView, 
    PrayersView, JournalView, SearchView, SettingsView 
} from './views.js';
import { storage } from './storage.js';

class App {
    constructor() {
        this.currentView = null;
        this.views = {
            today: new TodayView(),
            checkins: new CheckinsView(),
            tasks: new TasksView(),
            habits: new HabitsView(),
            prayers: new PrayersView(),
            journal: new JournalView(),
            search: new SearchView(),
            settings: new SettingsView()
        };
        
        this.init();
    }

    async init() {
        try {
            // Initialize storage
            await storage.init();
            console.log('App initialized successfully');

            // Set up navigation
            this.setupNavigation();

            // Show default view (Today)
            this.showView('today');

            // Set up global event listeners
            this.setupGlobalEventListeners();

            // Initialize any background tasks
            this.startBackgroundTasks();

        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Failed to initialize app. Please refresh the page.');
        }
    }

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-btn');
        
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const viewName = button.dataset.nav;
                if (viewName) {
                    this.showView(viewName);
                }
            });
        });
    }

    async showView(viewName) {
        if (!this.views[viewName]) {
            console.error(`View '${viewName}' not found`);
            return;
        }

        // Update navigation state
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-nav="${viewName}"]`).classList.add('active');

        // Show the view
        this.currentView = this.views[viewName];
        this.currentView.show();
        
        // Render the view content
        try {
            await this.currentView.render();
        } catch (error) {
            console.error(`Error rendering view '${viewName}':`, error);
            this.currentView.renderError('Failed to load view');
        }
    }

    setupGlobalEventListeners() {
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.showView('search');
            }

            // Escape to close modals
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Handle online/offline status
        window.addEventListener('online', () => {
            console.log('App is online');
            this.showOnlineStatus(true);
        });

        window.addEventListener('offline', () => {
            console.log('App is offline');
            this.showOnlineStatus(false);
        });

        // Handle visibility change (app comes to foreground)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentView) {
                // Refresh current view when app becomes visible
                this.currentView.render();
            }
        });

        // Handle app install prompt
        this.setupInstallPrompt();
    }

    closeAllModals() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    }

    showOnlineStatus(isOnline) {
        const message = isOnline ? 'Back online' : 'Working offline';
        const type = isOnline ? 'success' : 'warning';
        
        // Import Toast dynamically to avoid circular dependency
        import('./components.js').then(({ Toast }) => {
            Toast.show(message, type, 3000);
        });
    }

    setupInstallPrompt() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            
            // Stash the event so it can be triggered later
            deferredPrompt = e;

            // Show install button in settings
            this.showInstallButton();
        });

        // Handle install button click
        document.addEventListener('click', async (e) => {
            if (e.target.id === 'install-app') {
                if (!deferredPrompt) {
                    console.log('Install prompt not available');
                    return;
                }

                // Show the install prompt
                deferredPrompt.prompt();

                // Wait for the user to respond to the prompt
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);

                // We've used the prompt, and can't use it again, throw it away
                deferredPrompt = null;

                // Hide install button
                this.hideInstallButton();
            }
        });
    }

    showInstallButton() {
        const installButton = document.createElement('button');
        installButton.id = 'install-app';
        installButton.className = 'btn btn-primary';
        installButton.textContent = 'Install App';
        
        // Add to settings view when it's shown
        const settingsSection = document.querySelector('.settings-section');
        if (settingsSection) {
            settingsSection.appendChild(installButton);
        }
    }

    hideInstallButton() {
        const installButton = document.getElementById('install-app');
        if (installButton) {
            installButton.remove();
        }
    }

    startBackgroundTasks() {
        // Periodic sync (every 5 minutes when online)
        setInterval(async () => {
            if (navigator.onLine) {
                try {
                    await this.performBackgroundSync();
                } catch (error) {
                    console.error('Background sync failed:', error);
                }
            }
        }, 5 * 60 * 1000);

        // Check for overdue items every hour
        setInterval(() => {
            this.checkOverdueItems();
        }, 60 * 60 * 1000);
    }

    async performBackgroundSync() {
        // This would sync with Supabase when implemented
        console.log('Background sync performed');
    }

    checkOverdueItems() {
        // This could show notifications for overdue items
        console.log('Checked for overdue items');
    }

    showError(message) {
        const appElement = document.getElementById('app');
        if (appElement) {
            appElement.innerHTML = `
                <div class="error-screen text-center">
                    <h1>Something went wrong</h1>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Reload</button>
                </div>
            `;
        }
    }

    // Utility methods for global state
    async getCurrentUser() {
        // This would return the current authenticated user
        return null; // Will be implemented with Supabase auth
    }

    async getSyncStatus() {
        // This would return the current sync status
        return {
            lastSync: null,
            isOnline: navigator.onLine,
            pendingChanges: 0
        };
    }

    // Global refresh method
    async refresh() {
        if (this.currentView) {
            await this.currentView.render();
        }
    }

    // Global search method
    async search(query) {
        const results = {
            checkins: [],
            tasks: [],
            habits: [],
            prayers: [],
            journal: []
        };

        // This would implement global search across all domains
        return results;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Handle service worker updates
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service worker updated, reloading page');
        window.location.reload();
    });
}

// Export for global access
export default App;
