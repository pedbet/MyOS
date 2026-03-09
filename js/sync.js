/* ============================================================
   sync.js - Sync orchestrator (remote-first cache refresh + offline queue flush)
   ============================================================ */

let lastSyncAt = null;
let isSyncing = false;

async function syncAll(options = {}) {
  const { forcePull = true } = options;
  if (isSyncing) return false;

  const sb = await getSupabase();
  if (!sb) {
    setSyncStatus('error', 'Supabase not configured');
    return false;
  }

  const user = await getCurrentUser();
  if (!user) {
    setSyncStatus('error', 'Not signed in');
    return false;
  }

  isSyncing = true;
  setSyncStatus('syncing');

  try {
    await DB.flushPendingWrites();
    await DB.pullAllRemote({ force: forcePull });

    lastSyncAt = new Date();
    await DB.setConfig('last_sync', lastSyncAt.toISOString());

    const pending = await DB.getPendingWriteCount();
    setSyncStatus('ok', pending > 0 ? `${pending} queued` : '');
    return true;
  } catch (err) {
    console.error('Sync error:', err);
    setSyncStatus('error', err.message || 'Unknown sync error');
    return false;
  } finally {
    isSyncing = false;
  }
}

function setSyncStatus(status, msg = '') {
  const el = document.getElementById('sync-status');
  if (!el) return;

  el.className = 'sync-status ' + status;
  if (status === 'syncing') {
    el.textContent = 'Syncing...';
    return;
  }
  if (status === 'ok') {
    const base = `Synced ${formatRelative(lastSyncAt?.toISOString())}`;
    el.textContent = msg ? `${base} (${msg})` : base;
    return;
  }
  el.textContent = msg ? `Sync error: ${msg}` : 'Sync error';
}

async function hydrateSyncStateFromConfig() {
  const saved = await DB.getConfig('last_sync');
  if (saved) {
    lastSyncAt = new Date(saved);
    setSyncStatus('ok');
  }
}

const syncBtn = document.getElementById('sync-btn');
if (syncBtn) {
  syncBtn.addEventListener('click', async () => {
    const icon = document.querySelector('#sync-btn svg');
    if (icon) icon.classList.add('spin');
    const ok = await syncAll({ forcePull: true });
    if (icon) icon.classList.remove('spin');
    showToast(ok ? 'Sync complete' : 'Sync failed');
  });
}

window.addEventListener('online', () => {
  syncAll({ forcePull: true });
});

setInterval(() => {
  syncAll({ forcePull: true });
}, 5 * 60 * 1000);

hydrateSyncStateFromConfig();
