/* =====================================================
   app.js  –  Trading Dashboard main logic
   ===================================================== */

let dataList = [];
let idx = 0;
let chart, candleSeries, ema10Series, ema50Series, ema200Series;
let savedChartRange = null;  // range visibile salvato durante scorrimento titoli

// ── INIT ─────────────────────────────────────────────
async function init(){

  // Grafico
  chart = LightweightCharts.createChart(
    document.getElementById('chart'),
    {
      layout:      { background:{color:'#070b0f'}, textColor:'#4a6070' },
      grid:        { vertLines:{color:'#0d1117'}, horzLines:{color:'#0d1117'} },
      crosshair:   { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: { borderColor:'#1e2a38' },
      timeScale:   { borderColor:'#1e2a38', timeVisible:true },
      handleScroll: true,
      handleScale:  true,
    }
  );

  // Ridimensiona con la finestra
  const resizeChart = ()=>{
    const el = document.getElementById('chart');
    chart.resize(el.clientWidth, el.clientHeight);
  };
  window.addEventListener('resize', resizeChart);
  resizeChart();

  candleSeries = chart.addCandlestickSeries({
    upColor:   '#00ff88', downColor: '#ff3355',
    borderUpColor: '#00ff88', borderDownColor: '#ff3355',
    wickUpColor:   '#00ff88', wickDownColor:   '#ff3355',
  });

  ema10Series = chart.addLineSeries({
    color:'#ffd600', lineWidth:1, priceLineVisible:false, lastValueVisible:false,
  });
  ema50Series = chart.addLineSeries({
    color:'#00d0ff', lineWidth:1, priceLineVisible:false, lastValueVisible:false,
  });
  ema200Series = chart.addLineSeries({
    color:'#ff8800', lineWidth:1.5, priceLineVisible:false, lastValueVisible:false,
  });

  // Crosshair tooltip
  chart.subscribeCrosshairMove(param=>{
    if(param.time && candleSeries){
      const bar = param.seriesData.get(candleSeries);
      if(bar){
        document.getElementById('last-price').textContent =
          `O:${bar.open?.toFixed(2)}  H:${bar.high?.toFixed(2)}  L:${bar.low?.toFixed(2)}  C:${bar.close?.toFixed(2)}`;
      }
    }
  });

  // Popola select da files.json, poi carica il primo CSV
  await populateCsvSelect();

  // Cerca ticker salvato da portfolio.html
  const saved = localStorage.getItem('selectedTicker');
  if(saved){
    localStorage.removeItem('selectedTicker');
    const f = dataList.find(x=>x.ticker===saved);
    if(f) idx = dataList.indexOf(f);
  }

  loadAsset();

  document.getElementById('search')
    .addEventListener('keypress', e=>{ if(e.key==='Enter') searchAsset(); });
}

// ── FILES.JSON → SELECT ──────────────────────────────
async function populateCsvSelect(){
  const sel = document.getElementById('csvSelect');
  sel.innerHTML = '';
  try{
    const res   = await fetch('./files.json');
    const files = await res.json();                 // array di stringhe
    files.forEach(f=>{
      const opt   = document.createElement('option');
      opt.value   = f;
      opt.textContent = f.replace('.csv','');
      sel.appendChild(opt);
    });
  }catch(e){
    toast('⚠ files.json non trovato – uso Titoli.csv');
    const opt = document.createElement('option');
    opt.value = 'Titoli.csv'; opt.textContent = 'Titoli';
    sel.appendChild(opt);
  }
  await loadCurrentCSV();
}

// ── CSV ──────────────────────────────────────────────
async function loadCurrentCSV(){
  const csv = document.getElementById('csvSelect').value;
  try{
    dataList = await loadCSV(csv);
    idx = 0;
  }catch(e){
    toast('⚠ ' + e.message);
    dataList = [];
  }
}

async function onCsvChange(){
  await loadCurrentCSV();
  idx = 0;
  if(dataList.length) loadAsset();
}

// ── LOAD ASSET ───────────────────────────────────────
async function loadAsset(){
  const s = dataList[idx];
  if(!s) return;

  closeDropdown();

  // Header
  document.getElementById('title').textContent  = s.name  || s.ticker;
  document.getElementById('ticker').textContent = s.ticker + (s.isin ? '  ·  '+s.isin : '');
  document.getElementById('last-price').textContent = '…';
  document.getElementById('signal').textContent = '…';
  document.getElementById('tech').textContent   = '';
  document.getElementById('fund').textContent   = '';
  document.getElementById('last-signal-bar').textContent = '';

  // Spinner
  const sp = document.getElementById('spinner');
  sp.classList.add('show');

  let ohlc = [];
  try{
    ohlc = await getOHLC(s.ticker, '2y');
  }catch(e){
    toast('⚠ Dati non disponibili per ' + s.ticker);
    sp.classList.remove('show');
    return;
  }

  sp.classList.remove('show');

  if(!ohlc.length){
    toast('⚠ Nessun dato per ' + s.ticker);
    return;
  }

  // Candlestick
  candleSeries.setData(ohlc.map(x=>({
    time: x.time,
    open: x.open, high: x.high, low: x.low, close: x.close
  })));

  // Prezzo attuale
  const last = ohlc[ohlc.length-1].close;
  const prev = ohlc[ohlc.length-2]?.close;
  const chg  = prev ? ((last-prev)/prev*100) : 0;
  const sign = chg>=0?'+':'';
  document.getElementById('last-price').textContent =
    last.toFixed(2) + '  ' + sign+chg.toFixed(2)+'%';
  document.getElementById('last-price').style.color =
    chg>=0 ? 'var(--green)' : 'var(--red)';

  // EMA overlay
  const closes = ohlc.map(x=>x.close);
  const times  = ohlc.map(x=>x.time);

  function buildEmaLine(p){
    const vals = emaArr(closes, p);
    return vals.map((v,i)=>v!=null?{time:times[i],value:v}:null).filter(Boolean);
  }

  ema10Series.setData(buildEmaLine(10));
  ema50Series.setData(buildEmaLine(50));
  ema200Series.setData(buildEmaLine(200));

  // ── SEGNALI SUL GRAFICO (marker EMA10/50 crossover) ──
  const e10arr = emaArr(closes, 10);
  const e50arr = emaArr(closes, 50);
  const markers = [];
  let lastSignal = null;

  for(let i=51; i<ohlc.length; i++){
    const e10  = e10arr[i];
    const e10p = e10arr[i-1];
    const e50  = e50arr[i];
    const e50p = e50arr[i-1];
    if(!e10||!e10p||!e50||!e50p) continue;

    if(e10p<=e50p && e10>e50){
      // Crossover rialzista → BUY
      markers.push({
        time: ohlc[i].time,
        position: 'belowBar',
        color: '#00ff88',
        shape: 'arrowUp',
        text: 'BUY',
        size: 1,
      });
      lastSignal = {type:'BUY', time: ohlc[i].time};
    } else if(e10p>=e50p && e10<e50){
      // Crossover ribassista → SELL
      markers.push({
        time: ohlc[i].time,
        position: 'aboveBar',
        color: '#ff3355',
        shape: 'arrowDown',
        text: 'SELL',
        size: 1,
      });
      lastSignal = {type:'SELL', time: ohlc[i].time};
    }
  }

  candleSeries.setMarkers(markers);

  // Pannello ultimo segnale
  if(lastSignal){
    const d   = new Date(lastSignal.time * 1000);
    const ds  = d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
    const bar = document.getElementById('last-signal-bar');
    bar.innerHTML =
      `Ultimo segnale: <span class="${lastSignal.type==='BUY'?'signal-buy-forte':'signal-sell-forte'}">` +
      `${lastSignal.type}</span>  ·  ${ds}`;
  }

  // Ripristina zoom se era stato salvato (nav), altrimenti fitContent
  if(savedChartRange){
    try{ chart.timeScale().setVisibleRange(savedChartRange); }
    catch{ chart.timeScale().fitContent(); }
    savedChartRange = null;
  } else {
    chart.timeScale().fitContent();
  }

  // Rating
  const data = ohlc.map(x=>({time:x.time, close:x.close}));
  const fund = await getFundamentals(s.ticker);
  const rat  = calculateRating(data, fund);

  const sigEl = document.getElementById('signal');
  sigEl.textContent = `${rat.label}  (${rat.score >= 0?'+':''}${rat.score})`;
  sigEl.className   = rat.cls;

  document.getElementById('tech').textContent =
    rat.log.join('  ·  ') +
    (rat.rsi != null ? `  ·  RSI ${rat.rsi.toFixed(1)}` : '') +
    (rat.ema10  ? `  ·  EMA10 ${rat.ema10.toFixed(2)}`   : '') +
    (rat.ema50  ? `  ·  EMA50 ${rat.ema50.toFixed(2)}`   : '') +
    (rat.ema200 ? `  ·  EMA200 ${rat.ema200.toFixed(2)}`  : '');

  if(fund){
    document.getElementById('fund').textContent =
      'P/E ' + fmtNum(fund.pe,1) +
      '  ·  EPS ' + fmtNum(fund.eps,2) +
      '  ·  Div ' + fmtPct(fund.div) +
      '  ·  Cap ' + fmtCap(fund.cap) +
      '  ·  P/B ' + fmtNum(fund.pb,2);
  }
}

// ── NAV ──────────────────────────────────────────────
function nav(d){
  if(!dataList.length) return;
  // Salva zoom corrente prima di cambiare titolo
  try{ savedChartRange = chart.timeScale().getVisibleRange(); }catch{ savedChartRange=null; }
  idx = (idx+d+dataList.length) % dataList.length;
  loadAsset();
}

// ── SEARCH DROPDOWN ──────────────────────────────────
let ddHighlight = -1;

function onSearchInput(){
  const v = document.getElementById('search').value.toLowerCase().trim();
  const dd = document.getElementById('search-dropdown');
  ddHighlight = -1;

  if(!v || v.length < 1){ dd.innerHTML=''; dd.style.display='none'; return; }

  const matches = dataList.filter(x=>
    x.ticker?.toLowerCase().includes(v) ||
    x.name?.toLowerCase().includes(v)   ||
    x.isin?.toLowerCase().includes(v)
  ).slice(0, 30);

  if(!matches.length){ dd.innerHTML=''; dd.style.display='none'; return; }

  dd.innerHTML = matches.map((m,i)=>
    `<div class="dd-item" data-idx="${dataList.indexOf(m)}"
      onmousedown="selectFromDropdown(${dataList.indexOf(m)})">
      <span class="dd-ticker">${m.ticker}</span>
      <span class="dd-name">${m.name||''}</span>
    </div>`
  ).join('');
  dd.style.display = 'block';
}

function onSearchKey(e){
  const dd = document.getElementById('search-dropdown');
  const items = dd.querySelectorAll('.dd-item');
  if(!items.length) return;

  if(e.key==='ArrowDown'){
    e.preventDefault();
    ddHighlight = Math.min(ddHighlight+1, items.length-1);
    items.forEach((el,i)=>el.classList.toggle('dd-active', i===ddHighlight));
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    ddHighlight = Math.max(ddHighlight-1, 0);
    items.forEach((el,i)=>el.classList.toggle('dd-active', i===ddHighlight));
  } else if(e.key==='Enter'){
    if(ddHighlight>=0 && items[ddHighlight]){
      selectFromDropdown(parseInt(items[ddHighlight].dataset.idx));
    } else {
      searchAsset();
    }
  } else if(e.key==='Escape'){
    closeDropdown();
  }
}

function selectFromDropdown(i){
  idx = i;
  document.getElementById('search').value = '';
  closeDropdown();
  loadAsset();
}

function closeDropdown(){
  const dd = document.getElementById('search-dropdown');
  dd.innerHTML = '';
  dd.style.display = 'none';
  ddHighlight = -1;
}

function searchAsset(){
  const v = document.getElementById('search').value.toLowerCase().trim();
  if(!v) return;
  const f = dataList.find(x=>
    x.ticker?.toLowerCase().includes(v) ||
    x.name?.toLowerCase().includes(v)   ||
    x.isin?.toLowerCase().includes(v)
  );
  if(f){
    idx = dataList.indexOf(f);
    document.getElementById('search').value = '';
    closeDropdown();
    loadAsset();
  } else {
    toast('Nessun risultato per "'+v+'"');
  }
}

// Chiudi dropdown cliccando fuori
document.addEventListener('click', e=>{
  if(!e.target.closest('.search-wrap')) closeDropdown();
});

// ── START ─────────────────────────────────────────────
window.onload = init;
