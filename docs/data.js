// Data model for the China trip map: the places of the decided itinerary
// (grouped by area), the chosen hotels and the day-by-day trip (TRIP).

const REGIONS = [
  { id: 'est', name: 'Est · Shanghai e dintorni', color: '#3E5C9A', places: [
    { id: 'shanghai', name: 'Shanghai', cnName: '上海', coords: [31.2304, 121.4737], type: 'Città',
      description: "La metropoli più scintillante della Cina: sul Bund gli edifici coloniali guardano lo skyline futuristico di Pudong al di là del fiume. Tra il classico Giardino Yu, i caffè della Concessione Francese e i grattacieli panoramici, è un ottimo punto di partenza o di rientro.",
      highlights: ['Il Bund', 'Skyline di Pudong', 'Giardino Yu', 'Concessione Francese'],
      howToGet: "Si arriva all'aeroporto di Pudong (PVG) il 17; ci si torna il 18 da Tongli/Suzhou e il 22 si parte in volo da Hongqiao (SHA) per Guilin." },
    { id: 'suzhou', name: 'Suzhou', cnName: '苏州', coords: [31.2989, 120.5853], type: 'Città',
      description: "La Venezia d'Oriente, celebre per i giardini classici patrimonio UNESCO: microcosmi di rocce, acqua e padiglioni concepiti come dipinti tridimensionali. Canali, ponti in pietra e l'antica tradizione della seta completano il fascino della città vecchia.",
      highlights: ['Giardini classici', 'Canali', 'Seta', 'Città vecchia'],
      howToGet: "Il 17 dall'aeroporto PVG: Airport Link Line fino a Hongqiao, poi treno AV (~1h 30m in tutto)." },
    { id: 'tongli', name: 'Tongli', cnName: '同里', coords: [31.1560, 120.7250], type: 'Borgo d’acqua',
      description: "Uno dei borghi d'acqua più armoniosi vicino a Suzhou: una rete di canali attraversati da ponti in pietra, case affacciate sull'acqua e il raffinato giardino Tuisi. Perfetto per una mezza giornata in barca a remi, lontano dalla folla.",
      highlights: ['Canali e ponti', 'Giardino Tuisi', 'Barche a remi'],
      howToGet: "Da Suzhou ~50 min in taxi/Didi (28 km), oppure metro linea 4 + bus (~1h 40m)." },
  ]},
  { id: 'guangxi', name: 'Sud · Guangxi', color: '#5E8C3A', places: [
    { id: 'guilin', name: 'Guilin', cnName: '桂林', coords: [25.2736, 110.2907], type: 'Città',
      description: "Città-base immersa nel paesaggio carsico più celebre del paese, tra colline a pan di zucchero e il fiume Li. Offre grotte spettacolari, laghi urbani con pagode illuminate e ottime connessioni verso Yangshuo e i villaggi dei dintorni.",
      highlights: ['Fiume Li', 'Collina della Proboscide', 'Grotte del Flauto di Canna'],
      howToGet: "Solo transito: il 22 si atterra all'aeroporto di Guilin e si prosegue subito per Yangshuo (~1h 15m–1h 30m)." },
    { id: 'yangshuo', name: 'Yangshuo', cnName: '阳朔', coords: [24.7791, 110.4966], type: 'Natura',
      description: "Il regno dei pinnacoli carsici lungo il fiume Li: la crociera da Guilin regala gli scenari da dipinto che si ritrovano persino sulle banconote. Attorno, campi e terrazze di tè, villaggi rurali da girare in bici e lo spettacolo serale dei pescatori con i cormorani.",
      highlights: ['Fiume Li', 'Colline carsiche', 'Terrazze di tè', 'Cormorani'],
      howToGet: "Arrivo il 22 dall'aeroporto di Guilin in navetta o taxi (~85 km); il 25 si riparte in treno AV per Chongqing." },
  ]},
  { id: 'chongqing', name: 'Sud-ovest · Chongqing', color: '#2E7D64', places: [
    { id: 'chongqing', name: 'Chongqing', cnName: '重庆', coords: [29.5630, 106.5516], type: 'Città',
      description: "Megalopoli verticale abbarbicata sulle colline alla confluenza di due fiumi: grattacieli su più livelli, la monorotaia che attraversa i palazzi, hot pot bollente e il vecchio quartiere di Ciqikou. È anche il porto d'imbarco per le crociere lungo lo Yangtze e le Tre Gole.",
      highlights: ['Hot pot', 'Hongyadong', 'Ciqikou', 'Crociere sullo Yangtze'],
      howToGet: "Arrivo il 25 in treno ad alta velocità da Guilin/Yangshuo; partenza il 27 sera in volo per Pechino." },
  ]},
  { id: 'nord', name: 'Nord · Pechino', color: '#C0392B', places: [
    { id: 'beijing', name: 'Pechino', cnName: '北京', coords: [39.9042, 116.4074], type: 'Città',
      description: "Cuore politico e millenario della Cina. Si passa dalla sterminata Piazza Tienanmen ai cortili della Città Proibita, dai vicoli (hutong) in risciò ai tratti più panoramici della Grande Muraglia come Mutianyu o Jinshanling. Da mettere in conto almeno un'intera giornata per la Muraglia.",
      highlights: ['Città Proibita', 'Grande Muraglia (Mutianyu)', 'Tempio del Cielo', 'Hutong'],
      howToGet: "Arrivo il 27 sera in volo da Chongqing; il 1° novembre volo di rientro in Italia." },
  ]},
];

