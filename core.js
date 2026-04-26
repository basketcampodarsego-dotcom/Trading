/* =====================================================
   core.js  –  Trading Dashboard shared utilities
   ===================================================== */

// ── MENU ATTIVO ──────────────────────────────────────
(function(){
  const links = document.querySelectorAll('.menu a');
  const cur   = location.pathname.split('/').pop() || 'index.html';
  links.forEach(a => {
    if(a.getAttribute('href') === cur) a.classList.add('active');
  });
})();

// ── TOAST ────────────────────────────────────────────
function toast(msg, ms=2200){
  let el = document.getElementById('toast');
  if(!el){ el=document.createElement('div'); el.id='toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(()=>el.classList.remove('show'), ms);
}

// ── CSV LOADER ───────────────────────────────────────
async function loadCSV(filename){
  const res = await fetch('./' + filename);
  if(!res.ok) throw new Error('CSV not found: ' + filename);
  const text = await res.text();
  const rows = text.split('\n').filter(x=>x.trim());
  const header = rows[0].toLowerCase().split(',').map(h=>h.trim());
  return rows.slice(1)
    .filter(r=>r.trim())
    .map(r=>{
      const c = r.split(',');
      const obj = {};
      header.forEach((h,i)=>{ obj[h]=(c[i]||'').trim(); });
      return obj;
    })
    .filter(r=>r.ticker);
}

// ── YAHOO FINANCE DATA ───────────────────────────────
// Usa due proxy in fallback
const PROXIES = [
  s => "https://corsproxy.io/?" + encodeURIComponent(s),
  s => "https://api.allorigins.win/raw?url=" + encodeURIComponent(s),
];

async function fetchWithProxy(url){
  for(const proxy of PROXIES){
    try{
      const r = await fetch(proxy(url), {signal: AbortSignal.timeout(8000)});
      if(r.ok){
        const d = await r.json();
        return d;
      }
    }catch(e){ /* prova prossimo */ }
  }
  throw new Error('Tutti i proxy falliti per: ' + url);
}

// Ritorna array {time, open, high, low, close, volume}
async function getOHLC(symbol, range='1y'){
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`;
  const d = await fetchWithProxy(url);
  const r = d?.chart?.result?.[0];
  if(!r) throw new Error('Nessun dato per ' + symbol);
  const q = r.indicators.quote[0];
  return r.timestamp.map((t,i)=>({
    time:  t,
    open:  q.open[i],
    high:  q.high[i],
    low:   q.low[i],
    close: q.close[i],
    volume:q.volume[i]
  })).filter(x=>x.close != null && x.open != null);
}

// Ritorna solo close [{time,close}]
async function getClose(symbol, range='1y'){
  const ohlc = await getOHLC(symbol, range);
  return ohlc.map(x=>({time:x.time, close:x.close}));
}

// Prezzo corrente via quote endpoint
async function getCurrentPrice(symbol){
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
  try{
    const d = await fetchWithProxy(url);
    const r = d?.chart?.result?.[0];
    const q = r?.indicators?.quote?.[0];
    const closes = q?.close?.filter(v=>v!=null);
    return closes?.length ? closes[closes.length-1] : null;
  }catch{ return null; }
}

// Fondamentali (best-effort)
async function getFundamentals(symbol){
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
  try{
    const d = await fetchWithProxy(url);
    const q = d?.quoteResponse?.result?.[0];
    if(!q) return null;
    return {
      pe:  q.trailingPE,
      eps: q.epsTrailingTwelveMonths,
      cap: q.marketCap,
      div: q.dividendYield,
      pb:  q.priceToBook,
      name:q.longName || q.shortName
    };
  }catch{ return null; }
}

// ── INDICATORI ───────────────────────────────────────

// EMA su array di numeri (non oggetti)
function emaArr(arr, p){
  if(arr.length < p) return [];
  const k = 2/(p+1);
  const result = new Array(p-1).fill(null);
  let prev = arr.slice(0,p).reduce((a,b)=>a+b,0)/p;
  result.push(prev);
  for(let i=p; i<arr.length; i++){
    prev = arr[i]*k + prev*(1-k);
    result.push(prev);
  }
  return result;
}

// Ultimo valore EMA
function calcEMA(data, p){
  const closes = data.map(x=>x.close);
  const arr = emaArr(closes, p);
  return arr[arr.length-1] ?? null;
}

// RSI(14) ultimo valore
function calcRSI(data, period=14){
  if(data.length < period+1) return null;
  let gains=0, losses=0;
  for(let i=data.length-period; i<data.length; i++){
    const diff = data[i].close - data[i-1].close;
    if(diff>=0) gains+=diff; else losses-=diff;
  }
  const rs = gains / (losses||0.0001);
  return 100 - 100/(1+rs);
}

// ATR(14) ultimo valore
function calcATR(ohlc, period=14){
  if(ohlc.length < period+1) return null;
  const trs = [];
  for(let i=1;i<ohlc.length;i++){
    const tr = Math.max(
      ohlc[i].high - ohlc[i].low,
      Math.abs(ohlc[i].high - ohlc[i-1].close),
      Math.abs(ohlc[i].low  - ohlc[i-1].close)
    );
    trs.push(tr);
  }
  return trs.slice(-period).reduce((a,b)=>a+b,0)/period;
}

// Drawdown massimo su array di close
function maxDrawdown(closes){
  let peak = closes[0], maxDD = 0;
  for(const c of closes){
    if(c > peak) peak = c;
    const dd = (peak - c) / peak;
    if(dd > maxDD) maxDD = dd;
  }
  return maxDD;
}

// ── RATING ───────────────────────────────────────────
function calculateRating(data, fund){
  const last   = data[data.length-1].close;
  const rsi    = calcRSI(data);
  const ema10  = calcEMA(data,10);
  const ema50  = calcEMA(data,50);
  const ema200 = calcEMA(data,200);

  let score = 0;
  const log = [];

  if(ema200){
    if(last>ema200){ score+=2; log.push('+2 sopra EMA200'); }
    else            { score-=2; log.push('-2 sotto EMA200'); }
  }
  if(ema50){
    if(last>ema50){ score+=1; log.push('+1 sopra EMA50'); }
    else           { score-=1; log.push('-1 sotto EMA50'); }
  }
  if(ema10&&ema50){
    if(ema10>ema50){ score+=1; log.push('+1 EMA10>EMA50'); }
    else            { score-=1; log.push('-1 EMA10<EMA50'); }
  }
  if(rsi!=null){
    if(rsi<30)      { score+=1; log.push('+1 RSI ipervenduto'); }
    else if(rsi>70) { score-=1; log.push('-1 RSI ipercomprato'); }
  }
  if(fund){
    if(fund.pe && fund.pe<15)      { score+=1; log.push('+1 P/E basso'); }
    else if(fund.pe && fund.pe>30) { score-=1; log.push('-1 P/E alto'); }
    if(fund.div && fund.div>0.03)  { score+=1; log.push('+1 Div>3%'); }
  }

  let label='NEUTRO', cls='signal-neutro';
  if(score>=4)      { label='BUY FORTE';  cls='signal-buy-forte';  }
  else if(score>=2) { label='BUY';        cls='signal-buy';         }
  else if(score<=-4){ label='SELL FORTE'; cls='signal-sell-forte';  }
  else if(score<=-2){ label='SELL';       cls='signal-sell';         }

  return {score, label, cls, log, rsi, ema10, ema50, ema200};
}

// ── FORMAT HELPERS ───────────────────────────────────
function fmtCap(n){
  if(!n||isNaN(n)) return '–';
  if(n>1e12) return (n/1e12).toFixed(2)+'T';
  if(n>1e9)  return (n/1e9).toFixed(2)+'B';
  if(n>1e6)  return (n/1e6).toFixed(2)+'M';
  return n.toFixed(0);
}

function fmtPct(n){ return n!=null&&!isNaN(n) ? (n*100).toFixed(2)+'%' : '–'; }
function fmtNum(n,d=2){ return n!=null&&!isNaN(n) ? n.toFixed(d) : '–'; }

function badgeRating(label){
  const map = {
    'BUY FORTE':  'badge badge-buy-forte',
    'BUY':        'badge badge-buy',
    'NEUTRO':     'badge badge-neutro',
    'SELL':       'badge badge-sell',
    'SELL FORTE': 'badge badge-sell-forte',
  };
  return `<span class="${map[label]||'badge badge-na'}">${label}</span>`;
}
