/* ============================================================
   journal.js — Journal section with daily entries
   ============================================================ */

const JournalSection = {
  view: 'today', // 'today' | 'list'
  editingId: null,
  autoSaveTimer: null,

  async render() {
    const today = localDate();
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.className = 'section-page fade-in';

    const header = el('div', 'section-header');
    header.innerHTML = `
      <div>
        <div class="section-title">Journal</div>
        <div class="section-date">${new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'})}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-secondary" id="j-today-btn" style="font-size:12px;padding:6px 12px">Today</button>
        <button class="btn-secondary" id="j-list-btn" style="font-size:12px;padding:6px 12px">All Entries</button>
      </div>
    `;
    content.appendChild(header);

    document.getElementById('j-today-btn').addEventListener('click', () => { this.view = 'today'; JournalSection.render(); });
    document.getElementById('j-list-btn').addEventListener('click', () => { this.view = 'list'; JournalSection.render(); });

    if (this.view === 'today') {
      await this.renderTodayEditor(content, today);
    } else {
      await this.renderList(content, today);
    }
  },

  async renderTodayEditor(content, today) {
    const entries = await DB.getAll('journal_entries');
    const existing = entries.find(e => e.date === today && !e.deleted_at);

    const editor = el('div', 'journal-editor');
    editor.innerHTML = `
      <input type="text" id="j-title" placeholder="Title (optional)" value="${existing?.title || ''}" />
      <textarea id="j-body" placeholder="Write your thoughts for today...">${existing?.body || ''}</textarea>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span id="j-save-status" style="font-size:12px;color:var(--text3)">
          ${existing ? `Last saved ${formatRelative(existing.updated_at)}` : 'Not yet saved'}
        </span>
        <button class="btn-primary" id="j-save-btn" style="padding:9px 20px;width:auto">Save</button>
      </div>
    `;
    content.appendChild(editor);

    const titleInput = document.getElementById('j-title');
    const bodyInput = document.getElementById('j-body');
    const saveStatus = document.getElementById('j-save-status');

    const save = async (auto = false) => {
      const title = titleInput.value.trim();
      const body = bodyInput.value.trim();
      if (!body && !title) return;

      if (existing) {
        existing.title = title;
        existing.body = body;
        existing.updated_at = nowISO();
        await DB.put('journal_entries', existing);
        saveStatus.textContent = auto ? 'Auto-saved' : 'Saved ✓';
      } else {
        const obj = {
          id: uuid(), date: today, title, body,
          created_at: nowISO(), updated_at: nowISO(), deleted_at: null
        };
        await DB.put('journal_entries', obj);
        // Update reference
        Object.assign(existing || {}, obj);
        if (!entries.find(e => e.date === today)) entries.push(obj);
        saveStatus.textContent = auto ? 'Auto-saved' : 'Saved ✓';
      }
      if (!auto) showToast('Entry saved');
      syncAll();
    };

    // Auto-save on change
    const scheduleAutoSave = () => {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = setTimeout(() => save(true), 2000);
    };
    titleInput.addEventListener('input', scheduleAutoSave);
    bodyInput.addEventListener('input', scheduleAutoSave);
    document.getElementById('j-save-btn').addEventListener('click', () => save(false));
  },

  async renderList(content, today) {
    const entries = (await DB.getAll('journal_entries'))
      .filter(e => !e.deleted_at)
      .sort((a, b) => b.date.localeCompare(a.date));

    if (entries.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">📔</div><p>No journal entries yet.</p>';
      content.appendChild(e);
      return;
    }

    entries.forEach(entry => {
      const card = el('div', 'card');
      const isToday = entry.date === today;
      card.innerHTML = `
        <div class="card-row">
          <div style="flex:1">
            <div class="card-title">${entry.title || (isToday ? "Today's Entry" : entry.date)}</div>
            <div class="card-meta">${formatDate(entry.date + 'T12:00:00')} ${isToday ? '· <span style="color:var(--accent)">Today</span>' : ''}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="icon-btn" data-action="edit" data-id="${entry.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn" data-action="delete" data-id="${entry.id}" style="color:var(--text3)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        ${entry.body ? `<div class="card-meta" style="margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${entry.body}</div>` : ''}
      `;
      card.querySelector('[data-action="edit"]').addEventListener('click', () => {
        JournalSection.showEditModal(entry);
      });
      card.querySelector('[data-action="delete"]').addEventListener('click', () => {
        JournalSection.deleteEntry(entry);
      });
      content.appendChild(card);
    });
  },

  showEditModal(entry) {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${entry.date}</div>
      <div class="journal-editor">
        <input type="text" id="je-title" placeholder="Title (optional)" value="${entry.title || ''}" />
        <textarea id="je-body" style="min-height:250px">${entry.body || ''}</textarea>
      </div>
      <div class="form-actions">
        <button class="btn-secondary" id="je-cancel">Cancel</button>
        <button class="btn-primary" id="je-save">Save</button>
      </div>
    `;
    openModal(html);
    document.getElementById('je-cancel').addEventListener('click', closeModal);
    document.getElementById('je-save').addEventListener('click', async () => {
      const before = { ...entry };
      entry.title = document.getElementById('je-title').value.trim();
      entry.body = document.getElementById('je-body').value.trim();
      entry.updated_at = nowISO();
      await DB.put('journal_entries', entry);
      closeModal();
      showToast('Entry saved');
      JournalSection.render();
      syncAll();
    });
  },

  async deleteEntry(entry) {
    const before = { ...entry };
    entry.deleted_at = nowISO();
    entry.updated_at = nowISO();
    await DB.put('journal_entries', entry);
    JournalSection.render();
    showUndo(`Deleted entry for ${entry.date}`, async () => {
      entry.deleted_at = null;
      entry.updated_at = nowISO();
      await DB.put('journal_entries', entry);
    });
    syncAll();
  }
};