// ── Itinerario definitivo (17 ott – 1 nov 2026) ───────────────────────────
// Date, tappe, notti e hotel sono quelli decisi dai viaggiatori. Durate e
// mezzi dei trasferimenti sono stime verificate su fonti online: quando il
// mezzo non è ancora scelto lo step è marcato status: 'todo'.

const HOTELS = [
  { id: 'h-tongli', placeId: 'tongli', name: 'Floral Hotel · Tongli Ancient Town Jianyuan Inn',
    address: 'No. 38 Dongxi Street, Wujiang District, Suzhou',
    coords: [31.1585, 120.7240], precise: false,
    coordsNote: 'Posizione indicativa nel centro della città antica: la via non è mappata su OpenStreetMap.',
    checkIn: '2026-10-17', checkOut: '2026-10-18', nights: 1,
    info: 'Dentro la città antica di Tongli, 14 camere con cortile interno.',
    link: 'https://www.trip.com/hotels/suzhou-hotel-detail-22652352/floral-hotel-tongli-ancient-town-jianyuan-inn/' },
  { id: 'h-yangshuo', placeId: 'yangshuo', name: 'GuYu · Mountain View Hotel', cnName: '谷语·见山民宿',
    address: 'No. 73, Tieling Village, Yangshuo, Guangxi',
    coords: [24.7690, 110.4620], precise: true,
    coordsNote: 'Coordinate dalla scheda Trip.com.',
    checkIn: '2026-10-22', checkOut: '2026-10-25', nights: 3,
    info: 'In campagna, zona fiume Yulong: circa 3,5 km in linea d’aria da West Street, il centro di Yangshuo. Per muoversi servono taxi/Didi o bici.',
    link: 'https://www.trip.com/hotels/yangshuo-hotel-detail-130470814/guyu-mountain-view-hotel/' },
  { id: 'h-chongqing', placeId: 'chongqing', name: 'MitAn Resort Hotel (Jiefangbei Branch)',
    address: 'No. 95 Houchi Street, Shibati, Yuzhong District, Chongqing',
    coords: [29.5529, 106.5666], precise: false,
    coordsNote: 'Posizione sulla via (OpenStreetMap); numero civico non verificato.',
    checkIn: '2026-10-25', checkOut: '2026-10-27', nights: 2,
    info: 'Zona Shibati: circa 0,7 km a piedi da Jiefangbei e 1,6 km da Hongyadong.',
    link: 'https://www.expedia.co.uk/Chongqing-Hotels-MitAn-Resort-Hotel-Jiefangbei-Branch.h127515709.Hotel-Information' },
  { id: 'h-beijing', placeId: 'beijing', name: 'RIGHT HOTEL · Jinsong Subway Station Panjiayuan Antique City', cnName: '京玺酒店',
    address: 'No. 21 Panjiayuan Dongli, Chaoyang District, Beijing',
    coords: [39.8791, 116.4496], precise: true,
    coordsNote: 'Coordinate dalla scheda Trip.com.',
    checkIn: '2026-10-27', checkOut: '2026-11-01', nights: 5,
    info: 'Vicino alle metro Jinsong e Panjiayuan (linea 10) e al mercato d’antiquariato di Panjiayuan (~0,6 km).',
    link: 'https://www.trip.com/hotels/beijing-hotel-detail-111847269/right-hotel-jinsong-subway-station-panjiayuan-antique-city/' },
];

