
let dataList=[], idx=0;
let cache={};

let cash=10000;
let positions=[];
let trades=[];
let equityHistory=[];

function save(){localStorage.setItem('proB',JSON.stringify({cash,positions,trades,equityHistory,idx}));}
function load(){
 const s=localStorage.getItem('proB');
 if(!s) return;
 const d=JSON.parse(s);
 cash=d.cash||10000;
 positions=d.positions||[];
 trades=d.trades||[];
 equityHistory=d.equityHistory||[];
 idx=d.idx||0;
}

function log(m){const e=document.getElementById('status');if(e)e.innerText=m;}

async function loadCSV(){
 const r=await fetch('tr_isin_ticker.csv');
 const t=await r.text();
 const rows=t.trim().split('\n');
 const h=rows[0].toLowerCase().split(/[,;]/);
 const ti=h.indexOf('ticker');
 const na=h.indexOf('name');
 dataList=rows.slice(1).map(r=>{
  const c=r.split(/[,;]/);
  return {ticker:c[ti],name:c[na]};
 });
}

async function getPrice(t){
 if(cache[t]) return cache[t];
 const url='https://corsproxy.io/?'+encodeURIComponent(
 'https://query1.finance.yahoo.com/v8/finance/chart/'+t+'?range=1y&interval=1d'
 );
 const r=await fetch(url); const d=await r.json();
 const q=d.chart.result[0];
 const c=q.timestamp.map((x,i)=>({time:x,close:q.indicators.quote[0].close[i]}));
 cache[t]=c;
 return c;
}

function lastPrice(t){const c=cache[t];return c?c[c.length-1].close:0;}

function equity(){
 let a=0;
 for(let p of positions){
  a+=p.qty*lastPrice(p.ticker);
 }
 return cash+a;
}

function updateEquity(){
 equityHistory.push({time:Date.now(),value:equity()});
 save();
}

function buy(){
 const s=dataList[idx]; if(!s) return;
 const p=lastPrice(s.ticker);
 const q=parseFloat(prompt('Qty',1));
 if(!q) return;
 const cost=q*p;
 if(cost>cash) return log('NO CASH');
 cash-=cost;
 let pos=positions.find(x=>x.ticker===s.ticker);
 if(pos){pos.qty+=q; pos.avg=(pos.avg+p)/2;}
 else positions.push({ticker:s.ticker,name:s.name,qty:q,avg:p});
 updateEquity(); save(); render();
}

function sell(){
 const s=dataList[idx];
 let pos=positions.find(x=>x.ticker===s.ticker);
 if(!pos) return;
 const p=lastPrice(s.ticker);
 const q=parseFloat(prompt('Qty',pos.qty));
 if(!q) return;
 cash+=q*p;
 pos.qty-=q;
 trades.push({ticker:s.ticker,pl:(p-pos.avg)*q});
 if(pos.qty<=0) positions=positions.filter(x=>x!==pos);
 updateEquity(); save(); render();
}

function render(){
 const el=document.getElementById('portfolio');
 if(!el) return;
 let html='<h3>PORTFOLIO</h3>';
 for(let p of positions){
  const v=p.qty*lastPrice(p.ticker);
  html+=`${p.ticker} qty:${p.qty} value:${v.toFixed(2)}<br>`;
 }
 html+=`<hr>CASH:${cash.toFixed(2)}<br>TOTAL:${equity().toFixed(2)}`;
 el.innerHTML=html;
}

function nav(d){idx=(idx+d+dataList.length)%dataList.length; loadAsset();}

async function loadAsset(){
 const s=dataList[idx]; if(!s) return;
 document.getElementById('assetName').innerText=s.name;
 document.getElementById('ticker').innerText=s.ticker;
 await getPrice(s.ticker);
 render();
}

window.buy=buy;
window.sell=sell;
window.nav=nav;

window.onload=async()=>{
 load();
 await loadCSV();
 await loadAsset();
};
