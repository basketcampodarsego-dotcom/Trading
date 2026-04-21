let dataList = [], idx = 0;
let chart, candleSeries, ema10, ema50, ema200;
let cache = {};

// ================= INIT =================
async function init(){

 try{

  chart = LightweightCharts.createChart(
    document.getElementById("chart"),
    { layout:{ background:{color:"#000"}, textColor:"#aaa"} }
  );

  candleSeries = chart.addCandlestickSeries();
  ema10 = chart.addLineSeries({color:"#00ff00"});
  ema50 = chart.addLineSeries({color:"#ff0000"});
  ema200 = chart.addLineSeries({color:"#00aaff"});

  const res = await fetch('./tr_isin_ticker.csv');
  const text = await res.text();

  const rows = text.split('\n').filter(x=>x);
  const header = rows[0].toLowerCase().split(/[,;]/);

  const iT = header.indexOf('ticker');
  const iN = header.indexOf('name');

  dataList = rows.slice(1).map(r=>{
    const c = r.split(/[,;]/);
    return {ticker:c[iT], name:c[iN]};
  });

  loadAsset();

 }catch(e){
  console.error(e);
  document.getElementById("assetName").innerText="Errore init";
 }
}

// ================= DATA =================
async function getData(ticker){

 try{

  if(cache[ticker]) return cache[ticker];

  const url = "https://corsproxy.io/?" + encodeURIComponent(
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    ticker + "?range=1y&interval=1d"
  );

  const r = await fetch(url);
  const d = await r.json();

  if(!d.chart || !d.chart.result) throw "No data";

  const q = d.chart.result[0];

  const candles = q.timestamp.map((t,i)=>({
    time:t,
    open:q.indicators.quote[0].open[i],
    high:q.indicators.quote[0].high[i],
    low:q.indicators.quote[0].low[i],
    close:q.indicators.quote[0].close[i]
  })).filter(x=>x.open);

  cache[ticker] = candles;
  return candles;

 }catch(e){
  console.error("Errore dati:", ticker);
  return [];
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

// ================= RSI =================
function RSI(data,p=14){
 if(data.length<p+1) return [];
 let g=0,l=0;

 for(let i=1;i<=p;i++){
  let d=data[i].close-data[i-1].close;
  if(d>=0) g+=d; else l-=d;
 }

 let avgG=g/p, avgL=l/p;
 let out=[];

 for(let i=p+1;i<data.length;i++){
  let d=data[i].close-data[i-1].close;

  if(d>=0){
    avgG=(avgG*(p-1)+d)/p;
    avgL=(avgL*(p-1))/p;
  }else{
    avgL=(avgL*(p-1)-d)/p;
    avgG=(avgG*(p-1))/p;
  }

  let rs=avgL===0?100:avgG/avgL;

  out.push({time:data[i].time,value:100-(100/(1+rs))});
 }

 return out;
}

// ================= MARKERS =================
function generateMarkers(c,e10,e50,rsi){

 let m=[], state="NONE", last="NONE", lastTime="";

 for(let i=50;i<c.length;i++){

  let t=c[i].time;

  let a=e10.find(x=>x.time===t)?.value;
  let b=e50.find(x=>x.time===t)?.value;
  let r=rsi.find(x=>x.time===t)?.value;

  if(!a||!b||!r) continue;

  let bull=a>b && r>50;
  let bear=a<b && r<50;

  if(bull && state!=="BULL"){
    m.push({time:t,position:'belowBar',color:'green',shape:'arrowUp',text:'BUY'});
    state="BULL";
    last="BUY"; lastTime=t;
  }

  if(bear && state!=="BEAR"){
    m.push({time:t,position:'aboveBar',color:'red',shape:'arrowDown',text:'SELL'});
    state="BEAR";
    last="SELL"; lastTime=t;
  }
 }

 document.getElementById("signalBox").innerText =
   "Segnale: " + last + " (" + new Date(lastTime*1000).toLocaleDateString() + ")";

 return m;
}

// ================= LOAD =================
async function loadAsset(){

 const s = dataList[idx];
 if(!s) return;

 document.getElementById("assetName").innerText=s.name;
 document.getElementById("isinTicker").innerText=s.ticker;

 const c = await getData(s.ticker);

 if(!c.length){
   document.getElementById("assetName").innerText="No data";
   return;
 }

 candleSeries.setData(c);

 const e10=EMA(c,10);
 const e50=EMA(c,50);
 const e200=EMA(c,200);
 const rsi=RSI(c);

 ema10.setData(e10);
 ema50.setData(e50);
 ema200.setData(e200);

 const markers=generateMarkers(c,e10,e50,rsi);
 candleSeries.setMarkers(markers);

 chart.timeScale().fitContent();
}

// ================= NAV =================
function nav(d){
 idx=(idx+d+dataList.length)%dataList.length;
 loadAsset();
}

// ================= SEARCH =================
function liveSearchInput(){

 const v=document.getElementById("searchInput").value.toLowerCase();
 const box=document.getElementById("searchResults");

 if(!v){ box.innerHTML=""; return; }

 let r=[];

 for(let i=0;i<dataList.length;i++){
  let x=dataList[i];
  if(x.ticker.toLowerCase().includes(v) || x.name.toLowerCase().includes(v)){
    r.push({...x,i});
  }
  if(r.length>=5) break;
 }

 box.innerHTML=r.map(x=>`
  <div onclick="selectSearch(${x.i})">
   ${x.ticker} - ${x.name}
  </div>
 `).join("");
}

function selectSearch(i){
 idx=i;
 document.getElementById("searchResults").innerHTML="";
 loadAsset();
}

// ================= START =================
window.onload = init;
