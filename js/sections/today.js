/* ============================================================
   today.js — Today screen
   ============================================================ */

const TodaySection = {
  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.className = 'section-page fade-in';

    const today = localDate();
    const greeting = greet();
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const header = el('div');
    header.innerHTML = `
      <div class="today-greeting">${greeting}.</div>
      <div class="today-subdate">${dateStr}</div>
    `;
    content.appendChild(header);

    // Check-ins block
    await TodaySection.renderCheckins(content);
    // Tasks block
    await TodaySection.renderTasks(content);
    // Habits block
    await TodaySection.renderHabits(content, today);
    // Prayers block
    await TodaySection.renderPrayers(content, today);
    // Journal block
    await TodaySection.renderJournal(content, today);

    // Sync status
    const syncDiv = el('div', 'sync-status', '');
    syncDiv.id = 'sync-status';
    content.appendChild(syncDiv);
  },

  async renderCheckins(content) {
    const block = el('div', 'today-section-block');
    const titleRow = el('div', 'today-section-title');
    titleRow.innerHTML = `<span>CHECK-INS</span><a class="text-link" href="#" data-nav="checkins">All →</a>`;
    block.appendChild(titleRow);

    const checkins = await DB.getLive('checkins');
    const urgent = checkins.filter(c => {
      const s = checkinStatus(c);
      return s === 'red' || s === 'yellow';
    }).sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 };
      return order[checkinStatus(a)] - order[checkinStatus(b)];
    }).slice(0, 5);

    if (urgent.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">✓</div><p>All check-ins on track</p>';
      block.appendChild(e);
    } else {
      urgent.forEach(c => {
        const s = checkinStatus(c);
        const card = el('div', 'card');
        const due = checkinNextDue(c);
        const anchor = c.last_checkin_at || c.first_due_at || c.created_at;
        card.innerHTML = `
          <div class="card-row">
            <div class="status-dot status-${s}"></div>
            <div class="card-title" style="flex:1">${c.title}</div>
            <span class="badge badge-${s}">${s.toUpperCase()}</span>
          </div>
          <div class="card-meta">Last: ${c.last_checkin_at ? formatRelative(c.last_checkin_at) : 'never'} · Due: ${formatDate(due.toISOString())}</div>
          <div class="card-actions">
            <button class="btn-primary" style="padding:7px 16px;font-size:13px" data-checkin-id="${c.id}">Check in</button>
          </div>
        `;
        card.querySelector('[data-checkin-id]').addEventListener('click', async () => {
          await CheckinsSection.doCheckin(c.id);
          TodaySection.render();
        });
        block.appendChild(card);
      });
    }

    content.appendChild(block);
  },

  async renderTasks(content) {
    const block = el('div', 'today-section-block');
    const titleRow = el('div', 'today-section-title');
    titleRow.innerHTML = `<span>TASKS</span><a class="text-link" href="#" data-nav="tasks">All →</a>`;
    block.appendChild(titleRow);

    const tasks = (await DB.getLive('tasks')).filter(t => t.status === 'OPEN');
    tasks.sort((a, b) => {
      // overdue first
      const aOv = a.due_at && new Date(a.due_at) < new Date() ? 0 : 1;
      const bOv = b.due_at && new Date(b.due_at) < new Date() ? 0 : 1;
      if (aOv !== bOv) return aOv - bOv;
      return new Date(a.created_at) - new Date(b.created_at);
    });
    const shown = tasks.slice(0, 5);

    if (shown.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">📋</div><p>No open tasks</p>';
      block.appendChild(e);
    } else {
      shown.forEach(t => {
        const card = el('div', 'card');
        const days = daysOpen(t.created_at);
        const overdue = t.due_at && new Date(t.due_at) < new Date();
        const daysCls = days > 14 ? 'days-open very-old' : days > 7 ? 'days-open old' : 'days-open';
        card.innerHTML = `
          <div class="checkbox-wrap" data-task-id="${t.id}">
            <div class="checkbox"></div>
            <div>
              <div class="card-title">${t.title}</div>
              <div class="card-meta">${overdue ? `<span style="color:var(--red)">Overdue · </span>` : ''}${t.due_at ? 'Due ' + formatDate(t.due_at) + ' · ' : ''}<span class="${daysCls}">${days}d open</span></div>
            </div>
          </div>
        `;
        card.querySelector('.checkbox-wrap').addEventListener('click', async () => {
          await TasksSection.completeTask(t.id);
          TodaySection.render();
        });
        block.appendChild(card);
      });
    }

    if (tasks.length > 5) {
      const more = el('div', 'card-meta', `+${tasks.length - 5} more tasks`);
      more.style.cssText = 'text-align:center;padding:8px;cursor:pointer';
      more.addEventListener('click', () => App.navigate('tasks'));
      block.appendChild(more);
    }

    // Add task FAB handled by app
    const addBtn = el('button', '', '+ Task');
    addBtn.style.cssText = 'background:none;border:none;color:var(--accent);font-size:13px;cursor:pointer;margin-top:4px;padding:0';
    addBtn.addEventListener('click', () => TasksSection.showAddModal(() => TodaySection.render()));
    block.appendChild(addBtn);

    content.appendChild(block);
  },

  async renderHabits(content, today) {
    const block = el('div', 'today-section-block');
    const titleRow = el('div', 'today-section-title');
    titleRow.innerHTML = `<span>HABITS</span><a class="text-link" href="#" data-nav="habits">All →</a>`;
    block.appendChild(titleRow);

    const habits = (await DB.getLive('habits')).filter(h => !h.archived_at);
    const logs = await DB.getAll('habit_logs');
    const todayLogs = logs.filter(l => l.date === today && !l.deleted_at);

    if (habits.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">🌱</div><p>No habits yet</p>';
      block.appendChild(e);
    } else {
      habits.forEach(h => {
        const log = todayLogs.find(l => l.habit_id === h.id);
        const row = el('div', 'habit-row');
        row.innerHTML = `
          <div class="habit-name">${h.title}</div>
          <div class="habit-btns">
            <button class="habit-btn ${log?.status === 'SUCCESS' ? 'success' : ''}" data-hid="${h.id}" data-status="SUCCESS" title="Done">✓</button>
            <button class="habit-btn ${log?.status === 'FAIL' ? 'fail' : ''}" data-hid="${h.id}" data-status="FAIL" title="Skip">✗</button>
            <button class="habit-btn ${log?.status === 'NA' ? 'na' : ''}" data-hid="${h.id}" data-status="NA" title="N/A">–</button>
          </div>
        `;
        row.querySelectorAll('[data-status]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const status = btn.dataset.status;
            const newStatus = log?.status === status ? null : status;
            await HabitsSection.logHabit(h.id, today, newStatus, log);
            TodaySection.render();
          });
        });
        block.appendChild(row);
      });
    }

    content.appendChild(block);
  },

  async renderPrayers(content, today) {
    const block = el('div', 'today-section-block');
    const titleRow = el('div', 'today-section-title');
    titleRow.innerHTML = `<span>PRAYERS</span><a class="text-link" href="#" data-nav="prayers">All →</a>`;
    block.appendChild(titleRow);

    const prayers = await DB.getLive('prayers');
    const logs = (await DB.getAll('prayer_logs')).filter(l => l.date === today && !l.deleted_at);

    if (prayers.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">🙏</div><p>No prayers yet</p>';
      block.appendChild(e);
    } else {
      prayers.forEach(p => {
        const log = logs.find(l => l.prayer_id === p.id);
        const count = log?.count || 0;
        const card = el('div', 'card');
        card.innerHTML = `
          <div class="card-row">
            <div class="card-title" style="flex:1">${p.title}</div>
            <button class="prayer-count-btn" data-pid="${p.id}">
              <span class="prayer-count">${count}</span>
              <span style="font-size:11px;color:var(--text2)">× today</span>
            </button>
          </div>
          ${p.text ? `<div class="prayer-text">${p.text}</div>` : ''}
        `;
        card.querySelector('.prayer-count-btn').addEventListener('click', async () => {
          await PrayersSection.logPrayer(p.id, today, log);
          TodaySection.render();
        });
        block.appendChild(card);
      });
    }

    content.appendChild(block);
  },

  async renderJournal(content, today) {
    const block = el('div', 'today-section-block');
    const titleRow = el('div', 'today-section-title');
    titleRow.innerHTML = `<span>JOURNAL</span><a class="text-link" href="#" data-nav="journal">All →</a>`;
    block.appendChild(titleRow);

    const entries = await DB.getAll('journal_entries');
    const todayEntry = entries.find(e => e.date === today && !e.deleted_at);

    const card = el('div', 'card');
    if (todayEntry) {
      card.innerHTML = `
        <div class="card-title">${todayEntry.title || 'Today's Entry'}</div>
        <div class="card-meta" style="margin-top:4px;line-height:1.5;color:var(--text2);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${todayEntry.body || ''}</div>
        <button class="btn-secondary" style="margin-top:10px;font-size:13px" data-edit-journal="${todayEntry.id}">Edit entry →</button>
      `;
      card.querySelector('[data-edit-journal]').addEventListener('click', () => App.navigate('journal'));
    } else {
      card.innerHTML = `
        <div class="card-meta">No entry yet for today</div>
        <button class="btn-primary" style="margin-top:10px;font-size:13px;padding:9px 16px" id="today-journal-btn">Write today's entry →</button>
      `;
      card.querySelector('#today-journal-btn').addEventListener('click', () => App.navigate('journal'));
    }
    block.appendChild(card);
    content.appendChild(block);
  }
};
