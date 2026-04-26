/* =====================================================
   portfolio.js  v1.2
   ===================================================== */

let portfolio  = JSON.parse(localStorage.getItem('portfolio') || '[]');
let sortKey    = null;
let sortAsc    = true;
let tickerList = [];
let saldoContanti = null;

// ── CARICA LISTA TITOLI PER DROPDOWN ─────────────────
async function loadTickerList(){
  try{
    const res   = await fetch('./files.json');
    const files = await res.json();
    const lists = await Promise.allSettled(files.map(f=>loadCSV(f)));
    tickerList  = lists.flatMap(r=>r.status==='fulfilled'?r.value:[]);
  }catch{ tickerList = []; }
}

// ── ATTACH DROPDOWN AL FORM ──────────────────────────
function initDropdown(){
  const input   = document.getElementById('p_ticker');
  const dd      = document.getElementById('p_ticker_dd');
  const infoEl  = document.getElementById('p_selected_info');

  attachSearchDropdown(
    input, dd,
    ()=> tickerList,
    item => {
      input.value          = item.ticker || item.isin || '';
      input.dataset.isin   = item.isin   || '';
      input.dataset.name   = item.name   || '';
      input.dataset.ticker = item.ticker || '';
      // Mostra conferma visiva
      const parts = [item.ticker, item.name, item.isin].filter(Boolean);
      infoEl.textContent   = parts.join('  ·  ');
      infoEl.style.display = 'block';
    }
  );

  // Reset info se l'utente modifica manualmente
  input.addEventListener('input', ()=>{
    infoEl.style.display = 'none';
    input.dataset.ticker = '';
  });
}

// ── PERSIST ──────────────────────────────────────────
function save(){
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
}

// ── ADD ──────────────────────────────────────────────
async function addPosition(){
  const input  = document.getElementById('p_ticker');
  let   ticker = input.value.toUpperCase().trim();
  const qty    = parseFloat(document.getElementById('p_qty').value);
  const price  = parseFloat(document.getElementById('p_price').value);
  const date   = document.getElementById('p_date').value || null;
  const isin   = input.dataset.isin  || '';
  const name   = input.dataset.name  || '';

  if(!ticker || isNaN(qty) || qty<=0 || isNaN(price) || price<=0){
    toast('⚠ Compila tutti i campi correttamente');
    return;
  }

  if(ticker.length===12 && !ticker.includes('-') && !ticker.includes('.')){
    toast('Ricerca ticker per ISIN…');
    const resolved = await resolveTickerFromISIN(ticker);
    if(resolved) ticker = resolved;
    else { toast('⚠ Ticker non trovato per ISIN '+ticker); return; }
  }

  portfolio.push({ticker, qty, price, date, isin, name});
  save();
  ['p_ticker','p_qty','p_price','p_date'].forEach(id=>{ document.getElementById(id).value=''; });
  input.dataset.isin=''; input.dataset.name=''; input.dataset.ticker='';
  render();
}

// ── REMOVE ───────────────────────────────────────────
function removePosition(i){
  if(!confirm('Eliminare la posizione?')) return;
  portfolio.splice(i,1);
  save();
  render();
}

// ── SORT ─────────────────────────────────────────────
function sortBy(key){
  if(sortKey===key) sortAsc=!sortAsc;
  else { sortKey=key; sortAsc=true; }
  render();
}

// ── SIGNAL via EMA10/50 ───────────────────────────────
async function getSignal(symbol){
  try{
    const data = await getClose(symbol, '6mo');
    if(data.length < 50) return 'N/A';
    const e10 = calcEMA(data,10);
    const e50 = calcEMA(data,50);
    if(!e10||!e50) return 'N/A';
    if(e10>e50) return 'BUY';
    if(e10<e50) return 'SELL';
    return 'WAIT';
  }catch{ return 'N/A'; }
}

// ── FETCH ROW ─────────────────────────────────────────
async function fetchRow(p){
  const price  = await getCurrentPrice(p.ticker);
  const signal = await getSignal(p.ticker);
  return {price, signal};
}

