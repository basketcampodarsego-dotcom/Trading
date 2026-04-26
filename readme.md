# Trading Dashboard — Storico Versioni

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
