let dataList = [], idx = 0, chart, candleSeries, emaLines = {}, cache = {};

function log(m, e = false) {
  const el = document.getElementById('status');
  el.innerText = m;
  el.style.color = e ? 'red' : 'lime';
}

// ================= EMA =================
function EMA(data, p) {
  if (data.length < p) return [];
  const k = 2 / (p + 1);
  let out = [], sum = 0;

  for (let i = 0; i < p; i++) sum += data[i].close;
  let prev = sum / p;

  for (let i = p; i < data.length; i++) {
    let v = data[i].close * k + prev * (1 - k);
    out.push({ time: data[i].time, value: v });
    prev = v;
  }
  return out;
}

// ================= RSI =================
function RSI(data, p = 14) {
  if (data.length < p + 1) return [];

  let gains = 0, loss = 0;
  for (let i = 1; i <= p; i++) {
    let diff = data[i].close - data[i - 1].close;
    if (diff >= 0) gains += diff;
    else loss -= diff;
  }

  let avgG = gains / p, avgL = loss / p;
  let rsi = [];

  for (let i = p + 1; i < data.length; i++) {
    let diff = data[i].close - data[i - 1].close;

    if (diff >= 0) {
      avgG = (avgG * (p - 1) + diff) / p;
      avgL = (avgL * (p - 1)) / p;
    } else {
      avgL = (avgL * (p - 1) - diff) / p;
      avgG = (avgG * (p - 1)) / p;
    }

    let rs = avgL === 0 ? 100 : avgG / avgL;
    rsi.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) });
  }
  return rsi;
}

// ================= INIT =================
async function init() {
  try {
    log("Caricamento CSV...");

    const el = document.getElementById('chart');

    chart = LightweightCharts.createChart(el, {
      layout: { background: { color: '#000' }, textColor: '#fff' }
    });

    candleSeries = chart.addCandlestickSeries();

    [10, 50].forEach(p => {
      emaLines[p] = chart.addLineSeries();
    });

    const res = await fetch('./tr_isin_ticker.csv?v=' + Date.now());

    if (!res.ok) {
      log("CSV NON trovato", true);
      return;
    }

    const text = await res.text();

    const rows = text
      .replace(/\r/g, '')
      .split('\n')
      .filter(r => r.trim());

    if (rows.length < 2) {
      log("CSV vuoto", true);
      return;
    }

    // HEADER DINAMICO
    const header = rows[0].toLowerCase().split(/[,;]/);

    const iIsin = header.indexOf('isin');
    const iTicker = header.indexOf('ticker');
    const iName = header.indexOf('name');

    if (iTicker === -1) {
      log("Colonna TICKER mancante", true);
      return;
    }

    dataList = rows.slice(1).map(r => {
      let c = r.split(/[,;]/);

      return {
        isin: c[iIsin] || '',
        ticker: (c[iTicker] || '').trim(),
        name: c[iName] || c[iTicker]
      };
    }).filter(x => x.ticker);

    log("Titoli caricati: " + dataList.length);

    if (!dataList.length) {
      log("Nessun ticker valido", true);
      return;
    }

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
      'https://query1.finance.yahoo.com/v8/finance/chart/' + ticker +
      '?range=' + range + '&interval=' + tf
    )}`;

    const r = await fetch(url);
    const d = await r.json();

    if (!d.chart || !d.chart.result || !d.chart.result[0]) {
      throw new Error("No data");
    }

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
  if (!e10.length || !e50.length || !rsi.length) return "No data";

  let a = e10.at(-1).value;
  let b = e50.at(-1).value;
  let r = rsi.at(-1).value;

  if (a > b && r < 70) return "BUY";
  if (a < b && r > 30) return "SELL";
  return "WAIT";
}

// ================= LOAD =================
async function loadAsset() {
  if (!dataList.length) return;

  const s = dataList[idx];

  document.getElementById('assetName').innerText = s.name;
  document.getElementById('isinTicker').innerText = s.ticker;

  const c = await getData(s.ticker);

  if (!c.length) {
    log("Nessun dato Yahoo", true);
    return;
  }

  candleSeries.setData(c);

  const e10 = EMA(c, 10);
  const e50 = EMA(c, 50);

  emaLines[10].setData(e10);
  emaLines[50].setData(e50);

  const rsi = RSI(c);

  document.getElementById('signal').innerText = signal(e10, e50, rsi);
  document.getElementById('metrics').innerText =
    rsi.length ? "RSI: " + rsi.at(-1).value.toFixed(2) : "";

  chart.timeScale().fitContent();

  log("OK");
}

// ================= NAV =================
function nav(d) {
  idx = (idx + d + dataList.length) % dataList.length;
  loadAsset();
}

function cerca() {
  let v = document.getElementById('searchInput').value.toUpperCase();
  let f = dataList.findIndex(x => x.ticker === v);
  if (f != -1) {
    idx = f;
    loadAsset();
  }
}

window.onload = init;
