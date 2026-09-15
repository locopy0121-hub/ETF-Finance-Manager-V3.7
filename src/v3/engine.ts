import { Holding } from '../data/portfolio';
import { DividendEvent } from '../screens/DividendCalendarScreen';
import { LedgerEntry, type MoneyPreferences } from './model';

type QuoteLike={price?:number;change?:number;changePercent?:number;previousClose?:number;open?:number;high?:number;low?:number;volume?:number;nav?:number;quoteDate?:string;quoteTime?:string};

let DISPLAY_MONEY:MoneyPreferences|undefined;
export function configureDisplayPreferences(moneyPrefs?:MoneyPreferences){DISPLAY_MONEY=moneyPrefs;}
const digitsFor=(mode:'smart'|'fixed'|'custom'|undefined,standard:number,custom:number|undefined)=>Math.max(0,Math.min(12,Math.round(mode==='custom'?(custom??standard):standard)));
export function money(n:number){const v=Number.isFinite(n)?n:0;const cfg=DISPLAY_MONEY;const mode=cfg?.moneyMode??'smart';const d=digitsFor(mode,cfg?.moneyDigits??2,cfg?.customMoneyDigits);return v.toLocaleString('zh-TW',{minimumFractionDigits:mode==='smart'?0:d,maximumFractionDigits:d});}
export function pct(n:number){const v=Number.isFinite(n)?n:0;const cfg=DISPLAY_MONEY;const mode=cfg?.percentMode??'smart';const d=digitsFor(mode,cfg?.percentDigits??2,cfg?.customPercentDigits);return `${v>=0?'+':''}${v.toLocaleString('zh-TW',{minimumFractionDigits:mode==='smart'?0:d,maximumFractionDigits:d})}%`;}
export function num2(n:number){return Number.isFinite(n)?n.toFixed(2):'0.00';}
export function isIsoDate(v?:string){return !!v&&/^\d{4}-\d{2}-\d{2}$/.test(v);}

export function quotePrice(h:Holding,quotes:Record<string,QuoteLike>){return Number(quotes[h.symbol]?.price??h.fallbackPrice??h.tradeAvgPrice??h.avgCost??0);}
export function lastBuyDate(h:Holding){const rows=(h.purchaseRecords??[]).map(x=>x.date).filter(isIsoDate).sort();return rows.length?rows[rows.length-1]:'—';}

export function sharesOnDate(symbol:string,date:string,ledger:LedgerEntry[],fallbackCurrent=0){
 if(!isIsoDate(date))return fallbackCurrent;
 const symbolTrades=ledger.filter(x=>x.symbol===symbol&&(x.kind==='buy'||x.kind==='sell')&&isIsoDate(x.date));
 if(!symbolTrades.length)return fallbackCurrent;
 const rows=symbolTrades.filter(x=>x.date<=date);
 if(!rows.length)return 0;
 const buys=rows.filter(x=>x.kind==='buy').reduce((sum,x)=>sum+Number(x.shares??0),0);
 const sells=rows.filter(x=>x.kind==='sell').reduce((sum,x)=>sum+Number(x.shares??0),0);
 return Math.max(0,buys-sells);
}

export function dividendTotals(ledger:LedgerEntry[],dividends:DividendEvent[],symbol?:string){
 const paidEvents=dividends.filter(e=>(!symbol||e.symbol===symbol)&&Number(e.actualAmount??0)>0);
 const eventIds=new Set(paidEvents.map(e=>e.id));
 const eventTotal=paidEvents.reduce((s,e)=>s+Number(e.actualAmount??0),0);
 const unlinkedLedger=ledger.filter(x=>x.kind==='dividend'&&(!symbol||x.symbol===symbol)&&(!x.dividendEventId||!eventIds.has(x.dividendEventId))).reduce((s,x)=>s+Number(x.amount??0),0);
 return eventTotal+unlinkedLedger;
}

