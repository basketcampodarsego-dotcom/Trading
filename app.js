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

  // Volume
  volumeSeries = chart.addHistogramSeries({
    priceFormat:{ type:'volume' },
    priceScaleId:''
  });

  await loadCSV();
  loadAsset();
}

// ================= CSV =================
async function loadCSV(){

  try{
    const res = await fetch('./tr_isin_ticker.csv');
    const text = await res.text();

    const rows = text.split('\n').filter(x=>x);
    const header = rows[0].toLowerCase().split(/[,;]/);

    const iT = header.indexOf('ticker');
    const iN = header.indexOf('name');

    dataList = rows.slice(1).map(r=>{
      const c = r.split(/[,;]/);
      return { ticker:c[iT], name:c[iN] };
    });

  }catch(e){
    dataList = [
      {ticker:"MSFT", name:"Microsoft"},
      {ticker:"AAPL", name:"Apple"},
      {ticker:"TSLA", name:"Tesla"}
    ];
  }
}

// ================= PRICE DATA =================
async function getData(ticker){

  try{

    if(cache[ticker]) return cache[ticker];

    const url = "https://corsproxy.io/?" +
