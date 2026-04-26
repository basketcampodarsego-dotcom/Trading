/* =====================================================
   app.js  –  Trading Dashboard main logic
   ===================================================== */

let dataList = [];
let idx = 0;
let chart, candleSeries, ema10Series, ema50Series, ema200Series;

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

  // CSV iniziale
  await loadCurrentCSV();

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
  if(dataList.length) loadAsset();
}

// ── LOAD ASSET ───────────────────────────────────────
async function loadAsset(){
  const s = dataList[idx];
  if(!s) return;

  // Header
  document.getElementById('title').textContent  = s.name  || s.ticker;
  document.getElementById('ticker').textContent = s.ticker + (s.isin ? '  ·  '+s.isin : '');
  document.getElementById('last-price').textContent = '…';
  document.getElementById('signal').textContent = '…';
  document.getElementById('tech').textContent   = '';
  document.getElementById('fund').textContent   = '';

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

  chart.timeScale().fitContent();

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

// ── NAV + SEARCH ─────────────────────────────────────
function nav(d){
  if(!dataList.length) return;
  idx = (idx+d+dataList.length) % dataList.length;
  loadAsset();
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
    loadAsset();
  } else {
    toast('Nessun risultato per "'+v+'"');
  }
}

// ── START ─────────────────────────────────────────────
window.onload = init;
