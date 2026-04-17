let dataList = [], idx = 0;
let chart, candleSeries, emaLines = {}, cache = {};

let portfolio = [];
let trades = [];
let openPosition = null;

// ================= LOG =================
function log(m, e = false) {
  const el = document.getElementById('status');
  if (!el) return;
  el.innerText = m;
  el.style.color = e ? 'red' : 'lime';
}

// ================= EMA =================
function EMA(data, p) {
  if (data.length < p) return [];

  const k = 2 / (p + 1);
  let out = [];
  let prev = 0;

  for (let i = 0; i < p; i++) prev += data[i].close;
  prev /= p;

  for (let i = p; i < data.length; i++) {
    prev = data[i].close * k + prev * (1 - k);
    out.push({ time: data[i].time, value: prev });
  }

  return out;
}

// ================= RSI =================
function RSI(data, p = 14) {
  if (data.length < p + 1) return [];

  let g = 0, l = 0;

  for (let i = 1; i <= p; i++) {
    const d = data[i].close - data[i - 1].close;
    if (d >= 0) g += d;
    else l -= d;
  }

  let avgG = g / p;
  let avgL = l / p;

  let out = [];

  for (let i = p + 1; i < data.length; i++) {
    const d = data[i].close - data[i - 1].close;

    if (d >= 0) {
      avgG = (avgG * (p - 1) + d) / p;
      avgL = (avgL * (p - 1)) / p;
    } else {
      avgL = (avgL * (p - 1) - d) / p;
      avgG = (avgG * (p - 1)) / p;
    }

    const rs = avgL === 0 ? 100 : avgG / avgL;

    out.push({
      time: data[i].time,
      value: 100 - (100 / (1 + rs))
    });
  }

  return out;
}

// ================= SEARCH =================
function liveSearchInput() {
  const v = document.getElementById("searchInput").value.toLowerCase().trim();
  const box = document.getElementById("searchResults");

  if (!v) return box.innerHTML = "";

  let results = [];

  for (let i = 0; i < dataList.length; i++) {
    const x = dataList[i];

    if (x.ticker?.toLowerCase().includes(v) || x.name?.toLowerCase().includes(v)) {
      results.push({ ...x, i });
    }

    if (results.length >= 6) break;
  }

  box.innerHTML = results.map(r => `
    <div onclick="selectSearch(${r.i})"
         style="cursor:pointer;padding:6px;background:#111;margin:2px;">
      <b>${r.ticker}</b> - ${r.name}
    </div>
  `).join("");
}

function selectSearch(i) {
  idx = i;
  document.getElementById("searchResults").innerHTML = "";
  loadAsset();
}

// ================= NAV =================
function nav(d) {
  idx = (idx + d + dataList.length) % dataList.length;
  loadAsset();
}

// ================= INIT =================
async function init() {

  chart = LightweightCharts.createChart(
    document.getElementById('chart'),
    {
      layout: { background: { color: '#000' }, textColor: '#fff' }
    }
  );

  candleSeries = chart.addCandlestickSeries();

  emaLines[10] = chart.addLineSeries({ color: '#00ff00' });
  emaLines[50] = chart.addLineSeries({ color: '#ff0000' });
  emaLines[200] = chart.addLineSeries({ color: '#00aaff' });

  const res = await fetch('./tr_isin_ticker.csv');
  const text = await res.text();

  const rows = text.replace(/\r/g, '').split('\n').filter(x => x);
  const header = rows[0].toLowerCase().split(/[,;]/);

  const iTicker = header.indexOf('ticker');
  const iName = header.indexOf('name');

  dataList = rows.slice(1).map(r => {
    const c = r.split(/[,;]/);
    return { ticker: c[iTicker], name: c[iName] };
  });

  loadAsset();
}

// ================= DATA =================
async function getData(ticker) {

  if (cache[ticker]) return cache[ticker];

  const url = `https://corsproxy.io/?${encodeURIComponent(
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    ticker + '?range=1y&interval=1d'
  )}`;

  const r = await fetch(url);
  const d = await r.json();

  const q = d.chart.result[0];

  const candles = q.timestamp.map((t, i) => ({
    time: t,
    open: q.indicators.quote[0].open[i],
    high: q.indicators.quote[0].high[i],
    low: q.indicators.quote[0].low[i],
    close: q.indicators.quote[0].close[i]
  })).filter(x => x.open != null);

  cache[ticker] = candles;
  return candles;
}

// ================= LOAD =================
async function loadAsset() {

  const s = dataList[idx];
  if (!s) return;

  document.getElementById('assetName').innerText = s.name;
  document.getElementById('isinTicker').innerText = s.ticker;

  const c = await getData(s.ticker);

  candleSeries.setData(c);

  const e10 = EMA(c, 10);
  const e50 = EMA(c, 50);
  const e200 = EMA(c, 200);
  const rsi = RSI(c);

  emaLines[10].setData(e10);
  emaLines[50].setData(e50);
  emaLines[200].setData(e200);

  chart.timeScale().fitContent();

  log("OK");
}

// ================= PRICE =================
function getLastPrice(ticker) {
  const c = cache[ticker];
  if (!c || !c.length) return 0;
  return c[c.length - 1].close;
}

// ================= TRADING ENGINE V3 =================

// 🟢 OPEN POSITION (BUY)
function buyAsset() {

  const s = dataList[idx];
  if (!s) return;

  const price = getLastPrice(s.ticker);
  if (!price) return;

  const qty = parseFloat(prompt("Quantità:", "1"));
  if (!qty || qty <= 0) return;

  if (openPosition) {
    log("Hai già una posizione aperta", true);
    return;
  }

  openPosition = {
    ticker: s.ticker,
    entryPrice: price,
    qty
  };

  log("BUY aperto");
}

// 🔴 CLOSE POSITION (SELL)
function sellAsset() {

  if (!openPosition) {
    log("Nessuna posizione aperta", true);
    return;
  }

  const price = getLastPrice(openPosition.ticker);

  const pl = (price - openPosition.entryPrice) * openPosition.qty;

  trades.push({
    ...openPosition,
    exitPrice: price,
    pl
  });

  openPosition = null;

  renderTrades();

  log("SELL chiuso: " + pl.toFixed(2));
}

// ================= TRADES =================
function renderTrades() {

  const el = document.getElementById("portfolio");
  if (!el) return;

  let total = 0;

  el.innerHTML = trades.map(t => {
    total += t.pl;

    return `
      <div>
        <b>${t.ticker}</b><br>
        P/L: €${t.pl.toFixed(2)}
      </div>
      <hr>
    `;
  }).join("");

  const t = document.getElementById("portfolioTotal");
  if (t) t.innerHTML = `<b>Total: €${total.toFixed(2)}</b>`;
}

// ================= GLOBAL =================
window.buyAsset = buyAsset;
window.sellAsset = sellAsset;
window.liveSearchInput = liveSearchInput;
window.selectSearch = selectSearch;
window.nav = nav;

// ================= START =================
window.onload = init;
