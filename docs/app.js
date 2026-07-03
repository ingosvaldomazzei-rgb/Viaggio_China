// Mappa del viaggio in Cina — standalone implementation (no build step).
// Ported from the Claude Design prototype (Mappa Cina.dc.html): same data,
// same interactions, same Leaflet map behavior — reimplemented as plain
// DOM rendering instead of the proprietary dc-component runtime.

(() => {
  'use strict';

  // ── Flatten places, keep region metadata on each one ────────────────────
  const FLAT = [];
  REGIONS.forEach((r) => {
    r.places.forEach((p) => {
      p.regionId = r.id;
      p.color = r.color;
      p.regionName = r.name;
      FLAT.push(p);
    });
  });
  const byId = (id) => FLAT.find((p) => p.id === id);

  function daysLabel(days) { return days + (days === 1 ? ' giorno' : ' giorni'); }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function routeChain(route) {
    return route.stops.map((id, i) => {
      const p = byId(id);
      const prev = i > 0 ? route.stops[i - 1] : null;
      const seg = prev ? (SEGMENTS[prev + '>' + id] || { mode: 'Collegamento da definire', km: 0, time: '' }) : null;
      return { id: p.id, name: p.name, order: i + 1, days: p.days, seg };
    });
  }

  // ── App state ────────────────────────────────────────────────────────
  const state = {
    selected: null,     // place id shown in the right drawer
    hidden: {},          // regionId -> bool, area-tab visibility toggle
    panel: 'percorsi',   // 'percorsi' | 'aree'
    activeRoute: null,   // route id highlighted on the map
  };

  // ── IndexedDB-backed photo store (client-only stand-in for the design
  //    tool's server-side image-slot sidecar — no backend in a static site) ─
  const PhotoStore = (() => {
    const DB_NAME = 'mappa-cina-photos';
    const STORE = 'photos';
    let dbPromise = null;
    function open() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return dbPromise;
    }
    function get(id) {
      return open().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      })).catch(() => null);
    }
    function set(id, blob) {
      return open().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }));
    }
    function del(id) {
      return open().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }));
    }
    return { get, set, del };
  })();

  function resizeImageFile(file, maxDim, quality) {
    maxDim = maxDim || 1200;
    quality = quality || 0.85;
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/jpeg', quality);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function initPhotoSlots(container) {
    container.querySelectorAll('.photo-slot').forEach((el) => {
      const slotId = el.dataset.slotId;
      const fallback = el.dataset.fallback || '';
      const isHero = el.classList.contains('photo-slot--hero');

      el.innerHTML =
        '<img alt="' + escapeHtml(el.dataset.alt || '') + '" hidden>' +
        '<span class="placeholder-label">' + (isHero ? 'Trascina una foto' : '+ Foto') + '</span>' +
        '<button type="button" class="photo-clear" aria-label="Rimuovi foto">✕</button>' +
        '<input type="file" accept="image/png,image/jpeg,image/webp">';

      const imgEl = el.querySelector('img');
      const fileInput = el.querySelector('input[type=file]');
      const clearBtn = el.querySelector('.photo-clear');
      let objectUrl = null;

      function showImage(src, isObjectUrl) {
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
        if (isObjectUrl) objectUrl = src;
        imgEl.src = src;
        imgEl.hidden = false;
        el.classList.add('has-image');
      }
      function showEmpty() {
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
        imgEl.hidden = true;
        imgEl.removeAttribute('src');
        el.classList.remove('has-image');
      }

      PhotoStore.get(slotId).then((blob) => {
        if (blob) showImage(URL.createObjectURL(blob), true);
        else if (fallback) showImage(fallback, false);
      });

      async function handleFile(file) {
        if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) return;
        try {
          const blob = await resizeImageFile(file);
          await PhotoStore.set(slotId, blob);
          showImage(URL.createObjectURL(blob), true);
        } catch (e) {
          console.error('Import foto non riuscito', e);
        }
      }

      el.addEventListener('click', (e) => { if (e.target !== clearBtn) fileInput.click(); });
      fileInput.addEventListener('change', () => { handleFile(fileInput.files[0]); fileInput.value = ''; });
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('dragover'); });
      el.addEventListener('dragleave', () => el.classList.remove('dragover'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        el.classList.remove('dragover');
        handleFile(e.dataTransfer.files && e.dataTransfer.files[0]);
      });
      clearBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await PhotoStore.del(slotId);
        if (fallback) showImage(fallback, false); else showEmpty();
      });
    });
  }

  // ── Rendering ────────────────────────────────────────────────────────
  const els = {
    summary: document.getElementById('summaryText'),
    tabPercorsi: document.getElementById('tabPercorsi'),
    tabAree: document.getElementById('tabAree'),
    routesList: document.getElementById('routesList'),
    areasList: document.getElementById('areasList'),
    drawer: document.getElementById('drawer'),
    drawerBody: document.getElementById('drawerBody'),
  };

  function renderSummary() {
    els.summary.textContent = FLAT.length + ' luoghi · ' + REGIONS.length + ' aree · ' + ROUTES.length +
      ' percorsi possibili, tutti da Pechino a Shanghai o Hong Kong.';
  }

  function renderTabs() {
    els.tabPercorsi.classList.toggle('active', state.panel === 'percorsi');
    els.tabAree.classList.toggle('active', state.panel === 'aree');
    els.routesList.style.display = state.panel === 'percorsi' ? 'block' : 'none';
    els.areasList.style.display = state.panel === 'aree' ? 'block' : 'none';
  }

  function renderRoutes() {
    els.routesList.innerHTML = '';
    ROUTES.forEach((route, i) => {
      const active = state.activeRoute === route.id;
      const chain = active ? routeChain(route) : [];
      const totalKm = routeChain(route).reduce((a, n) => a + (n.seg ? n.seg.km : 0), 0);

      const card = document.createElement('div');
      card.className = 'route-card' + (active ? ' active' : '');
      card.style.setProperty('--route-color', route.color);

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'route-header';
      header.innerHTML =
        '<span class="route-num">' + (i + 1) + '</span>' +
        '<span class="route-heading">' +
          '<span class="route-title">' + escapeHtml(route.title) + '</span>' +
          '<span class="route-meta">' +
            '<span class="route-close">🏁 ' + escapeHtml(route.closeAt) + '</span>' +
            '<span class="route-stats">· ' + route.stops.length + ' tappe · ~' + totalKm.toLocaleString('it-IT') + ' km</span>' +
          '</span>' +
        '</span>' +
        '<span class="route-chevron">' + (active ? '⌄' : '›') + '</span>';
      header.addEventListener('click', () => selectRoute(route.id));
      card.appendChild(header);

      const body = document.createElement('div');
      body.className = 'route-body';
      body.hidden = !active;
      chain.forEach((node) => {
        const wrap = document.createElement('div');
        wrap.className = 'chain-node';
        if (node.seg) {
          const seg = document.createElement('div');
          seg.className = 'chain-seg';
          seg.innerHTML =
            '<span class="chain-seg-arrow">↓</span>' +
            '<span class="chain-seg-mode">' + escapeHtml(node.seg.mode) + '</span>' +
            '<span class="chain-seg-info">· ~' + node.seg.km + ' km · ' + escapeHtml(node.seg.time) + '</span>';
          wrap.appendChild(seg);
        }
        const stopBtn = document.createElement('button');
        stopBtn.type = 'button';
        stopBtn.className = 'chain-stop';
        stopBtn.innerHTML =
          '<span class="chain-order">' + node.order + '</span>' +
          '<span class="chain-name">' + escapeHtml(node.name) + '</span>' +
          '<span class="chain-days">' + daysLabel(node.days) + '</span>';
        stopBtn.addEventListener('click', () => selectPlace(node.id));
        wrap.appendChild(stopBtn);
        body.appendChild(wrap);
      });
      if (active) {
        const note = document.createElement('p');
        note.className = 'route-note';
        note.textContent = route.note;
        body.appendChild(note);
      }
      card.appendChild(body);
      els.routesList.appendChild(card);
    });
  }

  function renderAreas() {
    els.areasList.innerHTML = '';
    REGIONS.forEach((region) => {
      const isHidden = !!state.hidden[region.id];
      const block = document.createElement('div');
      block.className = 'region-block';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'region-header' + (isHidden ? ' hidden-region' : '');
      header.style.setProperty('--region-color', region.color);
      header.innerHTML =
        '<span class="region-dot"></span>' +
        '<span class="region-name">' + escapeHtml(region.name) + '</span>' +
        '<span class="region-count">' + region.places.length + '</span>' +
        '<span class="region-eye">' + (isHidden ? '⌀' : '●') + '</span>';
      header.addEventListener('click', () => toggleRegion(region.id));
      block.appendChild(header);

      const placesWrap = document.createElement('div');
      placesWrap.className = 'region-places';
      placesWrap.hidden = isHidden;
      region.places.forEach((place) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'place-row';
        row.style.setProperty('--place-color', place.color);
        row.innerHTML =
          '<span class="place-dot"></span>' +
          '<span class="place-text">' +
            '<span class="place-name-row">' +
              '<span class="place-name">' + escapeHtml(place.name) + '</span>' +
              '<span class="place-cn">' + escapeHtml(place.cnName) + '</span>' +
            '</span>' +
            '<span class="place-sub">' + escapeHtml(place.type) + ' · ' + daysLabel(place.days) + '</span>' +
          '</span>' +
          '<span class="place-chevron">›</span>';
        row.addEventListener('click', () => selectPlace(place.id));
        placesWrap.appendChild(row);
      });
      block.appendChild(placesWrap);
      els.areasList.appendChild(block);
    });
  }

  function renderDrawer() {
    const place = state.selected ? byId(state.selected) : null;
    els.drawer.classList.toggle('open', !!place);
    if (!place) { els.drawerBody.innerHTML = ''; return; }

    document.documentElement.style.setProperty('--sel', place.color);

    const slots = [
      { key: 'a', cls: 'photo-slot--hero', fallback: 'photos/' + place.id + '.jpg' },
      { key: 'b', cls: 'photo-slot--small', fallback: '' },
      { key: 'c', cls: 'photo-slot--small', fallback: '' },
      { key: 'd', cls: 'photo-slot--small', fallback: '' },
    ];
    const slotHtml = (s) =>
      '<div class="photo-slot ' + s.cls + '" data-slot-id="' + place.id + '-' + s.key + '"' +
      (s.fallback ? ' data-fallback="' + escapeHtml(s.fallback) + '"' : '') +
      ' data-alt="' + escapeHtml(place.name) + '"></div>';

    els.drawerBody.innerHTML =
      '<div class="place-panel" style="--place-color:' + place.color + '">' +
        '<div class="place-panel__region">' +
          '<span class="place-panel__region-dot"></span>' +
          '<span class="place-panel__region-name">' + escapeHtml(place.regionName) + '</span>' +
        '</div>' +
        '<div class="place-panel__title-row">' +
          '<h2>' + escapeHtml(place.name) + '</h2>' +
          '<span class="place-panel__cn">' + escapeHtml(place.cnName) + '</span>' +
        '</div>' +
        '<div class="tag-row">' +
          '<span class="tag">' + escapeHtml(place.type) + '</span>' +
          '<span class="tag"><span class="tag-icon-time">◷</span> ' + daysLabel(place.days) + '</span>' +
          '<span class="tag"><span class="tag-icon-season">☀</span> ' + escapeHtml(place.bestTime) + '</span>' +
        '</div>' +
        '<div class="section-label">Foto <span class="hint">· trascina le tue immagini per sostituire</span></div>' +
        '<div class="photo-stack">' +
          slotHtml(slots[0]) +
          '<div class="photo-grid">' + slotHtml(slots[1]) + slotHtml(slots[2]) + slotHtml(slots[3]) + '</div>' +
        '</div>' +
        '<p class="place-description">' + escapeHtml(place.description) + '</p>' +
        '<div class="section-label highlights-label">Da non perdere</div>' +
        '<div class="highlights-row">' + place.highlights.map((h) => '<span class="highlight-chip">' + escapeHtml(h) + '</span>').join('') + '</div>' +
        '<div class="how-to-get">' +
          '<div class="how-to-get__label">🧭 Come arrivarci</div>' +
          '<p class="how-to-get__text">' + escapeHtml(place.howToGet) + '</p>' +
        '</div>' +
      '</div>';

    initPhotoSlots(els.drawerBody);
  }

  // ── Leaflet map ──────────────────────────────────────────────────────
  let map = null;
  let markers = {};
  let routePolyEl = null;
  let activeRouteLatLngs = null;

  function addTiles() {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 18, attribution: '© OpenStreetMap · © CARTO',
    }).addTo(map);
  }

  function icon(p) {
    const activeRoute = state.activeRoute;
    const selected = state.selected === p.id;
    if (activeRoute) {
      const route = ROUTES.find((r) => r.id === activeRoute);
      const idx = route ? route.stops.indexOf(p.id) : -1;
      if (idx >= 0) {
        const size = selected ? 30 : 24;
        const html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + route.color +
          ';color:#fff;font-family:Manrope,sans-serif;font-weight:700;font-size:' + (selected ? 13 : 11) +
          'px;display:flex;align-items:center;justify-content:center;border:' + (selected ? 3 : 2.5) +
          'px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);">' + (idx + 1) + '</div>';
        return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      }
      const size = 9;
      const html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + p.color + ';opacity:.35;border:1.5px solid #fff;"></div>';
      return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    }
    const size = selected ? 22 : 15;
    const html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + p.color +
      ';border:' + (selected ? 3 : 2.5) + 'px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.4);' +
      (selected ? 'outline:3px solid ' + p.color + '55;' : '') + '"></div>';
    return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  function updateMarkers() {
    const activeRoute = state.activeRoute;
    FLAT.forEach((p) => {
      const m = markers[p.id]; if (!m) return;
      if (activeRoute) {
        if (!map.hasLayer(m)) m.addTo(map);
        m.setIcon(icon(p));
        return;
      }
      const hidden = !!state.hidden[p.regionId];
      if (hidden) { if (map.hasLayer(m)) map.removeLayer(m); }
      else { if (!map.hasLayer(m)) m.addTo(map); m.setIcon(icon(p)); }
    });
  }

  function initMap() {
    const mapEl = document.getElementById('chinamap');
    map = L.map(mapEl, { zoomControl: false, attributionControl: true, minZoom: 3, worldCopyJump: true });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    addTiles();
    markers = {};
    FLAT.forEach((p) => {
      const m = L.marker(p.coords, { icon: icon(p) }).addTo(map);
      m.bindTooltip(p.name, { permanent: false, direction: 'top', offset: [0, -6], className: 'cn-tip' });
      m.on('click', () => selectPlace(p.id));
      markers[p.id] = m;
    });
    fitAllBounds(false);
  }

  function fitAllBounds(animate) {
    const b = L.latLngBounds(FLAT.map((p) => p.coords));
    const opts = { paddingTopLeft: L.point(404, 60), paddingBottomRight: L.point(70, 70), duration: .9 };
    try { animate ? map.flyToBounds(b, opts) : map.fitBounds(b, opts); }
    catch (e) { try { map.fitBounds(b, opts); } catch (e2) {} }
  }
  function fitRouteBounds(routeId) {
    const route = ROUTES.find((r) => r.id === routeId);
    if (!route || !map) return;
    const b = L.latLngBounds(route.stops.map((id) => byId(id).coords));
    const opts = { paddingTopLeft: L.point(404, 60), paddingBottomRight: L.point(70, 70), duration: .9 };
    try { map.flyToBounds(b, opts); } catch (e) { try { map.fitBounds(b, opts); } catch (e2) {} }
  }
  function flyToPin(coords, zoom) {
    const p = map.project(coords, zoom);
    p.x += 40;
    map.flyTo(map.unproject(p, zoom), zoom, { duration: .9 });
  }

  // The route line is a hand-managed SVG polyline in Leaflet's overlayPane
  // (below markerPane, so it sits under the pins automatically) instead of
  // an L.polyline. Leaflet 1.9.4's Path/_clipPoints throws ("Cannot read
  // properties of undefined (reading 'x')") the first time a vector layer
  // is added to a map that has so far only held DivIcon markers — this
  // sidesteps its vector-layer system entirely for this one thin line.
  function ensureRouteLineEl() {
    if (routePolyEl) return;
    const svgNS = 'http://www.w3.org/2000/svg';
    const pane = map.getPane('overlayPane');
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('style', 'position:absolute;overflow:visible;pointer-events:none;left:0;top:0;');
    const poly = document.createElementNS(svgNS, 'polyline');
    poly.setAttribute('fill', 'none');
    svg.appendChild(poly);
    pane.appendChild(svg);
    routePolyEl = poly;
    map.on('move zoom viewreset', renderRouteLineGeometry);
  }
  function renderRouteLineGeometry() {
    if (!routePolyEl) return;
    if (!activeRouteLatLngs) { routePolyEl.setAttribute('points', ''); return; }
    try {
      const pts = activeRouteLatLngs.map((ll) => {
        const p = map.latLngToLayerPoint(ll);
        return p.x + ',' + p.y;
      }).join(' ');
      routePolyEl.setAttribute('points', pts);
    } catch (e) { /* transient mid-animation frame; next move/zoom tick retries */ }
  }
  function drawRouteLine(routeId) {
    const route = ROUTES.find((r) => r.id === routeId);
    if (!route || !map) return;
    ensureRouteLineEl();
    activeRouteLatLngs = route.stops.map((id) => L.latLng(byId(id).coords));
    routePolyEl.setAttribute('stroke', route.color);
    routePolyEl.setAttribute('stroke-width', '3.5');
    routePolyEl.setAttribute('stroke-dasharray', '2 10');
    routePolyEl.setAttribute('stroke-linecap', 'round');
    routePolyEl.setAttribute('opacity', '0.9');
    renderRouteLineGeometry();
  }
  function removeRouteLine() {
    activeRouteLatLngs = null;
    if (routePolyEl) routePolyEl.setAttribute('points', '');
  }

  // ── State transitions ────────────────────────────────────────────────
  function selectPlace(id) {
    const p = byId(id); if (!p) return;
    state.selected = id;
    renderDrawer();
    updateMarkers();
    if (map) flyToPin(p.coords, 8);
  }
  function closeDrawer() {
    state.selected = null;
    renderDrawer();
    updateMarkers();
  }
  function toggleRegion(id) {
    state.hidden[id] = !state.hidden[id];
    renderAreas();
    updateMarkers();
  }
  function selectRoute(id) {
    if (state.activeRoute === id) { clearRoute(); return; }
    state.activeRoute = id;
    state.selected = null;
    renderRoutes();
    renderDrawer();
    updateMarkers();
    drawRouteLine(id);
    fitRouteBounds(id);
  }
  function clearRoute() {
    state.activeRoute = null;
    renderRoutes();
    removeRouteLine();
    updateMarkers();
  }
  function setPanel(p) {
    if (p === state.panel) return;
    state.panel = p;
    if (p === 'aree') { state.activeRoute = null; removeRouteLine(); }
    else { state.hidden = {}; }
    renderTabs();
    renderRoutes();
    renderAreas();
    updateMarkers();
  }
  function showAll() {
    state.selected = null;
    state.activeRoute = null;
    renderDrawer();
    renderRoutes();
    removeRouteLine();
    updateMarkers();
    if (map) fitAllBounds(true);
  }

  // ── Boot ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderSummary();
    renderTabs();
    renderRoutes();
    renderAreas();
    renderDrawer();
    initMap();

    els.tabPercorsi.addEventListener('click', () => setPanel('percorsi'));
    els.tabAree.addEventListener('click', () => setPanel('aree'));
    document.getElementById('closeBtn').addEventListener('click', closeDrawer);
    document.getElementById('showAllBtn').addEventListener('click', showAll);
  });
})();
