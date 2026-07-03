# Mappa del viaggio · Cina

Sito statico, nessun build step. File: `index.html`, `styles.css`, `data.js`, `app.js`, `vendor/leaflet/` (Leaflet vendorizzato, nessuna dipendenza da CDN esterni a runtime tranne Google Fonts), `photos/` (immagini di intestazione per ogni tappa).

## Pubblicare il sito

Basta caricare l'intera cartella `site/` su un hosting statico qualsiasi:

- **GitHub Pages**: metti questi file nella root del branch pubblicato (o in `/docs`), attiva Pages nelle impostazioni del repo.
- **Netlify / Vercel**: trascina la cartella nell'upload manuale, oppure collega il repo e imposta la publish directory su `site`.
- **Qualsiasi hosting statico**: carica i file via FTP/rsync, non serve un server applicativo.

Per provarlo in locale: `cd site && python3 -m http.server 8080`, poi apri `http://localhost:8080`.

## Foto

Ogni tappa ha 4 riquadri foto. Il primo (grande, "hero") mostra un'intestazione elegante generata (silhouette di montagne, colore per area, nome del luogo) — non è una foto reale del luogo. Gli altri 3 sono vuoti.

Clicca o trascina un'immagine su un riquadro per sostituirla con una tua foto: viene ridimensionata automaticamente e salvata nel browser (IndexedDB), quindi resta anche dopo un ricaricamento della pagina — ma solo su quel dispositivo/browser, non è condivisa tra visitatori né caricata su un server (il sito è statico, senza backend). Passa il mouse su una foto caricata per vedere il pulsante "✕" e rimuoverla.

## Nota sulle immagini reali

Le intestazioni attuali sono placeholder generati, non foto reali dei luoghi — recuperarle da fonti come Wikimedia Commons non è stato possibile in questa sessione perché l'ambiente non aveva accesso di rete a quegli host. Sostituiscile trascinando le tue foto, oppure chiedi di riprovare il recupero automatico da un ambiente con accesso di rete più ampio.
