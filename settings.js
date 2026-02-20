/* ============================================================
   settings.js — Settings section
   ============================================================ */

const SettingsSection = {
  async render() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    content.className = 'section-page fade-in';

    const header = el('div', 'section-header');
    header.innerHTML = `<div class="section-title">Settings</div>`;
    content.appendChild(header);

    const user = await getCurrentUser();
    const sbUrl = await DB.getConfig('supabase_url') || 'Not set';
    const lastSync = await DB.getConfig('last_sync');

    // Account section
    const accountSec = el('div', 'settings-section');
    accountSec.innerHTML = `
      <div class="settings-section-title">Account</div>
      <div class="settings-row">
        <span class="settings-label">Signed in as</span>
        <span class="settings-value">${user?.email || 'Not signed in'}</span>
      </div>
      <div class="settings-row" id="signout-row" style="cursor:pointer">
        <span class="settings-label" style="color:var(--red)">Sign out</span>
      </div>
    `;
    accountSec.querySelector('#signout-row').addEventListener('click', signOut);
    content.appendChild(accountSec);

    // Sync section
    const syncSec = el('div', 'settings-section');
    syncSec.innerHTML = `
      <div class="settings-section-title">Sync & Data</div>
      <div class="settings-row">
        <span class="settings-label">Supabase URL</span>
        <span class="settings-value">${sbUrl.length > 30 ? sbUrl.slice(0, 30) + '…' : sbUrl}</span>
      </div>
      <div class="settings-row">
        <span class="settings-label">Last synced</span>
        <span class="settings-value">${lastSync ? formatRelative(lastSync) : 'Never'}</span>
      </div>
      <div class="settings-row" id="sync-now-row" style="cursor:pointer">
        <span class="settings-label">Sync now</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
      </div>
      <div class="settings-row" id="reconfigure-row" style="cursor:pointer">
        <span class="settings-label">Reconfigure Supabase</span>
      </div>
    `;
    syncSec.querySelector('#sync-now-row').addEventListener('click', async () => {
      await syncAll();
      showToast('Sync complete');
      SettingsSection.render();
    });
    syncSec.querySelector('#reconfigure-row').addEventListener('click', () => SettingsSection.showReconfigure());
    content.appendChild(syncSec);

    // Labels management
    const labelSec = el('div', 'settings-section');
    labelSec.innerHTML = `<div class="settings-section-title">Labels</div>`;
    const labels = await getAllLabels();
    if (labels.length === 0) {
      labelSec.innerHTML += '<div class="card-meta" style="padding:8px">No labels yet.</div>';
    } else {
      const wrap = el('div', 'labels-wrap', '');
      wrap.style.marginTop = '8px';
      labels.forEach(name => {
        const chip = el('div', 'label-chip', name);
        const del = el('span', '', ' ×');
        del.style.cssText = 'cursor:pointer;color:var(--text3);margin-left:2px';
        del.addEventListener('click', async () => {
          await DB.delete('labels', name);
          showToast(`Label "${name}" deleted`);
          SettingsSection.render();
        });
        chip.appendChild(del);
        wrap.appendChild(chip);
      });
      labelSec.appendChild(wrap);
    }
    content.appendChild(labelSec);

    // Data section
    const dataSec = el('div', 'settings-section');
    dataSec.innerHTML = `
      <div class="settings-section-title">Data</div>
      <div class="settings-row" id="export-row" style="cursor:pointer">
        <span class="settings-label">Export all data (JSON)</span>
      </div>
    `;
    dataSec.querySelector('#export-row').addEventListener('click', () => SettingsSection.exportData());
    content.appendChild(dataSec);

    // About
    const aboutSec = el('div', 'settings-section');
    aboutSec.innerHTML = `
      <div class="settings-section-title">About</div>
      <div class="settings-row">
        <span class="settings-label">MyOS</span>
        <span class="settings-value">v1.0.0</span>
      </div>
      <div class="settings-row">
        <span class="settings-label">Storage</span>
        <span class="settings-value">IndexedDB (offline-first)</span>
      </div>
    `;
    content.appendChild(aboutSec);
  },

  showReconfigure() {
    const html = `
      <div class="modal-handle"></div>
      <div class="modal-title">Reconfigure Supabase</div>
      <div class="form-row"><label>Supabase URL</label><input type="url" id="rc-url" placeholder="https://xxxx.supabase.co" /></div>
      <div class="form-row"><label>Anon Key</label><input type="text" id="rc-key" placeholder="eyJ..." /></div>
      <div class="form-actions">
        <button class="btn-secondary" id="rc-cancel">Cancel</button>
        <button class="btn-primary" id="rc-save">Save</button>
      </div>
    `;
    openModal(html);
    document.getElementById('rc-cancel').addEventListener('click', closeModal);
    document.getElementById('rc-save').addEventListener('click', async () => {
      const url = document.getElementById('rc-url').value.trim();
      const key = document.getElementById('rc-key').value.trim();
      if (!url || !key) { showToast('Both fields required'); return; }
      await DB.setConfig('supabase_url', url);
      await DB.setConfig('supabase_key', key);
      supabaseClient = null; // Reset
      closeModal();
      showToast('Supabase reconfigured');
    });
  },

  async exportData() {
    const data = {};
    const stores = ['checkins','tasks','habits','habit_logs','prayers','prayer_logs','journal_entries','labels'];
    for (const s of stores) data[s] = await DB.getAll(s);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myos-export-${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported');
  }
};
