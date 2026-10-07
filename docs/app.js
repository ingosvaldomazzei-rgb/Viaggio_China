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
  const hotelById = (id) => HOTELS.find((h) => h.id === id);

  // Itinerary stays, numbered in travel order (Guilin is transit only).
  const STAYS = TRIP.steps.filter((s) => s.type === 'stay');
  STAYS.forEach((s, i) => { s.order = i + 1; });
  const stayOf = (placeId) => STAYS.find((s) => s.placeId === placeId);

  function daysLabel(days) { return days + (days === 1 ? ' giorno' : ' giorni'); }
  function nightsLabel(n) { return n === 0 ? 'solo giornata' : n + (n === 1 ? ' notte' : ' notti'); }
  function fmtDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function fmtRange(from, to) { return from === to ? fmtDate(from) : fmtDate(from) + ' → ' + fmtDate(to); }
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
    panel: 'itinerario', // 'itinerario' | 'percorsi' | 'aree'
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
    tabItinerario: document.getElementById('tabItinerario'),
    tabPercorsi: document.getElementById('tabPercorsi'),
    tabAree: document.getElementById('tabAree'),
    itineraryList: document.getElementById('itineraryList'),
    routesList: document.getElementById('routesList'),
    areasList: document.getElementById('areasList'),
    drawer: document.getElementById('drawer'),
    drawerBody: document.getElementById('drawerBody'),
  };

  function renderSummary() {
    const nights = STAYS.reduce((a, s) => a + s.nights, 0);
    els.summary.textContent = state.panel === 'itinerario'
      ? 'Itinerario deciso: ' + nights + ' notti, da Shanghai a Pechino passando per Guangxi e Chongqing. ' +
        HOTELS.length + ' hotel già scelti.'
      : FLAT.length + ' luoghi · ' + REGIONS.length + ' aree · ' + ROUTES.length +
        ' percorsi alternativi valutati in fase di pianificazione.';
  }

  function renderTabs() {
    els.tabItinerario.classList.toggle('active', state.panel === 'itinerario');
    els.tabPercorsi.classList.toggle('active', state.panel === 'percorsi');
    els.tabAree.classList.toggle('active', state.panel === 'aree');
    els.itineraryList.style.display = state.panel === 'itinerario' ? 'block' : 'none';
    els.routesList.style.display = state.panel === 'percorsi' ? 'block' : 'none';
    els.areasList.style.display = state.panel === 'aree' ? 'block' : 'none';
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
        itineraryBoxHtml(place) +
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
  function fadedIcon(p) {
    const size = 9;
    const html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + p.color + ';opacity:.35;border:1.5px solid #fff;"></div>';
    return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }
  function hotelIcon() {
    const html = '<div class="hotel-pin">🛏</div>';
    return L.divIcon({ className: '', html, iconSize: [26, 26], iconAnchor: [13, 13] });
  }

  function icon(p) {
    const activeRoute = state.activeRoute;
    const selected = state.selected === p.id;
    if (state.panel === 'itinerario') {
      const stay = stayOf(p.id);
      return stay ? badgeIcon(stay.order, TRIP.color, selected) : fadedIcon(p);
    }
    if (activeRoute) {
      const route = ROUTES.find((r) => r.id === activeRoute);
      const idx = route ? route.stops.indexOf(p.id) : -1;
      return idx >= 0 ? badgeIcon(idx + 1, route.color, selected) : fadedIcon(p);
    }
    const size = selected ? 22 : 15;
    const html = '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + p.color +
      ';border:' + (selected ? 3 : 2.5) + 'px solid #fff;box-shadow:0 2px 7px rgba(0,0,0,.4);' +
      (selected ? 'outline:3px solid ' + p.color + '55;' : '') + '"></div>';
    return L.divIcon({ className: '', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  function updateMarkers() {
    const showAllPins = state.activeRoute || state.panel === 'itinerario';
    FLAT.forEach((p) => {
      const m = markers[p.id]; if (!m) return;
      const hidden = !showAllPins && !!state.hidden[p.regionId];
      if (hidden) { if (map.hasLayer(m)) map.removeLayer(m); }
      else { if (!map.hasLayer(m)) m.addTo(map); m.setIcon(icon(p)); }
    });
    // Hotel pins only make sense alongside the decided itinerary.
    HOTELS.forEach((h) => {
      const m = hotelMarkers[h.id]; if (!m) return;
      const show = state.panel === 'itinerario' && map.getZoom() >= HOTEL_MIN_ZOOM;
      if (show && !map.hasLayer(m)) m.addTo(map);
      if (!show && map.hasLayer(m)) map.removeLayer(m);
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
    if (state.panel === 'itinerario') { drawItineraryLine(); fitLatLngs(itineraryLatLngs(), false); }
    else fitAllBounds(false);
  }

  const PAD = () => ({ paddingTopLeft: L.point(404, 60), paddingBottomRight: L.point(70, 70), duration: .9 });
  function fitLatLngs(latlngs, animate) {
    const b = L.latLngBounds(latlngs);
    const opts = PAD();
    try { animate ? map.flyToBounds(b, opts) : map.fitBounds(b, opts); }
    catch (e) { try { map.fitBounds(b, opts); } catch (e2) {} }
  }
  function fitAllBounds(animate) { fitLatLngs(FLAT.map((p) => p.coords), animate); }
  function fitRouteBounds(routeId) {
    const route = ROUTES.find((r) => r.id === routeId);
    if (!route || !map) return;
    fitLatLngs(route.stops.map((id) => byId(id).coords), true);
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
  function drawRouteLine(routeId) {
    const route = ROUTES.find((r) => r.id === routeId);
    if (route) drawLine(route.stops.map((id) => byId(id).coords), route.color);
  }
  function drawItineraryLine() { drawLine(itineraryLatLngs(), TRIP.color); }
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
  function selectHotel(id) {
    const h = hotelById(id); if (!h) return;
    if (state.panel !== 'itinerario') setPanel('itinerario');
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
    state.activeRoute = null;
    state.hidden = {};
    removeRouteLine();
    if (p === 'itinerario') { drawItineraryLine(); if (map) fitLatLngs(itineraryLatLngs(), true); }
    renderSummary();
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
    if (state.panel === 'itinerario') drawItineraryLine(); else removeRouteLine();
    updateMarkers();
    if (map) fitAllBounds(true);
  }

  // ── Boot ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderSummary();
    renderTabs();
    renderItinerary();
    renderRoutes();
    renderAreas();
    renderDrawer();
    initMap();

    els.tabItinerario.addEventListener('click', () => setPanel('itinerario'));
    els.tabPercorsi.addEventListener('click', () => setPanel('percorsi'));
    els.tabAree.addEventListener('click', () => setPanel('aree'));
    document.getElementById('closeBtn').addEventListener('click', closeDrawer);
    document.getElementById('showAllBtn').addEventListener('click', showAll);
  });
})();
