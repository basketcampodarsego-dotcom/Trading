/* =====================================================
   report.js  –  analisi portafoglio
   ===================================================== */

async function loadReport(){
  const portfolio = JSON.parse(localStorage.getItem('portfolio') || '[]');

  const loadEl = document.getElementById('report-loading');
  const body   = document.getElementById('report-body');

  if(!portfolio.length){
    loadEl.textContent = 'Nessuna posizione in portafoglio. Aggiungile dalla pagina Portafoglio.';
    return;
  }

  loadEl.textContent = 'CARICAMENTO PREZZI…';

  // Fetch prezzi correnti per tutte le posizioni
  const priceResults = await Promise.allSettled(
    portfolio.map(p=>getCurrentPrice(p.ticker))
  );

  const rows = portfolio.map((p,i)=>{
    const current = priceResults[i].status==='fulfilled' ? priceResults[i].value : null;
    const cost    = p.price * p.qty;
    const value   = current!=null ? current * p.qty : cost; // fallback a costo
    const pl      = value - cost;
    const plpct   = cost ? pl/cost : 0;
    return { ticker:p.ticker, qty:p.qty, buyPrice:p.price, current, cost, value, pl, plpct };
  });

  const totValue = rows.reduce((a,r)=>a+r.value, 0);
  const totCost  = rows.reduce((a,r)=>a+r.cost,  0);
  const totPL    = totValue - totCost;
  const totPLpct = totCost ? totPL/totCost : 0;

  // Segnali
  const signalResults = await Promise.allSettled(
    portfolio.map(async p=>{
      const data = await getClose(p.ticker, '6mo');
      if(data.length<50) return 'N/A';
      const e10 = calcEMA(data,10);
      const e50 = calcEMA(data,50);
      if(!e10||!e50) return 'N/A';
      return e10>e50 ? 'BUY' : 'SELL';
    })
  );

  const signals = signalResults.map(r=>r.status==='fulfilled'?r.value:'N/A');

  const buyCount  = signals.filter(s=>s==='BUY').length;
  const sellCount = signals.filter(s=>s==='SELL').length;

  // Drawdown sul portafoglio: usiamo storico 1y del primo titolo come proxy
  let ddVal = null;
  try{
    const hist = await getClose(portfolio[0].ticker, '1y');
    ddVal = maxDrawdown(hist.map(x=>x.close));
  }catch{}

  // KPI
  document.getElementById('r-total').textContent = '€ '+fmtNum(totValue,2);
  document.getElementById('r-pl').textContent    = (totPL>=0?'+':'')+fmtNum(totPL,2);
  document.getElementById('r-plpct').textContent = (totPLpct>=0?'+':'')+fmtPct(totPLpct);
  document.getElementById('r-dd').textContent    = ddVal!=null ? '-'+fmtPct(ddVal) : '–';
  document.getElementById('r-buy').textContent   = buyCount;
  document.getElementById('r-sell').textContent  = sellCount;

  document.getElementById('r-pl').className    = 's-val '+(totPL>=0?'td-pos':'td-neg');
  document.getElementById('r-plpct').className = 's-val '+(totPLpct>=0?'td-pos':'td-neg');

  // Tabella allocazione
  const allocEl = document.getElementById('alloc-table');
  const rowsSorted = [...rows].sort((a,b)=>b.value-a.value);
  allocEl.innerHTML = `
    <table>
      <thead><tr>
        <th>Ticker</th><th>Valore €</th><th>Peso %</th>
      </tr></thead>
      <tbody>
        ${rowsSorted.map(r=>{
          const w = totValue ? r.value/totValue : 0;
          const bar = `<div style="height:3px;background:var(--accent);width:${(w*100).toFixed(1)}%;margin-top:4px;border-radius:1px;opacity:0.7"></div>`;
          return `<tr>
            <td class="td-link" onclick="(()=>{localStorage.setItem('selectedTicker','${r.ticker}');location.href='index.html'})()">
              ${r.ticker}</td>
            <td>${fmtNum(r.value,2)}</td>
            <td>${fmtPct(w)}${bar}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Tabella performance
  const perfEl = document.getElementById('perf-table');
  const rowsPerf = [...rows].sort((a,b)=>b.plpct-a.plpct);
  perfEl.innerHTML = `
    <table>
      <thead><tr>
        <th>Ticker</th><th>P/L €</th><th>P/L %</th><th>Segnale</th>
      </tr></thead>
      <tbody>
        ${rowsPerf.map((r,i)=>{
          const sig = signals[portfolio.findIndex(p=>p.ticker===r.ticker)] || 'N/A';
          const sigMap = {'BUY':'badge badge-buy','SELL':'badge badge-sell-forte','N/A':'badge badge-na'};
          return `<tr>
            <td>${r.ticker}</td>
            <td class="${r.pl>=0?'td-pos':'td-neg'}">${(r.pl>=0?'+':'')}${fmtNum(r.pl,2)}</td>
            <td class="${r.plpct>=0?'td-pos':'td-neg'}">${(r.plpct>=0?'+':'')}${fmtPct(r.plpct)}</td>
            <td><span class="${sigMap[sig]||'badge badge-na'}">${sig}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Equity chart: valore giornaliero aggregato portafoglio (storico 6mo)
  // Scarica storico per ogni posizione e somma
  loadEl.textContent = 'CALCOLO EQUITY…';

  try{
    const histories = await Promise.allSettled(
      portfolio.map(p=>getClose(p.ticker,'6mo'))
    );

    // Allinea le date
    const dateMap = {};
    portfolio.forEach((p,i)=>{
      if(histories[i].status!=='fulfilled') return;
      const hist = histories[i].value;
      hist.forEach(x=>{
        if(!dateMap[x.time]) dateMap[x.time]=0;
        const shares = p.qty; // quantità fissa
        dateMap[x.time] += shares * x.close;
      });
    });

    const equityData = Object.keys(dateMap)
      .sort((a,b)=>a-b)
      .map(t=>({time:parseInt(t), value:dateMap[t]}));

    if(equityData.length > 2){
      const ddChart = LightweightCharts.createChart(
        document.getElementById('drawdown-chart'),
        {
          layout: {background:{color:'#070b0f'}, textColor:'#4a6070'},
          grid:   {vertLines:{color:'#0d1117'}, horzLines:{color:'#0d1117'}},
          rightPriceScale:{borderColor:'#1e2a38'},
          timeScale:{borderColor:'#1e2a38', timeVisible:true},
          height: 180,
        }
      );
      const eqSeries = ddChart.addAreaSeries({
        lineColor:'#00e5ff',
        topColor:'rgba(0,229,255,0.15)',
        bottomColor:'rgba(0,229,255,0.0)',
        lineWidth:2, priceLineVisible:false
      });
      eqSeries.setData(equityData);
      ddChart.timeScale().fitContent();
    }
  }catch(e){
    document.getElementById('drawdown-chart').textContent = 'Storico non disponibile';
  }

  loadEl.style.display = 'none';
  body.style.display   = 'block';
}

window.onload = loadReport;
