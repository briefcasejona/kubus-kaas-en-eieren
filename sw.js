// Service worker: lets the installed app start without a connection and load fast.
// The page itself is fetched network-first, so a new version reaches players on their next start.
// 20261008161127 is filled in by build.ps1 on every build.
const CACHE = 'kubus-kaas-en-eieren-20261008161127';
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js',
];
const LOCAL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-32.png'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL);
    await Promise.all(LIBS.map(async url => {
      try { await cache.put(url, await fetch(url, { mode: 'no-cors' })); } catch (_) { /* fetched again on first use */ }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isPage = req.mode === 'navigate';
  const isOwn = url.origin === self.location.origin;
  const isLib = LIBS.includes(req.url);
  if (!isPage && !isOwn && !isLib) return; // everything else (the game relays) goes straight to the network

  if (isPage) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        (await caches.open(CACHE)).put('index.html', fresh.clone());
        return fresh;
      } catch (_) {
        return (await caches.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});
