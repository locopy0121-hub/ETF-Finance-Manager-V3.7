import { Holding } from '../data/portfolio';
import { TwseQuote } from './twse';
import { DailySnapshot } from '../storage/appStorage';
import { DividendEvent } from '../screens/DividendCalendarScreen';
import { LedgerEntry } from '../v3/model';
import { holdingMetrics, portfolioMetrics } from '../v3/engine';

const dayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

export function buildDailySnapshot(holdings:Holding[],quotes:Record<string,TwseQuote>,ledger:LedgerEntry[]=[],dividends:DividendEvent[]=[],at=new Date(),cashBalance=0):DailySnapshot{
 const p=portfolioMetrics(holdings,quotes,cashBalance,ledger,dividends);
 const rows=holdings.map(h=>{const x=holdingMetrics(h,quotes,ledger,dividends);return {symbol:h.symbol,shares:h.shares,price:x.price,marketValue:x.marketValue,todayPnl:x.todayPnl,totalPnl:x.pnl};});
 const currentBase=p.currentTradeCost; const costPnlPct=currentBase>0?p.priceUnrealizedPnl/currentBase:0; const totalPnlPct=p.historicalCashOutflow>0?p.totalPnl/p.historicalCashOutflow:0;
 return {
  id:`snapshot-${dayKey(at)}`,date:dayKey(at),createdAt:at.getTime(),marketValue:p.marketValue,cashBalance,totalAssets:p.totalAssets,totalCost:p.currentCashBasis,
  historicalTradeCost:p.historicalTradeCost,historicalBuyFees:p.historicalBuyFees,historicalCashOutflow:p.historicalCashOutflow,currentTradeCost:p.currentTradeCost,currentCashBasis:p.currentCashBasis,pricePnl:p.pricePnl,cashUnrealizedPnl:p.cashUnrealizedPnl,
  todayPnl:p.todayPnl,todayPnlPct:p.todayPnlPct/100,costPnl:p.priceUnrealizedPnl,costPnlPct,totalPnl:p.totalPnl,totalPnlPct,cumulativeDividend:p.cumulativeDividends,holdings:rows,
 };
}
export function upsertSnapshot(list:DailySnapshot[],snapshot:DailySnapshot){return [...list.filter(x=>x.date!==snapshot.date),snapshot].sort((a,b)=>a.date.localeCompare(b.date));}
