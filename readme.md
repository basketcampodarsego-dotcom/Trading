# Trading Dashboard — Storico Versioni

---

## v2.0 — 24/06/2026

### Modifiche

**`admin.html`** *(nuovo)*
- Pagina dedicata per upload file su GitHub (sostituisce modal in `index.html`)
- Stessa logica GitHub Contents API PUT; token salvato in localStorage
- Voce "Admin" aggiunta al menu di navigazione

**`index.html`**
- Rimossi: pulsante ↑ GitHub, modal overlay, script GitHub (~90 righe)
- Aggiunta voce "Admin" al menu

**`backtest.html`**
- Aggiunta voce "Admin" al menu

---

## v1.9 — 24/06/2026

### Modifiche

**`backtest.html`**
- Default periodo cambiato da `2y` a `5y`
- Aggiunta strategia `EMA40 Trend Following` come prima opzione (default)

**`backtest.js`**
- Aggiunta `strategyEMA40()`: BUY se close > EMA40, SELL se close < EMA40 oppure trailing stop ATR×2 dal picco; warm-up 40 barre; colonna exitReason (EMA40 / Trailing / aperto)

---

## v1.8 — 24/06/2026

### Modifiche

**`index.html`**
- Aggiunto pulsante **↑ GitHub** nella search bar
- Modal overlay con: campo token (salvato in localStorage), file picker CSV multiplo, log push per file
- File picker senza filtro estensione: accetta CSV, JS, HTML, CSS e qualsiasi file del pacchetto TradingWeb
- Repo hardcoded: `basketcampodarsego-dotcom/Trading`, branch `main`
- Chiusura modal con click fuori o pulsante Annulla

---

## v1.5 — 18/06/2026

### Modifiche

**`portfolio.js`**
- `exportCSV()` riscritta in formato asincrono: produce ora lo stesso schema di `portafoglio_reale_input.csv` (`isin,nome,valore_eur,pl_acquisto_eur,quantita,prezzo_eur`) invece del vecchio `ticker,qty,buy_price,date,isin,name`
- Recupera il prezzo corrente di ogni posizione via `getCurrentPrice`; in assenza di prezzo live usa il prezzo di acquisto come fallback e avvisa con un toast
- Aggiunta riga `SALDO_CONTANTI` nell'export se presente; aggiunta funzione `round2()` per arrotondamento a 2 decimali

**`app.js`, `core.js`, `backtest.js`, `backtest.html`, `style.css`**
- Consolidamento: ripristinate in questo merge le funzionalità già sviluppate in precedenza (andate perse durante una ricarica completa del repository) — selezione automatica di `Titoli.csv` come lista predefinita, e navigazione PREC/SUCC + ricerca ticker/nome/ISIN nella pagina Backtest con le stesse modalità della Dashboard

---

## v1.4 — 26/04/2026

### Modifiche

**`app.js`**
- `rightOffset:5` nella timeScale: 5 candele di spazio vuoto a destra del grafico
- Zoom persistente tra titoli: `subscribeVisibleLogicalRangeChange` salva il numero di barre visibili in `userRange`; al nav viene ripristinato con `setVisibleLogicalRange({from, to})` mantenendo lo stesso zoom
- Al primo caricamento (userRange=null) applica `fitContent` + offset +5 barre destra
- Aggiunto `volumeSeries` (istogramma) con pannello separato `priceScaleId:'volume'`, colore verde/rosso in base a close vs open
- Fondamentali: ora mostrati come span separati con valore in grassetto (`#fund span b`)

**`style.css`**
- `#fund`: cambiato da testo inline a `display:flex; flex-wrap:wrap; gap:10px` con `b` in colore testo

---

## v1.3 — 26/04/2026

### Modifiche

**`portfolio.html`**
- Form ristrutturato su due righe (`add-form-row`) per mobile: riga 1 ricerca+campi numerici, riga 2 bottoni
- Bottone "↑ Importa CSV" sempre visibile su riga separata
- Aggiunto `#p_selected_info`: riga di conferma titolo selezionato (ticker · nome · ISIN)

**`backtest.html`**
- Aggiunto `#bt_selected_info` sotto il campo ticker per conferma visiva del titolo selezionato

**`style.css`**
- `.add-form` riscritto: layout `flex-direction:column` con righe interne `.add-form-row`
- Aggiunto `.btn-importa` per stile uniforme del label-bottone importa CSV

**`core.js`**
- `attachSearchDropdown` aggiornato: dropdown mostra sempre ticker + nome + ISIN su tre colonne; logica `getMatches()` centralizzata; delay blur aumentato a 180ms

**`portfolio.js`**
- `initDropdown`: dopo selezione mostra `ticker · nome · ISIN` in `#p_selected_info`; reset info se utente modifica campo manualmente

**`backtest.js`**
- Init dropdown: dopo selezione mostra `ticker · nome · ISIN` in `#bt_selected_info`; reset se campo modificato manualmente

---

## v1.2 — 26/04/2026

### Modifiche

