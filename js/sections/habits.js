/* ============================================================
   habits.js — Habits section with daily logging
   ============================================================ */

const HabitsSection = {
  viewDate: null,

  async render() {
    this.viewDate = this.viewDate || localDate();
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.className = 'section-page fade-in';

    const today = localDate();

    const header = el('div', 'section-header');
    header.innerHTML = `
      <div>
        <div class="section-title">Habits</div>
        <div class="section-date">Daily tracking</div>
      </div>
    `;
    content.appendChild(header);

    // Date navigation (7 days)
    const dateNav = el('div', 'filter-row');
    const days = [];
    for (let i = 6; i >= 0; i--) {
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
      chip.addEventListener('click', () => { this.viewDate = ds; HabitsSection.render(); });
      dateNav.appendChild(chip);
    });
    content.appendChild(dateNav);

    const habits = (await DB.getLive('habits')).filter(h => !h.archived_at);
    const logs = (await DB.getAll('habit_logs')).filter(l => l.date === this.viewDate && !l.deleted_at);

    // Summary
    const done = logs.filter(l => l.status === 'SUCCESS').length;
    const total = habits.length;
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
          <div class="checkin-progress-fill" style="width:${pct}%;background:${pct===100?'var(--green)':pct>=50?'var(--yellow)':'var(--red)'}"></div>
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
        const row = el('div', 'habit-row');
        row.innerHTML = `
          <div>
            <div class="habit-name">${h.title}</div>
            ${h.description ? `<div class="card-meta" style="margin-top:2px">${h.description}</div>` : ''}
          </div>
          <div class="habit-btns">
            <button class="habit-btn ${log?.status === 'SUCCESS' ? 'success' : ''}" ${!isEditable?'disabled':''} data-hid="${h.id}" data-status="SUCCESS" title="Success">✓</button>
            <button class="habit-btn ${log?.status === 'FAIL' ? 'fail' : ''}" ${!isEditable?'disabled':''} data-hid="${h.id}" data-status="FAIL" title="Failed">✗</button>
            <button class="habit-btn ${log?.status === 'NA' ? 'na' : ''}" ${!isEditable?'disabled':''} data-hid="${h.id}" data-status="NA" title="N/A">–</button>
            <button class="icon-btn" data-action="delete-habit" data-id="${h.id}" style="margin-left:4px;color:var(--text3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `;
        if (isEditable) {
          row.querySelectorAll('[data-status]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const status = btn.dataset.status;
              const newStatus = log?.status === status ? null : status;
              await HabitsSection.logHabit(h.id, this.viewDate, newStatus, log);
              HabitsSection.render();
            });
          });
        }
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

  async logHabit(habitId, date, status, existingLog) {
    if (!status) {
      if (existingLog) {
        existingLog.deleted_at = nowISO();
        existingLog.updated_at = nowISO();
        await DB.put('habit_logs', existingLog);
      }
      return;
    }
    if (existingLog) {
      existingLog.status = status;
      existingLog.updated_at = nowISO();
      existingLog.deleted_at = null;
      await DB.put('habit_logs', existingLog);
    } else {
      await DB.put('habit_logs', {
        id: uuid(), habit_id: habitId, date, status,
        created_at: nowISO(), updated_at: nowISO(), deleted_at: null
      });
    }
    syncAll();
  },

  showAddModal() {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">New Habit</div>
      <div class="form-row"><label>Title</label><input type="text" id="h-title" placeholder="e.g. Morning meditation" /></div>
      <div class="form-row"><label>Description (optional)</label><input type="text" id="h-desc" placeholder="Short description" /></div>
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
      if (!title) { showToast('Title required'); return; }
      const obj = {
        id: uuid(), title,
        description: document.getElementById('h-desc').value.trim(),
        labels: labelEditor ? labelEditor.getSelected() : [],
        created_at: nowISO(), updated_at: nowISO(),
        archived_at: null, deleted_at: null
      };
      await DB.put('habits', obj);
      closeModal();
      showToast('Habit added');
      HabitsSection.render();
      syncAll();
    });
  },

  async deleteHabit(h) {
    const before = { ...h };
    h.deleted_at = nowISO();
    h.updated_at = nowISO();
    await DB.put('habits', h);
    HabitsSection.render();
    showUndo(`Deleted "${h.title}"`, async () => {
      h.deleted_at = null;
      h.updated_at = nowISO();
      await DB.put('habits', h);
    });
    syncAll();
  }
};
