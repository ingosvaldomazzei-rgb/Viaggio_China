// App del viaggio in Cina — single-page app senza build step.
// Pagine (indirizzo dopo #):
//   /             Oggi: conto alla rovescia, poi il giorno corrente
//   /itinerario   tappe in ordine con spostamenti
//   /mappa        mappa del viaggio
//   /info         voli, hotel, numeri utili
//   /citta/ID     città → giorni e punti da vedere
//   /giorno/DATA  giorno → programma e punti
//   /punto/ID     punto da vedere
// Tutti i contenuti arrivano da data.js.

(() => {
  'use strict';

  // ── Dati derivati ────────────────────────────────────────────────────
  const PLACES = [];
  REGIONS.forEach((r) => r.places.forEach((p) => { p.color = r.color; p.regionName = r.name; PLACES.push(p); }));
  const placeById = (id) => PLACES.find((p) => p.id === id);
  const hotelById = (id) => HOTELS.find((h) => h.id === id);
  const pointById = (id) => POINTS.find((p) => p.id === id);
  const dayByDate = (d) => DAYS.find((x) => x.date === d);
  const STAYS = TRIP.steps.filter((s) => s.type === 'stay');
  STAYS.forEach((s, i) => { s.order = i + 1; });
  const stayOf = (placeId) => STAYS.find((s) => s.placeId === placeId);
  const daysOf = (placeId) => DAYS.filter((d) => d.placeId === placeId);
  const pointsOf = (placeId) => POINTS.filter((p) => p.placeId === placeId);
  const photosOf = (placeId) => PHOTOS[placeId] || [];
  const movesOn = (date) => TRIP.steps.filter((s) => s.type === 'move' && s.date === date);
  const daysWithPoint = (pid) => DAYS.filter((d) => d.points.includes(pid));
  const pointPhoto = (pt) => (pt.photo !== undefined ? photosOf(pt.placeId)[pt.photo] : null);
  // Hotel della notte che inizia in quella data (null l'ultimo giorno).
  const hotelForNight = (date) => {
    const st = STAYS.find((s) => s.nights > 0 && s.from <= date && date < s.to);
    return st ? { stay: st, hotel: st.hotelId ? hotelById(st.hotelId) : null } : null;
  };

  // ── Utilità ──────────────────────────────────────────────────────────
  const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = (iso, opts) => parseISO(iso).toLocaleDateString('it-IT', opts);
  const fmtDate = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtLong = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtRange = (a, b) => (a === b ? fmtDate(a) : fmtDate(a) + ' → ' + fmtDate(b));
  const nightsLabel = (n) => (n === 0 ? 'solo giornata' : n + (n === 1 ? ' notte' : ' notti'));
  const dayIndex = (date) => DAYS.findIndex((d) => d.date === date);
  // ?oggi=AAAA-MM-GG nell'indirizzo simula una data (per provare la pagina Oggi).
  function todayISO() {
    const forced = new URLSearchParams(location.search).get('oggi');
    if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) return forced;
    const n = new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
  }
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  // Icona del primo mezzo citato ("Taxi/Didi, oppure metro" → auto).
  function moveIcon(m) {
    const kinds = [['✈', /volo/i], ['🚄', /treno|airport link|metro/i], ['🚗', /taxi|auto|navetta/i]];
    let best = ['🚗', Infinity];
    kinds.forEach(([icon, re]) => { const i = m.mode.search(re); if (i >= 0 && i < best[1]) best = [icon, i]; });
    return best[0];
  }

  // ── Pezzi di interfaccia riutilizzati ─────────────────────────────────
  function moveHtml(m, asCard) {
    return '<div class="move' + (m.status === 'todo' ? ' move--todo' : '') + (asCard ? ' move--card' : '') + '">' +
      '<div class="move__icon">' + moveIcon(m) + '</div><div>' +
        '<div class="move__title">' + esc(m.title) + '</div>' +
        '<div class="move__meta">' + (asCard ? fmtDate(m.date) + ' · ' : '') + esc(m.mode) + ' · ' + esc(m.time) + '</div>' +
        (m.detail ? '<div class="move__detail">' + esc(m.detail) + '</div>' : '') +
        (m.status === 'todo' ? '<div class="chips"><span class="chip chip--warn">Mezzo da definire</span></div>' : '') +
      '</div></div>';
  }
  function dayRow(d) {
    const place = placeById(d.placeId);
    const n = d.points.length;
    return '<a class="row" href="#/giorno/' + d.date + '" style="--c:' + place.color + '">' +
      '<span class="row__badge"><span class="row__badge-day">' + parseISO(d.date).getDate() + '</span>' +
        '<span class="row__badge-month">' + fmt(d.date, { weekday: 'short' }) + '</span></span>' +
      '<span class="row__text"><span class="row__title">' + esc(d.title) + '</span>' +
        '<span class="row__sub">' + (n ? n + (n === 1 ? ' punto in programma' : ' punti in programma') : 'Programma da definire') + '</span></span>' +
      '<span class="row__chev">›</span></a>';
  }
  function pointRow(pt) {
    const ph = pointPhoto(pt);
    return '<a class="row" href="#/punto/' + pt.id + '">' +
      (ph ? '<img class="row__thumb" src="' + esc(ph.src) + '" alt="" loading="lazy">' : '<span class="row__thumb"></span>') +
      '<span class="row__text"><span class="row__title">' + esc(pt.name) + (pt.cnName ? ' <span class="cn">' + esc(pt.cnName) + '</span>' : '') + '</span>' +
        '<span class="row__sub">' + esc(pt.summary || 'Dettagli da completare') + '</span></span>' +
      '<span class="row__chev">›</span></a>';
  }
  function hotelCard(h, extra) {
    return '<div class="card card--accent" style="--c:#211C18">' +
      '<h3>🛏 ' + esc(h.name) + (h.cnName ? ' <span class="cn">' + esc(h.cnName) + '</span>' : '') + '</h3>' +
      '<div class="kv">' + esc(h.address) + '</div>' +
      '<div class="kv">Check-in <b>' + fmtDate(h.checkIn) + '</b> · check-out <b>' + fmtDate(h.checkOut) + '</b> · ' + nightsLabel(h.nights) + '</div>' +
      (extra ? '<p class="small muted">' + esc(h.info) + '</p>' : '') +
      '<div class="btn-row">' +
        '<button class="btn" type="button" data-driver="' + h.id + '">Mostra all’autista</button>' +
        '<a class="btn" href="#/mappa/hotel/' + h.id + '">Sulla mappa</a>' +
        '<a class="btn" href="' + esc(h.link) + '" target="_blank" rel="noopener">Scheda ↗</a>' +
      '</div></div>';
  }
  function creditsHtml(photos) {
    if (!photos.length) return '';
    return '<div class="credits">Foto: ' + photos.map((ph) =>
      '<a href="' + esc(ph.page) + '" target="_blank" rel="noopener">' + esc(ph.author) + '</a> (' + esc(ph.license) + ')').join(' · ') +
      ' — Wikimedia Commons</div>';
  }
  function heroHtml(photo, eyebrow, title, cn) {
    if (!photo) {
      return '<div class="hero hero--plain"><div class="topbar__eyebrow">' + esc(eyebrow) + '</div>' +
        '<h2 class="hero__title serif" style="color:var(--ink)">' + esc(title) + (cn ? ' <span class="cn">' + esc(cn) + '</span>' : '') + '</h2></div>';
    }
    return '<div class="hero"><img src="' + esc(photo.src) + '" alt="' + esc(photo.title) + '">' +
      '<a class="hero__credit" href="' + esc(photo.page) + '" target="_blank" rel="noopener">© ' + esc(photo.author) + '</a>' +
      '<div class="hero__text"><div class="hero__eyebrow">' + esc(eyebrow) + '</div>' +
      '<h2 class="hero__title">' + esc(title) + (cn ? '<span class="cn">' + esc(cn) + '</span>' : '') + '</h2></div></div>';
  }
  const section = (title, body) => '<section class="section">' + (title ? '<h2 class="section__title">' + esc(title) + '</h2>' : '') + body + '</section>';

  // ── Mappe (Leaflet) ──────────────────────────────────────────────────
  // CARTO ora richiede una chiave gratuita (carto.com/basemaps/apikey): se
  // presente usa lo stile Voyager con nomi latini, altrimenti OpenStreetMap.
  const CARTO_KEY = '';
  let maps = [];
  function clearMaps() { maps.forEach((m) => m.remove()); maps = []; }
  function newMap(el, opts) {
    const map = L.map(el, Object.assign({ zoomControl: false, attributionControl: true }, opts || {}));
    if (CARTO_KEY) {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=' + CARTO_KEY,
        { subdomains: 'abcd', maxZoom: 18, attribution: '© OpenStreetMap · © CARTO' }).addTo(map);
    } else {
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    }
    maps.push(map);
    return map;
  }
  const numIcon = (n, color, size) => L.divIcon({ className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: '<div class="pin-num" style="width:' + size + 'px;height:' + size + 'px;background:' + color + ';font-size:' + Math.round(size * .45) + 'px">' + n + '</div>' });
  const hotelIcon = () => L.divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 14], html: '<div class="pin-hotel">🛏</div>' });
  const pointIcon = () => L.divIcon({ className: '', iconSize: [14, 14], iconAnchor: [7, 7], html: '<div class="pin-point"></div>' });

  // Linea del percorso come SVG gestito a mano: in Leaflet 1.9.4 il primo
  // layer vettoriale aggiunto a una mappa con soli DivIcon lancia un errore
  // in Path/_clipPoints, quindi si evita del tutto il sistema vettoriale.
  function drawLine(map, latlngs, color) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('style', 'position:absolute;overflow:visible;pointer-events:none;left:0;top:0;');
    const poly = document.createElementNS(svgNS, 'polyline');
    [['fill', 'none'], ['stroke', color], ['stroke-width', '3.5'], ['stroke-dasharray', '2 10'], ['stroke-linecap', 'round'], ['opacity', '.9']]
      .forEach(([k, v]) => poly.setAttribute(k, v));
    svg.appendChild(poly);
    map.getPane('overlayPane').appendChild(svg);
    const redraw = () => {
      try { poly.setAttribute('points', latlngs.map((ll) => { const p = map.latLngToLayerPoint(ll); return p.x + ',' + p.y; }).join(' ')); }
      catch (e) { /* frame intermedio di un'animazione: si riprova al prossimo evento */ }
    };
    map.on('move zoom viewreset', redraw);
    redraw();
  }

  function tripMap(el, focus) {
    const map = newMap(el, { minZoom: 3 });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const path = TRIP.path.map((id) => placeById(id).coords);
    drawLine(map, path, TRIP.color);
    PLACES.forEach((p) => {
      const st = stayOf(p.id);
      const m = L.marker(p.coords, { icon: st ? numIcon(st.order, TRIP.color, 28) : L.divIcon({ className: '', iconSize: [12, 12], iconAnchor: [6, 6], html: '<div class="pin-point" style="width:12px;height:12px;border-color:' + p.color + '"></div>' }) }).addTo(map);
      m.bindPopup('<div class="map-pop"><b>' + esc(p.name) + '</b><br>' +
        (st ? fmtRange(st.from, st.to) + ' · ' + nightsLabel(st.nights) + '<br><a href="#/citta/' + p.id + '">Apri la città ›</a>' : 'Solo transito') + '</div>');
    });
    const hotelLayer = L.layerGroup();
    HOTELS.forEach((h) => {
      L.marker(h.coords, { icon: hotelIcon(), zIndexOffset: 500 })
        .bindPopup('<div class="map-pop"><b>🛏 ' + esc(h.name) + '</b><br>' + fmtRange(h.checkIn, h.checkOut) + '<br><a href="#/citta/' + h.placeId + '">Apri la città ›</a></div>')
        .addTo(hotelLayer);
    });
    POINTS.filter((pt) => pt.coords).forEach((pt) => {
      L.marker(pt.coords, { icon: pointIcon() }).bindPopup('<div class="map-pop"><b>' + esc(pt.name) + '</b><br><a href="#/punto/' + pt.id + '">Apri ›</a></div>').addTo(hotelLayer);
    });
    // Hotel e punti solo da vicino, per non coprire i numeri delle tappe.
    const sync = () => { if (map.getZoom() >= 10) hotelLayer.addTo(map); else hotelLayer.remove(); };
    map.on('zoomend', sync);
    if (focus) map.setView(focus, 15); else map.fitBounds(L.latLngBounds(path), { padding: [30, 30] });
    sync();
    return map;
  }

  function miniMap(el, place, points, hotel) {
    const map = newMap(el, { dragging: !L.Browser.mobile, scrollWheelZoom: false, tap: false });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const pts = [place.coords];
    if (hotel) { L.marker(hotel.coords, { icon: hotelIcon() }).bindPopup('🛏 ' + esc(hotel.name)).addTo(map); pts.push(hotel.coords); }
    points.filter((p) => p.coords).forEach((p) => {
      L.marker(p.coords, { icon: pointIcon() }).bindPopup('<div class="map-pop"><a href="#/punto/' + p.id + '">' + esc(p.name) + ' ›</a></div>').addTo(map);
      pts.push(p.coords);
    });
    if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 });
    else map.setView(place.coords, 12);
  }

  // ── Pagine ───────────────────────────────────────────────────────────
  const view = document.getElementById('view');

  function pageToday() {
    const today = todayISO();
    const first = DAYS[0].date, last = DAYS[DAYS.length - 1].date;
    let html = '';
    if (today < first) {
      const n = daysBetween(today, first);
      html += '<div class="countdown"><div class="countdown__num">' + n + '</div>' +
        '<div class="countdown__label">' + (n === 1 ? 'giorno alla partenza' : 'giorni alla partenza') + '</div>' +
        '<div class="countdown__sub">Arrivo a Shanghai ' + fmtLong(first) + ' · rientro ' + fmtLong(last) + '</div></div>';
      html += section('Il primo giorno', '<div class="list">' + dayRow(DAYS[0]) + '</div>');
      html += section('Prima di partire', '<div class="card"><ul class="checklist">' +
        '<li>Installate questa app sul telefono (vedi Info › App offline) e apritela almeno una volta con internet.</li>' +
        '<li>Aprite le pagine delle città e la mappa ingrandendo sulle zone degli hotel: le mappe viste restano salvate per l’uso offline.</li>' +
        '<li>Registrate il viaggio su Dove Siamo nel Mondo (app Viaggiare Sicuri).</li>' +
        '<li>Configurate Alipay o WeChat Pay e scaricate le app utili (vedi Info).</li>' +
        '</ul></div>');
    } else if (today > last) {
      html += '<div class="countdown"><div class="countdown__num">再见</div><div class="countdown__label">Viaggio concluso</div>' +
        '<div class="countdown__sub">Bentornati! L’itinerario resta consultabile.</div></div>';
      html += section('Rivedi il viaggio', '<div class="list">' + DAYS.map(dayRow).join('') + '</div>');
    } else {
      const d = dayByDate(today);
      const i = dayIndex(today);
      const place = placeById(d.placeId);
      html += '<div class="today-head">Giorno ' + (i + 1) + ' di ' + DAYS.length + ' · ' + esc(fmtLong(today)) + '</div>';
      html += dayBody(d, place, true);
      if (DAYS[i + 1]) html += section('Domani', '<div class="list">' + dayRow(DAYS[i + 1]) + '</div>');
    }
    return { title: 'Oggi', eyebrow: 'Viaggio in Cina · ' + TRIP.dates, html };
  }

  function pageItinerary() {
    let html = '<p class="lead">' + STAYS.reduce((a, s) => a + s.nights, 0) + ' notti, ' + STAYS.length +
      ' tappe: da Shanghai a Pechino passando per il Guangxi e Chongqing. Tocca una tappa per i giorni e i punti da vedere.</p>';
    html += '<section class="section">';
    TRIP.steps.forEach((s) => {
      if (s.type === 'move') { html += moveHtml(s, false); return; }
      const place = placeById(s.placeId);
      const ph = photosOf(place.id)[0];
      const hotel = s.hotelId ? hotelById(s.hotelId) : null;
      html += '<a class="stay" href="#/citta/' + place.id + '" style="--c:' + place.color + '">' +
        '<div class="stay__img">' + (ph ? '<img src="' + esc(ph.src) + '" alt="" loading="lazy">' : '') +
          '<span class="stay__num" style="--c:' + TRIP.color + '">' + s.order + '</span></div>' +
        '<div class="stay__body"><div class="stay__name">' + esc(place.name) + ' <span class="cn">' + esc(place.cnName) + '</span></div>' +
          '<div class="stay__dates">' + fmtRange(s.from, s.to) + ' · ' + nightsLabel(s.nights) + '</div>' +
          (hotel ? '<div class="stay__hotel">🛏 ' + esc(hotel.name) + '</div>'
            : s.nights > 0 ? '<div class="stay__hotel stay__hotel--todo">🛏 ' + esc(s.hotelNote || 'Hotel da definire') + '</div>' : '') +
        '</div></a>';
    });
    html += '</section>';
    return { title: 'Itinerario', eyebrow: TRIP.dates, html };
  }

  function pageMap(hotelId) {
    view.classList.add('view--map');
    const h = hotelId ? hotelById(hotelId) : null;
    return { title: h ? h.name : 'Mappa del viaggio', eyebrow: h ? 'Hotel' : TRIP.dates, back: !!h,
      html: '<div class="map-full" id="bigMap"></div>', after: () => tripMap(document.getElementById('bigMap'), h ? h.coords : null) };
  }

  function pageCity(id) {
    const place = placeById(id);
    if (!place) return notFound();
    const st = stayOf(id);
    const photos = photosOf(id);
    const hotel = st && st.hotelId ? hotelById(st.hotelId) : null;
    const days = daysOf(id);
    const pts = pointsOf(id);
    let html = heroHtml(photos[0], place.regionName, place.name, place.cnName);
    html += '<div class="chips">' +
      (st ? '<span class="chip">📅 ' + fmtRange(st.from, st.to) + '</span><span class="chip">' + nightsLabel(st.nights) + '</span>' : '<span class="chip">Solo transito</span>') +
      '<span class="chip">' + esc(place.type) + '</span></div>';
    html += '<section class="section"><p class="lead">' + esc(place.description) + '</p></section>';
    if (days.length) html += section('I giorni a ' + place.name, '<div class="list">' + days.map(dayRow).join('') + '</div>');
    if (pts.length) html += section('Punti da vedere', '<div class="list">' + pts.map(pointRow).join('') + '</div>');
    if (hotel) html += section('Dove dormite', hotelCard(hotel, true));
    else if (st && st.nights > 0) html += section('Dove dormite', '<div class="empty">🛏 ' + esc(st.hotelNote || 'Hotel da definire') + (st.todo ? '. ' + esc(st.todo) : '') + '</div>');
    html += section('Come arrivare', '<div class="card"><p style="margin:0">' + esc(place.howToGet) + '</p></div>');
    html += section('Sulla mappa', '<div class="map-mini" id="miniMap"></div>');
    if (photos.length > 1) {
      html += section('Foto', '<div class="gallery">' + photos.slice(1).map((ph) => '<img src="' + esc(ph.src) + '" alt="' + esc(ph.title) + '" title="' + esc(ph.title) + '" loading="lazy">').join('') + '</div>' + creditsHtml(photos));
    } else html += creditsHtml(photos);
    return { title: place.name, eyebrow: st ? 'Tappa ' + st.order + ' · ' + fmtRange(st.from, st.to) : 'Transito', back: true, parent: '#/itinerario',
      html, after: () => miniMap(document.getElementById('miniMap'), place, pts, hotel) };
  }

  function dayBody(d, place, compact) {
    let html = '';
    if (!compact) html += '<a class="chip" href="#/citta/' + place.id + '" style="text-decoration:none">← ' + esc(place.name) + '</a>';
    html += '<section class="section" style="margin-top:12px"><h2 class="serif" style="margin:0;font-size:26px;line-height:1.2;font-weight:600">' + esc(d.title) + '</h2>' +
      (d.plan ? '<p class="lead" style="margin-top:8px">' + esc(d.plan) + '</p>' : '') + '</section>';
    const moves = movesOn(d.date);
    if (moves.length) html += section('Spostamenti', moves.map((m) => moveHtml(m, true)).join(''));
    const pts = d.points.map(pointById).filter(Boolean);
    html += section('In programma', pts.length ? '<div class="list">' + pts.map(pointRow).join('') + '</div>'
      : '<div class="empty">Programma da definire: ancora nessun punto assegnato a questo giorno.</div>');
    const night = hotelForNight(d.date);
    if (night) {
      html += section('Stanotte', night.hotel ? hotelCard(night.hotel, false)
        : '<div class="empty">🛏 ' + esc(night.stay.hotelNote || 'Hotel da definire') + '</div>');
    }
    if (compact) html += '<div class="btn-row"><a class="btn btn--primary" href="#/giorno/' + d.date + '">Apri la pagina del giorno</a><a class="btn" href="#/citta/' + place.id + '">' + esc(place.name) + '</a></div>';
    return html;
  }

  function pageDay(date) {
    const d = dayByDate(date);
    if (!d) return notFound();
    const place = placeById(d.placeId);
    const i = dayIndex(date);
    let html = dayBody(d, place, false);
    const pts = d.points.map(pointById).filter((p) => p && p.coords);
    if (pts.length) html += section('Mappa del giorno', '<div class="map-mini" id="miniMap"></div>');
    const prev = DAYS[i - 1], next = DAYS[i + 1];
    html += '<div class="pager">' +
      (prev ? '<a href="#/giorno/' + prev.date + '"><span>‹ ' + fmtDate(prev.date) + '</span>' + esc(prev.title) + '</a>' : '<a class="empty-slot"></a>') +
      (next ? '<a href="#/giorno/' + next.date + '"><span>' + fmtDate(next.date) + ' ›</span>' + esc(next.title) + '</a>' : '<a class="empty-slot"></a>') +
      '</div>';
    const hotel = (hotelForNight(date) || {}).hotel;
    return { title: fmtLong(date), eyebrow: 'Giorno ' + (i + 1) + ' · ' + place.name, back: true, parent: '#/citta/' + place.id,
      html, after: pts.length ? () => miniMap(document.getElementById('miniMap'), place, pts, hotel) : null };
  }

  function pagePoint(id) {
    const pt = pointById(id);
    if (!pt) return notFound();
    const place = placeById(pt.placeId);
    const ph = pointPhoto(pt);
    let html = heroHtml(ph, place.name, pt.name, pt.cnName);
    html += '<section class="section">' + (pt.summary ? '<p class="lead">' + esc(pt.summary) + '</p>'
      : '<div class="empty">Dettagli da completare: descrizione, orari, biglietti e consigli.</div>') + '</section>';
    if (pt.hours) html += section('Orari', '<div class="card"><p style="margin:0">' + esc(pt.hours) + '</p></div>');
    if (pt.tickets) html += section('Biglietti e prenotazione', '<div class="card"><p style="margin:0">' + esc(pt.tickets) + '</p></div>');
    if (pt.tips && pt.tips.length) html += section('Consigli', '<div class="card"><ul class="checklist">' + pt.tips.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></div>');
    const days = daysWithPoint(pt.id);
    html += section('Quando', days.length ? '<div class="list">' + days.map(dayRow).join('') + '</div>'
      : '<div class="empty">Non ancora assegnato a un giorno.</div>');
    if (pt.coords) html += section('Dove', '<div class="map-mini" id="miniMap"></div>');
    if (pt.cnName) {
      html += '<div class="btn-row"><a class="btn" href="https://uri.amap.com/search?keyword=' + encodeURIComponent(pt.cnName) + '" target="_blank" rel="noopener">Apri in Amap ↗</a></div>';
    }
    if (ph) html += creditsHtml([ph]);
    return { title: pt.name, eyebrow: place.name, back: true, parent: '#/citta/' + place.id,
      html, after: pt.coords ? () => miniMap(document.getElementById('miniMap'), place, [pt], null) : null };
  }

  function pageInfo() {
    let html = '';
    html += section('Voli e treni', TRIP.steps.filter((s) => s.type === 'move').map((m) => moveHtml(m, true)).join(''));
    html += section('Hotel', HOTELS.map((h) => hotelCard(h, false)).join('') +
      STAYS.filter((s) => s.nights > 0 && !s.hotelId).map((s) => '<div class="empty" style="margin-top:10px">🛏 ' + esc(placeById(s.placeId).name) + ': ' + esc(s.hotelNote || 'hotel da definire') + '</div>').join(''));
    html += section('Emergenze in Cina', '<div class="list">' + INFO.emergency.map((e) =>
      '<a class="tel" href="tel:' + e.number + '"><span>' + esc(e.label) + '</span><span class="tel__num">' + e.number + '</span></a>').join('') + '</div>');
    html += section('Ambasciata e consolati', INFO.consular.map((c) =>
      '<div class="card"><h3>' + esc(c.label) + '</h3>' +
        (c.phone ? '<div class="kv">Ufficio: <a href="tel:' + c.phone.replace(/\s/g, '') + '"><b>' + esc(c.phone) + '</b></a></div>' : '') +
        (c.emergency ? '<div class="kv">Emergenze: <a href="tel:' + c.emergency.replace(/\s/g, '') + '"><b>' + esc(c.emergency) + '</b></a></div>' : '') +
        '<p class="small muted">' + esc(c.note) + '</p>' +
        '<div class="btn-row"><a class="btn" href="' + esc(c.link) + '" target="_blank" rel="noopener">Sito ufficiale ↗</a></div></div>').join(''));
    html += section('App utili', '<div class="list">' + INFO.apps.map((a) =>
      '<div class="row"><span class="row__text"><span class="row__title">' + esc(a.name) + '</span><span class="row__sub">' + esc(a.why) + '</span></span></div>').join('') + '</div>');
    html += section('App offline', '<div class="card" id="offlineCard">' +
      '<p style="margin:0" id="offlineStatus">Controllo in corso…</p>' +
      '<p class="small muted"><b>iPhone:</b> apri il link in Safari › tasto Condividi › “Aggiungi alla schermata Home”.<br>' +
      '<b>Android:</b> apri il link in Chrome › menu ⋮ › “Installa app” o “Aggiungi a schermata Home”.</p>' +
      '<p class="small muted">Le mappe funzionano offline solo nelle zone già visualizzate con internet.</p></div>');
    return { title: 'Info utili', eyebrow: 'Viaggio in Cina', html, after: updateOfflineStatus };
  }

  function notFound() {
    return { title: 'Pagina non trovata', eyebrow: 'Viaggio in Cina', back: true, parent: '#/',
      html: '<div class="empty">Questa pagina non esiste. <a href="#/">Torna a Oggi</a>.</div>' };
  }

  // ── Router ───────────────────────────────────────────────────────────
  const backBtn = document.getElementById('backBtn');
  let currentParent = '#/';
  // Pagine visitate in questa sessione: "indietro" torna alla precedente se
  // c'è, altrimenti (link aperto direttamente) va alla pagina "madre".
  const visited = [];

  function route() {
    const h = location.hash || '#/';
    if (visited.length > 1 && visited[visited.length - 2] === h) visited.pop();
    else if (visited[visited.length - 1] !== h) visited.push(h);
    const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
    clearMaps();
    view.classList.remove('view--map');
    let page, tab = 'oggi';
    switch (parts[0]) {
      case undefined: page = pageToday(); break;
      case 'itinerario': page = pageItinerary(); tab = 'itinerario'; break;
      case 'mappa': page = pageMap(parts[1] === 'hotel' ? parts[2] : null); tab = 'mappa'; break;
      case 'info': page = pageInfo(); tab = 'info'; break;
      case 'citta': page = pageCity(parts[1]); tab = 'itinerario'; break;
      case 'giorno': page = pageDay(parts[1]); tab = 'itinerario'; break;
      case 'punto': page = pagePoint(parts[1]); tab = 'itinerario'; break;
      default: page = notFound();
    }
    document.getElementById('topTitle').textContent = page.title;
    document.getElementById('topEyebrow').textContent = page.eyebrow || '';
    document.title = page.title + ' · Viaggio in Cina';
    backBtn.hidden = !page.back;
    currentParent = page.parent || '#/';
    document.querySelectorAll('.tabbar__item').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
    view.innerHTML = page.html;
    if (!view.classList.contains('view--map')) { view.style.animation = 'none'; void view.offsetWidth; view.style.animation = ''; }
    window.scrollTo(0, 0);
    if (page.after) page.after();
    // Le mappe misurano il riquadro alla creazione: ricalcolo dopo il layout.
    setTimeout(() => maps.forEach((m) => m.invalidateSize()), 150);
  }

  backBtn.addEventListener('click', () => {
    if (visited.length > 1) history.back(); else location.hash = currentParent;
  });
  window.addEventListener('hashchange', route);

  // ── Scheda "mostra all'autista" ──────────────────────────────────────
  const driver = document.getElementById('driverCard');
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-driver]');
    if (!b) return;
    const h = hotelById(b.dataset.driver);
    document.getElementById('driverBody').innerHTML =
      (h.cnName ? '<div class="driver__cn">' + esc(h.cnName) + '</div>' : '') +
      '<div class="driver__en"><b>' + esc(h.name) + '</b><br>' + esc(h.address) + '</div>' +
      '<div class="driver__hint">Mostrate questa schermata al tassista.' + (h.cnName ? '' : ' Nome cinese dell’hotel non ancora inserito: chiedetelo alla reception e aggiungetelo.') + '</div>';
    driver.hidden = false;
  });
  document.getElementById('driverClose').addEventListener('click', () => { driver.hidden = true; });

  // ── Offline (service worker) ─────────────────────────────────────────
  function updateOfflineStatus() {
    const el = document.getElementById('offlineStatus');
    if (!el) return;
    if (!('serviceWorker' in navigator)) { el.textContent = 'Questo browser non supporta l’uso offline.'; return; }
    navigator.serviceWorker.getRegistration().then((reg) => {
      el.innerHTML = reg && reg.active
        ? '✅ <b>Pronta per l’uso offline.</b> Pagine, foto e caratteri sono salvati su questo telefono.'
        : '⏳ Salvataggio per l’uso offline in corso: riaprite questa pagina tra qualche secondo.';
    });
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  route();
})();
