
let dataList = [], idx = 0;

let chart;
let candleSeries;
let ema10Series;
let ema50Series;

let cache = {};

// ================= LOG =================
function log(m, e = false) {
  const el = document.getElementById("status");
  if (!el) return;
  el.innerText = m;
  el.style.color = e ? "red" : "lime";
}

// ================= EMA =================
function EMA(data, period) {
  if (data.length < period) return [];

  const k = 2 / (period + 1);
  let out = [];

  let prev = 0;
  for (let i = 0; i < period; i++) prev += data[i].close;
  prev /= period;

  for (let i = period; i < data.length; i++) {
    prev = data[i].close * k + prev * (1 - k);
    out.push({
      time: data[i].time,
      value: prev
    });
  }

  return out;
}

// ================= INIT CHART =================
function initChart() {
  const el = document.getElementById("chart");

  chart = LightweightCharts.createChart(el, {
    layout: {
      background: { color: "#000" },
      textColor: "#fff"
    },
    timeScale: {
      timeVisible: true
    }
  });

  candleSeries = chart.addCandlestickSeries();

  ema10Series = chart.addLineSeries({
    color: "#00ff00",
    lineWidth: 1
  });

  ema50Series = chart.addLineSeries({
    color: "#ff0000",
    lineWidth: 1
  });
}

// ================= CSV =================
async function loadCSV() {
  const r = await fetch("./tr_isin_ticker.csv");
  const t = await r.text();

  const rows = t.replace(/\r/g, "").split("\n").filter(Boolean);
  const header = rows[0].toLowerCase().split(/[,;]/);

  const iTicker = header.indexOf("ticker");
  const iName = header.indexOf("name");

  dataList = rows.slice(1).map(r => {
    const c = r.split(/[,;]/);
    return {
      ticker: c[iTicker],
      name: c[iName]
    };
  });

  log("CSV OK: " + dataList.length);
}

// ================= DATA =================
async function getData(ticker) {
  if (cache[ticker]) return cache[ticker];

  const url =
    "https://corsproxy.io/?" +
    encodeURIComponent(
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
        ticker +
        "?range=1y&interval=1d"
    );

  const r = await fetch(url);
  const d = await r.json();

  const q = d.chart.result[0];

  const candles = q.timestamp
    .map((t, i) => ({
      time: t,
      open: q.indicators.quote[0].open[i],
      high: q.indicators.quote[0].high[i],
      low: q.indicators.quote[0].low[i],
      close: q.indicators.quote[0].close[i]
    }))
    .filter(x => x.open != null);

  cache[ticker] = candles;
  return candles;
}

// ================= LOAD ASSET =================
async function loadAsset() {
  const s = dataList[idx];
  if (!s) return;

  document.getElementById("assetName").innerText = s.name;
  document.getElementById("ticker").innerText = s.ticker;

  const candles = await getData(s.ticker);

  candleSeries.setData(candles);

  const e10 = EMA(candles, 10);
  const e50 = EMA(candles, 50);

  ema10Series.setData(e10);
  ema50Series.setData(e50);

  chart.timeScale().fitContent();

  log("OK");
}

// ================= NAV =================
function nav(d) {
  idx = (idx + d + dataList.length) % dataList.length;
  loadAsset();
}

// ================= MOCK BUY/SELL =================
function buy() {
  log("BUY simulato");
}

function sell() {
  log("SELL simulato");
}

// ================= START =================
window.onload = async () => {
  initChart();
  await loadCSV();
  await loadAsset();
}; 
