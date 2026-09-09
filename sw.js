/* Service worker — offline cache. Podigni CACHE verziju pri promjeni datoteka. */
const CACHE = 'budzet-v1';
const ASSETS = [
  '.',
  'index.html',
  'app.css',
  'app.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  // network-first za navigaciju, cache-first za ostalo
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