const TRIP = {
  dates: '17 ott – 1 nov 2026',
  color: '#B23A2E',
  // Ordine degli spostamenti, per la linea sulla mappa (Guilin = solo transito).
  path: ['shanghai', 'suzhou', 'tongli', 'shanghai', 'guilin', 'yangshuo', 'chongqing', 'beijing'],
  steps: [
    { type: 'move', date: '2026-10-17', status: 'ok',
      title: 'Arrivo a Shanghai Pudong (PVG) alle 05:50 → Suzhou',
      mode: 'Airport Link Line + treno alta velocità', time: '~1h 30m di viaggio, più il ritiro bagagli',
      detail: 'Airport Link Line da PVG a Shanghai Hongqiao (~40 min), poi treno AV Hongqiao → Suzhou (20–40 min, partenze molto frequenti). Non c’è un treno AV diretto da PVG a Suzhou.' },
    { type: 'stay', placeId: 'suzhou', from: '2026-10-17', to: '2026-10-17', nights: 0,
      plan: 'Giornata a Suzhou.',
      tip: 'Avrete i bagagli con voi tutto il giorno: valutate il deposito bagagli in stazione.' },
    { type: 'move', date: '2026-10-17', status: 'todo',
      title: 'Suzhou → Tongli (sera)',
      mode: 'Taxi/Didi, oppure metro linea 4 + bus', time: '~50 min in taxi (28 km) · ~1h 40m con i mezzi' },
    { type: 'stay', placeId: 'tongli', from: '2026-10-17', to: '2026-10-18', nights: 1, hotelId: 'h-tongli',
      plan: 'Notte nella città antica. Il 18 altro giro tra Tongli e Suzhou.' },
    { type: 'move', date: '2026-10-18', status: 'todo',
      title: 'Tongli / Suzhou → Shanghai',
      mode: 'Treno AV da Suzhou, oppure auto da Tongli', time: '~25–40 min in treno AV · ~1h 30m in auto' },
    { type: 'stay', placeId: 'shanghai', from: '2026-10-18', to: '2026-10-22', nights: 4,
      plan: 'Sera del 18, poi 19, 20 e 21 pieni a Shanghai.',
      todo: 'Hotel da definire. Il 22 il volo parte molto presto da Hongqiao (SHA): conviene tenerne conto nella scelta della zona.' },
    { type: 'move', date: '2026-10-22', status: 'ok',
      title: 'Volo Shanghai Hongqiao (SHA) → Guilin (KWL), poi Yangshuo',
      mode: 'Volo + navetta/taxi', time: '~2h 30m di volo · ~1h 15m–1h 30m di strada (85 km)',
      detail: 'Dall’aeroporto di Guilin: navetta per Yangshuo (~90 min, ~50 CNY) oppure taxi/Didi (~70 min, ~300–500 CNY).' },
    { type: 'stay', placeId: 'yangshuo', from: '2026-10-22', to: '2026-10-25', nights: 3, hotelId: 'h-yangshuo',
      plan: 'Tre notti a Yangshuo.',
      todo: 'Attività da dettagliare.' },
    { type: 'move', date: '2026-10-25', status: 'ok',
      title: 'Yangshuo → Chongqing (mattina)',
      mode: 'Treno alta velocità', time: '~4h–5h 30m da Guilin Ovest a Chongqing Ovest',
      detail: 'Stazione di partenza da scegliere: Guilin Ovest (la maggior parte dei treni diretti) o Yangshuo, se c’è un treno adatto. Entrambe sono fuori dal centro: contate il trasferimento in auto dall’hotel.' },
    { type: 'stay', placeId: 'chongqing', from: '2026-10-25', to: '2026-10-27', nights: 2, hotelId: 'h-chongqing',
      plan: 'Il 26 giornata piena; il 27 fino a sera.' },
    { type: 'move', date: '2026-10-27', status: 'ok',
      title: 'Chongqing → Pechino (sera)',
      mode: 'Volo', time: '~2h 30m–3h di volo',
      detail: 'Aeroporto di arrivo a Pechino (Capital PEK o Daxing PKX) da confermare.' },
    { type: 'stay', placeId: 'beijing', from: '2026-10-27', to: '2026-11-01', nights: 5, hotelId: 'h-beijing',
      plan: 'Il 27 arrivo e riposo; 28, 29, 30 e 31 pieni a Pechino e dintorni.' },
    { type: 'move', date: '2026-11-01', status: 'ok',
      title: 'Volo di rientro in Italia',
      mode: 'Volo', time: 'Verso ora di pranzo',
      detail: 'Aeroporto da confermare: Capital (PEK) o Daxing (PKX).' },
  ],
};

