/**
 * Vibify Service Worker
 *
 * Strategy:
 *  - App shell (HTML, JS, CSS, fonts, images): Cache-first, network fallback
 *  - Navigation: Network-first, fall back to cached /index.html (offline shell)
 *  - Audio / media / API: Always network — never cached (range requests + CORS)
 *  - On activate: wipe all old caches so stale assets never linger
 */

const CACHE_VERSION = 'vibify-v3';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function isAudioOrMedia(request) {
  const url = new URL(request.url);
  return (
    request.destination === 'audio' ||
    request.destination === 'video' ||
    request.headers.get('range') !== null ||
    /saavn|jiosaavn|aac\.|cdnmusic/i.test(url.hostname) ||
    /\.(mp3|mp4|m4a|ogg|opus|webm|aac|flac|wav)(\?|$)/i.test(url.pathname)
  );
}

function isApiCall(request) {
  const url = new URL(request.url);
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('saavn') ||
    url.hostname.includes('jiosaavn')
  );
}

function isCacheableStatic(request, response) {
  if (!response || !response.ok) return false;
  const url = new URL(request.url);
  const dest = request.destination;
  const sameOrigin = url.origin === self.location.origin;
  const staticDest = ['style', 'script', 'font', 'image', 'manifest'].includes(dest);
  return sameOrigin || staticDest;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableStatic(request, response)) {
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cache the fresh shell
    const cache = await caches.open(CACHE_VERSION);
    cache.put(request, response.clone());
    return response;
  } catch {
    // Offline — serve cached shell
    const cached = await caches.match(request) || await caches.match('/index.html');
    if (cached) return cached;
    // Last-resort offline page
    return new Response(
      `<!doctype html><html lang="en"><head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1"/>
        <title>Vibify — Offline</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{background:#05090c;color:#e2e8f0;font-family:system-ui,sans-serif;
               display:flex;flex-direction:column;align-items:center;justify-content:center;
               min-height:100svh;gap:16px;padding:24px;text-align:center}
          svg{opacity:.7}
          h1{font-size:1.25rem;font-weight:700}
          p{font-size:.875rem;color:#94a3b8;max-width:280px;line-height:1.6}
          button{margin-top:8px;padding:10px 24px;border-radius:9999px;border:none;
                 background:#0ea47f;color:#05090c;font-weight:600;font-size:.875rem;cursor:pointer}
        </style>
      </head><body>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0ea47f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 19V6l12-3v13"/>
          <circle cx="6" cy="19" r="3" fill="#0ea47f" stroke="none"/>
          <circle cx="18" cy="16" r="3" fill="#0ea47f" stroke="none"/>
        </svg>
        <h1>You're offline</h1>
        <p>Check your internet connection and try again. Your music will be back in a moment.</p>
        <button onclick="location.reload()">Try again</button>
      </body></html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET — let POST/PUT/DELETE pass through untouched
  if (request.method !== 'GET') return;

  // Audio, media, streaming — always network, never cache
  if (isAudioOrMedia(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // API calls — always network, never cache
  if (isApiCall(request)) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML navigation — network-first (fresh app shell), offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else (JS, CSS, fonts, images) — cache-first
  event.respondWith(cacheFirst(request));
});

// ─── Push notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Vibify', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Vibify', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'vibify-notification',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then((c) => c.navigate(targetUrl));
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ─── Open the installed PWA ────────────────────────────────────────────────────
// Triggered from the app ("Open App" button) via postMessage. If a standalone
// PWA window is already open, focus it. Otherwise open the start URL so the OS
// launches the installed PWA instead of a plain browser tab.

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'OPEN_APP') return;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Prefer an already-running standalone PWA window
        const pwa = clients.find(
          (c) => c.url.includes(self.location.origin) && c.frameType === 'top-level' &&
            (c.visibilityState || '').length >= 0 &&
            // standalone PWA windows expose display-mode via matchMedia in-page,
            // but clients can't read that here — so focus any vibify window first.
            true
        );
        if (pwa) return pwa.focus();

        // No PWA window yet → open the start URL. The `?source=pwa` hint lets
        // the page/OS treat this as a PWA launch.
        return self.clients.openWindow('/?source=pwa');
      })
  );
});

// ─── Background sync (queue failed actions) ──────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'vibify-sync') {
    // Placeholder — extend here for offline queue (likes, history, etc.)
    event.waitUntil(Promise.resolve());
  }
});
