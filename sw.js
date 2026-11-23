// Offline-first service worker. Bump VERSION when shipping changes.
const VERSION = 'enough-v20';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/store.js', './js/calc.js', './js/content.js', './js/charts.js', './js/notify.js', './js/share.js',
  './fonts/fraunces-latin.woff2', './fonts/fraunces-latin-ext.woff2', './fonts/inter-latin.woff2', './fonts/inter-latin-ext.woff2',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Stale-while-revalidate for same-origin GETs.
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request).then(res => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => cached || (request.mode === 'navigate' ? cache.match('./index.html') : undefined));
    return cached || network;
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = e.notification.tag?.startsWith('diary') ? './#diary'
    : e.notification.tag?.startsWith('ms') ? './#health'
    : e.notification.tag?.startsWith('crave') ? './#cravings' : './#home';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { c.navigate?.(target); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