**`core.js`**
- Aggiunta `resolveTickerFromISIN(isin)`: risolve ISIN → ticker Yahoo via `/v1/finance/search`, con cache in memoria
- Aggiunta `CRYPTO_MAP`: dizionario `CRYPTO_BTC→BTC-USD`, `CRYPTO_ETH→ETH-USD`, ecc.
- Aggiunta `parsePortafoglioCSV(file)`: parser per `portafoglio_reale_input.csv` (colonne: isin, nome, valore_eur, pl_acquisto_eur, quantita, prezzo_eur). Gestisce righe `CRYPTO_*` e `SALDO_CONTANTI` separatamente
- Aggiunta `attachSearchDropdown(inputEl, dropdownEl, getDataList, onSelect)`: funzione condivisa per dropdown ricerca con filtro ticker/nome/ISIN, navigazione tastiera ↑↓Enter, chiusura blur

**`portfolio.html`**
- Campo ticker sostituito con `search-wrap` + dropdown autocomplete
- Aggiunto bottone "↑ Importa CSV" (file input nascosto)
- Aggiunto `#s-saldo-wrap` nella summary bar per saldo contanti

**`portfolio.js`**
- `loadTickerList()`: carica tutti i CSV da files.json per popolare il dropdown
- `initDropdown()`: aggancia `attachSearchDropdown` al form
- `addPosition()`: risoluzione automatica ISIN→ticker se l'utente digita un ISIN
- `importCSV(event)`: importa `portafoglio_reale_input.csv`, risolve ISIN, mappa crypto, mostra saldo contanti
- Colonna nome aggiunta sotto il ticker nella tabella

**`backtest.html`**
- Campo ticker sostituito con `search-wrap` + dropdown autocomplete

**`backtest.js`**
- Init asincrono: carica lista titoli da files.json e aggancia dropdown
- `runBacktest()`: risoluzione ISIN→ticker automatica se necessario

**`style.css`**
- Aggiunto `.dd-isin` per mostrare ISIN nella terza colonna del dropdown

---

## v1.1 — 26/04/2026

### Modifiche

**`core.js`**
- `loadCSV` riscritto con sistema di alias per colonne: ticker, name, isin vengono riconosciuti indipendentemente dal nome esatto della colonna nel CSV (es. `symbol`, `nome`, `codice_isin`, `isin_code`, ecc.)
- Rimossi caratteri `"` e `\r` dal parsing per compatibilità con CSV Windows

**`app.js`**
- Aggiunta variabile `savedChartRange` per memorizzare il range visibile del grafico
- `nav()`: salva `getVisibleRange()` prima di cambiare titolo; dopo il caricamento il range viene ripristinato con `setVisibleRange()` → lo zoom mantenuto durante lo scorrimento
- `onCsvChange()`: aggiunto `idx=0` esplicito prima di `loadAsset()` → fix scorrimento bloccato dopo cambio CSV

---

## v1.0 — 26/04/2026

### Modifiche

**`index.html`**
- Rimossi pulsanti ◀ ▶ dalla search bar
- Aggiunto `<div class="search-wrap">` con dropdown autocomplete per la ricerca titoli
- Aggiunto blocco `.nav-bottom` (pulsanti PREC/SUCC) direttamente sotto il grafico
- Aggiunto `#last-signal-bar` tra i pulsanti di navigazione e l'infoPanel

**`app.js`**
- Ricerca titoli: aggiunta funzione `onSearchInput()` che filtra `dataList` in tempo reale e popola il dropdown
- Dropdown navigabile con tastiera (↑ ↓ Enter Escape) tramite `onSearchKey()`
- `selectFromDropdown(i)`: selezione titolo al click su riga dropdown
- `closeDropdown()`: chiusura dropdown al click fuori o dopo selezione
- Segnali BUY/SELL evidenziati nel grafico come marker (freccia su verde / freccia giù rossa) al crossover EMA10/EMA50
- `#last-signal-bar`: mostra tipo e data dell'ultimo segnale rilevato nello storico

**`style.css`**
- `.nav-bottom button`: padding aumentato a 18px, font-size 16px, letter-spacing ampliato
- Aggiunti stili: `#last-signal-bar`, `.search-wrap`, `#search-dropdown`, `.dd-item`, `.dd-ticker`, `.dd-name`, `.dd-active`


### Modifiche

**`index.html`**
- Rimossi pulsanti ◀ ▶ dalla search bar
- Aggiunto `<div class="search-wrap">` con dropdown autocomplete per la ricerca titoli
- Aggiunto blocco `.nav-bottom` (pulsanti PREC/SUCC) direttamente sotto il grafico
- Aggiunto `#last-signal-bar` tra i pulsanti di navigazione e l'infoPanel

**`app.js`**
- Ricerca titoli: aggiunta funzione `onSearchInput()` che filtra `dataList` in tempo reale e popola il dropdown
- Dropdown navigabile con tastiera (↑ ↓ Enter Escape) tramite `onSearchKey()`
- `selectFromDropdown(i)`: selezione titolo al click su riga dropdown
- `closeDropdown()`: chiusura dropdown al click fuori o dopo selezione
- Segnali BUY/SELL evidenziati nel grafico come marker (freccia su verde / freccia giù rossa) al crossover EMA10/EMA50
- `#last-signal-bar`: mostra tipo e data dell'ultimo segnale rilevato nello storico

**`style.css`**
- `.nav-bottom button`: padding aumentato a 18px, font-size 16px, letter-spacing ampliato
- Aggiunti stili: `#last-signal-bar`, `.search-wrap`, `#search-dropdown`, `.dd-item`, `.dd-ticker`, `.dd-name`, `.dd-active`
