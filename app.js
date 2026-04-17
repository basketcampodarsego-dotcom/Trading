let dataList = [], idx = 0;

let chart;
let candleSeries;
let ema10Series;
let ema50Series;

let cache = {};

// ================= LOG =================
function log(m) {
  const el = document.getElementById("status");
  if (el) el.innerText = m;
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
  chart = LightweightCharts.createChart(document.getElementById("chart"), {
    layout: { background: { color: "#000" }, textColor: "#fff" },
    timeScale: { timeVisible: true }
  });

  candleSeries = chart.addCandlestickSeries();

  ema10Series = chart.addLineSeries({ color: "#00ff00" });
  ema50Series = chart.addLineSeries({ color: "#ff0000" });
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

  log("Asset caricati: " + dataList.length);
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

// ================= STATE MACHINE SIGNALS =================
// SOLO cambio stato → niente spam
function generateSignals(candles, e10, e50) {

  let markers = [];
  let state = "NONE";

  for (let i = 50; i < candles.length; i++) {

    const time = candles[i].time;

    const ema10 = e10.find(x => x.time === time)?.value;
    const ema50 = e50.find(x => x.time === time)?.value;

    if (!ema10 || !ema50) continue;

    const bull = ema10 > ema50;
    const bear = ema10 < ema50;

    if (bull && state !== "LONG") {
      markers.push({
        time,
        position: "belowBar",
        color: "#00c853",
        shape: "arrowUp",
        text: "BUY"
      });
      state = "LONG";
    }

    if (bear && state !== "SHORT") {
      markers.push({
        time,
        position: "aboveBar",
        color: "#ff5252",
        shape: "arrowDown",
        text: "SELL"
      });
      state = "SHORT";
    }
  }

  return markers;
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

  const signals = generateSignals(candles, e10, e50);
  candleSeries.setMarkers(signals);

  chart.timeScale().fitContent();

  log("OK PRO C+");
}

// ================= NAV =================
function nav(d) {
  idx = (idx + d + dataList.length) % dataList.length;
  loadAsset();
}

// ================= START =================
window.onload = async () => {
  initChart();
  await loadCSV();
  await loadAsset();
};
