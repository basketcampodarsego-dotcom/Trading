let dataList = [];
let idx = 0;

let chart;
let candleSeries, ema10, ema50, ema200, volumeSeries;

// ================= CONFIG =================
let currentCSV = localStorage.getItem("csvFile") || "Titoli.csv";

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
  ema10 = chart.addLineSeries({color:"#00ff00", lineWidth:2});
  ema50 = chart.addLineSeries({color:"#ff0000", lineWidth:2});
  ema200 = chart.addLineSeries({color:"#00aaff", lineWidth:2});

  volumeSeries = chart.addHistogramSeries({
    priceFormat:{ type:'volume' },
    priceScaleId:''
  });

  await loadCSV();

  const saved = localStorage.getItem("selectedTicker");
  if(saved){
    const i = dataList.findIndex(x => x.ticker === saved);
    if(i >= 0){
      idx = i;
      localStorage.removeItem("selectedTicker");
    }
  }

  loadAsset();

  const input = document.getElementById("search");
  input.addEventListener("keypress", e=>{
    if(e.key==="Enter") searchAsset();
  });

  const sel = document.getElementById("csvSelector");
  if(sel) sel.value = currentCSV;
}

// ================= CSV =================
async function loadCSV(){

  const res = await fetch('./' + currentCSV);
  const text = await res.text();

  const rows = text.split('\n').filter(x=>x.trim());
  const header = rows[0].toLowerCase().split(/[,;]/);

  const iTicker = header.indexOf('ticker');
  const iName   = header.indexOf('name');
  const iIsin   = header.indexOf('isin');

  dataList = rows.slice(1).map(r=>{
    const c = r.split(/[,;]/);
    return {
      ticker:(c[iTicker]||"").trim().toUpperCase(),
      name:(c[iName]||"").trim(),
      isin:(c[iIsin]||"").trim().toUpperCase()
    };
  });
}

// ================= CONFIG =================
function changeCSV(){

  const sel = document.getElementById("csvSelector");
  currentCSV = sel.value;

  localStorage.setItem("csvFile", currentCSV);

  loadCSV().then(()=>{
    idx = 0;
    loadAsset();
  });
}

function toggleConfig(){
  const box = document.getElementById("configBox");
  box.style.display = box.style.display==="none" ? "block" : "none";
}

// ================= SEARCH =================
function searchAsset(){

  const input = document.getElementById("search").value;

  const v = input.toLowerCase()
    .trim()
    .replace(/\s+/g,'')
    .replace(/[^a-z0-9]/g,'');

  if(!v) return;

  let found = dataList.find(x=>{
    const t = x.ticker.toLowerCase().replace(/[^a-z0-9]/g,'');
    const n = x.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    const i = x.isin.toLowerCase().replace(/[^a-z0-9]/g,'');
    return t.includes(v)||n.includes(v)||i.includes(v);
  });

  if(found){
    idx = dataList.indexOf(found);
    document.getElementById("searchInfo").innerText="Trovato: "+found.ticker;
    loadAsset();
  }else{
    document.getElementById("searchInfo").innerText="Nessun risultato";
  }
}

// ================= DATA =================
async function getData(symbol){

  try{
    const url = "https://corsproxy.io/?" + encodeURIComponent(
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      symbol + "?range=1y&interval=1d"
    );

    const r = await fetch(url);
    const d = await r.json();

    const q = d.chart.result[0];

    return q.timestamp.map((t,i)=>({
      time:t,
      open:q.indicators.quote[0].open[i],
      high:q.indicators.quote[0].high[i],
      low:q.indicators.quote[0].low[i],
      close:q.indicators.quote[0].close[i],
      volume:q.indicators.quote[0].volume[i]
    })).filter(x=>x.open!=null);

  }catch{
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

// ================= SIGNAL =================
function generateSignals(c,e10,e50){

  let markers=[];
  let state=null;
  let last="WAIT";
  let lastTime=null;

  for(let i=50;i<c.length;i++){

    let t=c[i].time;
    let a=e10.find(x=>x.time===t)?.value;
    let b=e50.find(x=>x.time===t)?.value;

    if(!a||!b) continue;

    if(a>b && state!=="BUY"){
      markers.push({time:t,position:'belowBar',color:'#00d0ff',shape:'arrowUp',text:'BUY'});
      state="BUY"; last="BUY"; lastTime=t;
    }

    if(a<b && state!=="SELL"){
      markers.push({time:t,position:'aboveBar',color:'#ff00ff',shape:'arrowDown',text:'SELL'});
      state="SELL"; last="SELL"; lastTime=t;
    }
  }

  let txt="Segnale: "+last;
  if(lastTime){
    txt+=" ("+new Date(lastTime*1000).toLocaleDateString()+")";
  }

  document.getElementById("signal").innerText=txt;

  return markers;
}

// ================= LOAD =================
async function loadAsset(){

  let s=dataList[idx];
  if(!s) return;

  document.getElementById("title").innerText=s.name;
  document.getElementById("ticker").innerText=s.ticker;

  const c=await getData(s.ticker);
  if(!c.length) return;

  candleSeries.setData(c);

  const e10=EMA(c,10);
  const e50=EMA(c,50);
  const e200=EMA(c,200);

  ema10.setData(e10);
  ema50.setData(e50);
  ema200.setData(e200);

  volumeSeries.setData(c.map(x=>({
    time:x.time,
    value:x.volume,
    color:x.close>x.open?'#26a69a':'#ef5350'
  })));

  const markers=generateSignals(c,e10,e50);
  candleSeries.setMarkers(markers);

  chart.timeScale().fitContent();
}

// ================= NAV =================
function nav(d){
  idx=(idx+d+dataList.length)%dataList.length;
  loadAsset();
}

// ================= START =================
window.onload=init;
