/* Mezzanine service worker: keeps the app working offline once it has been opened.
   The page and scripts are network-first, so edits and updates show up straight away;
   instrument samples and web fonts are cache-first, since they never change.
   Registered by js/device.js only over http(s), and never inside the Claude artifact. */
const CACHE = 'mezzanine-v1';
const SHELL = [
  './', 'index.html', 'css/style.css',
  'js/core.js', 'js/audio.js', 'js/ui.js', 'js/device.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mezzanine-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const page = await caches.match('index.html'); if (page) return page; }
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(url.pathname.includes('/samples/') ? cacheFirst(req) : networkFirst(req));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req));
  }
});
