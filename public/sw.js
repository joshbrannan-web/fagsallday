const CACHE_NAME = 'golf-app-v3';
const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip external origins entirely
  if (url.origin !== self.location.origin) return;

  // Never cache development-server modules. Their query hashes change whenever
  // Vite re-optimizes dependencies, and mixing old/new chunks breaks React hooks.
  if (
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh')
  ) return;

  // Skip Supabase API paths
  if (
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/functions/')
  ) return;

  // Stale-while-revalidate for same-origin assets
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Network failed — if navigating, serve index.html from cache
          if (event.request.mode === 'navigate') {
            return cache.match('/index.html');
          }
          return undefined;
        });

        // Return cached version immediately, or wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});
