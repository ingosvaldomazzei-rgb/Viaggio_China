# Mappa del viaggio · Cina

Sito statico, nessun build step. File: `index.html`, `styles.css`, `data.js`, `app.js`, `vendor/leaflet/` (Leaflet vendorizzato, nessuna dipendenza da CDN esterni a runtime tranne Google Fonts), `photos/` (immagini di intestazione per ogni tappa).

## Itinerario e hotel

La scheda **Itinerario** (quella di default) mostra il viaggio deciso, 17 ottobre – 1 novembre 2026: tappe in ordine con date e notti, trasferimenti con mezzo e durata stimata, hotel. I dati stanno in `data.js`, negli oggetti `TRIP` (tappe e trasferimenti) e `HOTELS` (strutture con indirizzo, coordinate, check-in/out). I trasferimenti ancora da decidere hanno `status: 'todo'` e compaiono come "Mezzo da definire". Le icone 🛏 degli hotel compaiono sulla mappa quando si ingrandisce su una città.

Le schede **Alternative** e **Aree** restano come archivio dei percorsi valutati in fase di pianificazione.

## Sfondo della mappa

Lo sfondo usa le tile standard di OpenStreetMap (nomi delle località in caratteri cinesi). Lo stile precedente, CARTO Voyager (nomi in caratteri latini), dal 2026 richiede una chiave gratuita: richiedila su https://carto.com/basemaps/apikey e incollala in `CARTO_KEY` dentro `app.js`.

## Pubblicare il sito

Basta caricare l'intera cartella `docs/` su un hosting statico qualsiasi:

- **GitHub Pages**: metti questi file nella root del branch pubblicato (o in `/docs`), attiva Pages nelle impostazioni del repo.
- **Netlify / Vercel**: trascina la cartella nell'upload manuale, oppure collega il repo e imposta la publish directory su `docs`.
- **Qualsiasi hosting statico**: carica i file via FTP/rsync, non serve un server applicativo.

Per provarlo in locale: `cd docs && python3 -m http.server 8080`, poi apri `http://localhost:8080`.

## Foto

Ogni tappa ha 4 riquadri foto. Il primo (grande, "hero") mostra un'intestazione elegante generata (silhouette di montagne, colore per area, nome del luogo) — non è una foto reale del luogo. Gli altri 3 sono vuoti.

Clicca o trascina un'immagine su un riquadro per sostituirla con una tua foto: viene ridimensionata automaticamente e salvata nel browser (IndexedDB), quindi resta anche dopo un ricaricamento della pagina — ma solo su quel dispositivo/browser, non è condivisa tra visitatori né caricata su un server (il sito è statico, senza backend). Passa il mouse su una foto caricata per vedere il pulsante "✕" e rimuoverla.

## Nota sulle immagini reali

Le intestazioni attuali sono placeholder generati, non foto reali dei luoghi — recuperarle da fonti come Wikimedia Commons non è stato possibile in questa sessione perché l'ambiente non aveva accesso di rete a quegli host. Sostituiscile trascinando le tue foto, oppure chiedi di riprovare il recupero automatico da un ambiente con accesso di rete più ampio.

## Cache del browser

In `index.html` i file CSS e JS sono richiamati con un numero di versione (`?v=2`). Ad ogni modifica di `app.js`, `data.js` o `styles.css` va aumentato (`?v=3`, …), così i browser scaricano subito la versione nuova invece di quella in cache.
