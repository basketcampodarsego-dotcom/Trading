let stockData=[];let idx=0;let chart,candleSeries,emas={};const cache={};
function log(msg,err=false){const s=document.getElementById('status');s.innerText=msg;s.style.color=err?'#f6465d':'#0c0';}
function calculateEMA(data,period){const k=2/(period+1);let emaData=[];let sum=0;for(let i=0;i<period;i++){sum+=data[i].close;}let prevEma=sum/period;for(let i=period;i<data.length;i++){const emaVal=data[i].close*k+prevEma*(1-k);emaData.push({time:data[i].time,value:emaVal});prevEma=emaVal;}return emaData;}
async function start(){const chartEl=document.getElementById('chart');chart=LightweightCharts.createChart(chartEl,{layout:{background:{color:'#000'},textColor:'#ddd'}});candleSeries=chart.addCandlestickSeries();
[10,25,50,100,200].forEach((p,i)=>{const colors=['#0f0','#ff0','#f00','#fff','#bf00ff'];emas[p]=chart.addLineSeries({color:colors[i]});});
const res=await fetch('tr_isin_ticker.csv');const text=await res.text();const lines=text.split('\n');stockData=lines.slice(1).map(l=>{const c=l.split(',');return{isin:c[0],ticker:c[1],name:c[2]};});
aggiornaTitolo();window.addEventListener('resize',()=>{chart.applyOptions({width:chartEl.clientWidth});});}
async function fetchData(ticker){if(cache[ticker])return cache[ticker];log("Caricamento...");
const url=`https://corsproxy.io/?${encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/'+ticker+'?range=2y&interval=1d')}`;
const r=await fetch(url);const d=await r.json();if(!d.chart||!d.chart.result){throw new Error("Errore Yahoo");}
const q=d.chart.result[0];
const candles=q.timestamp.map((t,i)=>({time:t,open:q.indicators.quote[0].open[i],high:q.indicators.quote[0].high[i],low:q.indicators.quote[0].low[i],close:q.indicators.quote[0].close[i]})).filter(c=>c.open);
cache[ticker]=candles;return candles;}
async function aggiornaTitolo(){const s=stockData[idx];document.getElementById('assetName').innerText=s.name;document.getElementById('isinTicker').innerText=`${s.isin} | ${s.ticker}`;
try{const candles=await fetchData(s.ticker);candleSeries.setData(candles);[10,25,50,100,200].forEach(p=>{if(candles.length>p){emas[p].setData(calculateEMA(candles,p));}});chart.timeScale().fitContent();log("OK");}
catch(e){log(e.message,true);}}
function naviga(dir){idx=(idx+dir+stockData.length)%stockData.length;aggiornaTitolo();}
function cerca(){const val=document.getElementById('searchInput').value.toUpperCase();const f=stockData.findIndex(s=>s.isin===val||s.ticker===val);if(f!==-1){idx=f;aggiornaTitolo();}else{alert("Non trovato");}}
window.onload=start;