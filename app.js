let dataList = [];
let idx = 0;

let chart;
let candleSeries;

// ===== INIT =====
async function init(){

  chart = LightweightCharts.createChart(
    document.getElementById("chart"),
    {
      layout:{ background:{color:"#000"}, textColor:"#aaa" }
    }
  );

  candleSeries = chart.addCandlestickSeries();

  await loadCSV();
  loadAsset();

  document.getElementById("search")
    .addEventListener("keypress", e=>{
      if(e.key==="Enter") searchAsset();
    });
}

// ===== CSV =====
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

// ===== DATA =====
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
  }));
}

// ===== RSI =====
function calcRSI(data, period=14){

  let gains=0, losses=0;

  for(let i=1;i<=period;i++){
    let diff = data[i].close - data[i-1].close;
    if(diff>=0) gains+=diff;
    else losses-=diff;
  }

  let rs = gains / losses;
  return 100 - (100/(1+rs));
}

// ===== EMA =====
function EMA(data,p){
  let k=2/(p+1);
  let prev=data[0].close;

  for(let i=1;i<data.length;i++){
    prev=data[i].close*k + prev*(1-k);
  }

  return prev;
}

// ===== FUNDAMENTALS =====
async function getFund(symbol){

  try{
    const r = await fetch("https://query1.finance.yahoo.com/v7/finance/quote?symbols="+symbol);
    const d = await r.json();
    const q = d.quoteResponse.result[0];

    return {
      pe:q.trailingPE,
      eps:q.epsTrailingTwelveMonths,
      cap:q.marketCap
    };

  }catch{
    return null;
  }
}

// ===== LOAD =====
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

  // ===== TECH =====
  const rsi = calcRSI(data);
  const ema50 = EMA(data,50);
  const last = data[data.length-1].close;

  const dist = ((last-ema50)/ema50*100).toFixed(2);

  document.getElementById("tech").innerText =
    "RSI: " + rsi.toFixed(1) +
    " | Dist EMA50: " + dist + "%";

  // ===== SIGNAL =====
  document.getElementById("signal").innerText =
    rsi>70 ? "SELL (ipercomprato)" :
    rsi<30 ? "BUY (ipervenduto)" :
    "NEUTRO";

  // ===== FUND =====
  const f = await getFund(s.ticker);

  if(f){
    document.getElementById("fund").innerText =
      "PE: "+(f.pe||"-")+
      " | EPS: "+(f.eps||"-")+
      " | MCap: "+(f.cap||"-");
  }

  chart.timeScale().fitContent();
}

// ===== NAV =====
function nav(d){
  idx=(idx+d+dataList.length)%dataList.length;
  loadAsset();
}

// ===== SEARCH =====
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

// ===== START =====
window.onload=init;
