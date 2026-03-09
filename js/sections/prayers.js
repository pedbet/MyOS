/* ============================================================
   prayers.js - Prayers section
   ============================================================ */

const PrayersSection = {
  async render() {
    const today = localDate();
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.className = 'section-page fade-in';

    const header = el('div', 'section-header');
    header.innerHTML = `
      <div>
        <div class="section-title">Prayers</div>
        <div class="section-date">${new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'})}</div>
      </div>
    `;
    content.appendChild(header);

    const prayers = await DB.getLive('prayers');
    const logs = (await DB.getAll('prayer_logs')).filter(l => l.date === today && !l.deleted_at);

    if (prayers.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">🙏</div><p>No prayers yet. Add a prayer to track your practice.</p>';
      content.appendChild(e);
    } else {
      prayers.forEach(p => {
        const log = logs.find(l => l.prayer_id === p.id);
        const count = log?.count || 0;
        const card = el('div', 'card');
        card.innerHTML = `
          <div class="card-row" style="align-items:flex-start">
            <div style="flex:1">
              <button class="icon-btn" data-action="quick-view" data-id="${p.id}" style="padding:0;color:var(--text);font-size:15px;justify-content:flex-start">
                ${p.title}
              </button>
              ${p.text ? `<div class="prayer-text">${p.text}</div>` : ''}
              ${p.labels?.length ? `<div class="labels-wrap" style="margin-top:6px">${p.labels.map(l=>`<span class="label-chip">${l}</span>`).join('')}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
              <div style="display:flex;align-items:center;gap:6px">
                <button class="icon-btn" data-action="dec" data-id="${p.id}" title="Decrease">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button class="prayer-count-btn" data-action="inc" data-id="${p.id}">
                  <span class="prayer-count">${count}</span>
                  <span style="font-size:11px;color:var(--text2)">today</span>
                </button>
              </div>
              <div style="display:flex;gap:4px">
                <button class="icon-btn" data-action="quick-view" data-id="${p.id}" title="Quick view">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="icon-btn" data-action="edit" data-id="${p.id}" title="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="icon-btn" data-action="history" data-id="${p.id}" title="History">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </button>
                <button class="icon-btn" data-action="delete" data-id="${p.id}" style="color:var(--text3)" title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;

        card.querySelectorAll('[data-action="quick-view"]').forEach(btn => {
          btn.addEventListener('click', () => PrayersSection.showQuickView(p));
        });
        card.querySelector('[data-action="inc"]').addEventListener('click', async () => {
          await PrayersSection.logPrayer(p.id, today, log, 1);
          PrayersSection.render();
        });
        card.querySelector('[data-action="dec"]').addEventListener('click', async () => {
          await PrayersSection.logPrayer(p.id, today, log, -1);
          PrayersSection.render();
        });
        card.querySelector('[data-action="edit"]').addEventListener('click', () => PrayersSection.showEditModal(p));
        card.querySelector('[data-action="history"]').addEventListener('click', () => PrayersSection.showHistory(p));
        card.querySelector('[data-action="delete"]').addEventListener('click', () => PrayersSection.deletePrayer(p));
        content.appendChild(card);
      });
    }

    const fab = el('button', 'fab', '+');
    fab.addEventListener('click', () => PrayersSection.showAddModal());
    document.body.appendChild(fab);
    content._cleanup = () => fab.remove();
  },

  async logPrayer(prayerId, date, existingLog, delta = 1) {
    const current = existingLog?.count || 0;
    const next = Math.max(0, current + delta);
    await PrayersSection.setPrayerCount(prayerId, date, next, existingLog, { sync: true });
  },

  async setPrayerCount(prayerId, date, nextCount, existingLog, options = {}) {
    const { sync = true } = options;
    const count = Math.max(0, parseInt(nextCount, 10) || 0);

    if (existingLog) {
      if (count === 0) {
        existingLog.deleted_at = nowISO();
        existingLog.updated_at = nowISO();
      } else {
        existingLog.count = count;
        existingLog.updated_at = nowISO();
        existingLog.deleted_at = null;
      }
      await DB.put('prayer_logs', existingLog);
    } else if (count > 0) {
      await DB.put('prayer_logs', {
        id: uuid(),
        prayer_id: prayerId,
        date,
        count,
        created_at: nowISO(),
        updated_at: nowISO(),
        deleted_at: null
      });
    }

    if (sync) syncAll({ forcePull: false });
  },

  showQuickView(p) {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${p.title}</div>
      <div class="card-meta" style="line-height:1.7;white-space:pre-wrap;color:var(--text);max-height:50dvh;overflow-y:auto">${p.text || 'No prayer text saved yet.'}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="p-view-close">Close</button>
      </div>
    `;
    openModal(html);
    document.getElementById('p-view-close').addEventListener('click', closeModal);
  },

  showAddModal() {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">New Prayer</div>
      <div class="form-row"><label>Title</label><input type="text" id="p-title" placeholder="Prayer name" /></div>
      <div class="form-row"><label>Text (optional)</label><textarea id="p-text" placeholder="Prayer text..."></textarea></div>
      <div class="form-row"><label>Labels</label>${labelsHTML()}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="p-cancel">Cancel</button>
        <button class="btn-primary" id="p-save">Save</button>
      </div>
    `;
    openModal(html);
    let labelEditor;
    initLabelEditor(document.getElementById('modal-content'), []).then(le => { labelEditor = le; });
    document.getElementById('p-cancel').addEventListener('click', closeModal);
    document.getElementById('p-save').addEventListener('click', async () => {
      const title = document.getElementById('p-title').value.trim();
      if (!title) {
        showToast('Title required');
        return;
      }
      const obj = {
        id: uuid(),
        title,
        text: document.getElementById('p-text').value.trim(),
        labels: labelEditor ? labelEditor.getSelected() : [],
        created_at: nowISO(),
        updated_at: nowISO(),
        deleted_at: null
      };
      await DB.put('prayers', obj);
      closeModal();
      showToast('Prayer added');
      PrayersSection.render();
      syncAll({ forcePull: false });
    });
  },

  async showEditModal(p) {
    const today = localDate();
    const logs = await DB.getAll('prayer_logs');
    const todayLog = logs.find(l => l.prayer_id === p.id && l.date === today && !l.deleted_at);
    const todayCount = todayLog?.count || 0;

    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">Edit Prayer</div>
      <div class="form-row"><label>Title</label><input type="text" id="p-title" value="${p.title}" /></div>
      <div class="form-row"><label>Text</label><textarea id="p-text">${p.text || ''}</textarea></div>
      <div class="form-row"><label>Today's Count</label><input type="number" id="p-today-count" min="0" value="${todayCount}" /></div>
      <div class="form-row"><label>Labels</label>${labelsHTML()}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="p-cancel">Cancel</button>
        <button class="btn-primary" id="p-save">Save</button>
      </div>
    `;

    openModal(html);
    let labelEditor;
    initLabelEditor(document.getElementById('modal-content'), p.labels || []).then(le => { labelEditor = le; });
    document.getElementById('p-cancel').addEventListener('click', closeModal);
    document.getElementById('p-save').addEventListener('click', async () => {
      p.title = document.getElementById('p-title').value.trim();
      p.text = document.getElementById('p-text').value.trim();
      p.labels = labelEditor ? labelEditor.getSelected() : p.labels;
      p.updated_at = nowISO();

      const manualCount = parseInt(document.getElementById('p-today-count').value, 10);
      await DB.put('prayers', p);
      await PrayersSection.setPrayerCount(p.id, today, manualCount, todayLog, { sync: false });

      closeModal();
      showToast('Updated');
      PrayersSection.render();
      syncAll({ forcePull: false });
    });
  },

  async showHistory(p) {
    const logs = (await DB.getAll('prayer_logs'))
      .filter(l => l.prayer_id === p.id && !l.deleted_at)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 30);

    const rows = logs.length === 0
      ? '<div class="empty-state"><p>No history yet</p></div>'
      : logs.map(l => `
          <div class="settings-row">
            <span class="settings-label">${l.date}</span>
            <span class="settings-value">${l.count}x</span>
          </div>`).join('');

    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">${p.title} - History</div>
      ${rows}
      <div class="form-actions"><button class="btn-secondary" id="hist-close">Close</button></div>
    `;
    openModal(html);
    document.getElementById('hist-close').addEventListener('click', closeModal);
  },

  async deletePrayer(p) {
    p.deleted_at = nowISO();
    p.updated_at = nowISO();
    await DB.put('prayers', p);
    PrayersSection.render();
    showUndo(`Deleted "${p.title}"`, async () => {
      p.deleted_at = null;
      p.updated_at = nowISO();
      await DB.put('prayers', p);
    });
    syncAll({ forcePull: false });
  }
};
