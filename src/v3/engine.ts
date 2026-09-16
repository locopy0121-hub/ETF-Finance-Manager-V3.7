import type { Holding } from '../data/portfolio';
import type { DividendEvent } from '../screens/DividendCalendarScreen';
import type { LedgerEntry } from './model';
import {
  defaultFeeSettings,
  estimateBrokerBookValue,
  resolveBrokerFeeSettings,
  truncateTowardZero,
  type FeeSettings,
} from '../data/tradeSettings';
import * as Base from './engineBase';

export * from './engineBase';

export const BROKER_COST_WRITEOFF_PREFIX='券商成本沖銷:';

function writeOffSymbol(entry:LedgerEntry){
  if(entry.kind!=='cashIn')return '';
  const note=String(entry.note??'');
  if(!note.startsWith(BROKER_COST_WRITEOFF_PREFIX))return '';
  return note.slice(BROKER_COST_WRITEOFF_PREFIX.length).split(':')[0]?.trim()??'';
}

export function brokerCostWriteOffAmount(symbol:string,ledger:LedgerEntry[]){
  return ledger.reduce((sum,e)=>writeOffSymbol(e)===symbol?sum+Math.max(0,Number(e.amount??0)):sum,0);
}

export function brokerCostWriteOffTotal(ledger:LedgerEntry[]){
  return ledger.reduce((sum,e)=>writeOffSymbol(e)?sum+Math.max(0,Number(e.amount??0)):sum,0);
}

/**
 * Preserve every original trade row. A broker cash/cost write-off is represented by a
 * tagged cashIn ledger row. The returned cost pool is the effective, reconciled pool.
 */
export function positionCostStats(h:Holding,ledger:LedgerEntry[]){
  const base=Base.positionCostStats(h,ledger);
  const requested=brokerCostWriteOffAmount(h.symbol,ledger);
  const adjustment=Math.min(requested,Math.max(0,base.historicalBuyFees));
  const currentRatio=base.historicalBuyFees>0?Math.max(0,Math.min(1,base.currentAllocatedBuyFees/base.historicalBuyFees)):0;
  const currentAdjustment=Math.min(base.currentAllocatedBuyFees,adjustment*currentRatio);
  const realizedAdjustment=Math.max(0,adjustment-currentAdjustment);
  const historicalBuyFees=Math.max(0,base.historicalBuyFees-adjustment);
  const historicalCashOutflow=base.historicalTradeCost+historicalBuyFees;
  const currentAllocatedBuyFees=Math.max(0,base.currentAllocatedBuyFees-currentAdjustment);
  const currentCashBasis=base.currentTradeCost+currentAllocatedBuyFees;
  const soldAllocatedBuyFees=Math.max(0,base.soldAllocatedBuyFees-realizedAdjustment);
  const realizedCashPnl=base.realizedCashPnl+realizedAdjustment;
  return {
    ...base,
    historicalBuyFees,
    historicalCashOutflow,
    currentAllocatedBuyFees,
    currentCashBasis,
    soldAllocatedBuyFees,
    realizedCashPnl,
    costAdjustments:adjustment,
    currentCostAdjustment:currentAdjustment,
    realizedCostAdjustment:realizedAdjustment,
  };
}

type QuoteLike={price?:number;change?:number;changePercent?:number;previousClose?:number;open?:number;high?:number;low?:number;volume?:number;nav?:number;quoteDate?:string;quoteTime?:string};

