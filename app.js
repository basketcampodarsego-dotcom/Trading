let dataList = [];
let idx = 0;

let chart;
let candleSeries, ema10, ema50, ema200, volumeSeries;

let cache = {};

// ================= INIT =================
async function init(){

  chart = LightweightCharts.createChart(
    document.getElementById("chart"),
    {
      layout:{ background:{color:"#000"}, textColor:"#aaa" },
      rightPriceScale:{ scaleMargins:{ top:0.1, bottom:0.3 } }
    }
  );

  candleSeries = chart.addCandlestickSeries();

  ema10 = chart.addLineSeries({color:"#00ff00"});
  ema50 = chart.addLineSeries({color:"#ff0000"});
  ema200 = chart.addLineSeries({color:"#00aaff"});

  volumeSeries = chart.addHistogramSeries({
    priceFormat:{ type:'volume' },
    priceScaleId:''
  });

  await loadCSV();
  loadAsset();
}

// ================= CSV =================
async function loadCSV(){

  const res = await fetch('./Titoli.csv');
  const text = await res.text();

  const rows = text.split('\n').filter(x=>x.trim());
  const header = rows[0].toLowerCase().split(/[,;]/);

  const iTicker = header.indexOf('ticker');
  const iName   = header.indexOf('name');
  const iIsin   = header.indexOf('isin');

  dataList = rows.slice(1).map(r=>{
    const c = r.split(/[,;]/);
    return {
      ticker: c[iTicker],
      name: c[iName],
      isin: c[iIsin]
    };
  });
}

// ================= DATA =================
async function getData(symbol){

  if(cache[symbol]) return cache[symbol];

  try{
    const url = "https://corsproxy.io/?" + encodeURIComponent(
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      symbol + "?range=1y&interval=1d"
    );

    const r = await fetch(url);
    const d = await r.json();

    const q = d.chart.result[0];

    const candles = q.timestamp.map((t,i)=>({
      time:t,
      open:q.indicators.quote[0].open[i],
      high:q.indicators.quote[0].high[i],
      low:q.indicators.quote[0].low[i],
      close:q.indicators.quote[0].close[i],
      volume:q.indicators.quote[0].volume[i]
    })).filter(x=>x.open != null);

    cache[symbol] = candles;
    return candles;

  }catch{
    return [];
  }
}

// ================= FUNDAMENTALS =================
async function getFundamentals(symbol){

  try{

    const url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + symbol;

    const r = await fetch(url);
    const d = await r.json();

    if(!d.quoteResponse || !d.quoteResponse.result.length){
      throw "No fundamentals";
    }

    const q = d.quoteResponse.result[0];

    return {
      pe: q.trailingPE ?? null,
      eps: q.epsTrailingTwelveMonths ?? null,
      cap: q.marketCap ?? null
    };

  }catch(e){
    console.log("Fundamentals error:", symbol);
    return null;
  }
}
// ================= EMA =================
function EMA(data,p){
  if(data.length<p) return [];
  const k=2/(p+1);
  let out=[],prev=0;

  for(let i=0;i<p;i++) prev+=data[i].close;
  prev/=p;

  for(let i=p;i<data.length;i++){
    prev=data[i].close*k+prev*(1-k);
    out.push({time:data[i].time,value:prev});
  }
  return out;
}

// ================= SIGNALS =================
function generateSignals(c,e10,e50){

  let markers=[];
  let state="NONE";
  let last="WAIT";
  let lastTime=null;

  for(let i=50;i<c.length;i++){

    let t=c[i].time;

    let a=e10.find(x=>x.time===t)?.value;
    let b=e50.find(x=>x.time===t)?.value;

    if(!a||!b) continue;

    let bull=a>b;
    let bear=a<b;

    // 🔵 BUY - BLU (molto visibile)
    if(bull && state!=="BULL"){
      markers.push({
        time:t,
        position:'belowBar',
        color:'#00d0ff', // BLU acceso
        shape:'arrowUp',
        text:' BUY ',
        size:2
      });

      state="BULL";
      last="BUY";
      lastTime=t;
    }

    // 🟣 SELL - VIOLA (distinto dal rosso)
    if(bear && state!=="BEAR"){
      markers.push({
        time:t,
        position:'aboveBar',
        color:'#ff00ff', // VIOLA acceso
        shape:'arrowDown',
        text:' SELL ',
        size:2
      });

      state="BEAR";
      last="SELL";
      lastTime=t;
    }
  }

  let txt="Segnale: "+last;

  if(lastTime){
    txt += " (" + new Date(lastTime*1000).toLocaleDateString() + ")";
  }

  document.getElementById("signal").innerText = txt;

  return markers;
}
// ================= LOAD =================
async function loadAsset(){

  let s = dataList[idx];
  if(!s) return;

  document.getElementById("title").innerText = s.name;
  document.getElementById("ticker").innerText = s.ticker;

  const c = await getData(s.ticker);

  if(!c.length){
    document.getElementById("signal").innerText="No data";
    return;
  }

  candleSeries.setData(c);

  const e10=EMA(c,10);
  const e50=EMA(c,50);
  const e200=EMA(c,200);

  ema10.setData(e10);
  ema50.setData(e50);
  ema200.setData(e200);

  volumeSeries.setData(
    c.map(x=>({
      time:x.time,
      value:x.volume,
      color: x.close>x.open ? '#26a69a' : '#ef5350'
    }))
  );

  const markers=generateSignals(c,e10,e50);
  candleSeries.setMarkers(markers);

  // fondamentali
  const f = await getFundamentals(s.ticker);
  if(f){
    document.getElementById("fundamentals").innerText =
      "PE: "+(f.pe||"-")+" | EPS: "+(f.eps||"-")+" | MCap: "+(f.cap||"-");
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

  let v = document.getElementById("search").value.toLowerCase();

  let found = dataList.find(x =>
    (x.ticker && x.ticker.toLowerCase().includes(v)) ||
    (x.name && x.name.toLowerCase().includes(v)) ||
    (x.isin && x.isin.toLowerCase().includes(v))
  );

  if(found){
    idx = dataList.indexOf(found);
    loadAsset();
  }
}

// ================= START =================
window.onload = init;
