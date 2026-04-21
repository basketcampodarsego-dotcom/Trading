let chart;
let candleSeries;
let idx = 0;
let assets = ["AAPL","MSFT","TSLA"];

function createChart(){

  chart = LightweightCharts.createChart(
    document.getElementById("chart"),
    { layout:{background:{color:"#000"},textColor:"#fff"} }
  );

  candleSeries = chart.addCandlestickSeries();
}

function demoData(){

  let data=[], price=100;

  for(let i=0;i<100;i++){
    let open=price;
    let close=price+(Math.random()-0.5)*5;
    let high=Math.max(open,close)+2;
    let low=Math.min(open,close)-2;

    data.push({time:1670000000+i*86400,open,high,low,close});
    price=close;
  }

  return data;
}

function loadChart(symbol){

  document.getElementById("title").innerText = symbol;
  document.getElementById("ticker").innerText = symbol;

  document.getElementById("chart").innerHTML="";

  createChart();

  try{
    let data = demoData();
    candleSeries.setData(data);

    let last = data[data.length-1];
    let prev = data[data.length-2];

    let signal = last.close > prev.close ? "BUY" : "SELL";

    document.getElementById("signal").innerText =
      signal + " - " + new Date().toLocaleDateString();

  }catch(e){
    document.getElementById("signal").innerText="Errore dati";
  }
}

function nav(d){
  idx = (idx + d + assets.length) % assets.length;
  loadChart(assets[idx]);
}

function searchAsset(){
  let v = document.getElementById("search").value.toUpperCase();
  let found = assets.find(x=>x.includes(v));
  if(found){
    idx = assets.indexOf(found);
    loadChart(found);
  }
}

loadChart(assets[idx]);
