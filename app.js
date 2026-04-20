let dataList=[], idx=0;
let chart,candleSeries,ema10,ema50,ema200;
let cache={};

// ================= NAV =================
function goPage(p){window.location.href=p;}

// ================= EMA =================
function EMA(data,p){
 if(data.length<p)return[];
 let k=2/(p+1),out=[],prev=0;
 for(let i=0;i<p;i++)prev+=data[i].close;
 prev/=p;
 for(let i=p;i<data.length;i++){
  prev=data[i].close*k+prev*(1-k);
  out.push({time:data[i].time,value:prev});
 }
 return out;
}

// ================= RSI =================
function RSI(data,p=14){
 if(data.length<p+1)return[];
 let g=0,l=0;
 for(let i=1;i<=p;i++){
  let d=data[i].close-data[i-1].close;
  d>=0?g+=d:l-=d;
 }
 let avgG=g/p,avgL=l/p,out=[];
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

// ================= INIT =================
async function init(){

 try {

  chart=LightweightCharts.createChart(document.getElementById("chart"),{
    layout:{background:{color:"#000"},textColor:"#aaa"},
    grid:{vertLines:{color:"#111"},horzLines:{color:"#111"}},
    rightPriceScale:{borderColor:"#333"},
    timeScale:{borderColor:"#333",timeVisible:true},
    handleScroll:{mouseWheel:true,pressedMouseMove:true,touch:true},
    handleScale:{axisPressedMouseMove:true,pinch:true,mouseWheel:true}
  });

  candleSeries=chart.addCandlestickSeries();

  ema10=chart.addLineSeries({color:"#00c853"});
  ema50=chart.addLineSeries({color:"#ff5252"});
  ema200=chart.addLineSeries({color:"#00aaff"});

  // ===== FETCH CSV =====
  const res=await fetch('./tr_isin_ticker.csv');

  if(!res.ok) throw "CSV non trovato";

  const text=await res.text();

  if(!text) throw "CSV vuoto";

  const rows=text.split('\n').filter(x=>x);

  const header=rows[0].toLowerCase().split(/[,;]/);

  const iT=header.indexOf('ticker');
  const iN=header.indexOf('name');

  if(iT===-1 || iN===-1) throw "Formato CSV errato";

  dataList=rows.slice(1).map(r=>{
    const c=r.split(/[,;]/);
    return {ticker:c[iT],name:c[iN]};
  });

  if(!dataList.length) throw "Nessun dato";

  loadAsset();

 } catch(e) {

  document.getElementById("assetName").innerText="Errore caricamento";
  console.error(e);
 }
}
// ================= DATA =================

async function getData(ticker){

 try {

  if (cache[ticker]) return cache[ticker];

  const url = "https://corsproxy.io/?" + encodeURIComponent(
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
    ticker + "?range=1y&interval=1d"
  );

  const r = await fetch(url);
  const d = await r.json();

  // 🔴 PROTEZIONE
  if (!d.chart || !d.chart.result || !d.chart.result[0]) {
    throw "Dati Yahoo non validi";
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

 } catch(e) {

  console.error("Errore dati:", ticker, e);

  document.getElementById("assetName").innerText =
    "Errore dati: " + ticker;

  return [];
 }
}
// ================= SIGNAL =================
function calcSignal(e10,e50,e200,rsi){

 let a=e10.at(-1)?.value;
 let b=e50.at(-1)?.value;
 let c=e200.at(-1)?.value;
 let r=rsi.at(-1)?.value;

 if(!a||!b||!c||!r) return "WAIT";

 if(a>b && b>c && r>55) return "BUY";
 if(a<b && r<45) return "SELL";
 return "WAIT";
}

// ================= MARKERS =================
function markers(c,e10,e50,rsi){

 let m=[],state="";
 let lastSignal=null;

 for(let i=50;i<c.length;i++){

  let t=c[i].time;
  let a=e10.find(x=>x.time===t)?.value;
  let b=e50.find(x=>x.time===t)?.value;
  let r=rsi.find(x=>x.time===t)?.value;

  if(!a||!b||!r) continue;

  let bull=a>b && r>50;
  let bear=a<b && r<50;

  if(bull && state!=="B"){
   m.push({time:t,position:'belowBar',color:'#00c853',shape:'arrowUp',text:'BUY'});
   state="B";
   lastSignal={type:"BUY",time:t};
  }

  if(bear && state!=="S"){
   m.push({time:t,position:'aboveBar',color:'#ff5252',shape:'arrowDown',text:'SELL'});
   state="S";
   lastSignal={type:"SELL",time:t};
  }
 }

 return {markers:m,last:lastSignal};
}

// ================= LOAD =================
async function loadAsset(){

 let s=dataList[idx];
 if(!s) return;

 document.getElementById("assetName").innerText=s.name;
 document.getElementById("ticker").innerText=s.ticker;

 let c=await getData(s.ticker);

 candleSeries.setData(c);

 let e10=EMA(c,10);
 let e50=EMA(c,50);
 let e200=EMA(c,200);
 let r=RSI(c);

 ema10.setData(e10);
 ema50.setData(e50);
 ema200.setData(e200);

 const mk=markers(c,e10,e50,r);
 candleSeries.setMarkers(mk.markers);

 let sig=calcSignal(e10,e50,e200,r);

// ===== UI SEGNALE MODERNO =====
let box = document.getElementById("signalBox");

let txt = sig;

if (mk.last) {
  let d = new Date(mk.last.time * 1000);
  let ds = d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short"
  });
  txt += " • " + ds;
}

box.innerText = txt;

// reset classi
box.className = "signal";

// colore dinamico
if (sig === "BUY") box.classList.add("buy");
else if (sig === "SELL") box.classList.add("sell");
else box.classList.add("wait");

 chart.timeScale().fitContent();
}

// ================= SEARCH =================
function liveSearch(){

 let v=document.getElementById("searchInput").value.toLowerCase();
 let box=document.getElementById("searchResults");

 if(!v){box.innerHTML="";return;}

 let res=dataList.filter(x=>
  x.ticker.toLowerCase().includes(v) ||
  x.name.toLowerCase().includes(v)
 ).slice(0,5);

 box.innerHTML=res.map(r=>
 `<div onclick="selectAsset('${r.ticker}')">${r.ticker} - ${r.name}</div>`
 ).join("");
}

function selectAsset(t){
 idx=dataList.findIndex(x=>x.ticker===t);
 document.getElementById("searchResults").innerHTML="";
 loadAsset();
}

// ================= NAV =================
function nav(d){
 idx=(idx+d+dataList.length)%dataList.length;
 loadAsset();
}

// ================= START =================
window.onload=init;