export type PositionCostStats={
 symbol:string;
 buyShares:number;
 soldShares:number;
 currentShares:number;
 historicalTradeCost:number;
 historicalBuyFees:number;
 historicalCashOutflow:number;
 avgTradePrice:number;
 avgBuyFeePerShare:number;
 currentTradeCost:number;
 currentAllocatedBuyFees:number;
 currentCashBasis:number;
 soldTradeCost:number;
 soldAllocatedBuyFees:number;
 grossSellProceeds:number;
 sellFees:number;
 sellTaxes:number;
 netSellProceeds:number;
 realizedPricePnl:number;
 realizedCashPnl:number;
};

/**
 * Canonical accounting contract
 * - 成交金額 = floor(股數 × 成交價)，永遠不混入費用。
 * - 買進現金支出 = 成交金額 + 買進手續費。
 * - 賣出現金流入 = 成交金額 - 賣出手續費 - 交易稅。
 * - 目前市值 = 即時行情 × 目前持有股數。
 * - 部分賣出採移動平均成本法；賣出只等比例釋放成本池，剩餘平均成本不改變。
 */
export function positionCostStats(h:Holding,ledger:LedgerEntry[]):PositionCostStats{
 const trades=ledger
  .map((e,i)=>({e,i}))
  .filter(x=>x.e.symbol===h.symbol&&(x.e.kind==='buy'||x.e.kind==='sell'))
  .sort((a,b)=>String(a.e.date??'').localeCompare(String(b.e.date??''))||a.i-b.i);
 let buyShares=0,historicalTradeCost=0,historicalBuyFees=0;
 let poolShares=0,poolTradeCost=0,poolBuyFees=0;
 let soldShares=0,soldTradeCost=0,soldAllocatedBuyFees=0;
 let grossSellProceeds=0,sellFees=0,sellTaxes=0,realizedPricePnl=0,realizedCashPnl=0;
 for(const {e} of trades){
  const shares=Math.max(0,Number(e.shares??0));
  if(!(shares>0))continue;
  if(e.kind==='buy'){
   const amount=Number.isFinite(Number(e.price))&&Number(e.price)>0?Math.floor(Number(e.price)*shares):Math.floor(Math.max(0,Number(e.amount??0)));
   const fee=Math.max(0,Number(e.fee??0));
   buyShares+=shares;historicalTradeCost+=amount;historicalBuyFees+=fee;
   poolShares+=shares;poolTradeCost+=amount;poolBuyFees+=fee;
  }else{
   const qty=Math.min(shares,poolShares);
   const avgTrade=poolShares>0?poolTradeCost/poolShares:0;
   const avgFee=poolShares>0?poolBuyFees/poolShares:0;
   const allocatedTrade=qty*avgTrade,allocatedFee=qty*avgFee;
   const proceeds=Number.isFinite(Number(e.price))&&Number(e.price)>0?Math.floor(Number(e.price)*shares):Math.floor(Math.max(0,Number(e.amount??0)));
   const fee=Math.max(0,Number(e.fee??0)),tax=Math.max(0,Number(e.tax??0));
   soldShares+=qty;soldTradeCost+=allocatedTrade;soldAllocatedBuyFees+=allocatedFee;
   grossSellProceeds+=proceeds;sellFees+=fee;sellTaxes+=tax;
   realizedPricePnl+=proceeds-allocatedTrade;
   realizedCashPnl+=(proceeds-fee-tax)-allocatedTrade-allocatedFee;
   poolShares-=qty;poolTradeCost-=allocatedTrade;poolBuyFees-=allocatedFee;
   if(poolShares<1e-9){poolShares=0;poolTradeCost=0;poolBuyFees=0}
  }
 }
 if(!trades.length){
  const records=h.purchaseRecords??[];
  if(records.length){
   for(const r of records){
    const sh=Math.max(0,Number(r.shares??0)); if(!(sh>0))continue;
    const amount=Math.floor(Math.max(0,Number(r.tradePrice??0))*sh);
    const fee=Math.max(0,Number(r.fee??0));
    buyShares+=sh;historicalTradeCost+=amount;historicalBuyFees+=fee;
   }
   poolShares=Math.max(0,Number(h.shares??buyShares));
   const ratio=buyShares>0?Math.min(1,poolShares/buyShares):0;
   poolTradeCost=historicalTradeCost*ratio;poolBuyFees=historicalBuyFees*ratio;
  }else{
   buyShares=Math.max(0,Number(h.shares??0));
   const avg=Number(h.tradeAvgPrice??h.avgCost??0);
   historicalTradeCost=Math.floor(Math.max(0,avg)*buyShares);
   historicalBuyFees=Math.max(0,Number(h.buyFee??0));
   poolShares=buyShares;poolTradeCost=historicalTradeCost;poolBuyFees=historicalBuyFees;
  }
 }
 const currentShares=Math.max(0,Number(h.shares??poolShares));
 if(Math.abs(currentShares-poolShares)>1e-6&&poolShares>0){
  const ratio=currentShares/poolShares;poolTradeCost*=ratio;poolBuyFees*=ratio;poolShares=currentShares;
 }
 const currentTradeCost=poolTradeCost;
 const currentAllocatedBuyFees=poolBuyFees;
 const currentCashBasis=currentTradeCost+currentAllocatedBuyFees;
 const avgTradePrice=currentShares>0?currentTradeCost/currentShares:(buyShares>0?historicalTradeCost/buyShares:0);
 const avgBuyFeePerShare=currentShares>0?currentAllocatedBuyFees/currentShares:(buyShares>0?historicalBuyFees/buyShares:0);
 const netSellProceeds=grossSellProceeds-sellFees-sellTaxes;
 return {symbol:h.symbol,buyShares,soldShares,currentShares,historicalTradeCost,historicalBuyFees,historicalCashOutflow:historicalTradeCost+historicalBuyFees,avgTradePrice,avgBuyFeePerShare,currentTradeCost,currentAllocatedBuyFees,currentCashBasis,soldTradeCost,soldAllocatedBuyFees,grossSellProceeds,sellFees,sellTaxes,netSellProceeds,realizedPricePnl,realizedCashPnl};
}

