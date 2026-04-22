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

// ================= GET PRICE =================
async function getPrice(symbol){

  try{
    const url = "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + symbol;

    const r = await fetch(url);
    const d = await r.json();

    return d.quoteResponse.result[0].regularMarketPrice;

  }catch{
    return null;
  }
}

// ================= RENDER =================
async function render(){

  const tbody = document.querySelector("#portfolioTable tbody");
  tbody.innerHTML = "";

  for(let i=0;i<portfolio.length;i++){

    const p = portfolio[i];

    const current = await getPrice(p.ticker);

    const value = current ? current * p.qty : 0;
    const cost  = p.price * p.qty;
    const pl    = value - cost;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.ticker}</td>
      <td>${p.qty}</td>
      <td>${p.price}</td>
      <td>${current ? current.toFixed(2) : "-"}</td>
      <td>${value.toFixed(2)}</td>
      <td style="color:${pl>=0?'#0f0':'#f00'}">${pl.toFixed(2)}</td>
      <td><button onclick="removePosition(${i})">X</button></td>
    `;

    tbody.appendChild(tr);
  }
}

// ================= INIT =================
render();
