let dataList = [], idx = 0;
let chart, candleSeries, emaLines = {}, cache = {};

let trades = [];
let position = null;
let equity = 10000;

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

    out.push({
      time: data[i].time,
      value: prev
    });
  }

  return out;
}

// ================= RSI =================
function RSI(data, p = 14) {
  if (data.length < p + 1) return [];

  let gains = 0, losses = 0;

  for (let i = 1; i <= p; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgG = gains / p;
  let avgL = losses / p;

  let rsi = [];

  for (let i = p + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;

    if (diff >= 0) {
      avgG = (avgG * (p - 1) + diff) / p;
      avgL = (avgL * (p - 1)) / p;
    } else {
      avgL = (avgL * (p - 1) - diff) / p;
      avgG = (avgG * (p - 1)) / p;
    }

    const rs = avgL === 0 ? 100 : avgG / avgL;

    rsi.push({
      time: data[i].time,
      value: 100 - (100 / (1 + rs))
    });
  }

  return rsi;
}

// ================= INIT =================
async function init() {
  try {
    log("Caricamento...");

    chart = LightweightCharts.createChart(
      document.getElementById('chart'),
      {
        layout: { background: { color: '#000' }, textColor: '#fff' }
      }
    );

    candleSeries = chart.addCandlestickSeries();

    emaLines[10] = chart.addLineSeries({ color: '#00ff00', lineWidth: 1 });
    emaLines[50] = chart.addLineSeries({ color: '#ff0000', lineWidth: 1 });
    emaLines[200] = chart.addLineSeries({ color: '#00aaff', lineWidth: 1 });

    const res = await fetch('./tr_isin_ticker.csv?v=' + Date.now());
    const text = await res.text();

    const rows = text.replace(/\r/g, '').split('\n').filter(r => r.trim());
    const header = rows[0].toLowerCase().split(/[,;]/);

    const iIsin = header.indexOf('isin');
    const iTicker = header.indexOf('ticker');
    const iName = header.indexOf('name');

    dataList = rows.slice(1).map(r => {
      const c = r.split(/[,;]/);

      return {
        isin: c[iIsin] || '',
        ticker: (c[iTicker] || '').trim(),
        name: c[iName] || c[iTicker]
      };
    }).filter(x => x.ticker);

    log("Titoli: " + dataList.length);

    loadAsset();

  } catch (e) {
    log("Errore INIT", true);
  }
}

// ================= DATA =================
async function getData(ticker) {
  try {
    if (cache[ticker]) return cache[ticker];

    const tf = document.getElementById('timeframe').value;
    const range = tf === '1h' ? '1mo' : '1y';

    const url = `https://corsproxy.io/?${encodeURIComponent(
      'https://query1.finance.yahoo.com/v8/finance/chart/' +
      ticker + '?range=' + range + '&interval=' + tf
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

  } catch (e) {
    log("Errore dati", true);
    return [];
  }
}

// ================= SIGNAL =================
function signal(e10, e50, rsi) {
  const a = e10.at(-1)?.value;
  const b = e50.at(-1)?.value;
  const r = rsi.at(-1)?.value;

  if (!a || !b || !r) return "No data";

  if (a > b && r < 60) return "BUY";
  if (a < b && r > 40) return "SELL";
  return "WAIT";
}

// ================= BACKTEST =================
function backtest(candles, e10, e50, e200, rsi) {
  trades = [];
  position = null;
  equity = 10000;

  for (let i = 200; i < candles.length; i++) {

    const price = candles[i].close;

    const a = e10[i - 10]?.value;
    const b = e50[i - 50]?.value;
    const c = e200[i - 200]?.value;
    const r = rsi[i - 14]?.value;

    if (!a || !b || !c || !r) continue;

    if (!position &&
        b > c &&
        a > b &&
        r > 55) {

      position = { entry: price };
    }

    if (position && (a < b || r < 45)) {

      const pnl = ((price - position.entry) / position.entry) * equity;
      equity += pnl;

      trades.push({ pnl });
      position = null;
    }
  }

  updateStats();
}

// ================= STATS =================
function updateStats() {
  const wins = trades.filter(t => t.pnl > 0).length;
  const winrate = trades.length ? (wins / trades.length) * 100 : 0;

  const totalPnL = trades.reduce((a, b) => a + b.pnl, 0);

  document.getElementById("metrics").innerText =
`Trades: ${trades.length}
Winrate: ${winrate.toFixed(1)}%
PnL: ${totalPnL.toFixed(2)}$
Equity: ${equity.toFixed(2)}`;
}

// ================= STRATEGY =================
function updateStrategy(price, e10, e50, e200, rsi) {
  let text = "";

  if (e50 > e200 && price > e200) {
    text += "📈 Trend rialzista\n";

    if (price < e10) text += "⏳ Pullback EMA10\n";
    else if (rsi < 50) text += "⏳ RSI debole\n";
    else text += "🟢 BUY possibile\n";

  } else if (e50 < e200) {
    text += "📉 Trend ribassista\n";
  } else {
    text += "⚪ Laterale\n";
  }

  document.getElementById('strategyBox').innerText = text;
}

// ================= LOAD =================
async function loadAsset() {
  const s = dataList[idx];

  document.getElementById('assetName').innerText = s.name;
  document.getElementById('isinTicker').innerText = s.ticker;

  const c = await getData(s.ticker);
  if (!c.length) return;

  candleSeries.setData(c);

  const e10 = EMA(c, 10);
  const e50 = EMA(c, 50);
  const e200 = EMA(c, 200);
  const rsi = RSI(c);

  emaLines[10].setData(e10);
  emaLines[50].setData(e50);
  emaLines[200].setData(e200);

  const last = c.at(-1).close;

  document.getElementById('signal').innerText =
    signal(e10, e50, rsi);

  updateStrategy(last,
    e10.at(-1)?.value,
    e50.at(-1)?.value,
    e200.at(-1)?.value,
    rsi.at(-1)?.value
  );

  backtest(c, e10, e50, e200, rsi);

  chart.timeScale().fitContent();

  log("OK");
}

// ================= NAV =================
function nav(d) {
  idx = (idx + d + dataList.length) % dataList.length;
  loadAsset();
}

function cerca() {
  const v = document.getElementById('searchInput').value.toUpperCase();
  const f = dataList.findIndex(x => x.ticker === v);
  if (f !== -1) {
    idx = f;
    loadAsset();
  }
}

window.onload = init;
