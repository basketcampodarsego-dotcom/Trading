/* =====================================================
   backtest.js  –  simulazione strategie
   ===================================================== */

let btChart       = null;
let btCandleChart = null;
let btDataList = [];   // titoli del file CSV attualmente selezionato (come dataList in app.js)
let btIdx      = 0;    // indice corrente nel file, per navigazione PREC/SUCC

// ── INIT ─────────────────────────────────────────────
(async ()=>{
  await populateBtCsvSelect();

  const input   = document.getElementById('bt_ticker');
  const dd      = document.getElementById('bt_ticker_dd');
  const infoEl  = document.getElementById('bt_selected_info');

  attachSearchDropdown(
    input, dd,
    ()=> btDataList,
    item => selectBtTitolo(item, true)
  );

  input.addEventListener('input', ()=>{
    infoEl.textContent   = '';
    input.dataset.ticker = '';
  });

  // Come la dashboard: al primo caricamento seleziona ed esegue subito sul primo titolo del file
  if(btDataList.length) selectBtTitolo(btDataList[0], true);
})();

// ── FILES.JSON → SELECT (identico a populateCsvSelect in app.js) ──
async function populateBtCsvSelect(){
  const sel = document.getElementById('bt_csvSelect');
  sel.innerHTML = '';
  try{
    const res   = await fetch('./files.json');
    const files = await res.json();
    files.forEach(f=>{
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f.replace('.csv','');
      sel.appendChild(opt);
    });
  }catch{
    toast('⚠ files.json non trovato – uso Titoli.csv');
    const opt = document.createElement('option');
    opt.value = 'Titoli.csv'; opt.textContent = 'Titoli';
    sel.appendChild(opt);
  }
  // Per definizione, la prima lista caricata è sempre Titoli.csv (se presente)
  if([...sel.options].some(o=>o.value==='Titoli.csv')){
    sel.value = 'Titoli.csv';
  }
  await loadBtCurrentCsv();
}

async function loadBtCurrentCsv(){
  const csv = document.getElementById('bt_csvSelect').value;
  try{
    btDataList = await loadCSV(csv);
  }catch(e){
    toast('⚠ ' + e.message);
    btDataList = [];
  }
  btIdx = 0;
}

async function onBtCsvChange(){
  await loadBtCurrentCsv();
  if(btDataList.length) selectBtTitolo(btDataList[0], true);
}

// ── SELEZIONE TITOLO (da dropdown, da nav, o al caricamento) ──
function selectBtTitolo(item, autoRun){
  const input  = document.getElementById('bt_ticker');
  const infoEl = document.getElementById('bt_selected_info');
  input.value          = item.ticker || item.isin || '';
  input.dataset.ticker = item.ticker || '';
  const parts = [item.ticker, item.name, item.isin].filter(Boolean);
  infoEl.textContent   = parts.join('  ·  ');
  const i = btDataList.indexOf(item);
  if(i>=0) btIdx = i;
  if(autoRun) runBacktest();
}

// ── NAV PREC/SUCC sul file selezionato (stesse modalità della dashboard) ──
function btNav(d){
  if(!btDataList.length) return;
  btIdx = (btIdx + d + btDataList.length) % btDataList.length;
  selectBtTitolo(btDataList[btIdx], true);
}