// Foto delle tappe da Wikimedia Commons (licenze libere): autore e licenza
// vanno sempre mostrati, la scheda di dettaglio li elenca sotto le foto.
const PHOTOS = {
  suzhou: [
    {"src": "photos/suzhou-1.jpg", "title": "Giardino dell'Amministratore Umile", "author": "King of Hearts", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Humble_Administrator%27s_Garden_Suzhou_November_2017_005.jpg"},
    {"src": "photos/suzhou-2.jpg", "title": "Canale di Pingjiang Road", "author": "song songroov", "license": "CC BY 3.0", "page": "https://commons.wikimedia.org/wiki/File:Riverside_of_Pingjiang_Road,_Gusu,_Suzhou,_Jiangsu,_China,_215000.jpg"},
    {"src": "photos/suzhou-3.jpg", "title": "Giardino del Riposo (Liuyuan)", "author": "Another Believer", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Lingering_Garden,_Suzhou,_China_(2015)_-_07.jpg"},
    {"src": "photos/suzhou-4.jpg", "title": "Finestra tonda nel Giardino del Riposo", "author": "Another Believer", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Lingering_Garden,_Suzhou,_China_(2015)_-_27.jpg"},
  ],
  tongli: [
    {"src": "photos/tongli-1.jpg", "title": "Canali e ponti di Tongli", "author": "EditQ", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:The_Three_Bridges_of_Tongli_1.jpg"},
    {"src": "photos/tongli-2.jpg", "title": "Giardino Tuisi", "author": "Zossolino", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:2015-09-25-080503_-_Tongli,_Tuisi_Yuan_-_%E2%80%9EGarten_des_Pension%C3%A4rs%E2%80%9C.jpg"},
    {"src": "photos/tongli-3.jpg", "title": "Pescatore con i cormorani", "author": "Rose Abrams", "license": "CC BY 4.0", "page": "https://commons.wikimedia.org/wiki/File:Waters_of_Tongli_05.jpg"},
    {"src": "photos/tongli-4.jpg", "title": "Sotto un ponte in pietra", "author": "Ben Burkland/Carolyn Cook", "license": "CC BY 2.0", "page": "https://commons.wikimedia.org/wiki/File:Tongli_pic_3.jpg"},
  ],
  shanghai: [
    {"src": "photos/shanghai-1.jpg", "title": "Skyline di Pudong di sera", "author": "Larry Qian", "license": "CC0", "page": "https://commons.wikimedia.org/wiki/File:Shanghai_Lujiazui_night_skyline_2017_-_Flickr.jpg"},
    {"src": "photos/shanghai-2.jpg", "title": "Il Bund dal fiume Huangpu", "author": "Ermell", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Shanghai_Bund-20150516-RM-173803.jpg"},
    {"src": "photos/shanghai-3.jpg", "title": "Giardino Yu", "author": "Stefan Fussan", "license": "CC BY-SA 3.0", "page": "https://commons.wikimedia.org/wiki/File:Shanghai_-_Yu_Garden_-_0034.jpg"},
    {"src": "photos/shanghai-4.jpg", "title": "Wukang Mansion, Concessione Francese", "author": "N509FZ", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Wukang_Mansion_(20191114161507).jpg"},
  ],
  yangshuo: [
    {"src": "photos/yangshuo-1.jpg", "title": "Il fiume Li tra le colline carsiche", "author": "chensiyuan", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:1_li_jiang_guilin_yangshuo_2011.jpg"},
    {"src": "photos/yangshuo-2.jpg", "title": "Zattere sul fiume", "author": "Huangdan2060", "license": "CC0", "page": "https://commons.wikimedia.org/wiki/File:Li_River_and_mountains_in_Yangshuo_County,_Guilin52.jpg"},
    {"src": "photos/yangshuo-3.jpg", "title": "Collina della Luna (Moon Hill)", "author": "Maria Ly", "license": "CC BY 2.0", "page": "https://commons.wikimedia.org/wiki/File:Moon_Hill_-_Yangshuo,_China.jpg"},
    {"src": "photos/yangshuo-4.jpg", "title": "Paesaggio carsico al tramonto", "author": "chensiyuan", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:1_yangshuo_moon_hill_view_2011.jpg"},
  ],
  chongqing: [
    {"src": "photos/chongqing-1.jpg", "title": "Hongyadong di sera", "author": "GeoffLeng", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:%E9%87%8D%E5%BA%86%E6%B4%AA%E5%B4%96%E6%B4%9E.jpg"},
    {"src": "photos/chongqing-2.jpg", "title": "Chongqing dall’alto di notte", "author": "HoweyYuan", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Chaotianmen_nightview_20240721.jpg"},
    {"src": "photos/chongqing-3.jpg", "title": "Hongyadong di giorno", "author": "xiquinhosilva", "license": "CC BY 2.0", "page": "https://commons.wikimedia.org/wiki/File:Hongya_Cave_20180520.jpg"},
    {"src": "photos/chongqing-4.jpg", "title": "Skyline sul fiume", "author": "Baycrest", "license": "CC BY-SA 2.5", "page": "https://commons.wikimedia.org/wiki/File:Chongqing_Jiefangbei_CBD.jpg"},
  ],
  beijing: [
    {"src": "photos/beijing-1.jpg", "title": "Grande Muraglia a Mutianyu", "author": "Velatrix", "license": "CC0", "page": "https://commons.wikimedia.org/wiki/File:Great_Wall_of_China_July_2006.JPG"},
    {"src": "photos/beijing-2.jpg", "title": "Città Proibita", "author": "Ermell", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Beijing_forbidden_city_Belvedere_of_Embodying_Benevolence-20071018-RM-142403.jpg"},
    {"src": "photos/beijing-3.jpg", "title": "Tempio del Cielo", "author": "Fong Chen", "license": "Public domain", "page": "https://commons.wikimedia.org/wiki/File:Hall_of_Prayer_for_Good_Harvest.JPG"},
    {"src": "photos/beijing-4.jpg", "title": "Palazzo d’Estate", "author": "Ermell", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Peking_Sommerpalast_Longivity_Hill-20071020-RM-091840.jpg"},
  ],
  guilin: [
    {"src": "photos/guilin-1.jpg", "title": "Collina della Proboscide di Elefante di sera", "author": "N509FZ", "license": "CC BY-SA 4.0", "page": "https://commons.wikimedia.org/wiki/File:Guilin_Elephant_Hill_at_night_(20240217201207).jpg"},
  ],
};
