import type { Holding } from '../data/portfolio';
import type { DividendEvent } from '../screens/DividendCalendarScreen';
import type {
  DividendFrequency,
  ETFItem,
  TradeMode,
  Transaction,
} from '../types/etf';
import {
  calculateETFSummary,
  calculateNetDividend,
  calculatePortfolioSummary,
  calculatePurchaseCost,
} from '../utils/etfCalculators';
import type { LedgerEntry, MoneyPreferences } from './model';
import { builtInBrokerProfiles, normalizeBrokerProfiles, resolveBrokerProfile, type BrokerProfile } from '../data/brokerProfiles';

type QuoteLike={price?:number;change?:number;changePercent?:number;previousClose?:number;open?:number;high?:number;low?:number;volume?:number;nav?:number;quoteDate?:string;quoteTime?:string};

let RUNTIME_BROKER_PROFILES:BrokerProfile[]=normalizeBrokerProfiles(builtInBrokerProfiles);
export function configureBrokerProfiles(profiles?:BrokerProfile[]){RUNTIME_BROKER_PROFILES=normalizeBrokerProfiles(profiles);}
export function configuredBrokerProfiles(){return RUNTIME_BROKER_PROFILES.map(x=>({...x}));}

let DISPLAY_MONEY:MoneyPreferences|undefined;
export function configureDisplayPreferences(moneyPrefs?:MoneyPreferences){DISPLAY_MONEY=moneyPrefs;}
const digitsFor=(mode:'smart'|'fixed'|'custom'|undefined,standard:number,custom:number|undefined)=>Math.max(0,Math.min(12,Math.round(mode==='custom'?(custom??standard):standard)));
export function money(n:number){const v=Number.isFinite(n)?n:0;const cfg=DISPLAY_MONEY;const mode=cfg?.moneyMode??'smart';const d=digitsFor(mode,cfg?.moneyDigits??2,cfg?.customMoneyDigits);return v.toLocaleString('zh-TW',{minimumFractionDigits:mode==='smart'?0:d,maximumFractionDigits:d});}
export function pct(n:number){const v=Number.isFinite(n)?n:0;const cfg=DISPLAY_MONEY;const mode=cfg?.percentMode??'smart';const d=digitsFor(mode,cfg?.percentDigits??2,cfg?.customPercentDigits);return `${v>=0?'+':''}${v.toLocaleString('zh-TW',{minimumFractionDigits:mode==='smart'?0:d,maximumFractionDigits:d})}%`;}
export function num2(n:number){return Number.isFinite(n)?n.toFixed(2):'0.00';}
export function isIsoDate(v?:string){return !!v&&/^\d{4}-\d{2}-\d{2}$/.test(v);}

const roundPercent=(value:number)=>Math.round(((Number.isFinite(value)?value:0)+Number.EPSILON)*100)/100;

function requiredTradeMode(value:unknown,context:string):TradeMode{
 if(value==='ROUND_LOT'||value==='ODD_LOT')return value;
 throw new Error(`${context} 缺少 TradeMode；Breaking Refactor 不允許 Legacy Fallback。`);
}
function requiredDividendFrequency(value:unknown,context:string):DividendFrequency{
 if(value===1||value===2||value===4||value===6||value===12)return value;
 throw new Error(`${context} 缺少 DividendFrequency；請先完成資料遷移。`);
}

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

function canonicalTransactions(symbol:string,ledger:LedgerEntry[]):Transaction[]{
 return ledger
  .filter(e=>e.symbol===symbol&&(e.kind==='buy'||e.kind==='sell'))
  .map(e=>({
   id:e.id,
   etfCode:symbol,
   type:e.kind==='buy'?('BUY' as const):('SELL' as const),
   tradeMode:requiredTradeMode((e as LedgerEntry&{tradeMode?:TradeMode}).tradeMode,`交易 ${e.id}`),
   shares:Math.max(0,Number(e.shares??0)),
   price:Math.max(0,Number(e.price??0)),
   date:e.date,
   brokerProfile:resolveBrokerProfile(e.brokerProfileId,RUNTIME_BROKER_PROFILES,e.broker),
   calculatedFee:Number.isFinite(Number(e.calculatedFee))?Math.max(0,Number(e.calculatedFee)):undefined,
   calculatedTax:Number.isFinite(Number(e.calculatedTax))?Math.max(0,Number(e.calculatedTax)):undefined,
   actualFee:Number.isFinite(Number(e.actualFee))?Math.max(0,Number(e.actualFee)):undefined,
   actualTax:Number.isFinite(Number(e.actualTax))?Math.max(0,Number(e.actualTax)):undefined,
  }))
  .sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}

