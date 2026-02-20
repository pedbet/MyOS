/* ============================================================
   checkins.js — Check-ins section
   ============================================================ */

const CheckinsSection = {
  filter: 'all',

  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.className = 'section-page fade-in';

    const header = el('div', 'section-header');
    header.innerHTML = `
      <div>
        <div class="section-title">Check-ins</div>
        <div class="section-date">Periodic activities</div>
      </div>
    `;
    content.appendChild(header);

    // Filter row
    const filterRow = el('div', 'filter-row');
    ['all','red','yellow','green'].forEach(f => {
      const chip = el('div', 'filter-chip' + (this.filter === f ? ' active' : ''), f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1));
      chip.addEventListener('click', () => { this.filter = f; this.render(); });
      filterRow.appendChild(chip);
    });
    content.appendChild(filterRow);

    let checkins = await DB.getLive('checkins');
    if (this.filter !== 'all') {
      checkins = checkins.filter(c => checkinStatus(c) === this.filter);
    }

    // Sort: red > yellow > green, then by time since anchor
    checkins.sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 };
      const sa = checkinStatus(a), sb = checkinStatus(b);
      if (order[sa] !== order[sb]) return order[sa] - order[sb];
      const anchorA = new Date(a.last_checkin_at || a.first_due_at || a.created_at);
      const anchorB = new Date(b.last_checkin_at || b.first_due_at || b.created_at);
      return anchorA - anchorB;
    });

    if (checkins.length === 0) {
      const e = el('div', 'empty-state');
      e.innerHTML = '<div class="empty-state-icon">✓</div><p>No check-ins yet. Add one to track periodic activities.</p>';
      content.appendChild(e);
    } else {
      checkins.forEach(c => {
        content.appendChild(CheckinsSection.renderCard(c));
      });
    }

    // FAB
    const fab = el('button', 'fab', '+');
    fab.addEventListener('click', () => CheckinsSection.showAddModal());
    document.body.appendChild(fab);
    content._cleanup = () => fab.remove();
  },

  renderCard(c) {
    const s = checkinStatus(c);
    const nextDue = checkinNextDue(c);
    const anchor = c.last_checkin_at || c.first_due_at || c.created_at;
    const card = el('div', 'card');
    card.innerHTML = `
      <div class="card-row">
        <div class="status-dot status-${s}"></div>
        <div class="card-title" style="flex:1">${c.title}</div>
        <span class="badge badge-${s}">${s.toUpperCase()}</span>
      </div>
      <div class="card-meta">
        Every ${c.frequency_value} ${c.frequency_unit}${c.frequency_value > 1 ? 's' : ''} ·
        Last: ${c.last_checkin_at ? formatRelative(c.last_checkin_at) : 'never'} ·
        Due: ${formatDate(nextDue.toISOString())}
      </div>
      ${c.labels?.length ? `<div class="labels-wrap" style="margin-top:6px">${c.labels.map(l => `<span class="label-chip">${l}</span>`).join('')}</div>` : ''}
      <div class="card-actions">
        <button class="btn-primary" style="padding:7px 16px;font-size:13px" data-action="checkin" data-id="${c.id}">Check in now</button>
        <button class="btn-secondary" data-action="edit" data-id="${c.id}">Edit</button>
        <button class="btn-danger" data-action="delete" data-id="${c.id}">Delete</button>
      </div>
    `;
    card.querySelector('[data-action="checkin"]').addEventListener('click', async () => {
      await CheckinsSection.doCheckin(c.id);
      CheckinsSection.render();
    });
    card.querySelector('[data-action="edit"]').addEventListener('click', () => CheckinsSection.showEditModal(c));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => CheckinsSection.deleteCheckin(c));
    return card;
  },

  async doCheckin(id) {
    const c = await DB.get('checkins', id);
    const before = { ...c };
    c.last_checkin_at = nowISO();
    c.updated_at = nowISO();
    await DB.put('checkins', c);
    await logAction('checkin', 'checkins', id, before, c);
    showToast(`Checked in: ${c.title}`);
    syncAll();
  },

  showAddModal(onDone) {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">New Check-in</div>
      <div class="form-row"><label>Title</label><input type="text" id="ci-title" placeholder="e.g. Call Grandma" /></div>
      <div class="form-row"><label>Frequency</label>
        <div class="form-inline">
          <input type="number" id="ci-freq-val" value="1" min="1" />
          <select id="ci-freq-unit"><option value="day">Day(s)</option><option value="week" selected>Week(s)</option><option value="month">Month(s)</option><option value="year">Year(s)</option></select>
        </div>
      </div>
      <div class="form-row"><label>Yellow warning after frequency +</label>
        <div class="form-inline">
          <input type="number" id="ci-yellow-val" value="1" min="0" />
          <select id="ci-yellow-unit"><option value="day" selected>Day(s)</option><option value="week">Week(s)</option></select>
        </div>
      </div>
      <div class="form-row"><label>Red alert after frequency +</label>
        <div class="form-inline">
          <input type="number" id="ci-red-val" value="3" min="0" />
          <select id="ci-red-unit"><option value="day" selected>Day(s)</option><option value="week">Week(s)</option></select>
        </div>
      </div>
      <div class="form-row"><label>Labels</label>${labelsHTML()}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="ci-cancel">Cancel</button>
        <button class="btn-primary" id="ci-save">Save</button>
      </div>
    `;
    openModal(html, onDone);
    let labelEditor;
    initLabelEditor(document.getElementById('modal-content'), []).then(le => { labelEditor = le; });
    document.getElementById('ci-cancel').addEventListener('click', closeModal);
    document.getElementById('ci-save').addEventListener('click', async () => {
      const title = document.getElementById('ci-title').value.trim();
      if (!title) { showToast('Title required'); return; }
      const obj = {
        id: uuid(),
        title,
        frequency_value: parseInt(document.getElementById('ci-freq-val').value) || 1,
        frequency_unit: document.getElementById('ci-freq-unit').value,
        yellow_value: parseInt(document.getElementById('ci-yellow-val').value) || 1,
        yellow_unit: document.getElementById('ci-yellow-unit').value,
        red_value: parseInt(document.getElementById('ci-red-val').value) || 3,
        red_unit: document.getElementById('ci-red-unit').value,
        first_due_at: nowISO(),
        last_checkin_at: null,
        labels: labelEditor ? labelEditor.getSelected() : [],
        created_at: nowISO(), updated_at: nowISO(), deleted_at: null
      };
      await DB.put('checkins', obj);
      await logAction('create', 'checkins', obj.id, null, obj);
      closeModal();
      showToast('Check-in added');
      if (onDone) onDone(); else CheckinsSection.render();
      syncAll();
    });
  },

  showEditModal(c) {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">Edit Check-in</div>
      <div class="form-row"><label>Title</label><input type="text" id="ci-title" value="${c.title}" /></div>
      <div class="form-row"><label>Frequency</label>
        <div class="form-inline">
          <input type="number" id="ci-freq-val" value="${c.frequency_value}" min="1" />
          <select id="ci-freq-unit">
            ${['day','week','month','year'].map(u => `<option value="${u}" ${c.frequency_unit===u?'selected':''}>${u.charAt(0).toUpperCase()+u.slice(1)}(s)</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row"><label>Yellow after due +</label>
        <div class="form-inline">
          <input type="number" id="ci-yellow-val" value="${c.yellow_value}" min="0" />
          <select id="ci-yellow-unit">${['day','week'].map(u=>`<option value="${u}" ${c.yellow_unit===u?'selected':''}>${u}(s)</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row"><label>Red after due +</label>
        <div class="form-inline">
          <input type="number" id="ci-red-val" value="${c.red_value}" min="0" />
          <select id="ci-red-unit">${['day','week'].map(u=>`<option value="${u}" ${c.red_unit===u?'selected':''}>${u}(s)</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-row"><label>Labels</label>${labelsHTML()}</div>
      <div class="form-actions">
        <button class="btn-secondary" id="ci-cancel">Cancel</button>
        <button class="btn-primary" id="ci-save">Save</button>
      </div>
    `;
    openModal(html);
    let labelEditor;
    initLabelEditor(document.getElementById('modal-content'), c.labels || []).then(le => { labelEditor = le; });
    document.getElementById('ci-cancel').addEventListener('click', closeModal);
    document.getElementById('ci-save').addEventListener('click', async () => {
      const before = { ...c };
      c.title = document.getElementById('ci-title').value.trim();
      c.frequency_value = parseInt(document.getElementById('ci-freq-val').value) || 1;
      c.frequency_unit = document.getElementById('ci-freq-unit').value;
      c.yellow_value = parseInt(document.getElementById('ci-yellow-val').value) || 1;
      c.yellow_unit = document.getElementById('ci-yellow-unit').value;
      c.red_value = parseInt(document.getElementById('ci-red-val').value) || 3;
      c.red_unit = document.getElementById('ci-red-unit').value;
      c.labels = labelEditor ? labelEditor.getSelected() : c.labels;
      c.updated_at = nowISO();
      await DB.put('checkins', c);
      await logAction('update', 'checkins', c.id, before, c);
      closeModal();
      showToast('Updated');
      CheckinsSection.render();
      syncAll();
    });
  },

  async deleteCheckin(c) {
    const before = { ...c };
    c.deleted_at = nowISO();
    c.updated_at = nowISO();
    await DB.put('checkins', c);
    await logAction('delete', 'checkins', c.id, before, c);
    CheckinsSection.render();
    showUndo(`Deleted "${c.title}"`, async () => {
      c.deleted_at = null;
      c.updated_at = nowISO();
      await DB.put('checkins', c);
    });
    syncAll();
  }
};
