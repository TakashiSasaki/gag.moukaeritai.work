// Service Worker — Network-First Strategy
// Online: always fetch from server, cache the response
// Offline: serve from cache, or show a fallback

const CACHE_NAME = 'gag-cache-v1';

// Install: skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: claim clients and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch: Network-First strategy
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (e.g., Google Fonts, analytics)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Don't cache non-OK responses
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone the response and cache it
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Network failed — try cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // If navigating and no cache, return offline fallback
          if (event.request.mode === 'navigate') {
            return new Response(
              '<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8">' +
              '<meta name="viewport" content="width=device-width,initial-scale=1">' +
              '<title>オフライン</title>' +
              '<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;' +
              'justify-content:center;min-height:100vh;margin:0;background:#0f0f1a;color:#eaeaea;' +
              'text-align:center}h1{font-size:2rem;margin-bottom:1rem}p{color:#8892a4}</style>' +
              '</head><body><div><h1>⚡ オフライン</h1>' +
              '<p>インターネット接続がありません。<br>接続を確認してからもう一度お試しください。</p>' +
              '</div></body></html>',
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html; charset=UTF-8' },
              }
            );
          }

          // For non-navigation requests with no cache, return network error
          return new Response('', { status: 408, statusText: 'Offline' });
        });
      })
  );
});