export function portfolioMetrics(holdings:Holding[],quotes:Record<string,QuoteLike>,cashBalance:number,ledger:LedgerEntry[],dividends:DividendEvent[]){
 let currentTradeCost=0,currentAllocatedBuyFees=0,currentCashBasis=0,marketValue=0,todayPnl=0,previousValue=0;
 let historicalTradeCost=0,historicalBuyFees=0,historicalCashOutflow=0,realizedPricePnl=0,realizedCashPnl=0;
 const holdingSymbols=new Set(holdings.map(h=>h.symbol));
 for(const h of holdings){
  const c=positionCostStats(h,ledger); const price=quotePrice(h,quotes); const value=price*h.shares; const prev=Number(quotes[h.symbol]?.previousClose??price);
  currentTradeCost+=c.currentTradeCost; currentAllocatedBuyFees+=c.currentAllocatedBuyFees; currentCashBasis+=c.currentCashBasis;
  historicalTradeCost+=c.historicalTradeCost; historicalBuyFees+=c.historicalBuyFees; historicalCashOutflow+=c.historicalCashOutflow;
  realizedPricePnl+=c.realizedPricePnl; realizedCashPnl+=c.realizedCashPnl;
  marketValue+=value; previousValue+=prev*h.shares; todayPnl+=(price-prev)*h.shares;
 }
 const historicalSymbols=[...new Set(ledger.filter(e=>e.symbol&&(e.kind==='buy'||e.kind==='sell')).map(e=>String(e.symbol)))].filter(sym=>!holdingSymbols.has(sym));
 for(const symbol of historicalSymbols){
  const fake:Holding={symbol,name:symbol,subtitle:'歷史部位',shares:0,avgCost:0,fallbackPrice:0,targetWeight:0,annualDividendPerShare:0,tag:'歷史'} as Holding;
  const c=positionCostStats(fake,ledger); historicalTradeCost+=c.historicalTradeCost; historicalBuyFees+=c.historicalBuyFees; historicalCashOutflow+=c.historicalCashOutflow; realizedPricePnl+=c.realizedPricePnl; realizedCashPnl+=c.realizedCashPnl;
 }
 const cumulativeDividends=dividendTotals(ledger,dividends);
 const priceUnrealizedPnl=marketValue-currentTradeCost;
 const cashUnrealizedPnl=marketValue-currentCashBasis;
 const pricePnl=priceUnrealizedPnl+realizedPricePnl;
 const comprehensivePnl=cashUnrealizedPnl+realizedCashPnl+cumulativeDividends;
 const totalPnl=comprehensivePnl;
 const totalRoi=historicalCashOutflow>0?totalPnl/historicalCashOutflow*100:0;
 const priceRoi=historicalTradeCost>0?(pricePnl+cumulativeDividends)/historicalTradeCost*100:0;
 const todayPnlPct=previousValue>0?todayPnl/previousValue*100:0;
 const pendingDividends=dividends.filter(e=>Number(e.actualAmount??0)<=0).reduce((s,e)=>s+Number(e.estimatedAmount??0),0);
 const totalAssets=marketValue+Math.max(0,Number(cashBalance)||0);
 const accountEquity=totalAssets;
 return {
  historicalTradeCost,historicalBuyFees,historicalCashOutflow,
  currentTradeCost,currentAllocatedBuyFees,currentCashBasis,
  marketValue,cashBalance,totalAssets,accountEquity,priceUnrealizedPnl,cashUnrealizedPnl,realizedPricePnl,realizedCashPnl,pricePnl,cumulativeDividends,totalPnl,totalRoi,priceRoi,todayPnl,todayPnlPct,pendingDividends,holdingCount:holdings.length,comprehensivePnl,
  totalInvestedCost:historicalCashOutflow,currentCost:currentCashBasis,pureCost:currentTradeCost,totalFees:historicalBuyFees,unrealizedPnl:cashUnrealizedPnl,realizedPnl:realizedCashPnl,
 };
}

