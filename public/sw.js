const CACHE_NAME = 'arsith-tunes-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // For navigation requests, try network first then fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((r) => {
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(request, copy));
        return r;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For other requests, use cache-first strategy
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((r) => {
      // cache fetched asset for future
      const copy = r.clone();
      caches.open(CACHE_NAME).then(c => c.put(request, copy));
      return r;
    })).catch(() => cached || Promise.reject('no-match'))
  );
});
