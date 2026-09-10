/* Service worker — offline cache. Podigni CACHE verziju pri promjeni datoteka. */
const CACHE = 'budzet-v4';
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
  // network-first za sve (uvijek svježa verzija kad je mreža dostupna),
  // cache samo kao fallback kad je offline. Ako zatreba čist cache-first
  // za pravu offline PWA upotrebu, vrati staru verziju iz git povijesti.
  e.respondWith(
    fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
      return res;
    }).catch(() => caches.match(request).then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