function canonicalDividendRecords(symbol:string,dividends:DividendEvent[]){
 return dividends
  .filter(e=>e.symbol===symbol&&Number(e.dividend)>0&&Number(e.eligibleShares??0)>0)
  .map(e=>({id:e.id,etfCode:symbol,paymentDate:e.payDate,perShareAmount:Number(e.dividend),sharesHeld:Number(e.eligibleShares??0)}));
}

function toETFItem(h:Holding,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[],dividends:DividendEvent[]):ETFItem{
 const transactions=canonicalTransactions(h.symbol,ledger);
 const holdingProfileId=(h as Holding&{brokerProfileId?:string}).brokerProfileId??[...ledger].reverse().find(e=>e.symbol===h.symbol&&(e.kind==='buy'||e.kind==='sell'))?.brokerProfileId;
 const brokerProfile=resolveBrokerProfile(holdingProfileId,RUNTIME_BROKER_PROFILES,h.broker);
 if(Number(h.shares)>0&&!transactions.length)throw new Error(`${h.symbol} 有持股但沒有 canonical transaction；Breaking Refactor 禁止舊成本 fallback。`);
 return {
  etfCode:h.symbol,
  name:h.name,
  currentPrice:Math.max(0,quotePrice(h,quotes)),
  liquidationTradeMode:requiredTradeMode((h as Holding&{liquidationTradeMode?:TradeMode}).liquidationTradeMode,`${h.symbol} 清算模式`),
  dividendFrequency:requiredDividendFrequency((h as Holding&{dividendFrequency?:DividendFrequency}).dividendFrequency,`${h.symbol} 配息頻率`),
  latestDividendPerShare:Math.max(0,Number(h.annualDividendPerShare??0))/requiredDividendFrequency((h as Holding&{dividendFrequency?:DividendFrequency}).dividendFrequency,`${h.symbol} 配息頻率`),
  transactions,
  dividendRecords:canonicalDividendRecords(h.symbol,dividends),
  brokerProfile,
 };
}

type CostBreakdown={
 historicalTradeCost:number;
 historicalBuyFees:number;
 historicalCashOutflow:number;
 currentTradeCost:number;
 currentAllocatedBuyFees:number;
 currentCashBasis:number;
 realizedPricePnl:number;
 realizedCashPnl:number;
};

function calculateCostBreakdown(symbol:string,ledger:LedgerEntry[]):CostBreakdown{
 const rows=canonicalTransactions(symbol,ledger);
 let historicalTradeCost=0,historicalBuyFees=0,poolShares=0,poolTrade=0,poolFees=0,realizedPricePnl=0,realizedCashPnl=0;
 for(const tx of rows){
  if(!(tx.shares>0&&tx.price>0))continue;
  const tradeAmount=Math.floor(tx.shares*tx.price);
  if(tx.type==='BUY'){
   const actualFee=Number.isFinite(Number(tx.actualFee))?Math.max(0,Number(tx.actualFee)):0;
   historicalTradeCost+=tradeAmount;
   historicalBuyFees+=actualFee;
   poolShares+=tx.shares;
   poolTrade+=tradeAmount;
   poolFees+=actualFee;
   continue;
  }
  if(poolShares<=0)continue;
  const qty=Math.min(tx.shares,poolShares);
  const releasedTrade=qty*(poolTrade/poolShares);
  const releasedFee=qty*(poolFees/poolShares);
  const saleGross=Math.floor(tx.price*qty);
  const actualSellFee=Number.isFinite(Number(tx.actualFee))?Math.max(0,Number(tx.actualFee)):0;
  const actualSellTax=Number.isFinite(Number(tx.actualTax))?Math.max(0,Number(tx.actualTax)):0;
  const saleNet=saleGross-actualSellFee-actualSellTax;
  realizedPricePnl+=saleGross-releasedTrade;
  realizedCashPnl+=saleNet-releasedTrade-releasedFee;
  poolShares-=qty;
  poolTrade-=releasedTrade;
  poolFees-=releasedFee;
  if(poolShares<1e-9){poolShares=0;poolTrade=0;poolFees=0;}
 }
 return {historicalTradeCost,historicalBuyFees,historicalCashOutflow:historicalTradeCost+historicalBuyFees,currentTradeCost:poolTrade,currentAllocatedBuyFees:poolFees,currentCashBasis:poolTrade+poolFees,realizedPricePnl,realizedCashPnl};
}

