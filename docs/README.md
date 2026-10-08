# App del viaggio · Cina

App web per telefono (installabile, funziona anche offline), senza build step.
Link: https://ingosvaldomazzei-rgb.github.io/Viaggio_China/

## Pagine

- **Oggi** — prima della partenza il conto alla rovescia e una checklist; durante il viaggio il giorno corrente (programma, spostamenti, hotel della notte); dopo, il riepilogo.
- **Itinerario** — le 6 tappe in ordine con i trasferimenti.
- **Città** (`#/citta/ID`) — foto, descrizione, giorni, punti da vedere, hotel, come arrivare, mini-mappa.
- **Giorno** (`#/giorno/AAAA-MM-GG`) — programma, spostamenti, punti in programma, hotel della notte, giorno precedente/successivo.
- **Punto** (`#/punto/ID`) — foto, descrizione, orari, biglietti, consigli, giorni in cui è in programma.
- **Mappa** — percorso, tappe numerate, hotel e punti (da vicino).
- **Info** — voli e treni, hotel con scheda "mostra all'autista", numeri di emergenza, ambasciata e consolati, app utili, stato dell'uso offline.

Per provare la pagina Oggi in una data del viaggio: aggiungere `?oggi=2026-10-29` all'indirizzo.

## Dove si modificano i contenuti

Tutto in `data.js`:

- `REGIONS` — città (coordinate, descrizione, come arrivarci).
- `HOTELS`, `TRIP` — hotel, soggiorni e spostamenti (`status: 'todo'` = mezzo da definire).
- `DAYS` — un elemento per data: città, titolo, programma, `points` (id dei punti in ordine di visita).
- `POINTS` — punti da vedere: `name` e, facoltativi, `cnName`, `coords`, `summary`, `photo`, `hours`, `tickets`, `tips`.
- `PHOTOS` — foto da Wikimedia Commons con autore e licenza (vanno sempre citati).
- `INFO` — numeri utili (verificati sui siti ufficiali a ottobre 2026) e app consigliate.

## Dopo ogni modifica

Lanciare `python3 tools/aggiorna_offline.py`: rigenera `sw.js` (elenco dei file salvati sul telefono e versione). Se cambiano `app.js`, `data.js` o `styles.css`, aumentare anche il numero `?v=` in `index.html` prima di lanciarlo.

## Uso offline e in Cina

Il link `github.io` potrebbe non essere raggiungibile dalla Cina, e Google Fonts lì è bloccato. Per questo:

- i caratteri sono ospitati in `fonts/`;
- `sw.js` salva sul telefono pagine, foto e caratteri alla prima apertura, e conserva le zone di mappa visualizzate (fino a 3000 riquadri);
- l'app si installa: iPhone → Safari › Condividi › "Aggiungi alla schermata Home"; Android → Chrome › ⋮ › "Installa app".

Le mappe offline coprono solo le zone già viste con internet (le regole di OpenStreetMap non consentono di scaricarle in blocco).

Lo sfondo usa OpenStreetMap (nomi in cinese); per i nomi latini serve una chiave gratuita CARTO (https://carto.com/basemaps/apikey) da inserire in `CARTO_KEY` in `app.js`.

## Prova in locale

`cd docs && python3 -m http.server 8080`, poi `http://localhost:8080`.