export function holdingMetrics(h:Holding,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[]=[],dividends:DividendEvent[]=[]){
 const q=quotes[h.symbol]??{}; const price=quotePrice(h,quotes), c=positionCostStats(h,ledger), marketValue=price*h.shares;
 const pricePnl=marketValue-c.currentTradeCost;
 const cashPnl=marketValue-c.currentCashBasis;
 const priceRoi=c.currentTradeCost>0?pricePnl/c.currentTradeCost*100:0;
 const cashRoi=c.currentCashBasis>0?cashPnl/c.currentCashBasis*100:0;
 const pnl=cashPnl;
 const roi=cashRoi;
 const prev=Number(q.previousClose??price); const todayPnl=(price-prev)*h.shares; const prevValue=prev*h.shares; const todayPnlPct=prevValue>0?todayPnl/prevValue*100:0;
 const cumulativeDividend=dividendTotals(ledger,dividends,h.symbol);
 const comprehensivePnl=cashPnl+c.realizedCashPnl+cumulativeDividend;
 const comprehensiveRoi=c.historicalCashOutflow>0?comprehensivePnl/c.historicalCashOutflow*100:0;
 const costYield=c.currentCashBasis>0?cumulativeDividend/c.currentCashBasis*100:0;
 return {
  price,
  pureCost:c.currentTradeCost,
  totalFees:c.currentAllocatedBuyFees,
  totalCost:c.currentCashBasis,
  historicalTradeCost:c.historicalTradeCost,
  historicalBuyFees:c.historicalBuyFees,
  historicalCashOutflow:c.historicalCashOutflow,
  marketValue,pnl,pricePnl,cashPnl,roi,priceRoi,cashRoi,comprehensivePnl,comprehensiveRoi,
  avgCost:c.avgTradePrice,
  cashAvgCost:h.shares>0?c.currentCashBasis/h.shares:0,
  realizedPricePnl:c.realizedPricePnl,realizedCashPnl:c.realizedCashPnl,
  todayPnl,todayPnlPct,cumulativeDividend,costYield,
  previousClose:q.previousClose,open:q.open,high:q.high,low:q.low,volume:q.volume,nav:q.nav,quoteDate:q.quoteDate,quoteTime:q.quoteTime,
 };
}