export function calculateDividendIncome(ledger:LedgerEntry[],dividends:DividendEvent[],symbol?:string){
 const scoped=dividends.filter(e=>(!symbol||e.symbol===symbol)&&Number(e.dividend)>0&&Number(e.eligibleShares??0)>0);
 const eventIds=new Set(scoped.map(e=>e.id));
 const eventNet=scoped.reduce((sum,e)=>sum+calculateNetDividend({id:e.id,etfCode:e.symbol,paymentDate:e.payDate,perShareAmount:Number(e.dividend),sharesHeld:Number(e.eligibleShares??0)}),0);
 const unlinkedLedger=ledger.filter(e=>e.kind==='dividend'&&(!symbol||e.symbol===symbol)&&(!e.dividendEventId||!eventIds.has(e.dividendEventId))).reduce((sum,e)=>sum+Math.max(0,Number(e.amount??0)),0);
 return eventNet+unlinkedLedger;
}

export function calculateDividendView(
 holdings:Holding[],
 ledger:LedgerEntry[],
 dividends:DividendEvent[],
 year:number,
 month:number,
){
 const holdingMap=new Map(holdings.map(h=>[h.symbol,h] as const));
 const monthKey=`${year}-${String(month).padStart(2,'0')}`;
 const yearPrefix=String(year);

 const rows=dividends.map(event=>{
  const holding=holdingMap.get(event.symbol);
  const frequency=holding?.dividendFrequency;
  const frequencyLabel=frequency===12?'月配':frequency===4?'季配':frequency===2?'半年配':frequency===1?'年配':'配息';
  const actualAmount=Math.max(0,Number(event.actualAmount??0));
  const estimatedAmount=Math.max(0,Number(event.estimatedAmount??0));
  const displayAmount=actualAmount>0?actualAmount:estimatedAmount;
  const paid=actualAmount>0||event.status==='paid';
  return {
   id:event.id,
   symbol:event.symbol,
   name:event.name,
   frequencyLabel,
   dividendPerShare:Math.max(0,Number(event.dividend)||0),
   eligibleShares:Math.max(0,Number(event.eligibleShares??0)),
   estimatedAmount,
   actualAmount,
   displayAmount,
   announcementDate:event.announcementDate,
   lastBuyDate:event.lastBuyDate,
   exDate:event.exDate,
   payDate:event.payDate,
   status:paid?'paid' as const:'pending' as const,
  };
 }).sort((a,b)=>String(a.payDate||a.exDate||'').localeCompare(String(b.payDate||b.exDate||'')));

 const yearRows=rows.filter(row=>String(row.payDate||row.exDate||'').startsWith(yearPrefix));
 const monthRows=rows.filter(row=>String(row.payDate||'').startsWith(monthKey));
 const yearExpected=yearRows.reduce((sum,row)=>sum+row.displayAmount,0);
 const averageMonthly=yearExpected/12;
 const currentMonthExpected=monthRows.reduce((sum,row)=>sum+row.displayAmount,0);
 const months=Array.from({length:12},(_,index)=>{
  const key=`${year}-${String(index+1).padStart(2,'0')}`;
  const value=rows.filter(row=>String(row.payDate||'').startsWith(key)).reduce((sum,row)=>sum+row.displayAmount,0);
  return {month:index+1,key,value,hasDividend:value>0};
 });

 return {
  year,
  month,
  yearExpected,
  averageMonthly,
  currentMonthExpected,
  rows,
  monthRows,
  months,
  cumulativeIncome:calculateDividendIncome(ledger,dividends),
 };
}

