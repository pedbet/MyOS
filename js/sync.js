/* ============================================================
   sync.js — Supabase sync (eventual consistency, last-write-wins)
   ============================================================ */

const SYNC_STORES = [
  'checkins', 'tasks', 'habits', 'habit_logs',
  'prayers', 'prayer_logs', 'journal_entries', 'labels'
];

const SUPABASE_TABLES = {
  checkins: 'checkins',
  tasks: 'tasks',
  habits: 'habits',
  habit_logs: 'habit_logs',
  prayers: 'prayers',
  prayer_logs: 'prayer_logs',
  journal_entries: 'journal_entries',
  labels: 'labels'
};

let lastSyncAt = null;
let isSyncing = false;

async function syncAll() {
  if (isSyncing) return;
  const sb = await getSupabase();
  if (!sb) return;
  const user = await getCurrentUser();
  if (!user) return;

  isSyncing = true;
  setSyncStatus('syncing');

  try {
    for (const store of SYNC_STORES) {
      await syncStore(sb, store);
    }
    lastSyncAt = new Date();
    await DB.setConfig('last_sync', lastSyncAt.toISOString());
    setSyncStatus('ok');
  } catch (err) {
    console.error('Sync error:', err);
    setSyncStatus('error', err.message);
  } finally {
    isSyncing = false;
  }
}

async function syncStore(sb, store) {
  const table = SUPABASE_TABLES[store];
  const local = await DB.getAll(store);

  // Push local → remote (upsert)
  if (local.length > 0) {
    const { error } = await sb.from(table).upsert(local, { onConflict: 'id' });
    if (error) throw error;
  }

  // Pull remote → local
  const { data: remote, error: pullErr } = await sb.from(table).select('*');
  if (pullErr) throw pullErr;

  for (const row of (remote || [])) {
    const localRow = local.find(r => r.id === row.id);
    if (!localRow || new Date(row.updated_at) > new Date(localRow.updated_at || 0)) {
      await DB.put(store, row);
    }
  }
}

function setSyncStatus(status, msg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.className = 'sync-status ' + status;
  if (status === 'syncing') el.textContent = 'Syncing...';
  else if (status === 'ok') el.textContent = `Synced ${formatRelative(lastSyncAt?.toISOString())}`;
  else if (status === 'error') el.textContent = 'Sync error';
}

// Sync button
document.getElementById('sync-btn').addEventListener('click', async () => {
  const icon = document.querySelector('#sync-btn svg');
  icon.classList.add('spin');
  await syncAll();
  icon.classList.remove('spin');
  showToast('Sync complete');
});

// Online reconnect sync
window.addEventListener('online', () => syncAll());

// Periodic sync every 5 minutes
setInterval(() => syncAll(), 5 * 60 * 1000);
