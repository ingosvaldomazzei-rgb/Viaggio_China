// Service worker generato da tools/aggiorna_offline.py — non modificare a mano.
// Salva l'app sul telefono per l'uso offline (e in Cina, dove github.io
// potrebbe non essere raggiungibile) e conserva le zone di mappa visitate.
const VERSION = 'v5-79839cad';
const CORE = 'core-' + VERSION;
const TILES = 'tiles-v1';
const MAX_TILES = 3000;
const ASSETS = [
  './',
  './app.js?v=5',
  './data.js?v=5',
  './fonts/fonts.css?v=5',
  './fonts/manrope-latin-cf48e3.woff2',
  './fonts/manrope-latin-ext-b4290e.woff2',
  './fonts/spectral-latin-0340db.woff2',
  './fonts/spectral-latin-9efe49.woff2',
  './fonts/spectral-latin-ext-362f0a.woff2',
  './fonts/spectral-latin-ext-4aad0a.woff2',
  './fonts/spectral-latin-ext-ba2613.woff2',
  './fonts/spectral-latin-f4a845.woff2',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './index.html',
  './manifest.webmanifest',
  './photos/beijing-1.jpg',
  './photos/beijing-2.jpg',
  './photos/beijing-3.jpg',
  './photos/beijing-4.jpg',
  './photos/chongqing-1.jpg',
  './photos/chongqing-2.jpg',
  './photos/chongqing-3.jpg',
  './photos/chongqing-4.jpg',
  './photos/guilin-1.jpg',
  './photos/shanghai-1.jpg',
  './photos/shanghai-2.jpg',
  './photos/shanghai-3.jpg',
  './photos/shanghai-4.jpg',
  './photos/suzhou-1.jpg',
  './photos/suzhou-2.jpg',
  './photos/suzhou-3.jpg',
  './photos/suzhou-4.jpg',
  './photos/tongli-1.jpg',
  './photos/tongli-2.jpg',
  './photos/tongli-3.jpg',
  './photos/tongli-4.jpg',
  './photos/yangshuo-1.jpg',
  './photos/yangshuo-2.jpg',
  './photos/yangshuo-3.jpg',
  './photos/yangshuo-4.jpg',
  './styles.css?v=5',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/leaflet.css?v=5',
  './vendor/leaflet/leaflet.js?v=5'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CORE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('core-') && k !== CORE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isTile = (url) => /(^|\.)tile\.openstreetmap\.org$|basemaps\.cartocdn\.com$/.test(url.hostname);

async function trimTiles() {
  const cache = await caches.open(TILES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Mappe: prima la copia salvata, poi la rete (e si salva per la prossima volta).
  if (isTile(url)) {
    event.respondWith(caches.open(TILES).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') { cache.put(req, res.clone()); trimTiles(); }
        return res;
      } catch (e) {
        return new Response('', { status: 504 });
      }
    }));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // App: risposta immediata dalla copia salvata; con internet si aggiorna da sola
  // alla prossima versione (nuovo sw.js).
  event.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CORE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => (req.mode === 'navigate' ? caches.match('./') : new Response('', { status: 504 })));
    })
  );
});
