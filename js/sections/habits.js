/* ============================================================
   habits.js - Habits section with daily logging and trend score cards
   ============================================================ */

const HabitsSection = {
  viewDate: null,

  async render() {
    this.viewDate = this.viewDate || localDate();
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.className = 'section-page fade-in';

    const header = el('div', 'section-header');
    header.innerHTML = `
      <div>
        <div class="section-title">Habits</div>
        <div class="section-date">Daily tracking</div>
      </div>
    `;
    content.appendChild(header);

    const dateNav = el('div', 'filter-row');
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      days.push({ ds, d });
    }

    days.forEach(({ ds, d }) => {
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const chip = el('div', `filter-chip${this.viewDate === ds ? ' active' : ''}`);
      chip.innerHTML = `<div style="font-size:10px">${dayName}</div><div style="font-size:14px;font-weight:500">${dayNum}</div>`;
      chip.addEventListener('click', () => {
        this.viewDate = ds;
        HabitsSection.render();
      });
      dateNav.appendChild(chip);
    });
    content.appendChild(dateNav);

    const habits = (await DB.getLive('habits')).filter(h => !h.archived_at);
    const logs = (await DB.getAll('habit_logs')).filter(l => l.date === this.viewDate && !l.deleted_at);

    const dueHabits = habits.filter(h => isHabitDueOnDate(h, this.viewDate));
    const done = logs.filter(l => l.status === 'SUCCESS' && dueHabits.some(h => h.id === l.habit_id)).length;
    const total = dueHabits.length;

    if (total > 0) {
      const summary = el('div', 'card');
      summary.style.marginBottom = '16px';
      const pct = Math.round((done / total) * 100);
      summary.innerHTML = `
        <div class="card-row">
          <div class="card-title">${done}/${total} habits completed</div>
          <span class="badge ${pct === 100 ? 'badge-green' : pct >= 50 ? 'badge-yellow' : ''}">${pct}%</span>
        </div>
        <div class="checkin-progress">
          <div class="checkin-progress-fill" style="width:${pct}%;background:${pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)'}"></div>
        </div>
      `;
      content.appendChild(summary);
    }

    const isEditable = (() => {
      const vd = new Date(this.viewDate);
      const now = new Date();
      const diffDays = Math.floor((now - vd) / 86400000);
      return diffDays <= 7;
    })();

    if (habits.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">🌱</div><p>No habits yet. Add habits to track your daily practices.</p>';
      content.appendChild(e);
    } else {
      habits.forEach(h => {
        const log = logs.find(l => l.habit_id === h.id);
        const isDue = isHabitDueOnDate(h, this.viewDate);
        const row = el('div', 'habit-row');
        row.innerHTML = `
          <div>
            <div class="habit-name">${h.title}</div>
            ${h.description ? `<div class="card-meta" style="margin-top:2px">${h.description}</div>` : ''}
            ${!isDue ? `<div class="card-meta" style="margin-top:2px">Starts ${habitFirstDueDate(h)}</div>` : ''}
          </div>
          <div class="habit-btns">
            <button class="habit-btn ${log?.status === 'SUCCESS' ? 'success' : ''}" ${(!isEditable || !isDue) ? 'disabled' : ''} data-hid="${h.id}" data-status="SUCCESS" title="Success">✓</button>
            <button class="habit-btn ${log?.status === 'FAIL' ? 'fail' : ''}" ${(!isEditable || !isDue) ? 'disabled' : ''} data-hid="${h.id}" data-status="FAIL" title="Failed">✕</button>
            <button class="habit-btn ${log?.status === 'NA' ? 'na' : ''}" ${(!isEditable || !isDue) ? 'disabled' : ''} data-hid="${h.id}" data-status="NA" title="N/A">-</button>
            <button class="icon-btn" data-action="trend-habit" data-id="${h.id}" title="Trends" style="margin-left:4px;color:var(--text3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            </button>
            <button class="icon-btn" data-action="edit-habit" data-id="${h.id}" title="Edit" style="color:var(--text3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn" data-action="delete-habit" data-id="${h.id}" title="Delete" style="color:var(--text3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `;

        if (isEditable && isDue) {
          row.querySelectorAll('[data-status]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const status = btn.dataset.status;
              const newStatus = log?.status === status ? null : status;
              await HabitsSection.logHabit(h.id, this.viewDate, newStatus, log);
              HabitsSection.render();
            });
          });
        }

        row.querySelector('[data-action="trend-habit"]').addEventListener('click', () => HabitsSection.showTrendModal(h));
        row.querySelector('[data-action="edit-habit"]').addEventListener('click', () => HabitsSection.showEditModal(h));
        row.querySelector('[data-action="delete-habit"]').addEventListener('click', () => HabitsSection.deleteHabit(h));
        content.appendChild(row);
      });

      if (!isEditable) {
        const note = el('div', 'card-meta', 'Logs older than 7 days cannot be edited.');
        note.style.cssText = 'text-align:center;padding:8px;color:var(--text3)';
        content.appendChild(note);
      }
    }

    const fab = el('button', 'fab', '+');
    fab.addEventListener('click', () => HabitsSection.showAddModal());
    document.body.appendChild(fab);
    content._cleanup = () => fab.remove();
  },

  addDays(dateStr, delta) {
    const d = new Date(`${dateStr}T12:00:00`);
    d.setDate(d.getDate() + delta);
    return d.toISOString().split('T')[0];
  },

  getRangeStart(firstDue, today, windowDays) {
    if (!windowDays) return firstDue;
    const candidate = HabitsSection.addDays(today, -(windowDays - 1));
    return firstDue > candidate ? firstDue : candidate;
  },

  computeTrendStats(habit, allLogs, windowDays = null) {
    const today = localDate();
    const firstDue = habitFirstDueDate(habit);
    if (firstDue > today) {
      return { dueDays: 0, success: 0, fail: 0, na: 0, missed: 0, tracked: 0, scorePct: 0 };
    }

    const start = HabitsSection.getRangeStart(firstDue, today, windowDays);
    const byDate = new Map();
    allLogs.forEach(l => {
      if (!byDate.has(l.date)) byDate.set(l.date, l.status);
    });

    let dueDays = 0;
    let success = 0;
    let fail = 0;
    let na = 0;

    let cur = start;
    while (cur <= today) {
      dueDays += 1;
      const st = byDate.get(cur);
      if (st === 'SUCCESS') success += 1;
      else if (st === 'FAIL') fail += 1;
      else if (st === 'NA') na += 1;
      cur = HabitsSection.addDays(cur, 1);
    }

    const tracked = success + fail + na;
    const missed = Math.max(0, dueDays - tracked);
    const scorePct = dueDays > 0 ? Math.round((success / dueDays) * 100) : 0;

    return { dueDays, success, fail, na, missed, tracked, scorePct };
  },

  trendCellClass(status, isDue) {
    if (!isDue) return 'none';
    if (status === 'SUCCESS') return 'success';
    if (status === 'FAIL') return 'fail';
    if (status === 'NA') return 'na';
    return 'missed';
  },

  async showTrendModal(habit) {
    const logs = (await DB.getAll('habit_logs'))
      .filter(l => l.habit_id === habit.id && !l.deleted_at)
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    const byDate = new Map();
    logs.forEach(l => {
      if (!byDate.has(l.date)) byDate.set(l.date, l.status);
    });

    const score7 = HabitsSection.computeTrendStats(habit, logs, 7);
    const score30 = HabitsSection.computeTrendStats(habit, logs, 30);
    const scoreAll = HabitsSection.computeTrendStats(habit, logs, null);

    const today = localDate();
    const stripDays = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = HabitsSection.addDays(today, -i);
      const isDue = date >= habitFirstDueDate(habit);
      const status = isDue ? byDate.get(date) : null;
      stripDays.push({ date, status, isDue });
    }

    const cardsHtml = [
      { label: '7 Days', data: score7 },
      { label: '30 Days', data: score30 },
      { label: 'All Time', data: scoreAll }
    ].map(c => `
      <div class="score-card">
        <div class="score-label">${c.label}</div>
        <div class="score-value">${c.data.scorePct}%</div>
        <div class="score-meta">${c.data.success}/${c.data.dueDays} success</div>
      </div>
    `).join('');

    const stripHtml = stripDays.map(d => `
      <div class="trend-cell ${HabitsSection.trendCellClass(d.status, d.isDue)}" title="${d.date}: ${!d.isDue ? 'Not due yet' : (d.status || 'Missed')}" ></div>
    `).join('');

    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${habit.title} - Trends</div>
      <div class="score-grid">${cardsHtml}</div>
      <div class="card-meta" style="margin-top:12px">Recent 14 days</div>
      <div class="trend-strip">${stripHtml}</div>
      <div class="card-meta" style="margin-top:10px">Legend: green=success, red=fail, blue=N/A, gray=missed.</div>
      <div class="form-actions">
        <button class="btn-secondary" id="h-trend-close">Close</button>
      </div>
    `;

    openModal(html);
    document.getElementById('h-trend-close').addEventListener('click', closeModal);
  },

  async logHabit(habitId, date, status, existingLog) {
    if (!status) {
      if (existingLog) {
        existingLog.deleted_at = nowISO();
        existingLog.updated_at = nowISO();
        await DB.put('habit_logs', existingLog);
      }
      syncAll({ forcePull: false });
      return;
    }

    if (existingLog) {
      existingLog.status = status;
      existingLog.updated_at = nowISO();
      existingLog.deleted_at = null;
      await DB.put('habit_logs', existingLog);
    } else {
      await DB.put('habit_logs', {
        id: uuid(),
        habit_id: habitId,
        date,
        status,
        created_at: nowISO(),
        updated_at: nowISO(),
        deleted_at: null
      });
    }
    syncAll({ forcePull: false });
  },

  showAddModal() {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">New Habit</div>
      <div class="form-row"><label>Title</label><input type="text" id="h-title" placeholder="e.g. Morning meditation" /></div>
      <div class="form-row"><label>Description (optional)</label><input type="text" id="h-desc" placeholder="Short description" /></div>
      <div class="form-row"><label>First due date (optional)</label><input type="date" id="h-first-due" value="${localDate()}" /></div>
      <div class="form-row"><label>Labels</label>${labelsHTML()}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="h-cancel">Cancel</button>
        <button class="btn-primary" id="h-save">Save</button>
      </div>
    `;
    openModal(html);
    let labelEditor;
    initLabelEditor(document.getElementById('modal-content'), []).then(le => { labelEditor = le; });
    document.getElementById('h-cancel').addEventListener('click', closeModal);
    document.getElementById('h-save').addEventListener('click', async () => {
      const title = document.getElementById('h-title').value.trim();
      if (!title) {
        showToast('Title required');
        return;
      }

      const obj = {
        id: uuid(),
        title,
        description: document.getElementById('h-desc').value.trim(),
        first_due_date: document.getElementById('h-first-due').value || localDate(),
        labels: labelEditor ? labelEditor.getSelected() : [],
        created_at: nowISO(),
        updated_at: nowISO(),
        archived_at: null,
        deleted_at: null
      };
      await DB.put('habits', obj);
      closeModal();
      showToast('Habit added');
      HabitsSection.render();
      syncAll({ forcePull: false });
    });
  },

  showEditModal(h) {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">Edit Habit</div>
      <div class="form-row"><label>Title</label><input type="text" id="h-title" value="${h.title}" /></div>
      <div class="form-row"><label>Description</label><input type="text" id="h-desc" value="${h.description || ''}" /></div>
      <div class="form-row"><label>First due date</label><input type="date" id="h-first-due" value="${habitFirstDueDate(h)}" /></div>
      <div class="form-row"><label>Labels</label>${labelsHTML()}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="h-cancel">Cancel</button>
        <button class="btn-primary" id="h-save">Save</button>
      </div>
    `;

    openModal(html);
    let labelEditor;
    initLabelEditor(document.getElementById('modal-content'), h.labels || []).then(le => { labelEditor = le; });
    document.getElementById('h-cancel').addEventListener('click', closeModal);
    document.getElementById('h-save').addEventListener('click', async () => {
      h.title = document.getElementById('h-title').value.trim();
      h.description = document.getElementById('h-desc').value.trim();
      h.first_due_date = document.getElementById('h-first-due').value || localDate();
      h.labels = labelEditor ? labelEditor.getSelected() : h.labels;
      h.updated_at = nowISO();
      await DB.put('habits', h);
      closeModal();
      showToast('Habit updated');
      HabitsSection.render();
      syncAll({ forcePull: false });
    });
  },

  async deleteHabit(h) {
    h.deleted_at = nowISO();
    h.updated_at = nowISO();
    await DB.put('habits', h);
    HabitsSection.render();
    showUndo(`Deleted "${h.title}"`, async () => {
      h.deleted_at = null;
      h.updated_at = nowISO();
      await DB.put('habits', h);
    });
    syncAll({ forcePull: false });
  }
};
