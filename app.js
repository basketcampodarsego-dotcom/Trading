
let dataList=[], idx=0, chart, candleSeries, emaLines={}, cache={};

function log(m,e=false){
 document.getElementById('status').innerText=m;
 document.getElementById('status').style.color=e?'red':'lime';
}

// EMA
function EMA(data,p){
 const k=2/(p+1);
 let out=[], sum=0;

 for(let i=0;i<p;i++) sum+=data[i].close;
 let prev=sum/p;

 for(let i=p;i<data.length;i++){
  let v=data[i].close*k+prev*(1-k);
  out.push({time:data[i].time,value:v});
  prev=v;
 }
 return out;
}

// RSI
function RSI(data,p=14){
 let gains=0,loss=0;

 for(let i=1;i<=p;i++){
  let diff=data[i].close-data[i-1].close;
  if(diff>=0) gains+=diff;
  else loss-=diff;
 }

 let avgG=gains/p, avgL=loss/p;
 let rsi=[];

 for(let i=p+1;i<data.length;i++){
  let diff=data[i].close-data[i-1].close;
  if(diff>=0){avgG=(avgG*(p-1)+diff)/p; avgL=(avgL*(p-1))/p;}
  else{avgL=(avgL*(p-1)-diff)/p; avgG=(avgG*(p-1))/p;}

  let rs=avgL===0?100:avgG/avgL;
  rsi.push({time:data[i].time,value:100-(100/(1+rs))});
 }
 return rsi;
}

async function init(){
 const el=document.getElementById('chart');

 chart=LightweightCharts.createChart(el,{
  layout:{background:{color:'#000'},textColor:'#fff'}
 });

 candleSeries=chart.addCandlestickSeries();

 [10,20,50,100,200].forEach(p=>{
  emaLines[p]=chart.addLineSeries({lineWidth:1});
 });

 const res=await fetch('tr_isin_ticker.csv');
 const text=await res.text();

 const rows=text.split('
').filter(r=>r.trim());
 dataList=rows.slice(1).map(r=>{
  let c=r.split(',');
  return {isin:c[0],ticker:c[1],name:c[2]};
 });

 loadAsset();
}

async function getData(ticker){
 if(cache[ticker]) return cache[ticker];

 const tf=document.getElementById('timeframe').value;

 const url=`https://corsproxy.io/?${encodeURIComponent(
 'https://query1.finance.yahoo.com/v8/finance/chart/'+ticker+'?range=1y&interval='+tf
 )}`;

 const r=await fetch(url);
 const d=await r.json();


 if (!d.chart || !d.chart.result || !d.chart.result[0]) {
    throw new Error("Errore Yahoo");
 }
 const q=d.chart.result[0];

 const candles=q.timestamp.map((t,i)=>({
  time:t,
  open:q.indicators.quote[0].open[i],
  high:q.indicators.quote[0].high[i],
  low:q.indicators.quote[0].low[i],
  close:q.indicators.quote[0].close[i]
 })).filter(x=>x.open);

 cache[ticker]=candles;
 return candles;
}

function signal(ema10,ema50,rsi){
 if(!ema10.length||!ema50.length||!rsi.length) return "";

 let e1=ema10.at(-1).value;
 let e2=ema50.at(-1).value;
 let r=rsi.at(-1).value;

 if(e1>e2 && r<70) return "🟢 BUY";
 if(e1<e2 && r>30) return "🔴 SELL";
 return "⚪ WAIT";
}

async function loadAsset(){
 if(!dataList.length) return;

 let s=dataList[idx];

 document.getElementById('assetName').innerText=s.name;
 document.getElementById('isinTicker').innerText=s.ticker;

 try{
  let c=await getData(s.ticker);

  candleSeries.setData(c);

  let e10=EMA(c,10);
  let e50=EMA(c,50);

  emaLines[10].setData(e10);
  emaLines[50].setData(e50);

  let rsi=RSI(c);

  document.getElementById('signal').innerText=signal(e10,e50,rsi);

  document.getElementById('metrics').innerText=
   "RSI: "+rsi.at(-1).value.toFixed(2);

  chart.timeScale().fitContent();

  log("OK");
 }catch(e){log("Error",true)}
}

function nav(d){
 idx=(idx+d+dataList.length)%dataList.length;
 loadAsset();
}

function cerca(){
 let v=document.getElementById('searchInput').value.toUpperCase();
 let f=dataList.findIndex(x=>x.ticker===v);
 if(f!=-1){idx=f; loadAsset();}
}

window.onload=init;
