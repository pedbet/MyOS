/* ============================================================
   sw.js — Service Worker (app shell caching)
   ============================================================ */

const CACHE_NAME = 'myos-v1';
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/main.css',
  './js/db.js',
  './js/sync.js',
  './js/utils.js',
  './js/auth.js',
  './js/search.js',
  './js/app.js',
  './js/sections/today.js',
  './js/sections/checkins.js',
  './js/sections/tasks.js',
  './js/sections/habits.js',
  './js/sections/prayers.js',
  './js/sections/journal.js',
  './js/sections/settings.js',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first for Supabase, cache-first for shell
  const url = new URL(event.request.url);

  if (url.hostname.includes('supabase.co') || url.hostname.includes('googleapis.com')) {
    // Network only for API calls
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