export type SimulationMonth={month:number;year:number;label:string;monthlyContribution:number;invested:number;value:number;monthlyDividend:number;cumulativeDividend:number;monthlyPnl:number;totalPnl:number;roi:number};
export type SimulationYear={year:number;label:string;invested:number;value:number;cumulativeDividend:number;totalPnl:number;roi:number;months:SimulationMonth[]};

export function simulateMonthly(initial:number,monthly:number,years:number,annualPct:number,annualDividendYield=0,reinvest=true){
 const annual=Math.max(-99.9,Number(annualPct)||0)/100; const monthlyReturn=Math.pow(1+annual,1/12)-1; const divMonthly=Math.max(0,Number(annualDividendYield)||0)/100/12;
 const months=Math.max(1,Math.round(Math.max(0,years)*12)); let value=Math.max(0,initial),invested=Math.max(0,initial),cumDiv=0; const monthRows:SimulationMonth[]=[]; let prevEconomicValue=value;
 for(let i=1;i<=months;i++){
  value*=1+monthlyReturn;
  const dividend=Math.max(0,value*divMonthly); cumDiv+=dividend; if(reinvest)value+=dividend;
  const contribution=Math.max(0,monthly); value+=contribution; invested+=contribution;
  const economicValue=value+(reinvest?0:cumDiv); const totalPnl=economicValue-invested; const monthlyPnl=economicValue-(prevEconomicValue+contribution); const y=Math.ceil(i/12); const m=((i-1)%12)+1;
  monthRows.push({month:m,year:y,label:`${y}年${m}月`,monthlyContribution:contribution,invested,value,monthlyDividend:dividend,cumulativeDividend:cumDiv,monthlyPnl,totalPnl,roi:invested>0?totalPnl/invested*100:0}); prevEconomicValue=economicValue;
 }
 const yearRows:SimulationYear[]=[]; for(let y=1;y<=Math.ceil(months/12);y++){const mm=monthRows.filter(x=>x.year===y);const last=mm[mm.length-1];if(last)yearRows.push({year:y,label:`第 ${y} 年`,invested:last.invested,value:last.value,cumulativeDividend:last.cumulativeDividend,totalPnl:last.totalPnl,roi:last.roi,months:mm});}
 const last=monthRows[monthRows.length-1]; const effectiveValue=last.value+(reinvest?0:last.cumulativeDividend);
 const chartRows=[{label:'現在',invested:Math.max(0,initial),value:Math.max(0,initial),pnl:0,roi:0,cumulativeDividend:0},...yearRows.map(x=>({label:`${x.year}年`,invested:x.invested,value:x.value+(reinvest?0:x.cumulativeDividend),pnl:x.totalPnl,roi:x.roi,cumulativeDividend:x.cumulativeDividend}))];
 return {value:effectiveValue,marketValue:last.value,invested:last.invested,pnl:last.totalPnl,roi:last.roi,cumulativeDividend:last.cumulativeDividend,monthlyRate:monthlyReturn,months:monthRows,years:yearRows,rows:chartRows};
}

export function simulateCompound(initial:number,monthly:number,years:number,annualPct:number){return simulateMonthly(initial,monthly,years,annualPct,0,true);}
