import type {Holding} from '../data/portfolio';
import type {DividendEvent} from '../screens/DividendCalendarScreen';
import type {LedgerEntry} from './model';
import {holdingMetrics,portfolioMetrics} from './engine';

export type MetricEnvelope={value:number;source:string;formula:string;asOf:number;isStale:boolean};
export function buildGlobalMetrics(args:{holdings:Holding[];quotes:Record<string,any>;ledger:LedgerEntry[];dividends:DividendEvent[];cashBalance:number;asOf?:number;maxAgeMs?:number}){
 const asOf=args.asOf??Date.now(),stale=Date.now()-asOf>(args.maxAgeMs??20000);
 const p=portfolioMetrics(args.holdings,args.quotes,args.cashBalance,args.ledger,args.dividends);
 const env=(value:number,formula:string,source='Finance Engine 2.0'):MetricEnvelope=>({value,source,formula,asOf,isStale:stale});
 const global={
  totalCost:env(p.currentTradeCost,'Σ 單筆 floor(成交行情 × 股數) 的目前持有成本'),
  marketValue:env(p.marketValue,'Σ (即時行情 × 目前持有股數)','TWSE + Finance Engine 2.0'),
  inventoryPnl:env(p.totalPnl,'總市值 - 總成本'),
  todayPnl:env(p.todayPnl,'Σ ((即時行情 - 昨收) × 持有股數)'),
  cashBalance:env(p.cashBalance,'帳務現金餘額','Ledger'),
 };
 const bySymbol=Object.fromEntries(args.holdings.map(h=>{const m=holdingMetrics(h,args.quotes,args.ledger,args.dividends);return [h.symbol,{
  price:env(m.price,'最新有效行情','TWSE'),
  shares:env(h.shares,'目前持有股數','Holdings'),
  pureCost:env(m.pureCost,'移動平均純成本','Finance Engine 2.0'),
  marketValue:env(m.marketValue,'即時行情 × 持有股數','TWSE + Finance Engine 2.0'),
  inventoryPnl:env(m.pnl,'即時市值 - 純成本'),
  inventoryRoi:env(m.roi,'庫存即時損益 ÷ 純成本 × 100'),
  todayPnl:env(m.todayPnl,'(即時行情 - 昨收) × 持有股數'),
  todayPnlPct:env(m.todayPnlPct,'今日損益 ÷ 昨收市值 × 100'),
 }];}));
 return {global,bySymbol,raw:p};
}
