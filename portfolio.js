let portfolio = JSON.parse(localStorage.getItem("portfolio") || "[]");

// ================= SAVE =================
function save(){
  localStorage.setItem("portfolio", JSON.stringify(portfolio));
}

// ================= ADD =================
function addPosition(){

  const ticker = document.getElementById("p_ticker").value.toUpperCase();
  const qty = parseFloat(document.getElementById("p_qty").value);
  const price = parseFloat(document.getElementById("p_price").value);

  if(!ticker || !qty || !price) return;

  portfolio.push({ticker, qty, price});
  save();
  render();
}

// ================= REMOVE =================
function removePosition(i){
  portfolio.splice(i,1);
  save();
  render();
}

// ================= PRICE =================
async function getPrice(symbol){
  try{
    const r = await fetch("https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + symbol);
    const d = await r.json();
    return d.quoteResponse.result[0].regularMarketPrice;
  }catch{
    return null;
  }
}

// ================= DATA =================
async function getData(symbol){

  try{
    const url = "https://corsproxy.io/?" + encodeURIComponent(
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      symbol + "?range=6mo&interval=1d"
    );

    const r = await fetch(url);
    const d = await r.json();

    const q = d.chart.result[0];

    return q.timestamp.map((t,i)=>({
      time:t,
      close:q.indicators.quote[0].close[i]
    })).filter(x=>x.close != null);

  }catch{
    return [];
  }
}

// ================= EMA =================
function EMA(data,p){
  if(data.length<p) return null;
  const k=2/(p+1);

  let prev = data.slice(0,p).reduce((a,b)=>a+b.close,0)/p;

  for(let i=p;i<data.length;i++){
    prev = data[i].close*k + prev*(1-k);
  }

  return prev;
}

// ================= SIGNAL =================
async function getSignal(symbol){

  const data = await getData(symbol);

  if(data.length < 50) return "N/A";

  const e10 = EMA(data,10);
  const e50 = EMA(data,50);

  if(!e10 || !e50) return "N/A";

  if(e10 > e50) return "BUY";
  if(e10 < e50) return "SELL";

  return "WAIT";
}

// ================= NAVIGATE =================
function openChart(ticker){
  localStorage.setItem("selectedTicker", ticker);
  window.location.href = "index.html";
}

// ================= RENDER =================
async function render(){

  const tbody = document.querySelector("#portfolioTable tbody");
  tbody.innerHTML = "";

  let totalValue = 0;
  let totalCost = 0;

  for(let i=0;i<portfolio.length;i++){

    const p = portfolio[i];

    const current = await getPrice(p.ticker);
    const signal = await getSignal(p.ticker);

    const value = current ? current * p.qty : 0;
    const cost  = p.price * p.qty;
    const pl    = value - cost;

    totalValue += value;
    totalCost  += cost;

    let signalColor = "#aaa";
    if(signal === "BUY") signalColor = "#00d0ff";
    if(signal === "SELL") signalColor = "#ff00ff";

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td onclick="openChart('${p.ticker}')" style="cursor:pointer;color:#00d0ff">
        ${p.ticker}
      </td>
      <td>${p.qty}</td>
      <td>${p.price}</td>
      <td>${current ? current.toFixed(2) : "-"}</td>
      <td>${value.toFixed(2)}</td>
      <td style="color:${pl>=0?'#0f0':'#f55'}">${pl.toFixed(2)}</td>
      <td style="color:${signalColor}">${signal}</td>
      <td><button onclick="removePosition(${i})">X</button></td>
    `;

    tbody.appendChild(tr);
  }

  // ===== TOTALE =====
  const totalPL = totalValue - totalCost;
  const perc = totalCost ? (totalPL / totalCost * 100) : 0;

  document.getElementById("total").innerText =
    "Totale: " +
    totalValue.toFixed(2) +
    " | P/L: " +
    totalPL.toFixed(2) +
    " (" + perc.toFixed(2) + "%)";
}

// ================= INIT =================
render();
