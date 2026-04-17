let dataList = [], idx = 0;

let chart;
let candleSeries;
let ema10Series;
let ema50Series;

let cache = {};

// ================= PORTFOLIO =================
let portfolio = JSON.parse(localStorage.getItem("portfolio") || "[]");
let cash = parseFloat(localStorage.getItem("cash") || "10000");

// ================= NAV =================
function goPage(p) {
  window.location.href = p;
}

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
    out.push({ time: data[i].time, value: prev });
  }

  return out;
}

// ================= CHART =================
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

// ================= LOAD =================
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

// ================= PRICE =================
function lastPrice(ticker) {
  const c = cache[ticker];
  if (!c || !c.length) return 0;
  return c[c.length - 1].close;
}

// ================= BUY =================
function buy() {

  const s = dataList[idx];
  const price = lastPrice(s.ticker);
  if (!price) return;

  const qty = cash / 10 / price;
  const cost = qty * price;

  cash -= cost;

  portfolio.push({
    ticker: s.ticker,
    name: s.name,
    entry: price,
    qty
  });

  save();
  log("BUY " + s.ticker);
}

// ================= SELL (ALL POSITIONS SIMPLE) =================
function sell() {

  const s = dataList[idx];
  const price = lastPrice(s.ticker);

  portfolio = portfolio.filter(p => {
    if (p.ticker === s.ticker) {
      cash += p.qty * price;
      return false;
    }
    return true;
  });

  save();
  log("SELL " + s.ticker);
}

// ================= SAVE =================
function save() {
  localStorage.setItem("portfolio", JSON.stringify(portfolio));
  localStorage.setItem("cash", cash);
}

// ================= PORTFOLIO PAGE =================
function renderPortfolioPage() {

  const box = document.getElementById("portfolioBox");
  const cashBox = document.getElementById("cashBox");
  const totalBox = document.getElementById("totalBox");

  if (!box) return;

  let total = cash;

  cashBox.innerHTML = `<h3>Cash: €${cash.toFixed(2)}</h3>`;

  box.innerHTML = portfolio.map(p => {

    const price = lastPrice(p.ticker) || p.entry;
    const pl = (price - p.entry) * p.qty;

    total += pl;

    return `
      <div>
        <b>${p.ticker}</b><br>
        Qty: ${p.qty.toFixed(4)}<br>
        P/L: €${pl.toFixed(2)}
      </div>
      <hr>
    `;
  }).join("");

  totalBox.innerHTML = `<h3>Total Equity: €${total.toFixed(2)}</h3>`;
}

// ================= START =================
window.onload = async () => {
  initChart();
  await loadCSV();
  await loadAsset();
};
