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

  if(!dataList.length){
    showError("CSV vuoto");
    return;
  }

  loadAsset();
}

// ================= CSV =================
async function loadCSV(){

  const res = await fetch('./tr_isin_ticker_clean.csv');
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

  try{

    console.log("Carico:", symbol);

    const url = "https://corsproxy.io/?" + encodeURIComponent(
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      symbol + "?range=1y&interval=1d"
    );

    const r = await fetch(url);
    const d = await r.json();

    if(!d.chart || !d.chart.result) throw "No data";

    const q = d.chart.result[0];

    return q.timestamp.map((t,i)=>({
      time:t,
      open:q.indicators.quote[0].open[i],
      high:q.indicators.quote[0].high[i],
      low:q.indicators.quote[0].low[i],
      close:q.indicators.quote[0].close[i],
      volume:q.indicators.quote[0].volume[i]
    })).filter(x=>x.open != null);

  }catch(e){
    console.log("Errore:", symbol);
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

// ================= SIGNALS =================
function generateMarkers(c,e10,e50){

  let markers=[], state="NONE";
  let last="WAIT", lastTime=null;

  for(let i=50;i<c.length;i++){

    let t=c[i].time;

    let a=e10.find(x=>x.time===t)?.value;
    let b=e50.find(x=>x.time===t)?.value;

    if(!a||!b) continue;

    let bull=a>b;
    let bear=a<b;

    if(bull && state!=="BULL"){
      markers.push({time:t,position:'belowBar',color:'green',shape:'arrowUp',text:'BUY'});
      state="BULL";
      last="BUY"; lastTime=t;
    }

    if(bear && state!=="BEAR"){
      markers.push({time:t,position:'aboveBar',color:'red',shape:'arrowDown',text:'SELL'});
      state="BEAR";
      last="SELL"; lastTime=t;
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

  let attempts=0;

  while(attempts < dataList.length){

    const s = dataList[idx];
    const symbol = s.ticker;

    document.getElementById("title").innerText = s.name;
    document.getElementById("ticker").innerText = symbol;

    const c = await getData(symbol);

    if(c.length > 50){

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

      const markers=generateMarkers(c,e10,e50);
      candleSeries.setMarkers(markers);

      chart.timeScale().fitContent();

      return;
    }

    // ❌ asset non valido → passa oltre
    idx=(idx+1)%dataList.length;
    attempts++;
  }

  showError("Nessun ticker valido");
}

// ================= NAV =================
function nav(d){
  idx=(idx+d+dataList.length)%dataList.length;
  loadAsset();
}

// ================= ERROR =================
function showError(msg){
  document.getElementById("title").innerText = msg;
  document.getElementById("ticker").innerText = "--";
  document.getElementById("signal").innerText = "";
}
window.onload = init;
