# Mappa del viaggio · Cina

Sito statico, nessun build step. File: `index.html`, `styles.css`, `data.js`, `app.js`, `vendor/leaflet/` (Leaflet vendorizzato), `photos/` (foto delle tappe).

## Cosa mostra

Solo l'itinerario deciso, 17 ottobre – 1 novembre 2026:

- **Pannello a sinistra**: tappe in ordine con date, notti, foto, hotel e i trasferimenti tra una tappa e l'altra (in giallo quelli con il mezzo ancora da definire).
- **Mappa**: tappe numerate collegate dalla linea del percorso; Guilin è solo transito. Le icone 🛏 degli hotel compaiono ingrandendo su una città.
- **Scheda di dettaglio** (clic su una tappa): descrizione, foto, date, hotel con indirizzo e link, come ci si arriva.

## Dove stanno i dati

Tutto in `data.js`:

- `REGIONS` — le località (coordinate, descrizione, cose da vedere, come arrivarci).
- `HOTELS` — gli hotel (indirizzo, coordinate, check-in/out, link).
- `TRIP` — l'itinerario: `steps` alterna soggiorni (`stay`) e trasferimenti (`move`, con `status: 'todo'` se il mezzo non è deciso); `path` è l'ordine della linea sulla mappa.
- `PHOTOS` — le foto di ogni tappa con autore, licenza e pagina di origine.

## Foto

Le foto sono prese da Wikimedia Commons con licenze libere (CC BY / CC BY-SA): autore e licenza sono indicati sotto le foto nella scheda di dettaglio, come richiesto dalle licenze. Si possono sostituire con le proprie cliccando o trascinando un'immagine su un riquadro della scheda: viene salvata solo nel browser di chi la carica (IndexedDB), non sul sito.

## Sfondo della mappa

Lo sfondo usa le tile standard di OpenStreetMap (nomi delle località in caratteri cinesi). Per i nomi in caratteri latini si può usare CARTO Voyager, che richiede una chiave gratuita: richiedila su https://carto.com/basemaps/apikey e incollala in `CARTO_KEY` dentro `app.js`.

## Cache del browser

In `index.html` i file CSS e JS sono richiamati con un numero di versione (`?v=4`). Ad ogni modifica di `app.js`, `data.js` o `styles.css` va aumentato, così i browser scaricano subito la versione nuova.

## Pubblicare e provare in locale

GitHub Pages pubblica la cartella `docs/` del branch `main`. In locale: `cd docs && python3 -m http.server 8080`, poi apri `http://localhost:8080`.
