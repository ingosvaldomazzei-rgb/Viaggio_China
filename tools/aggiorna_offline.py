#!/usr/bin/env python3
"""Rigenera docs/sw.js: elenco dei file da salvare sul telefono per l'uso
offline e numero di versione (cambiandolo, i telefoni scaricano i file nuovi).
Da lanciare dopo ogni modifica al sito:  python3 tools/aggiorna_offline.py
"""
import hashlib, pathlib, re

DOCS = pathlib.Path(__file__).resolve().parent.parent / 'docs'
SKIP = {'sw.js', 'README.md'}

index = (DOCS / 'index.html').read_text()
asset_v = re.search(r'\?v=(\d+)', index).group(1)
versioned = set(re.findall(r'(?:href|src)="([^"#:]+\?v=\d+)"', index))

files = []
for p in sorted(DOCS.rglob('*')):
    rel = p.relative_to(DOCS).as_posix()
    if p.is_dir() or rel in SKIP or rel.startswith('.'):
        continue
    url = next((v for v in versioned if v.split('?')[0] == rel), rel)
    files.append(url)

digest = hashlib.sha1()
for f in files:
    digest.update(f.encode()); digest.update((DOCS / f.split('?')[0]).read_bytes())
version = 'v' + asset_v + '-' + digest.hexdigest()[:8]

assets = ',\n'.join("  './" + f + "'" for f in files)
sw = f"""// Service worker generato da tools/aggiorna_offline.py — non modificare a mano.
// Salva l'app sul telefono per l'uso offline (e in Cina, dove github.io
// potrebbe non essere raggiungibile) e conserva le zone di mappa visitate.
const VERSION = '{version}';
const CORE = 'core-' + VERSION;
const TILES = 'tiles-v1';
const MAX_TILES = 3000;
const ASSETS = [
  './',
{assets}
];

self.addEventListener('install', (event) => {{
  event.waitUntil(caches.open(CORE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
}});

self.addEventListener('activate', (event) => {{
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('core-') && k !== CORE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
}});

const isTile = (url) => /(^|\\.)tile\\.openstreetmap\\.org$|basemaps\\.cartocdn\\.com$/.test(url.hostname);

async function trimTiles() {{
  const cache = await caches.open(TILES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}}

self.addEventListener('fetch', (event) => {{
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Mappe: prima la copia salvata, poi la rete (e si salva per la prossima volta).
  if (isTile(url)) {{
    event.respondWith(caches.open(TILES).then(async (cache) => {{
      const hit = await cache.match(req);
      if (hit) return hit;
      try {{
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') {{ cache.put(req, res.clone()); trimTiles(); }}
        return res;
      }} catch (e) {{
        return new Response('', {{ status: 504 }});
      }}
    }}));
    return;
  }}

  if (url.origin !== self.location.origin) return;

  // App: risposta immediata dalla copia salvata; con internet si aggiorna da sola
  // alla prossima versione (nuovo sw.js).
  event.respondWith(
    caches.match(req, {{ ignoreSearch: req.mode === 'navigate' }}).then((hit) => {{
      if (hit) return hit;
      return fetch(req).then((res) => {{
        if (res.ok) {{ const copy = res.clone(); caches.open(CORE).then((c) => c.put(req, copy)); }}
        return res;
      }}).catch(() => (req.mode === 'navigate' ? caches.match('./') : new Response('', {{ status: 504 }})));
    }})
  );
}});
"""
(DOCS / 'sw.js').write_text(sw)
print('sw.js aggiornato:', version, '·', len(files) + 1, 'file salvati per l\'offline')
