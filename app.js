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

// ================= SEARCH FIX =================
function liveSearchInput() {

  const v = document.getElementById("searchInput")
    .value.toLowerCase().trim();

  if (!v) {
    document.getElementById("searchResults").innerHTML = "";
    return;
  }

  const results = dataList
    .map((x, i) => ({ ...x, i }))
    .filter(x =>
      x.ticker?.toLowerCase().includes(v) ||
      x.name?.toLowerCase().includes(v)
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

function selectSearch(i) {
  idx = i;
  document.getElementById("searchResults").innerHTML = "";
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

// ================= MARKERS FIX (IMPORTANTISSIMO) =================
function generateMarkers(candles, ema10, ema50, rsi) {

  let markers = [];
  let state = "NONE";

  for (let i = 50; i < candles.length; i++) {

    const time = candles[i].time;

    const e10 = ema10.find(x => x.time === time)?.value;
    const e50 = ema50.find(x => x.time === time)?.value;
    const r = rsi.find(x => x.time === time)?.value;

    if (!e10 || !e50 || !r) continue;

    // ================= TREND CONDITIONS =================
    const isBull = e10 > e50 && r > 55;
    const isBear = e10 < e50 && r < 45;

    // ================= CAMBIO STATO =================
    if (isBull && state !== "BULL") {

      markers.push({
        time,
        position: 'belowBar',
        color: '#00c853',
        shape: 'arrowUp',
        text: 'BUY'
      });

      state = "BULL";
    }

    if (isBear && state !== "BEAR") {

      markers.push({
        time,
        position: 'aboveBar',
        color: '#ff5252',
        shape: 'arrowDown',
        text: 'SELL'
      });

      state = "BEAR";
    }
  }

  return markers;
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
  const rsi = RSI(c);

  emaLines[10].setData(e10);
  emaLines[50].setData(e50);
  emaLines[200].setData(e200);

  // 🔥 QUESTO È IL FIX CHE TI MANCAVA
  const markers = generateMarkers(c, e10, e50, rsi);
  candleSeries.setMarkers(markers);

  chart.timeScale().fitContent();

  log("OK");
}

// ================= START =================
window.onload = init;