export function calculateHoldingView(h:Holding,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[]=[],dividends:DividendEvent[]=[]){
 const q=quotes[h.symbol]??{};
 const item=toETFItem(h,quotes,ledger,dividends);
 const summary=calculateETFSummary(item);
 const cost=calculateCostBreakdown(h.symbol,ledger);
 const price=summary.currentPrice;
 const prev=Number(q.previousClose??price);
 const todayPnl=(price-prev)*summary.totalShares;
 const prevValue=prev*summary.totalShares;
 const todayPnlPct=prevValue>0?roundPercent(todayPnl/prevValue*100):0;
 const cumulativeDividend=summary.totalDividendsReceived;
 const comprehensivePnl=summary.comprehensivePnL;
 const comprehensiveRoi=cost.historicalCashOutflow>0?roundPercent(comprehensivePnl/cost.historicalCashOutflow*100):0;
 const costYield=summary.totalInvestmentCost>0?roundPercent(cumulativeDividend/summary.totalInvestmentCost*100):0;
 return {
  symbol:h.symbol,
  name:h.name,
  shares:summary.totalShares,
  price,
  pureCost:cost.currentTradeCost,
  totalFees:cost.currentAllocatedBuyFees,
  totalCost:summary.totalInvestmentCost,
  historicalTradeCost:cost.historicalTradeCost,
  historicalBuyFees:cost.historicalBuyFees,
  historicalCashOutflow:cost.historicalCashOutflow,
  grossMarketValue:summary.currentMarketValue,
  marketValue:summary.currentMarketValue,
  netLiquidationValue:summary.netLiquidationValue,
  estimatedSellCommission:summary.estimatedSellCommission,
  estimatedSellTax:summary.estimatedSellTax,
  pnl:summary.unrealizedProfit,
  pricePnl:summary.currentMarketValue-cost.currentTradeCost,
  cashPnl:summary.unrealizedProfit,
  roi:summary.unrealizedROI,
  priceRoi:cost.currentTradeCost>0?roundPercent((summary.currentMarketValue-cost.currentTradeCost)/cost.currentTradeCost*100):0,
  cashRoi:summary.unrealizedROI,
  comprehensivePnl,
  comprehensiveRoi,
  avgCost:summary.totalShares>0?cost.currentTradeCost/summary.totalShares:0,
  cashAvgCost:summary.averageCostPerShare,
  realizedPricePnl:cost.realizedPricePnl,
  realizedCashPnl:summary.realizedNetPnL,
  todayPnl,
  todayPnlPct,
  cumulativeDividend,
  costYield,
  previousClose:q.previousClose,
  open:q.open,
  high:q.high,
  low:q.low,
  volume:q.volume,
  nav:q.nav,
  quoteDate:q.quoteDate,
  quoteTime:q.quoteTime,
 };
}

export function calculatePortfolioCoreSummary(holdings:Holding[],quotes:Record<string,QuoteLike>,ledger:LedgerEntry[],dividends:DividendEvent[],selectedSymbols:string[]=[]){
 const selected=selectedSymbols.length?holdings.filter(h=>selectedSymbols.includes(h.symbol)):holdings;
 return calculatePortfolioSummary(selected.map(h=>toETFItem(h,quotes,ledger,dividends)));
}

export function calculateTradePreview({symbol,shares,price,tradeMode,side,brokerProfile}:{symbol:string;shares:number;price:number;tradeMode:TradeMode;side:'buy'|'sell';brokerProfile?:BrokerProfile}){
 const safeShares=Math.max(0,Number(shares)||0),safePrice=Math.max(0,Number(price)||0);
 const tx:Transaction={id:'ui-preview',etfCode:symbol||'PREVIEW',type:'BUY',tradeMode,shares:safeShares,price:safePrice,date:'2000-01-01',brokerProfile};
 const buy=calculatePurchaseCost(tx);
 if(side==='buy')return {tradeAmount:buy.tradeAmount,calculatedFee:buy.commission,calculatedTax:0,estimatedCashFlow:-buy.settlementAmount};
 const probe:ETFItem={etfCode:symbol||'PREVIEW',name:symbol||'PREVIEW',currentPrice:safePrice,liquidationTradeMode:tradeMode,dividendFrequency:1,transactions:[tx],dividendRecords:[],brokerProfile};
 const sell=calculateETFSummary(probe);
 return {tradeAmount:sell.currentMarketValue,calculatedFee:sell.estimatedSellCommission,calculatedTax:sell.estimatedSellTax,estimatedCashFlow:sell.netLiquidationValue};
}

