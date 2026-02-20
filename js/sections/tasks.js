/* ============================================================
   tasks.js — Tasks section
   ============================================================ */

const TasksSection = {
  showCompleted: false,
  filter: 'all',

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.className = 'section-page fade-in';

    const header = el('div', 'section-header');
    header.innerHTML = `
      <div>
        <div class="section-title">Tasks</div>
        <div class="section-date">All open tasks</div>
      </div>
    `;
    content.appendChild(header);

    let allTasks = await DB.getLive('tasks');
    let open = allTasks.filter(t => t.status === 'OPEN');
    let done = allTasks.filter(t => t.status === 'DONE');

    open.sort((a, b) => {
      const aOv = a.due_at && new Date(a.due_at) < new Date() ? 0 : 1;
      const bOv = b.due_at && new Date(b.due_at) < new Date() ? 0 : 1;
      if (aOv !== bOv) return aOv - bOv;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    if (open.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">✓</div><p>No open tasks. Great work!</p>';
      content.appendChild(e);
    } else {
      open.forEach(t => content.appendChild(TasksSection.renderCard(t)));
    }

    // Completed toggle
    const toggleWrap = el('div', 'completed-section');
    const toggleBtn = el('button', 'toggle-completed', `${this.showCompleted ? '▼' : '▶'} Completed (${done.length})`);
    toggleBtn.addEventListener('click', () => {
      this.showCompleted = !this.showCompleted;
      TasksSection.render();
    });
    toggleWrap.appendChild(toggleBtn);

    if (this.showCompleted) {
      done.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).slice(0, 20).forEach(t => {
        toggleWrap.appendChild(TasksSection.renderCard(t, true));
      });
    }
    content.appendChild(toggleWrap);

    const fab = el('button', 'fab', '+');
    fab.addEventListener('click', () => TasksSection.showAddModal());
    document.body.appendChild(fab);
    content._cleanup = () => fab.remove();
  },

  renderCard(t, isDone = false) {
    const days = daysOpen(t.created_at);
    const overdue = t.status === 'OPEN' && t.due_at && new Date(t.due_at) < new Date();
    const daysCls = days > 14 ? 'days-open very-old' : days > 7 ? 'days-open old' : 'days-open';
    const card = el('div', `card${isDone ? ' task-done' : ''}`);

    let metaParts = [];
    if (overdue) metaParts.push(`<span style="color:var(--red)">Overdue</span>`);
    if (t.due_at) metaParts.push(`Due ${formatDate(t.due_at)}`);
    if (!isDone) metaParts.push(`<span class="${daysCls}">${days}d open</span>`);
    if (isDone && t.completed_at) metaParts.push(`Done ${formatRelative(t.completed_at)}`);

    card.innerHTML = `
      <div class="card-row">
        <div class="checkbox-wrap" style="flex:1;cursor:pointer" data-task-id="${t.id}">
          <div class="checkbox ${isDone ? 'checked' : ''}"></div>
          <div>
            <div class="card-title">${t.title}</div>
            <div class="card-meta">${metaParts.join(' · ')}</div>
          </div>
        </div>
        ${!isDone ? `<button class="icon-btn" data-action="edit" data-id="${t.id}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>` : ''}
        <button class="icon-btn" data-action="delete" data-id="${t.id}" title="Delete" style="color:var(--text3)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
      ${t.notes ? `<div class="card-meta" style="margin-top:6px">${t.notes}</div>` : ''}
      ${t.labels?.length ? `<div class="labels-wrap" style="margin-top:6px">${t.labels.map(l => `<span class="label-chip">${l}</span>`).join('')}</div>` : ''}
    `;

    const checkWrap = card.querySelector('.checkbox-wrap');
    if (checkWrap) {
      checkWrap.addEventListener('click', async () => {
        if (isDone) {
          await TasksSection.reopenTask(t.id);
        } else {
          await TasksSection.completeTask(t.id);
        }
        TasksSection.render();
      });
    }

    const editBtn = card.querySelector('[data-action="edit"]');
    if (editBtn) editBtn.addEventListener('click', () => TasksSection.showEditModal(t));

    card.querySelector('[data-action="delete"]').addEventListener('click', () => TasksSection.deleteTask(t));
    return card;
  },

  async completeTask(id) {
    const t = await DB.get('tasks', id);
    const before = { ...t };
    t.status = 'DONE';
    t.completed_at = nowISO();
    t.updated_at = nowISO();
    await DB.put('tasks', t);
    await logAction('complete', 'tasks', id, before, t);
    showToast('Task completed ✓');
    syncAll();
  },

  async reopenTask(id) {
    const t = await DB.get('tasks', id);
    t.status = 'OPEN';
    t.completed_at = null;
    t.updated_at = nowISO();
    await DB.put('tasks', t);
    showToast('Task reopened');
    syncAll();
  },

  showAddModal(onDone) {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">New Task</div>
      <div class="form-row"><label>Title</label><input type="text" id="t-title" placeholder="What needs to be done?" /></div>
      <div class="form-row"><label>Notes (optional)</label><textarea id="t-notes" placeholder="Details..."></textarea></div>
      <div class="form-row"><label>Due date (optional)</label><input type="date" id="t-due" /></div>
      <div class="form-row"><label>Labels</label>${labelsHTML()}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="t-cancel">Cancel</button>
        <button class="btn-primary" id="t-save">Save</button>
      </div>
    `;
    openModal(html, onDone);
    let labelEditor;
    initLabelEditor(document.getElementById('modal-content'), []).then(le => { labelEditor = le; });
    document.getElementById('t-cancel').addEventListener('click', closeModal);
    document.getElementById('t-save').addEventListener('click', async () => {
      const title = document.getElementById('t-title').value.trim();
      if (!title) { showToast('Title required'); return; }
      const due = document.getElementById('t-due').value;
      const obj = {
        id: uuid(), title,
        notes: document.getElementById('t-notes').value.trim(),
        status: 'OPEN',
        due_at: due ? new Date(due).toISOString() : null,
        labels: labelEditor ? labelEditor.getSelected() : [],
        created_at: nowISO(), updated_at: nowISO(),
        completed_at: null, deleted_at: null
      };
      await DB.put('tasks', obj);
      await logAction('create', 'tasks', obj.id, null, obj);
      closeModal();
      showToast('Task added');
      if (onDone) onDone(); else TasksSection.render();
      syncAll();
    });
  },

  showEditModal(t) {
    const dueVal = t.due_at ? new Date(t.due_at).toISOString().split('T')[0] : '';
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">Edit Task</div>
      <div class="form-row"><label>Title</label><input type="text" id="t-title" value="${t.title}" /></div>
      <div class="form-row"><label>Notes</label><textarea id="t-notes">${t.notes || ''}</textarea></div>
      <div class="form-row"><label>Due date</label><input type="date" id="t-due" value="${dueVal}" /></div>
      <div class="form-row"><label>Labels</label>${labelsHTML()}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="t-cancel">Cancel</button>
        <button class="btn-primary" id="t-save">Save</button>
      </div>
    `;
    openModal(html);
    let labelEditor;
    initLabelEditor(document.getElementById('modal-content'), t.labels || []).then(le => { labelEditor = le; });
    document.getElementById('t-cancel').addEventListener('click', closeModal);
    document.getElementById('t-save').addEventListener('click', async () => {
      const before = { ...t };
      t.title = document.getElementById('t-title').value.trim();
      t.notes = document.getElementById('t-notes').value.trim();
      const due = document.getElementById('t-due').value;
      t.due_at = due ? new Date(due).toISOString() : null;
      t.labels = labelEditor ? labelEditor.getSelected() : t.labels;
      t.updated_at = nowISO();
      await DB.put('tasks', t);
      await logAction('update', 'tasks', t.id, before, t);
      closeModal();
      showToast('Task updated');
      TasksSection.render();
      syncAll();
    });
  },

  async deleteTask(t) {
    const before = { ...t };
    t.deleted_at = nowISO();
    t.updated_at = nowISO();
    await DB.put('tasks', t);
    TasksSection.render();
    showUndo(`Deleted "${t.title}"`, async () => {
      t.deleted_at = null;
      t.updated_at = nowISO();
      await DB.put('tasks', t);
    });
    syncAll();
  }
};
