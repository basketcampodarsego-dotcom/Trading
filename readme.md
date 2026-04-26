# Trading Dashboard — Storico Versioni

---

## v1.0 — 26/04/2025

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