export function holdingMetrics(
  h:Holding,
  quotes:Record<string,QuoteLike>,
  ledger:LedgerEntry[]=[],
  dividends:DividendEvent[]=[],
  feeSettings:FeeSettings=defaultFeeSettings,
){
  const q=quotes[h.symbol]??{};
  const price=Base.quotePrice(h,quotes);
  const c=positionCostStats(h,ledger);
  const marketValue=price*h.shares;
  const localSettings=resolveBrokerFeeSettings(h.broker,feeSettings);
  const isHuanan=localSettings.brokerProfileId==='huanan-yongchang';
  const book=estimateBrokerBookValue(marketValue,localSettings);
  const brokerBookValue=isHuanan?book.bookValue:marketValue;

  const pricePnl=marketValue-c.currentTradeCost;
  const cashPnl=marketValue-c.currentCashBasis;
  const brokerPnl=brokerBookValue-c.currentCashBasis;
  const priceRoi=c.currentTradeCost>0?pricePnl/c.currentTradeCost*100:0;
  const cashRoi=c.currentCashBasis>0?cashPnl/c.currentCashBasis*100:0;
  const brokerRoi=c.currentCashBasis>0?brokerPnl/c.currentCashBasis*100:0;
  const pnl=isHuanan?brokerPnl:cashPnl;
  const roi=isHuanan?truncateTowardZero(brokerRoi,2):cashRoi;

  const prev=Number(q.previousClose??price);
  const todayPnl=(price-prev)*h.shares;
  const prevValue=prev*h.shares;
  const todayPnlPct=prevValue>0?todayPnl/prevValue*100:0;
  const cumulativeDividend=Base.dividendTotals(ledger,dividends,h.symbol);
  const comprehensivePnl=pnl+c.realizedCashPnl+cumulativeDividend;
  const comprehensiveRoi=c.historicalCashOutflow>0?comprehensivePnl/c.historicalCashOutflow*100:0;
  const costYield=c.currentCashBasis>0?cumulativeDividend/c.currentCashBasis*100:0;
  const effectiveAvg=h.shares>0?c.currentCashBasis/h.shares:0;

  return {
    price,
    pureCost:c.currentTradeCost,
    totalFees:c.currentAllocatedBuyFees,
    totalCost:c.currentCashBasis,
    historicalTradeCost:c.historicalTradeCost,
    historicalBuyFees:c.historicalBuyFees,
    historicalCashOutflow:c.historicalCashOutflow,
    marketValue,
    brokerBookValue,
    brokerSellFee:isHuanan?book.sellFee:0,
    brokerSellTax:isHuanan?book.sellTax:0,
    brokerPnl,
    costAdjustments:c.costAdjustments,
    pnl,pricePnl,cashPnl,roi,priceRoi,cashRoi,brokerRoi,comprehensivePnl,comprehensiveRoi,
    avgCost:isHuanan?truncateTowardZero(effectiveAvg,2):c.avgTradePrice,
    cashAvgCost:isHuanan?truncateTowardZero(effectiveAvg,2):effectiveAvg,
    realizedPricePnl:c.realizedPricePnl,
    realizedCashPnl:c.realizedCashPnl,
    todayPnl,todayPnlPct,cumulativeDividend,costYield,
    previousClose:q.previousClose,open:q.open,high:q.high,low:q.low,volume:q.volume,nav:q.nav,quoteDate:q.quoteDate,quoteTime:q.quoteTime,
  };
}

export function portfolioMetrics(
  holdings:Holding[],
  quotes:Record<string,QuoteLike>,
  cashBalance:number,
  ledger:LedgerEntry[],
  dividends:DividendEvent[],
  feeSettings:FeeSettings=defaultFeeSettings,
){
  const base=Base.portfolioMetrics(holdings,quotes,cashBalance,ledger,dividends);
  const metrics=holdings.map(h=>holdingMetrics(h,quotes,ledger,dividends,feeSettings));
  const currentTradeCost=metrics.reduce((s,m)=>s+m.pureCost,0);
  const currentAllocatedBuyFees=metrics.reduce((s,m)=>s+m.totalFees,0);
  const currentCashBasis=metrics.reduce((s,m)=>s+m.totalCost,0);
  const brokerBookValue=metrics.reduce((s,m)=>s+m.brokerBookValue,0);
  const brokerUnrealizedPnl=metrics.reduce((s,m)=>s+m.pnl,0);
  const currentCostAdjustments=metrics.reduce((s,m)=>s+m.costAdjustments,0);
  const allAdjustments=brokerCostWriteOffTotal(ledger);
  const historicalBuyFees=Math.max(0,base.historicalBuyFees-allAdjustments);
  const historicalCashOutflow=Math.max(0,base.historicalCashOutflow-allAdjustments);
  const realizedAdjustment=Math.max(0,allAdjustments-currentCostAdjustments);
  const realizedCashPnl=base.realizedCashPnl+realizedAdjustment;
  const comprehensivePnl=brokerUnrealizedPnl+realizedCashPnl+base.cumulativeDividends;
  const totalPnl=comprehensivePnl;
  const totalRoi=historicalCashOutflow>0?totalPnl/historicalCashOutflow*100:0;

  return {
    ...base,
    historicalBuyFees,
    historicalCashOutflow,
    currentTradeCost,
    currentAllocatedBuyFees,
    currentCashBasis,
    brokerBookValue,
    brokerUnrealizedPnl,
    costAdjustments:allAdjustments,
    realizedCashPnl,
    comprehensivePnl,
    totalPnl,
    totalRoi,
    totalInvestedCost:historicalCashOutflow,
    currentCost:currentCashBasis,
    totalFees:historicalBuyFees,
    unrealizedPnl:brokerUnrealizedPnl,
    realizedPnl:realizedCashPnl,
  };
}