// ── RENDER ───────────────────────────────────────────
async function render(){
  const tbody = document.getElementById('portfolioBody');
  tbody.innerHTML = '<tr><td colspan="9" class="loading">CARICAMENTO</td></tr>';

  let rows = portfolio.map((p,i)=>({
    i, ticker:p.ticker, name:p.name||'', qty:p.qty, buyPrice:p.price,
    current:null, signal:null, value:0, pl:0, plpct:0
  }));

  if(sortKey){
    rows.sort((a,b)=>{
      const va=a[sortKey]??0, vb=b[sortKey]??0;
      if(typeof va==='string') return sortAsc?va.localeCompare(vb):vb.localeCompare(va);
      return sortAsc?va-vb:vb-va;
    });
  }

  function buildRows(rowsData){
    tbody.innerHTML = '';
    let totVal=0, totCost=0;

    rowsData.forEach(row=>{
      const p    = portfolio[row.i];
      const cost = p.price * p.qty;
      const val  = row.current!=null ? row.current*p.qty : 0;
      const pl   = val - cost;
      const plp  = cost ? pl/cost : 0;
      row.value=val; row.pl=pl; row.plpct=plp;
      if(row.current!=null){ totVal+=val; totCost+=cost; }

      const sig = row.signal||'…';
      const sigMap = {'BUY':'badge badge-buy','SELL':'badge badge-sell-forte','WAIT':'badge badge-neutro','N/A':'badge badge-na','…':'badge badge-na'};
      const sublabel = p.name ? `<div style="font-size:10px;color:var(--muted)">${p.name}</div>` : '';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="td-link" onclick="openChart('${p.ticker}')">${p.ticker}${sublabel}</td>
        <td>${p.qty}</td>
        <td>${fmtNum(p.price,3)}</td>
        <td>${row.current!=null?fmtNum(row.current,3):'<span class="loading" style="padding:0"></span>'}</td>
        <td>${row.current!=null?fmtNum(val,2):'–'}</td>
        <td class="${pl>=0?'td-pos':'td-neg'}">${row.current!=null?(pl>=0?'+':'')+fmtNum(pl,2):'–'}</td>
        <td class="${plp>=0?'td-pos':'td-neg'}">${row.current!=null?(plp>=0?'+':'')+fmtPct(plp):'–'}</td>
        <td><span class="${sigMap[sig]||'badge badge-na'}">${sig}</span></td>
        <td><button onclick="removePosition(${row.i})" title="Rimuovi">✕</button></td>
      `;
      tbody.appendChild(tr);
    });

    const totPL=totVal-totCost, totPLp=totCost?totPL/totCost:0;
    document.getElementById('s-total').textContent  = fmtNum(totVal,2);
    document.getElementById('s-cost').textContent   = fmtNum(totCost,2);
    document.getElementById('s-pl').textContent     = (totPL>=0?'+':'')+fmtNum(totPL,2);
    document.getElementById('s-plpct').textContent  = (totPLp>=0?'+':'')+fmtPct(totPLp);
    document.getElementById('s-count').textContent  = portfolio.length;
    document.getElementById('s-pl').className       = 's-val '+(totPL>=0?'td-pos':'td-neg');
    document.getElementById('s-plpct').className    = 's-val '+(totPLp>=0?'td-pos':'td-neg');

    if(saldoContanti){
      document.getElementById('s-saldo-wrap').style.display='';
      document.getElementById('s-saldo').textContent = '€ '+fmtNum(saldoContanti.value,2);
    }
  }

  buildRows(rows);

  const results = await Promise.allSettled(rows.map(row=>fetchRow(portfolio[row.i])));
  results.forEach((res,ri)=>{
    if(res.status==='fulfilled'){
      rows[ri].current = res.value.price;
      rows[ri].signal  = res.value.signal;
    }
  });
  buildRows(rows);
}

function refreshAll(){ render(); toast('Aggiornamento in corso…'); }

function openChart(ticker){
  localStorage.setItem('selectedTicker', ticker);
  window.location.href = 'index.html';
}

function exportCSV(){
  if(!portfolio.length){ toast('Nessuna posizione da esportare'); return; }
  const header = 'ticker,qty,buy_price,date,isin,name\n';
  const body   = portfolio.map(p=>`${p.ticker},${p.qty},${p.price},${p.date||''},${p.isin||''},${p.name||''}`).join('\n');
  const blob   = new Blob([header+body],{type:'text/csv'});
  const a      = document.createElement('a');
  a.href       = URL.createObjectURL(blob);
  a.download   = 'portafoglio.csv';
  a.click();
}

// ── IMPORTA CSV (portafoglio_reale_input.csv) ─────────
async function importCSV(event){
  const file = event.target.files[0];
  if(!file) return;
  toast('Importazione in corso…');
  try{
    const {positions, saldo} = await parsePortafoglioCSV(file);

    const toResolve = positions.filter(p=>!CRYPTO_MAP[p.isin] && p.ticker===p.isin);
    if(toResolve.length){
      toast(`Risoluzione ${toResolve.length} ISIN…`);
      await Promise.allSettled(toResolve.map(async p=>{
        const t = await resolveTickerFromISIN(p.isin);
        if(t) p.ticker = t;
      }));
    }

    if(portfolio.length){
      if(!confirm(`Sostituire le ${portfolio.length} posizioni esistenti con le ${positions.length} del CSV?`)) return;
    }

    portfolio = positions.map(p=>({
      ticker: p.ticker,
      qty:    p.qty,
      price:  p.buyPrice,
      date:   null,
      isin:   p.isin,
      name:   p.name,
    }));

    saldoContanti = saldo;
    save();
    toast(`✓ Importate ${portfolio.length} posizioni`);
    render();
  }catch(e){
    toast('⚠ Errore importazione: '+e.message);
  }
  event.target.value='';
}

// ── INIT ─────────────────────────────────────────────
(async ()=>{
  await loadTickerList();
  initDropdown();
  render();
})();