async function runBacktest(){
  const input    = document.getElementById('bt_ticker');
  let   ticker   = (input.dataset.ticker || input.value).toUpperCase().trim();
  const range    = document.getElementById('bt_range').value;
  const strategy = document.getElementById('bt_strategy').value;
  const capital  = parseFloat(document.getElementById('bt_capital').value) || 10000;
  const feePct   = parseFloat(document.getElementById('bt_fee').value) / 100 || 0.001;

  if(!ticker){ toast('⚠ Inserisci un ticker'); return; }

  // Risolvi ISIN se necessario
  if(ticker.length===12 && !ticker.includes('-') && !ticker.includes('.')){
    toast('Ricerca ticker per ISIN…');
    const resolved = await resolveTickerFromISIN(ticker);
    if(resolved) ticker = resolved;
    else { toast('⚠ Ticker non trovato per ISIN '+ticker); return; }
  }

  const result = document.getElementById('bt-result');
  result.innerHTML = '<div class="loading" style="padding:40px">SCARICAMENTO DATI</div>';

  let ohlc;
  try{
    ohlc = await getOHLC(ticker, range);
  }catch(e){
    result.innerHTML = `<div class="loading" style="padding:40px;color:var(--red)">⚠ ${e.message}</div>`;
    return;
  }

  if(ohlc.length < 60){
    result.innerHTML = '<div class="loading" style="padding:40px;color:var(--red)">⚠ Dati insufficienti</div>';
    return;
  }

  const data = ohlc.map(x=>({time:x.time, close:x.close}));

  // ── STRATEGIA ────────────────────────────────────
  let trades = [];

  if(strategy === 'sp2'){
    trades = strategySP2(ohlc, capital, feePct);
  } else if(strategy === 'ema'){
    trades = strategyEMA(data, capital, feePct);
  } else {
    trades = strategyRSI(data, capital, feePct);
  }

  // ── BUY & HOLD ───────────────────────────────────
  const bhReturn = (data[data.length-1].close - data[0].close) / data[0].close;
  const bhFinal  = capital * (1 + bhReturn);

  // ── STATISTICHE ──────────────────────────────────
  const equity   = trades.equity;
  const tradeLog = trades.log;

  const finalVal = equity[equity.length-1].value;
  const totalRet = (finalVal - capital) / capital;

  const closes   = equity.map(x=>x.value);
  const maxDD    = maxDrawdown(closes);

  // Sharpe semplificato (daily returns)
  const dailyR = [];
  for(let i=1;i<closes.length;i++){
    dailyR.push((closes[i]-closes[i-1])/closes[i-1]);
  }
  const meanR = dailyR.reduce((a,b)=>a+b,0)/dailyR.length;
  const stdR  = Math.sqrt(dailyR.map(r=>(r-meanR)**2).reduce((a,b)=>a+b,0)/dailyR.length);
  const sharpe = stdR>0 ? (meanR/stdR)*Math.sqrt(252) : 0;

  const winTrades  = tradeLog.filter(t=>t.pl>0).length;
  const lossTrades = tradeLog.filter(t=>t.pl<=0).length;
  const winRate    = tradeLog.length ? winTrades/tradeLog.length : 0;

  const avgWin  = winTrades  ? tradeLog.filter(t=>t.pl>0).reduce((a,t)=>a+t.pl,0)/winTrades   : 0;
  const avgLoss = lossTrades ? tradeLog.filter(t=>t.pl<=0).reduce((a,t)=>a+t.pl,0)/lossTrades : 0;

  // ── HTML ─────────────────────────────────────────
  result.innerHTML = `
    <div class="bt-stat-grid">
      <div class="bt-stat"><div class="s-label">RENDIMENTO STRATEGIA</div>
        <div class="s-val ${totalRet>=0?'td-pos':'td-neg'}">${(totalRet>=0?'+':'')}${fmtPct(totalRet)}</div></div>
      <div class="bt-stat"><div class="s-label">RENDIMENTO B&H</div>
        <div class="s-val ${bhReturn>=0?'td-pos':'td-neg'}">${(bhReturn>=0?'+':'')}${fmtPct(bhReturn)}</div></div>
      <div class="bt-stat"><div class="s-label">VALORE FINALE</div>
        <div class="s-val">€ ${fmtNum(finalVal,2)}</div></div>
      <div class="bt-stat"><div class="s-label">MAX DRAWDOWN</div>
        <div class="s-val td-neg">-${fmtPct(maxDD)}</div></div>
      <div class="bt-stat"><div class="s-label">SHARPE RATIO</div>
        <div class="s-val">${fmtNum(sharpe,2)}</div></div>
      <div class="bt-stat"><div class="s-label">N° TRADE</div>
        <div class="s-val">${tradeLog.length}</div></div>
      <div class="bt-stat"><div class="s-label">WIN RATE</div>
        <div class="s-val ${winRate>=0.5?'td-pos':'td-neg'}">${fmtPct(winRate)}</div></div>
      <div class="bt-stat"><div class="s-label">AVG WIN / LOSS</div>
        <div class="s-val">${fmtNum(avgWin,2)} / ${fmtNum(avgLoss,2)}</div></div>
    </div>

    <div id="bt-candle-chart"></div>
    <div id="bt-chart"></div>

    <div style="padding:0 14px 14px">
      <div class="page-title" style="margin-bottom:10px">▸ TRADE LOG</div>
      <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>#</th><th>DATA ENTRATA</th><th>DATA USCITA</th>
          <th>PREZZO ENT.</th><th>PREZZO USC.</th><th>P/L €</th><th>P/L %</th><th>USCITA</th>
        </tr></thead>
        <tbody>
          ${tradeLog.map((t,i)=>`
          <tr>
            <td class="td-neu">${i+1}</td>
            <td>${new Date(t.entryTime*1000).toLocaleDateString('it-IT')}</td>
            <td>${t.exitTime ? new Date(t.exitTime*1000).toLocaleDateString('it-IT') : '–'}</td>
            <td>${fmtNum(t.entryPrice,3)}</td>
            <td>${t.exitPrice ? fmtNum(t.exitPrice,3) : '–'}</td>
            <td class="${t.pl>=0?'td-pos':'td-neg'}">${t.pl!=null?(t.pl>=0?'+':'')+fmtNum(t.pl,2):'aperto'}</td>
            <td class="${t.plpct>=0?'td-pos':'td-neg'}">${t.plpct!=null?(t.plpct>=0?'+':'')+fmtPct(t.plpct):'–'}</td>
            <td class="td-neu" style="font-size:10px">${t.exitReason||'–'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;

  // ── CANDLE CHART ─────────────────────────────────
  if(btCandleChart){ btCandleChart.remove(); btCandleChart=null; }

  btCandleChart = LightweightCharts.createChart(
    document.getElementById('bt-candle-chart'),
    {
      layout: { background:{color:'#070b0f'}, textColor:'#4a6070' },
      grid:   { vertLines:{color:'#0d1117'}, horzLines:{color:'#0d1117'} },
      rightPriceScale: { borderColor:'#1e2a38' },
      timeScale: { borderColor:'#1e2a38', timeVisible:true },
      height: 280,
    }
  );

  const candleSeries = btCandleChart.addCandlestickSeries({
    upColor:'#00ff88', downColor:'#ff3355',
    borderUpColor:'#00ff88', borderDownColor:'#ff3355',
    wickUpColor:'#00ff88', wickDownColor:'#ff3355',
  });
  candleSeries.setData(ohlc.map(x=>({time:x.time, open:x.open, high:x.high, low:x.low, close:x.close})));

  // Marker BUY/SELL sui trade
  const markers = [];
  for(const t of tradeLog){
    markers.push({time:t.entryTime, position:'belowBar', color:'#00ff88', shape:'arrowUp',   text:'BUY',  size:1});
    if(t.exitTime) markers.push({time:t.exitTime, position:'aboveBar', color:'#ff3355', shape:'arrowDown', text:'SELL', size:1});
  }
  candleSeries.setMarkers(markers);
  btCandleChart.timeScale().fitContent();

  // ── EQUITY CHART ─────────────────────────────────
  if(btChart){ btChart.remove(); btChart=null; }

  btChart = LightweightCharts.createChart(
    document.getElementById('bt-chart'),
    {
      layout: { background:{color:'#070b0f'}, textColor:'#4a6070' },
      grid:   { vertLines:{color:'#0d1117'}, horzLines:{color:'#0d1117'} },
      rightPriceScale: { borderColor:'#1e2a38' },
      timeScale: { borderColor:'#1e2a38', timeVisible:true },
      height: 240,
    }
  );

  const eqSeries = btChart.addLineSeries({ color:'#00e5ff', lineWidth:2, priceLineVisible:false });
  const bhSeries = btChart.addLineSeries({ color:'#4a6070', lineWidth:1, priceLineVisible:false, lineStyle:2 });

  eqSeries.setData(equity.map(x=>({time:x.time, value:x.value})));

  // B&H equity
  const bhData = data.map(x=>({
    time: x.time,
    value: capital * x.close / data[0].close
  }));
  bhSeries.setData(bhData);

  btChart.timeScale().fitContent();
}

// ── STRATEGIA EMA CROSSOVER ──────────────────────────
function strategyEMA(data, capital, feePct){
  const closes = data.map(x=>x.close);
  const e10arr  = emaArr(closes,10);
  const e50arr  = emaArr(closes,50);

  let equity   = [{time:data[0].time, value:capital}];
  let log      = [];
  let inTrade  = false;
  let entry    = null;
  let shares   = 0;
  let cash     = capital;

  for(let i=51; i<data.length; i++){
    const e10  = e10arr[i];
    const e10p = e10arr[i-1];
    const e50  = e50arr[i];
    const e50p = e50arr[i-1];
    const price= data[i].close;

    if(!inTrade && e10p<=e50p && e10>e50){
      // BUY signal
      const cost = cash * (1 - feePct);
      shares = cost / price;
      cash = 0;
      inTrade = true;
      entry = {time:data[i].time, price, shares};
    } else if(inTrade && e10p>=e50p && e10<e50){
      // SELL signal
      const value = shares * price * (1 - feePct);
      const pl    = value - entry.price * entry.shares;
      const plpct = pl / (entry.price * entry.shares);
      log.push({
        entryTime:entry.time, exitTime:data[i].time,
        entryPrice:entry.price, exitPrice:price,
        pl, plpct
      });
      cash = value;
      shares = 0;
      inTrade = false;
      entry = null;
    }

    const portfolioVal = inTrade ? shares * price : cash;
    equity.push({time:data[i].time, value:portfolioVal});
  }

  // Posizione aperta a fine periodo
  if(inTrade){
    const lastPrice = data[data.length-1].close;
    const value = shares * lastPrice;
    const pl = value - entry.price * entry.shares;
    log.push({
      entryTime:entry.time, exitTime:null,
      entryPrice:entry.price, exitPrice:null,
      pl, plpct:pl/(entry.price*entry.shares)
    });
  }

  return {equity, log};
}

// ── STRATEGIA SP2 — Score v3.1.1 + Anti-Coltello + Trailing ATR ──────
//
// Porting da PAC_v4 (celle 6/6b):
//   BUY  : score > 50 AND anti_coltello > 0 (non sotto EMA200)
//   SELL : anti_coltello == 0 (sotto EMA200)
//          OPPURE trailing stop: calo > ATR×2.5 dal picco
//
// score_v311 = YTD×0.30 + 1Y×0.40 + 2Y×0.30  (normalizzato 0-100)
// anti_coltello usa EMA10/20/40 weekly (≡ EMA50/100/200 daily)
//
function sp2Score(closes, times, i){
  if(i < 52) return null;
  const p0  = closes[i];
  const now = new Date(times[i] * 1000);
  const jan1Ts = new Date(now.getFullYear(), 0, 1).getTime() / 1000;
  const weeksIntoYear = Math.round((times[i] - jan1Ts) / (7*86400));

  function priceAt(wb){ const idx = i - wb; return idx >= 0 ? closes[idx] : null; }
  const pJan = priceAt(weeksIntoYear) ?? priceAt(52);
  const p1y  = priceAt(52);
  const p2y  = priceAt(104) ?? p1y;
  if(!pJan || !p1y || p0 <= 0) return null;

  const ytd = (p0/pJan - 1)*100;
  const r1  = (p0/p1y  - 1)*100;
  const r2  = (p0/p2y  - 1)*100;
  const norm = x => Math.max(0, Math.min(100, (x + 60) / 180 * 100));
  const ny = norm(ytd), n1 = norm(r1), n2 = norm(r2);

  let wYtd = 0.30, wR1 = 0.40, wR2 = 0.30;
  if(weeksIntoYear < 8){ wYtd = 0.00; wR1 = 0.60; wR2 = 0.40; }

  let base = ny*wYtd + n1*wR1 + n2*wR2;
  if(ytd < -15 && r1 < -10) base *= 0.70;

  const dispersion  = Math.max(ny,n1,n2) - Math.min(ny,n1,n2);
  const persistence = Math.max(0.70, 1.0 - dispersion/200.0);
  base *= persistence;

  if(ytd > 300)                   base = Math.min(base, 50);
  else if(ytd > 150 && base >= 90) base *= 0.50;
  else if(ytd > 80  && base >= 90) base *= 0.70;
  if(r1 > 200) base = Math.min(base, 55);
  if(r2 > 300) base = Math.min(base, 55);

  if(i >= 8){
    const win = closes.slice(i-8, i+1);
    const rets = win.slice(1).map((v,j) => Math.abs(v/win[j]-1));
    const std  = Math.sqrt(rets.reduce((s,r) => s + r*r, 0) / rets.length);
    if(std > 0.15)      base *= 0.50;
    else if(std > 0.08) base *= 0.75;
  }
  return Math.round(base * 10) / 10;
}

function sp2AntiColtello(closes, i){
  if(i < 40) return 1.0;
  const slice  = closes.slice(0, i+1);
  const e10arr = emaArr(slice, 10);
  const e20arr = emaArr(slice, 20);
  const e40arr = emaArr(slice, 40);
  const e10 = e10arr[e10arr.length-1];
  const e20 = e20arr[e20arr.length-1];
  const e40 = e40arr[e40arr.length-1];
  const p   = closes[i];
  if(!e10 || !e20 || !e40) return 1.0;
  if(p < e40)             return 0.0;
  if(p < e10 && p < e20)  return 0.5;
  if(p < e10 || p < e20)  return 0.75;
  return 1.0;
}

function sp2ATR(ohlc, i, period=14){
  if(i < period) return ohlc[i].close * 0.03;
  let sum = 0;
  for(let j = i - period + 1; j <= i; j++){
    const prev = j > 0 ? ohlc[j-1].close : ohlc[j].open;
    const tr = Math.max(
      ohlc[j].high - ohlc[j].low,
      Math.abs(ohlc[j].high - prev),
      Math.abs(ohlc[j].low  - prev)
    );
    sum += tr;
  }
  return sum / period;
}

function strategySP2(ohlc, capital, feePct){
  const closes = ohlc.map(x => x.close);
  const times  = ohlc.map(x => x.time);
  const SP2_BUY_THRESHOLD = 50;
  const ATR_MULT_TRAIL    = 2.5;

  const equity  = [{time: ohlc[0].time, value: capital}];
  const log     = [];
  let inTrade   = false;
  let entry     = null;
  let shares    = 0;
  let cash      = capital;
  let peak      = 0;

  for(let i = 104; i < ohlc.length; i++){
    const price = closes[i];
    const score = sp2Score(closes, times, i);
    const ac    = sp2AntiColtello(closes, i);
    const atr   = sp2ATR(ohlc, i);

    if(!inTrade){
      if(score !== null && score >= SP2_BUY_THRESHOLD && ac > 0){
        const cost = cash * (1 - feePct);
        shares  = cost / price;
        cash    = 0;
        inTrade = true;
        peak    = price;
        entry   = {time: times[i], price, shares};
      }
    } else {
      if(price > peak) peak = price;
      const trailStop = peak - atr * ATR_MULT_TRAIL;
      const sellAC    = ac === 0;
      const sellTrail = price <= trailStop && peak > entry.price * 1.01;

      if(sellAC || sellTrail){
        const value = shares * price * (1 - feePct);
        const pl    = value - entry.price * entry.shares;
        const plpct = pl / (entry.price * entry.shares);
        log.push({
          entryTime: entry.time,  exitTime: times[i],
          entryPrice: entry.price, exitPrice: price,
          pl, plpct,
          exitReason: sellAC ? 'EMA200' : 'Trailing'
        });
        cash = value; shares = 0; inTrade = false; entry = null; peak = 0;
      }
    }
    const portfolioVal = inTrade ? shares * price : cash;
    equity.push({time: times[i], value: portfolioVal});
  }

  if(inTrade){
    const lastPrice = closes[closes.length-1];
    const value = shares * lastPrice;
    const pl = value - entry.price * entry.shares;
    log.push({
      entryTime: entry.time, exitTime: null,
      entryPrice: entry.price, exitPrice: null,
      pl, plpct: pl/(entry.price*entry.shares),
      exitReason: 'aperto'
    });
  }
  return {equity, log};
}
// ── STRATEGIA RSI MEAN-REVERSION ─────────────────────
function strategyRSI(data, capital, feePct){
  const equity  = [{time:data[0].time, value:capital}];
  const log     = [];
  let inTrade   = false;
  let entry     = null;
  let shares    = 0;
  let cash      = capital;

  for(let i=20; i<data.length; i++){
    const slice = data.slice(Math.max(0,i-30), i+1);
    const rsi   = calcRSI(slice);
    const price = data[i].close;

    if(!inTrade && rsi!=null && rsi<30){
      // BUY: ipervenduto
      const cost = cash * (1 - feePct);
      shares = cost / price;
      cash = 0;
      inTrade = true;
      entry = {time:data[i].time, price, shares};
    } else if(inTrade && rsi!=null && rsi>65){
      // SELL: ritorno alla media
      const value = shares * price * (1 - feePct);
      const pl    = value - entry.price * entry.shares;
      const plpct = pl / (entry.price * entry.shares);
      log.push({
        entryTime:entry.time, exitTime:data[i].time,
        entryPrice:entry.price, exitPrice:price,
        pl, plpct
      });
      cash = value;
      shares = 0;
      inTrade = false;
      entry = null;
    }

    const portfolioVal = inTrade ? shares * price : cash;
    equity.push({time:data[i].time, value:portfolioVal});
  }

  if(inTrade){
    const lastPrice = data[data.length-1].close;
    const value = shares * lastPrice;
    const pl = value - entry.price * entry.shares;
    log.push({
      entryTime:entry.time, exitTime:null,
      entryPrice:entry.price, exitPrice:null,
      pl, plpct:pl/(entry.price*entry.shares)
    });
  }

  return {equity, log};
}
