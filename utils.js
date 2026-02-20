/* ============================================================
   utils.js — Shared utilities
   ============================================================ */

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

function nowISO() { return new Date().toISOString(); }

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  if (days < 365) return `${Math.floor(days/30)}mo ago`;
  return `${Math.floor(days/365)}y ago`;
}

function daysOpen(createdAt) {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

// Calendar-aware date addition for check-in frequency
function addDuration(date, value, unit) {
  const d = new Date(date);
  switch(unit) {
    case 'day':   d.setDate(d.getDate() + value); break;
    case 'week':  d.setDate(d.getDate() + value * 7); break;
    case 'month': d.setMonth(d.getMonth() + value); break;
    case 'year':  d.setFullYear(d.getFullYear() + value); break;
  }
  return d;
}

function checkinStatus(item) {
  const anchor = item.last_checkin_at
    ? new Date(item.last_checkin_at)
    : new Date(item.first_due_at || item.created_at);

  const dueAt = addDuration(anchor, item.frequency_value, item.frequency_unit);
  const yellowAt = addDuration(dueAt, item.yellow_value || 0, item.yellow_unit || 'day');
  const redAt = addDuration(dueAt, item.red_value || 0, item.red_unit || 'day');

  const now = new Date();
  if (now >= redAt) return 'red';
  if (now >= yellowAt) return 'yellow';
  return 'green';
}

function checkinNextDue(item) {
  const anchor = item.last_checkin_at
    ? new Date(item.last_checkin_at)
    : new Date(item.first_due_at || item.created_at);
  return addDuration(anchor, item.frequency_value, item.frequency_unit);
}

function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function showToast(msg, duration = 2500) {
  const container = document.getElementById('toast-container');
  const t = el('div', 'toast', msg);
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

let undoTimer = null;
let pendingUndo = null;

function showUndo(message, undoFn) {
  if (undoTimer) { clearTimeout(undoTimer); }
  pendingUndo = undoFn;
  const bar = document.getElementById('undo-bar');
  document.getElementById('undo-message').textContent = message;
  bar.classList.remove('hidden');
  undoTimer = setTimeout(() => { bar.classList.add('hidden'); pendingUndo = null; }, 5000);
}

document.getElementById('undo-btn').addEventListener('click', async () => {
  if (pendingUndo) {
    await pendingUndo();
    pendingUndo = null;
    clearTimeout(undoTimer);
    document.getElementById('undo-bar').classList.add('hidden');
    showToast('Action undone');
    App.refresh();
  }
});

async function logAction(type, entityType, entityId, before, after) {
  await DB.put('action_logs', {
    id: uuid(),
    type,
    entity_type: entityType,
    entity_id: entityId,
    before: JSON.stringify(before),
    after: JSON.stringify(after),
    created_at: nowISO()
  });
}

function openModal(html, onClose) {
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-content').innerHTML = html;
  overlay.classList.remove('hidden');
  overlay._onClose = onClose;
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
  if (overlay._onClose) overlay._onClose();
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// Labels helpers
async function getAllLabels() {
  const all = await DB.getLive('labels');
  return all.map(l => l.name);
}

function labelsHTML(selectedLabels = []) {
  return `<div class="labels-wrap" id="label-chips"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <input type="text" id="label-input" placeholder="Add label..." style="flex:1" />
      <button class="btn-secondary" id="label-add-btn" type="button">Add</button>
    </div>`;
}

async function initLabelEditor(container, initial = []) {
  const selected = [...initial];
  const allLabels = await getAllLabels();
  const chipsWrap = container.querySelector('#label-chips');

  function render() {
    chipsWrap.innerHTML = '';
    const shown = new Set([...allLabels, ...selected]);
    shown.forEach(name => {
      const chip = el('span', 'label-chip' + (selected.includes(name) ? ' active' : ''), name);
      chip.addEventListener('click', () => {
        const idx = selected.indexOf(name);
        if (idx >= 0) selected.splice(idx, 1); else selected.push(name);
        render();
      });
      chipsWrap.appendChild(chip);
    });
  }

  render();

  const addBtn = container.querySelector('#label-add-btn');
  const labelInput = container.querySelector('#label-input');
  addBtn.addEventListener('click', () => {
    const v = labelInput.value.trim();
    if (v && !selected.includes(v)) {
      selected.push(v);
      if (!allLabels.includes(v)) allLabels.push(v);
      // Save new label
      DB.put('labels', { id: v, name: v, created_at: nowISO() });
    }
    labelInput.value = '';
    render();
  });

  return { getSelected: () => [...selected] };
}
