/* ============================================================
   today.js - Today screen
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

    await TodaySection.renderCheckins(content);
    await TodaySection.renderTasks(content);
    await TodaySection.renderHabits(content, today);
    await TodaySection.renderPrayers(content, today);
    await TodaySection.renderJournal(content, today);

    const syncDiv = el('div', 'sync-status', '');
    syncDiv.id = 'sync-status';
    content.appendChild(syncDiv);
    if (typeof hydrateSyncStateFromConfig === 'function') hydrateSyncStateFromConfig();
  },

  async renderCheckins(content) {
    const block = el('div', 'today-section-block');
    const titleRow = el('div', 'today-section-title');
    titleRow.innerHTML = `<span>CHECK-INS</span><a class="text-link" href="#" data-nav="checkins">All →</a>`;
    block.appendChild(titleRow);

    const checkins = await DB.getLive('checkins');
    const urgent = checkins
      .filter(c => {
        const s = checkinStatus(c);
        return s === 'red' || s === 'yellow';
      })
      .sort((a, b) => {
        const order = { red: 0, yellow: 1, green: 2 };
        return order[checkinStatus(a)] - order[checkinStatus(b)];
      })
      .slice(0, 5);

    if (urgent.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">✓</div><p>All check-ins on track</p>';
      block.appendChild(e);
    } else {
      urgent.forEach(c => {
        const s = checkinStatus(c);
        const due = checkinNextDue(c);
        const card = el('div', 'card');
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
              <div class="card-meta">${overdue ? `<span style="color:var(--red)">Overdue · </span>` : ''}${t.due_at ? `Due ${formatDate(t.due_at)} · ` : ''}<span class="${daysCls}">${days}d open</span></div>
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

    const habits = (await DB.getLive('habits')).filter(h => !h.archived_at && isHabitDueOnDate(h, today));
    const logs = await DB.getAll('habit_logs');
    const todayLogs = logs.filter(l => l.date === today && !l.deleted_at);

    if (habits.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">🌱</div><p>No habits due today</p>';
      block.appendChild(e);
    } else {
      habits.forEach(h => {
        const log = todayLogs.find(l => l.habit_id === h.id);
        const row = el('div', 'habit-row');
        row.innerHTML = `
          <div class="habit-name">${h.title}</div>
          <div class="habit-btns">
            <button class="habit-btn ${log?.status === 'SUCCESS' ? 'success' : ''}" data-hid="${h.id}" data-status="SUCCESS" title="Done">✓</button>
            <button class="habit-btn ${log?.status === 'FAIL' ? 'fail' : ''}" data-hid="${h.id}" data-status="FAIL" title="Skip">✕</button>
            <button class="habit-btn ${log?.status === 'NA' ? 'na' : ''}" data-hid="${h.id}" data-status="NA" title="N/A">-</button>
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
          <div class="card-row" style="align-items:flex-start">
            <div style="flex:1">
              <button class="icon-btn" data-action="quick-view" style="padding:0;color:var(--text);font-size:15px;justify-content:flex-start">${p.title}</button>
              ${p.text ? `<div class="prayer-text">${p.text}</div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button class="icon-btn" data-action="dec" title="Decrease">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button class="prayer-count-btn" data-action="inc">
                <span class="prayer-count">${count}</span>
                <span style="font-size:11px;color:var(--text2)">x today</span>
              </button>
            </div>
          </div>
        `;
        card.querySelector('[data-action="quick-view"]').addEventListener('click', () => PrayersSection.showQuickView(p));
        card.querySelector('[data-action="inc"]').addEventListener('click', async () => {
          await PrayersSection.logPrayer(p.id, today, log, 1);
          TodaySection.render();
        });
        card.querySelector('[data-action="dec"]').addEventListener('click', async () => {
          await PrayersSection.logPrayer(p.id, today, log, -1);
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
    const todayEntries = entries
      .filter(e => e.date === today && !e.deleted_at)
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    const card = el('div', 'card');
    if (todayEntries.length > 0) {
      const latest = todayEntries[0];
      card.innerHTML = `
        <div class="card-title">${todayEntries.length} entr${todayEntries.length === 1 ? 'y' : 'ies'} today</div>
        <div class="card-meta" style="margin-top:4px;line-height:1.5;color:var(--text2);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${latest.body || latest.title || ''}</div>
        <button class="btn-secondary" style="margin-top:10px;font-size:13px" id="today-journal-open">Open journal →</button>
      `;
    } else {
      card.innerHTML = `
        <div class="card-meta">No entry yet for today</div>
        <button class="btn-primary" style="margin-top:10px;font-size:13px;padding:9px 16px" id="today-journal-open">Write entry →</button>
      `;
    }

    card.querySelector('#today-journal-open').addEventListener('click', () => App.navigate('journal'));
    block.appendChild(card);
    content.appendChild(block);
  }
};

