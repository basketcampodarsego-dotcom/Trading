let dataList = [];
let idx = 0;

let chart;
let candleSeries;

// ===== CONFIG =====
let selectedCSVs = JSON.parse(localStorage.getItem("csvFiles")) || ["Titoli.csv"];

// ===== INIT =====
async function init(){

  chart = LightweightCharts.createChart(
    document.getElementById("chart"),
    {
      layout:{ background:{color:"#000"}, textColor:"#aaa" }
    }
  );

  candleSeries = chart.addCandlestickSeries();

  await loadAllCSVs();
  loadAsset();

  // restore selezione UI
  const sel = document.getElementById("csvSelector");
  if(sel){
    for(let opt of sel.options){
      if(selectedCSVs.includes(opt.value)){
        opt.selected = true;
      }
    }
  }

  document.getElementById("search")
    .addEventListener("keypress", e=>{
      if(e.key==="Enter") searchAsset();
    });
}

// ===== LOAD MULTI CSV =====
async function loadAllCSVs(){

  dataList = [];

  for(let file of selectedCSVs){

    try{
      const res = await fetch('./' + file);
      const text = await res.text();

      const rows = text.split('\n').filter(x=>x.trim());
      const header = rows[0].toLowerCase().split(/[,;]/);

      const iTicker = header.indexOf('ticker');
      const iName   = header.indexOf('name');
      const iIsin   = header.indexOf('isin');

      const parsed = rows.slice(1).map(r=>{
        const c = r.split(/[,;]/);
        return {
          ticker:(c[iTicker]||"").trim().toUpperCase(),
          name:(c[iName]||"").trim(),
          isin:(c[iIsin]||"").trim().toUpperCase()
        };
      });

      dataList = dataList.concat(parsed);

    }catch(e){
      console.log("Errore CSV:", file);
    }
  }
}

// ===== APPLY SELECTION =====
function applyCSVSelection(){

  const sel = document.getElementById("csvSelector");

  selectedCSVs = Array.from(sel.selectedOptions).map(o => o.value);

  if(selectedCSVs.length === 0){
    alert("Seleziona almeno un file");
    return;
  }

  localStorage.setItem("csvFiles", JSON.stringify(selectedCSVs));

  loadAllCSVs().then(()=>{
    idx = 0;
    loadAsset();
  });
}

// ===== SEARCH =====
function searchAsset(){

  const input = document.getElementById("search").value;

  const v = input.toLowerCase()
    .replace(/\s+/g,'')
    .replace(/[^a-z0-9]/g,'');

  let found = dataList.find(x=>{
    return (
      x.ticker.toLowerCase().includes(v) ||
      x.name.toLowerCase().includes(v) ||
      x.isin.toLowerCase().includes(v)
    );
  });

  if(found){
    idx = dataList.indexOf(found);
    loadAsset();
  }
}

// ===== DATA =====
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
      close:q.indicators.quote[0].close[i]
    }));

  }catch{
    return [];
  }
}

// ===== LOAD ASSET =====
async function loadAsset(){

  let s = dataList[idx];
  if(!s) return;

  document.getElementById("title").innerText = s.name;
  document.getElementById("ticker").innerText = s.ticker;

  const data = await getData(s.ticker);
  if(!data.length) return;

  candleSeries.setData(data);
  chart.timeScale().fitContent();
}

// ===== NAV =====
function nav(d){
  idx = (idx + d + dataList.length) % dataList.length;
  loadAsset();
}

// ===== CONFIG =====
function toggleConfig(){
  const box = document.getElementById("configBox");
  box.style.display = box.style.display==="none" ? "block" : "none";
}

// ===== START =====
window.onload = init;