export function calculatePortfolioView(holdings:Holding[],quotes:Record<string,QuoteLike>,cashBalance:number,ledger:LedgerEntry[],dividends:DividendEvent[]){
 const canonical=calculatePortfolioCoreSummary(holdings,quotes,ledger,dividends);
 const rows=holdings.map(h=>calculateHoldingView(h,quotes,ledger,dividends));
 const historicalTradeCost=rows.reduce((s,m)=>s+m.historicalTradeCost,0);
 const historicalBuyFees=rows.reduce((s,m)=>s+m.historicalBuyFees,0);
 const historicalCashOutflow=historicalTradeCost+historicalBuyFees;
 const currentTradeCost=rows.reduce((s,m)=>s+m.pureCost,0);
 const currentAllocatedBuyFees=rows.reduce((s,m)=>s+m.totalFees,0);
 const currentCashBasis=canonical.totalInvestmentCost;
 const realizedPricePnl=rows.reduce((s,m)=>s+m.realizedPricePnl,0);
 const realizedCashPnl=canonical.realizedNetPnL;
 const cumulativeDividends=canonical.totalDividendsReceived;
 const todayPnl=rows.reduce((s,m)=>s+m.todayPnl,0);
 const previousValue=rows.reduce((s,m)=>s+(Number(m.previousClose??m.price)*m.shares),0);
 const todayPnlPct=previousValue>0?roundPercent(todayPnl/previousValue*100):0;
 const pendingDividends=dividends.filter(e=>Number(e.actualAmount??0)<=0).reduce((s,e)=>s+Number(e.estimatedAmount??0),0);
 const safeCash=Number.isFinite(Number(cashBalance))?Number(cashBalance):0;
 const totalAssets=canonical.totalMarketValue+safeCash;
 const comprehensivePnl=canonical.comprehensivePnL;
 const comprehensiveRoi=historicalCashOutflow>0?roundPercent(comprehensivePnl/historicalCashOutflow*100):0;
 return {
  canonicalSummary:canonical,
  historicalTradeCost,historicalBuyFees,historicalCashOutflow,
  currentTradeCost,currentAllocatedBuyFees,currentCashBasis,
  grossMarketValue:canonical.totalMarketValue,
  marketValue:canonical.totalMarketValue,
  netLiquidationValue:canonical.totalNetLiquidationValue,
  totalEstimatedSellCommission:canonical.totalEstimatedSellCommission,
  totalEstimatedSellTax:canonical.totalEstimatedSellTax,
  cashBalance:safeCash,totalAssets,accountEquity:totalAssets,
  priceUnrealizedPnl:canonical.totalMarketValue-currentTradeCost,
  cashUnrealizedPnl:canonical.totalUnrealizedProfit,
  unrealizedPnl:canonical.totalUnrealizedProfit,
  realizedPricePnl,realizedCashPnl,realizedPnl:realizedCashPnl,
  pricePnl:canonical.totalMarketValue-currentTradeCost,
  cumulativeDividends,
  totalPnl:canonical.totalPnl,
  totalRoi:comprehensiveRoi,
  priceRoi:currentTradeCost>0?roundPercent((canonical.totalMarketValue-currentTradeCost)/currentTradeCost*100):0,
  todayPnl,todayPnlPct,pendingDividends,holdingCount:rows.filter(m=>m.shares>0).length,comprehensivePnl,
  totalInvestedCost:canonical.totalInvestmentCost,currentCost:canonical.totalInvestmentCost,pureCost:currentTradeCost,totalFees:historicalBuyFees,
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
