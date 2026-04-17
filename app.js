let dataList=[], idx=0;
let chart,candleSeries,ema10,ema50,ema200;
let cache={};

let portfolio=JSON.parse(localStorage.getItem("portfolio")||"[]");

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

 chart=LightweightCharts.createChart(document.getElementById("chart"),{
  layout:{background:{color:"#000"},textColor:"#fff"}
 });

 candleSeries=chart.addCandlestickSeries();
 ema10=chart.addLineSeries({color:"#0f0"});
 ema50=chart.addLineSeries({color:"#f00"});
 ema200=chart.addLineSeries({color:"#0af"});

 const res=await fetch('./tr_isin_ticker.csv');
 const text=await res.text();

 const rows=text.split('\n').filter(x=>x);
 const h=rows[0].toLowerCase().split(/[,;]/);

 let iT=h.indexOf('ticker'), iN=h.indexOf('name');

 dataList=rows.slice(1).map(r=>{
  let c=r.split(/[,;]/);
  return {ticker:c[iT],name:c[iN]};
 });

 loadAsset();
}

// ================= DATA =================
async function getData(t){

 if(cache[t]) return cache[t];

 const url="https://corsproxy.io/?"+encodeURIComponent(
  "https://query1.finance.yahoo.com/v8/finance/chart/"+t+"?range=1y&interval=1d"
 );

 const r=await fetch(url);
 const d=await r.json();
 const q=d.chart.result[0];

 const c=q.timestamp.map((t,i)=>({
  time:t,
  open:q.indicators.quote[0].open[i],
  high:q.indicators.quote[0].high[i],
  low:q.indicators.quote[0].low[i],
  close:q.indicators.quote[0].close[i]
 })).filter(x=>x.open!=null);

 cache[t]=c;
 return c;
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
 for(let i=50;i<c.length;i++){

  let t=c[i].time;
  let a=e10.find(x=>x.time===t)?.value;
  let b=e50.find(x=>x.time===t)?.value;
  let r=rsi.find(x=>x.time===t)?.value;

  if(!a||!b||!r) continue;

  let bull=a>b && r>50;
  let bear=a<b && r<50;

  if(bull && state!=="B"){
   m.push({time:t,position:'belowBar',color:'#0f0',shape:'arrowUp',text:'BUY'});
   state="B";
  }

  if(bear && state!=="S"){
   m.push({time:t,position:'aboveBar',color:'#f00',shape:'arrowDown',text:'SELL'});
   state="S";
  }
 }

 return m;
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

 candleSeries.setMarkers(markers(c,e10,e50,r));

 let sig=calcSignal(e10,e50,e200,r);

 document.getElementById("signalBox").innerText="Segnale: "+sig;

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

// ================= PORTFOLIO =================
function addManual(){

 let t=document.getElementById("manualTicker").value;
 let p=parseFloat(document.getElementById("manualPrice").value);
 let pl=parseFloat(document.getElementById("manualPL").value);

 portfolio.push({ticker:t,entry:p,pl});
 localStorage.setItem("portfolio",JSON.stringify(portfolio));
 renderPortfolio();
}

async function renderPortfolio(){

 let box=document.getElementById("portfolioBox");
 if(!box) return;

 let html="";

 for(let p of portfolio){

  let c=await getData(p.ticker);
  let e10=EMA(c,10);
  let e50=EMA(c,50);
  let e200=EMA(c,200);
  let r=RSI(c);

  let sig=calcSignal(e10,e50,e200,r);
  let trend=e50.at(-1)?.value>e200.at(-1)?.value?"UP":"DOWN";
  let rsiVal=r.at(-1)?.value?.toFixed(1);

  let perc=p.entry? (p.pl/p.entry*100):0;

  html+=`
  <div>
    <b>${p.ticker}</b><br>
    P/L: €${p.pl} (${perc.toFixed(2)}%)<br>
    Segnale: ${sig}<br>
    Trend: ${trend}<br>
    RSI: ${rsiVal}
  </div>
  <hr>
  `;
 }

 box.innerHTML=html;
}

// ================= START =================
window.onload=init;
