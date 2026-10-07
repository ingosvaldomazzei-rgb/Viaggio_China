// Mappa del viaggio in Cina — standalone implementation (no build step).
// Shows the decided itinerary only: day-by-day stays and transfers in the
// left panel, numbered stops + hotels on a Leaflet map, place details with
// photos in the right drawer.

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
  const hotelById = (id) => HOTELS.find((h) => h.id === id);

  // Itinerary stays, numbered in travel order (Guilin is transit only).
  const STAYS = TRIP.steps.filter((s) => s.type === 'stay');
  STAYS.forEach((s, i) => { s.order = i + 1; });
  const stayOf = (placeId) => STAYS.find((s) => s.placeId === placeId);

  function nightsLabel(n) { return n === 0 ? 'solo giornata' : n + (n === 1 ? ' notte' : ' notti'); }
  function fmtDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function fmtRange(from, to) { return from === to ? fmtDate(from) : fmtDate(from) + ' → ' + fmtDate(to); }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ── App state ────────────────────────────────────────────────────────
  const state = {
    selected: null,     // place id shown in the right drawer
  };

  // Photo credits (Wikimedia Commons) keyed by place id; see data.js.
  const photosOf = (placeId) => PHOTOS[placeId] || [];
  function creditText(ph) { return ph.author + ' · ' + ph.license + ' · Wikimedia Commons'; }

  // An <img> that shows the visitor's own upload for this slot if there is
  // one (IndexedDB, set from the drawer), else the default photo.
  function slotImage(img, slotId, fallback) {
    if (fallback) img.src = fallback;
    PhotoStore.get(slotId).then((blob) => { if (blob) img.src = URL.createObjectURL(blob); });
  }

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
    itineraryList: document.getElementById('itineraryList'),
    drawer: document.getElementById('drawer'),
    drawerBody: document.getElementById('drawerBody'),
  };

  function renderSummary() {
    const nights = STAYS.reduce((a, s) => a + s.nights, 0);
    els.summary.textContent = nights + ' notti, da Shanghai a Pechino passando per Guangxi e Chongqing. ' +
      HOTELS.length + ' hotel già scelti.';
  }

  function renderItinerary() {
    els.itineraryList.innerHTML = '';
    els.itineraryList.style.setProperty('--route-color', TRIP.color);
    TRIP.steps.forEach((step) => {
      if (step.type === 'move') {
        const mv = document.createElement('div');
        mv.className = 'itin-move' + (step.status === 'todo' ? ' todo' : '');
        mv.innerHTML =
          '<div class="itin-move__head">' +
            '<span class="itin-move__icon">↓</span>' +
            '<span class="itin-move__title">' + escapeHtml(step.title) + '</span>' +
          '</div>' +
          '<div class="itin-move__meta">' +
            '<span class="itin-date">' + fmtDate(step.date) + '</span> · ' + escapeHtml(step.mode) +
          '</div>' +
          '<div class="itin-move__time">' + escapeHtml(step.time) + '</div>' +
          (step.detail ? '<div class="itin-move__detail">' + escapeHtml(step.detail) + '</div>' : '') +
          (step.status === 'todo' ? '<span class="itin-badge itin-badge--todo">Mezzo da definire</span>' : '');
        els.itineraryList.appendChild(mv);
        return;
      }
      const place = byId(step.placeId);
      const hotel = step.hotelId ? hotelById(step.hotelId) : null;
      const card = document.createElement('div');
      card.className = 'itin-stay';
      card.style.setProperty('--place-color', place.color);

      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'itin-stay__head';
      head.innerHTML =
        '<span class="chain-order">' + step.order + '</span>' +
        '<span class="itin-stay__heading">' +
          '<span class="itin-stay__name">' + escapeHtml(place.name) + ' <span class="place-cn">' + escapeHtml(place.cnName) + '</span></span>' +
          '<span class="itin-stay__dates">' + fmtRange(step.from, step.to) + ' · ' + nightsLabel(step.nights) + '</span>' +
        '</span>' +
        '<span class="place-chevron">›</span>';
      head.addEventListener('click', () => selectPlace(place.id));
      card.appendChild(head);

      const photos = photosOf(place.id);
      if (photos.length) {
        const gallery = document.createElement('button');
        gallery.type = 'button';
        gallery.className = 'itin-photos' + (photos.length > 1 ? '' : ' itin-photos--single');
        gallery.setAttribute('aria-label', 'Foto di ' + place.name);
        photos.slice(0, 4).forEach((ph, i) => {
          const img = document.createElement('img');
          img.alt = ph.title;
          img.title = creditText(ph);
          img.loading = 'lazy';
          img.className = i === 0 ? 'itin-photos__main' : 'itin-photos__thumb';
          slotImage(img, place.id + '-' + 'abcd'[i], ph.src);
          gallery.appendChild(img);
        });
        gallery.addEventListener('click', () => selectPlace(place.id));
        card.appendChild(gallery);
      }

      const plan = document.createElement('p');
      plan.className = 'itin-stay__plan';
      plan.textContent = step.plan;
      card.appendChild(plan);

      if (hotel) {
        const h = document.createElement('button');
        h.type = 'button';
        h.className = 'itin-hotel';
        h.innerHTML = '<span class="itin-hotel__icon">🛏</span><span class="itin-hotel__name">' + escapeHtml(hotel.name) + '</span>';
        h.addEventListener('click', () => selectHotel(hotel.id));
        card.appendChild(h);
      } else if (step.nights > 0) {
        const h = document.createElement('div');
        h.className = 'itin-hotel itin-hotel--missing';
        h.innerHTML = '<span class="itin-hotel__icon">🛏</span><span class="itin-hotel__name">Hotel da definire</span>';
        card.appendChild(h);
      }
      if (step.todo) {
        const t = document.createElement('div');
        t.className = 'itin-note itin-note--todo';
        t.textContent = step.todo;
        card.appendChild(t);
      }
      if (step.tip) {
        const t = document.createElement('div');
        t.className = 'itin-note';
        t.textContent = '💡 ' + step.tip;
        card.appendChild(t);
      }
      els.itineraryList.appendChild(card);
    });
  }

  function itineraryBoxHtml(place) {
    const stay = stayOf(place.id);
    if (!stay) return '';
    const hotel = stay.hotelId ? hotelById(stay.hotelId) : null;
    let html =
      '<div class="itin-box">' +
        '<div class="how-to-get__label">📅 Nel vostro itinerario · tappa ' + stay.order + '</div>' +
        '<p class="itin-box__dates">' + fmtRange(stay.from, stay.to) + ' · ' + nightsLabel(stay.nights) + '</p>' +
        '<p class="how-to-get__text">' + escapeHtml(stay.plan) + '</p>';
    if (hotel) {
      html +=
        '<div class="itin-box__hotel">' +
          '<div class="itin-box__hotel-name">🛏 ' + escapeHtml(hotel.name) +
            (hotel.cnName ? ' <span class="place-cn">' + escapeHtml(hotel.cnName) + '</span>' : '') + '</div>' +
          '<div class="itin-box__hotel-line">' + escapeHtml(hotel.address) + '</div>' +
          '<div class="itin-box__hotel-line">Check-in ' + fmtDate(hotel.checkIn) + ' · check-out ' + fmtDate(hotel.checkOut) +
            ' · ' + nightsLabel(hotel.nights) + '</div>' +
          '<div class="itin-box__hotel-line">' + escapeHtml(hotel.info) + '</div>' +
          '<div class="itin-box__hotel-line itin-box__muted">📍 ' + escapeHtml(hotel.coordsNote) + '</div>' +
          '<div class="itin-box__actions">' +
            '<button type="button" class="itin-box__btn" data-hotel="' + hotel.id + '">Mostra sulla mappa</button>' +
            '<a class="itin-box__btn" href="' + escapeHtml(hotel.link) + '" target="_blank" rel="noopener">Scheda hotel ↗</a>' +
          '</div>' +
        '</div>';
    } else if (stay.nights > 0) {
      html += '<div class="itin-note itin-note--todo">' + escapeHtml(stay.todo || 'Hotel da definire.') + '</div>';
    }
    return html + '</div>';
  }

  function renderDrawer() {
    const place = state.selected ? byId(state.selected) : null;
    els.drawer.classList.toggle('open', !!place);
    if (!place) { els.drawerBody.innerHTML = ''; return; }

    document.documentElement.style.setProperty('--sel', place.color);

    const photos = photosOf(place.id);
    const slots = ['a', 'b', 'c', 'd'].map((key, i) => ({
      key, cls: i === 0 ? 'photo-slot--hero' : 'photo-slot--small', fallback: photos[i] ? photos[i].src : '',
    }));
    const creditsHtml = photos.length
      ? '<div class="photo-credits">Foto: ' + photos.map((ph) =>
          '<a href="' + escapeHtml(ph.page) + '" target="_blank" rel="noopener">' + escapeHtml(ph.author) + '</a> (' + escapeHtml(ph.license) + ')'
        ).join(' · ') + ' — Wikimedia Commons</div>'
      : '';
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
          (stayOf(place.id) ? '<span class="tag"><span class="tag-icon-time">◷</span> ' + nightsLabel(stayOf(place.id).nights) + '</span>' : '') +
        '</div>' +
        itineraryBoxHtml(place) +
        '<div class="section-label">Foto <span class="hint">· trascina le tue immagini per sostituire</span></div>' +
        '<div class="photo-stack">' +
          slotHtml(slots[0]) +
          '<div class="photo-grid">' + slotHtml(slots[1]) + slotHtml(slots[2]) + slotHtml(slots[3]) + '</div>' +
        '</div>' +
        creditsHtml +
        '<p class="place-description">' + escapeHtml(place.description) + '</p>' +
        '<div class="section-label highlights-label">Da non perdere</div>' +
        '<div class="highlights-row">' + place.highlights.map((h) => '<span class="highlight-chip">' + escapeHtml(h) + '</span>').join('') + '</div>' +
        '<div class="how-to-get">' +
          '<div class="how-to-get__label">🧭 Come arrivarci</div>' +
          '<p class="how-to-get__text">' + escapeHtml(place.howToGet) + '</p>' +
        '</div>' +
      '</div>';

    initPhotoSlots(els.drawerBody);
    els.drawerBody.querySelectorAll('[data-hotel]').forEach((b) => {
      b.addEventListener('click', () => selectHotel(b.dataset.hotel));
    });
  }

  // ── Leaflet map ──────────────────────────────────────────────────────
  let map = null;
  let markers = {};
  let hotelMarkers = {};
  const HOTEL_MIN_ZOOM = 10;
  let routePolyEl = null;
  let activeRouteLatLngs = null;

  // CARTO basemaps now watermark keyless requests ("API KEY REQUIRED").
  // With a free key (carto.com/basemaps/apikey) set here the map uses the
  // CARTO Voyager style; without one it falls back to standard OpenStreetMap.
  const CARTO_KEY = '';
  function addTiles() {
    if (CARTO_KEY) {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=' + CARTO_KEY, {
        subdomains: 'abcd', maxZoom: 18, attribution: '© OpenStreetMap · © CARTO',
      }).addTo(map);
      return;
    }
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
  }

  function badgeIcon(label, color, selected) {
    const size = selected ? 30 : 24;
    const html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color +
      ';color:#fff;font-family:Manrope,sans-serif;font-weight:700;font-size:' + (selected ? 13 : 11) +
      'px;display:flex;align-items:center;justify-content:center;border:' + (selected ? 3 : 2.5) +
      'px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);">' + label + '</div>';
    return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }
  function hotelIcon() {
    const html = '<div class="hotel-pin">🛏</div>';
    return L.divIcon({ className: '', html, iconSize: [26, 26], iconAnchor: [13, 13] });
  }

  function icon(p) {
    const selected = state.selected === p.id;
    const stay = stayOf(p.id);
    if (stay) return badgeIcon(stay.order, TRIP.color, selected);
    // Transit-only place (Guilin): small pin on the line.
    const size = selected ? 16 : 11;
    const html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + p.color +
      ';border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4);"></div>';
    return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  function updateMarkers() {
    FLAT.forEach((p) => { if (markers[p.id]) markers[p.id].setIcon(icon(p)); });
    // Hotel pins only when zoomed in enough not to cover the numbered stops.
    const showHotels = map.getZoom() >= HOTEL_MIN_ZOOM;
    HOTELS.forEach((h) => {
      const m = hotelMarkers[h.id]; if (!m) return;
      if (showHotels && !map.hasLayer(m)) m.addTo(map);
      if (!showHotels && map.hasLayer(m)) map.removeLayer(m);
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
    hotelMarkers = {};
    HOTELS.forEach((h) => {
      const m = L.marker(h.coords, { icon: hotelIcon(), zIndexOffset: 500 });
      m.bindTooltip('🛏 ' + h.name, { permanent: false, direction: 'top', offset: [0, -10], className: 'cn-tip' });
      m.on('click', () => selectHotel(h.id));
      hotelMarkers[h.id] = m;
    });
    map.on('zoomend', updateMarkers);
    updateMarkers();
    drawItineraryLine();
    fitLatLngs(itineraryLatLngs(), false);
  }

  const PAD = () => ({ paddingTopLeft: L.point(404, 60), paddingBottomRight: L.point(70, 70), duration: .9 });
  function fitLatLngs(latlngs, animate) {
    const b = L.latLngBounds(latlngs);
    const opts = PAD();
    try { animate ? map.flyToBounds(b, opts) : map.fitBounds(b, opts); }
    catch (e) { try { map.fitBounds(b, opts); } catch (e2) {} }
  }
  function itineraryLatLngs() { return TRIP.path.map((id) => byId(id).coords); }
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
  function drawLine(coordsList, color) {
    if (!map) return;
    ensureRouteLineEl();
    activeRouteLatLngs = coordsList.map((c) => L.latLng(c));
    routePolyEl.setAttribute('stroke', color);
    routePolyEl.setAttribute('stroke-width', '3.5');
    routePolyEl.setAttribute('stroke-dasharray', '2 10');
    routePolyEl.setAttribute('stroke-linecap', 'round');
    routePolyEl.setAttribute('opacity', '0.9');
    renderRouteLineGeometry();
  }
  function drawItineraryLine() { drawLine(itineraryLatLngs(), TRIP.color); }

  // ── State transitions ────────────────────────────────────────────────
  function selectPlace(id) {
    const p = byId(id); if (!p) return;
    state.selected = id;
    renderDrawer();
    updateMarkers();
    if (map) flyToPin(p.coords, 8);
  }
  function selectHotel(id) {
    const h = hotelById(id); if (!h) return;
    state.selected = h.placeId;
    renderDrawer();
    updateMarkers();
    if (map) flyToPin(h.coords, 14);
  }
  function closeDrawer() {
    state.selected = null;
    renderDrawer();
    updateMarkers();
  }
  function showAll() {
    state.selected = null;
    renderDrawer();
    updateMarkers();
    if (map) fitLatLngs(itineraryLatLngs(), true);
  }

  // ── Boot ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderSummary();
    renderItinerary();
    renderDrawer();
    initMap();

    document.getElementById('closeBtn').addEventListener('click', closeDrawer);
    document.getElementById('showAllBtn').addEventListener('click', showAll);
  });
})();
