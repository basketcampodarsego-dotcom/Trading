let dataList = [], idx = 0;
let chart, candleSeries, emaLines = {}, cache = {};
let priceCache = {};

let portfolio = [];

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

// ================= INIT =================
async function init() {

  log("Loading...");

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
    return {
      ticker: c[iTicker],
      name: c[iName]
    };
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

// ================= CURRENT PRICE =================
async function getCurrentPrice(ticker) {

  if (priceCache[ticker]) return priceCache[ticker];

  const data = await getData(ticker);
  const price = data.at(-1)?.close || null;

  priceCache[ticker] = price;

  return price;
}

// ================= SEARCH =================
function liveSearchInput() {

  const v = document.getElementById("searchInput")
    .value
    .toLowerCase()
    .trim();

  if (!v) {
    document.getElementById("searchResults").innerHTML = "";
    return;
  }

  const results = dataList
    .map((x, i) => ({ ...x, i }))
    .filter(x =>
      (x.ticker && x.ticker.toLowerCase().includes(v)) ||
      (x.name && x.name.toLowerCase().includes(v))
    )
    .slice(0, 6);

  const box = document.getElementById("searchResults");

  box.innerHTML = "";

  results.forEach(r => {
    box.innerHTML += `
      <div onclick="selectSearch(${r.i})"
           style="cursor:pointer;padding:6px;background:#111;margin:2px;">
        <b>${r.ticker}</b> - ${r.name}
      </div>
    `;
  });
}
function selectSearch(index) {
  idx = index;
  document.getElementById("searchResults").innerHTML = "";
  loadAsset();
}

// fallback GO button
function cerca() {

  const v = document.getElementById('searchInput').value.toLowerCase();

  const f = dataList.findIndex(x =>
    x.ticker?.toLowerCase().includes(v) ||
    x.name?.toLowerCase().includes(v)
  );

  if (f !== -1) {
    idx = f;
    loadAsset();
  } else {
    log("Non trovato", true);
  }
}

// ================= LOAD =================
async function loadAsset() {

  const s = dataList[idx];

  document.getElementById('assetName').innerText = s.name;
  document.getElementById('isinTicker').innerText = s.ticker;

  const c = await getData(s.ticker);

  candleSeries.setData(c);

  const e10 = EMA(c, 10);
  const e50 = EMA(c, 50);
  const e200 = EMA(c, 200);

  emaLines[10].setData(e10);
  emaLines[50].setData(e50);
  emaLines[200].setData(e200);

  chart.timeScale().fitContent();

  log("OK");
}

// ================= PORTFOLIO =================
function buyAsset() {

  const s = dataList[idx];

  portfolio.push({
    ticker: s.ticker,
    name: s.name,
    capital: 1000,
    qty: null,
    entryPrice: null,
    currentPrice: null,
    pl: 0
  });

  renderPortfolio();
}

async function updatePortfolio() {

  for (let p of portfolio) {

    const price = await getCurrentPrice(p.ticker);

    if (!price) continue;

    p.currentPrice = price;

    if (!p.entryPrice) {
      p.entryPrice = price;
      p.qty = p.capital / price;
    }

    p.pl = (p.currentPrice - p.entryPrice) * p.qty;
  }

  renderPortfolio();
}

function renderPortfolio() {

  const box = document.getElementById("portfolio");

  let total = 0;

  box.innerHTML = "";

  portfolio.forEach(p => {

    const pct = (p.pl / p.capital) * 100;
    total += p.pl;

    box.innerHTML += `
      <div>
        <b>${p.ticker}</b><br>
        P/L: €${p.pl.toFixed(2)} (${pct.toFixed(2)}%)
      </div>
      <hr>
    `;
  });

  document.getElementById("portfolioTotal").innerHTML =
    `<b>Total P/L: €${total.toFixed(2)}</b>`;
}

// ================= NAV =================
function nav(d) {
  idx = (idx + d + dataList.length) % dataList.length;
  loadAsset();
}

// ================= AUTO REFRESH =================
setInterval(() => {
  priceCache = {};
  updatePortfolio();
}, 30000);

// ================= START =================
window.onload = init;
