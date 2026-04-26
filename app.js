let dataList = [];
let idx = 0;

let chart;
let candleSeries;

// ================= INIT =================
async function init(){

  chart = LightweightCharts.createChart(
    document.getElementById("chart"),
    { layout:{ background:{color:"#000"}, textColor:"#aaa" } }
  );

  candleSeries = chart.addCandlestickSeries();

  await loadCSV();
  loadAsset();

  document.getElementById("search")
    .addEventListener("keypress", e=>{
      if(e.key==="Enter") searchAsset();
    });
}

// ================= CSV =================
async function loadCSV(){

  const res = await fetch('./Titoli.csv');
  const text = await res.text();

  const rows = text.split('\n').filter(x=>x.trim());
  const header = rows[0].toLowerCase().split(',');

  const iTicker = header.indexOf('ticker');
  const iName   = header.indexOf('name');
  const iIsin   = header.indexOf('isin');

  dataList = rows.slice(1).map(r=>{
    const c = r.split(',');
    return {
      ticker:c[iTicker].trim(),
      name:c[iName].trim(),
      isin:c[iIsin].trim()
    };
  });
}

// ================= DATA =================
async function getData(symbol){

  const url = "https://corsproxy.io/?" + encodeURIComponent(
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    symbol + "?range=1y&interval=1d"
  );

  const r = await fetch(url);
  const d = await r.json();

  const q = d.chart.result[0];

  return q.timestamp.map((t,i)=>({
    time:t,
    close:q.indicators.quote[0].close[i]
  })).filter(x=>x.close);
}

// ================= RSI =================
function calcRSI(data, period=14){

  if(data.length < period+1) return null;

  let gains=0, losses=0;

  for(let i=1;i<=period;i++){
    let diff = data[i].close - data[i-1].close;
    if(diff>=0) gains+=diff;
    else losses-=diff;
  }

  let rs = gains / (losses || 1);
  return 100 - (100/(1+rs));
}

// ================= EMA =================
function calcEMA(data,p){

  if(data.length < p) return null;

  let k=2/(p+1);
  let prev=data[0].close;

  for(let i=1;i<data.length;i++){
    prev=data[i].close*k + prev*(1-k);
  }

  return prev;
}

// ================= FUNDAMENTALS =================
async function getFund(symbol){

  try{
    const r = await fetch("https://query1.finance.yahoo.com/v7/finance/quote?symbols="+symbol);
    const d = await r.json();
    const q = d.quoteResponse.result[0];

    return {
      pe:q.trailingPE,
      eps:q.epsTrailingTwelveMonths,
      cap:q.marketCap,
      div:q.dividendYield
    };

  }catch{
    return null;
  }
}

// ================= FORMAT =================
function formatCap(n){
  if(!n) return "-";
  if(n>1e9) return (n/1e9).toFixed(1)+"B";
  if(n>1e6) return (n/1e6).toFixed(1)+"M";
  return n;
}

// ================= RATING PRO =================
function calculateRating(data, rsi, ema50, ema200, ema10, fund){

  let score = 0;
  let log = [];

  const last = data[data.length-1].close;

  // TREND LUNGO
  if(ema200){
    if(last > ema200){
      score += 2;
      log.push("Trend lungo positivo (sopra EMA200) +2");
    }else{
      score -= 2;
      log.push("Trend lungo negativo (sotto EMA200) -2");
    }
  }

  // TREND MEDIO
  if(ema50){
    if(last > ema50){
      score += 1;
      log.push("Trend medio positivo (sopra EMA50) +1");
    }else{
      score -= 1;
      log.push("Trend medio negativo (sotto EMA50) -1");
    }
  }

  // MOMENTUM
  if(ema10 && ema50){
    if(ema10 > ema50){
      score += 1;
      log.push("Momentum positivo (EMA10 > EMA50) +1");
    }else{
      score -= 1;
      log.push("Momentum negativo (EMA10 < EMA50) -1");
    }
  }

  // RSI
  if(rsi){
    if(rsi < 30){
      score += 1;
      log.push("RSI ipervenduto +1");
    }else if(rsi > 70){
      score -= 1;
      log.push("RSI ipercomprato -1");
    }
  }

  // FUNDAMENTALI
  if(fund){
    if(fund.pe && fund.pe < 15){
      score += 1;
      log.push("P/E basso +1");
    }else if(fund.pe && fund.pe > 30){
      score -= 1;
      log.push("P/E alto -1");
    }

    if(fund.div && fund.div > 0.03){
      score += 1;
      log.push("Dividendo interessante +1");
    }
  }

  // CLASSIFICAZIONE
  let label = "NEUTRO";

  if(score >= 4) label = "BUY FORTE";
  else if(score >= 2) label = "BUY";
  else if(score <= -4) label = "SELL FORTE";
  else if(score <= -2) label = "SELL";

  return { score, label, log };
}

// ================= LOAD =================
async function loadAsset(){

  let s = dataList[idx];
  if(!s) return;

  document.getElementById("title").innerText = s.name;
  document.getElementById("ticker").innerText = s.ticker;

  const data = await getData(s.ticker);
  if(!data.length) return;

  candleSeries.setData(data.map(x=>({
    time:x.time,
    open:x.close,
    high:x.close,
    low:x.close,
    close:x.close
  })));

  const rsi = calcRSI(data);
  const ema50 = calcEMA(data,50);
  const ema200 = calcEMA(data,200);
  const ema10 = calcEMA(data,10);

  const f = await getFund(s.ticker);

  // ===== RATING =====
  const rating = calculateRating(data, rsi, ema50, ema200, ema10, f);

  document.getElementById("signal").innerText =
    "Rating: " + rating.label + " (" + rating.score + ")";

  document.getElementById("tech").innerText =
    rating.log.join(" | ");

  // ===== FUNDAMENTALS DISPLAY =====
  if(f){
    document.getElementById("fund").innerText =
      "PE: " + (f.pe||"-") +
      " | EPS: " + (f.eps||"-") +
      " | Div: " + (f.div ? (f.div*100).toFixed(2)+"%" : "-") +
      " | Cap: " + formatCap(f.cap);
  }

  chart.timeScale().fitContent();
}

// ================= NAV =================
function nav(d){
  idx=(idx+d+dataList.length)%dataList.length;
  loadAsset();
}

// ================= SEARCH =================
function searchAsset(){

  let v=document.getElementById("search").value.toLowerCase();

  let f=dataList.find(x=>
    x.ticker.toLowerCase().includes(v) ||
    x.name.toLowerCase().includes(v) ||
    x.isin.toLowerCase().includes(v)
  );

  if(f){
    idx=dataList.indexOf(f);
    loadAsset();
  }
}

// ================= START =================
window.onload=init;
