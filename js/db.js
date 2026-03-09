/* ============================================================
   db.js - IndexedDB wrapper with remote-first Supabase sync/cache
   ============================================================ */

const DB_NAME = 'myos-db';
const DB_VERSION = 2;

const STORES = [
  'checkins', 'tasks', 'habits', 'habit_logs',
  'prayers', 'prayer_logs', 'journal_entries',
  'labels', 'action_logs', 'config', 'pending_writes'
];

const REMOTE_TABLES = {
  checkins: 'checkins',
  tasks: 'tasks',
  habits: 'habits',
  habit_logs: 'habit_logs',
  prayers: 'prayers',
  prayer_logs: 'prayer_logs',
  journal_entries: 'journal_entries',
  labels: 'labels'
};

const REMOTE_CACHE_TTL_MS = 30000;

let _db = null;
const remoteFreshAt = new Map();

function isRemoteStore(store) {
  return !!REMOTE_TABLES[store];
}

function localNowISO() {
  return new Date().toISOString();
}

function dbUuid() {
  return crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

function markRemoteFresh(store) {
  remoteFreshAt.set(store, Date.now());
}

function markRemoteStale(store) {
  remoteFreshAt.delete(store);
}

function isRemoteFresh(store) {
  const ts = remoteFreshAt.get(store);
  return !!ts && (Date.now() - ts) < REMOTE_CACHE_TTL_MS;
}

async function getRemoteContext() {
  if (!navigator.onLine) return null;
  if (typeof getSupabase !== 'function' || typeof getCurrentUser !== 'function') return null;
  const sb = await getSupabase();
  if (!sb) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  return { sb, user };
}

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function getAllLocal(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getLocal(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putLocal(store, obj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(obj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteLocal(store, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getPendingWritesForStore(store) {
  const pending = await getAllLocal('pending_writes');
  return pending.filter(p => p.store === store);
}

async function queuePendingWrite({ op, store, payload, targetId }) {
  const pending = await getPendingWritesForStore(store);
  for (const p of pending) {
    if (p.target_id === targetId) {
      await deleteLocal('pending_writes', p.id);
    }
  }

  await putLocal('pending_writes', {
    id: dbUuid(),
    op,
    store,
    target_id: targetId,
    payload_json: payload ? JSON.stringify(payload) : null,
    queued_at: localNowISO()
  });
}

async function mirrorRemoteRowsToLocal(store, remoteRows) {
  const localRows = await getAllLocal(store);
  const pending = await getPendingWritesForStore(store);
  const pendingUpsertIds = new Set(
    pending
      .filter(p => p.op === 'upsert')
      .map(p => p.target_id)
  );

  const remoteIds = new Set(remoteRows.map(r => r.id));

  for (const row of localRows) {
    if (!remoteIds.has(row.id) && !pendingUpsertIds.has(row.id)) {
      await deleteLocal(store, row.id);
    }
  }

  for (const row of remoteRows) {
    await putLocal(store, row);
  }
}

async function pullStoreFromRemote(store, { force = false } = {}) {
  const localRows = await getAllLocal(store);
  if (!isRemoteStore(store)) return localRows;

  const ctx = await getRemoteContext();
  if (!ctx) return localRows;

  if (!force && isRemoteFresh(store)) {
    return localRows;
  }

  const table = REMOTE_TABLES[store];
  const { data, error } = await ctx.sb.from(table).select('*');
  if (error) {
    console.warn(`Remote pull failed for ${store}:`, error.message);
    return localRows;
  }

  const rows = data || [];
  await mirrorRemoteRowsToLocal(store, rows);
  markRemoteFresh(store);
  return getAllLocal(store);
}

async function flushPendingWrites() {
  const ctx = await getRemoteContext();
  if (!ctx) return 0;

  const pending = (await getAllLocal('pending_writes'))
    .sort((a, b) => new Date(a.queued_at) - new Date(b.queued_at));

  let flushed = 0;
  for (const entry of pending) {
    const table = REMOTE_TABLES[entry.store];
    if (!table) {
      await deleteLocal('pending_writes', entry.id);
      continue;
    }

    let error = null;
    try {
      if (entry.op === 'upsert') {
        const payload = entry.payload_json ? JSON.parse(entry.payload_json) : null;
        if (payload) {
          const res = await ctx.sb.from(table).upsert([payload], { onConflict: 'id' });
          error = res.error;
        }
      } else if (entry.op === 'delete') {
        const res = await ctx.sb.from(table).delete().eq('id', entry.target_id);
        error = res.error;
      }
    } catch (err) {
      error = err;
    }

    if (error) {
      console.warn(`Pending ${entry.op} failed for ${entry.store}/${entry.target_id}:`, error.message || error);
      const msg = String(error.message || '').toLowerCase();
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('timeout')) {
        break;
      }
      continue;
    }

    await deleteLocal('pending_writes', entry.id);
    markRemoteStale(entry.store);
    flushed += 1;
  }

  return flushed;
}

const DB = {
  async getAll(store, options = {}) {
    const { localOnly = false, forceRemote = false } = options;
    if (localOnly || !isRemoteStore(store)) {
      return getAllLocal(store);
    }
    return pullStoreFromRemote(store, { force: forceRemote });
  },

  async get(store, id, options = {}) {
    const { localOnly = false } = options;
    if (localOnly || !isRemoteStore(store)) {
      return getLocal(store, id);
    }

    if (isRemoteFresh(store)) {
      const cached = await getLocal(store, id);
      if (cached) return cached;
    }

    const ctx = await getRemoteContext();
    if (!ctx) return getLocal(store, id);

    const table = REMOTE_TABLES[store];
    const { data, error } = await ctx.sb.from(table).select('*').eq('id', id).maybeSingle();
    if (error) {
      console.warn(`Remote get failed for ${store}/${id}:`, error.message);
      return getLocal(store, id);
    }
    if (data) {
      await putLocal(store, data);
      markRemoteFresh(store);
      return data;
    }
    return null;
  },

  async put(store, obj, options = {}) {
    const { localOnly = false } = options;
    await putLocal(store, obj);

    if (localOnly || !isRemoteStore(store)) {
      return obj.id;
    }

    const ctx = await getRemoteContext();
    if (!ctx) {
      await queuePendingWrite({ op: 'upsert', store, payload: obj, targetId: obj.id });
      markRemoteStale(store);
      return obj.id;
    }

    const table = REMOTE_TABLES[store];
    const { data, error } = await ctx.sb.from(table).upsert([obj], { onConflict: 'id' }).select().limit(1);
    if (error) {
      console.warn(`Remote upsert failed for ${store}/${obj.id}:`, error.message);
      await queuePendingWrite({ op: 'upsert', store, payload: obj, targetId: obj.id });
      markRemoteStale(store);
      return obj.id;
    }

    const saved = (data && data[0]) || obj;
    await putLocal(store, saved);
    markRemoteFresh(store);
    return saved.id;
  },

  async delete(store, id, options = {}) {
    const { localOnly = false } = options;
    await deleteLocal(store, id);

    if (localOnly || !isRemoteStore(store)) {
      return;
    }

    const ctx = await getRemoteContext();
    if (!ctx) {
      await queuePendingWrite({ op: 'delete', store, payload: null, targetId: id });
      markRemoteStale(store);
      return;
    }

    const table = REMOTE_TABLES[store];
    const { error } = await ctx.sb.from(table).delete().eq('id', id);
    if (error) {
      console.warn(`Remote delete failed for ${store}/${id}:`, error.message);
      await queuePendingWrite({ op: 'delete', store, payload: null, targetId: id });
      markRemoteStale(store);
      return;
    }

    markRemoteFresh(store);
  },

  async getConfig(key) {
    const obj = await getLocal('config', key);
    return obj ? obj.value : null;
  },

  async setConfig(key, value) {
    await putLocal('config', { id: key, value });
  },

  async flushPendingWrites() {
    return flushPendingWrites();
  },

  async pullAllRemote({ force = true } = {}) {
    for (const store of Object.keys(REMOTE_TABLES)) {
      await pullStoreFromRemote(store, { force });
    }
  },

  async getPendingWriteCount() {
    const pending = await getAllLocal('pending_writes');
    return pending.length;
  },

  async getLive(store, options = {}) {
    const all = await DB.getAll(store, options);
    return all.filter(r => !r.deleted_at);
  }
};
