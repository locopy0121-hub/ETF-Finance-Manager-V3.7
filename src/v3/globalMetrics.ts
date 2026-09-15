import type {Holding} from '../data/portfolio';
import type {DividendEvent} from '../screens/DividendCalendarScreen';
import type {LedgerEntry} from './model';
import {holdingMetrics,portfolioMetrics} from './engine';

export type MetricEnvelope={value:number;source:string;formula:string;asOf:number;isStale:boolean};
export function buildGlobalMetrics(args:{holdings:Holding[];quotes:Record<string,any>;ledger:LedgerEntry[];dividends:DividendEvent[];cashBalance:number;asOf?:number;maxAgeMs?:number}){
 const asOf=args.asOf??Date.now(),stale=Date.now()-asOf>(args.maxAgeMs??20000);
 const p=portfolioMetrics(args.holdings,args.quotes,args.cashBalance,args.ledger,args.dividends);
 const env=(value:number,formula:string,source='Finance Engine 2.1'):MetricEnvelope=>({value,source,formula,asOf,isStale:stale});
 const global={
  totalCost:env(p.currentCashBasis,'目前持有純成交成本 + 分攤買進手續費'),
  tradeCost:env(p.currentTradeCost,'Σ 移動平均後目前持有純成交成本'),
  marketValue:env(p.marketValue,'Σ (即時行情 × 目前持有股數)','TWSE + Finance Engine 2.1'),
  inventoryPnl:env(p.cashUnrealizedPnl,'持股總市值 - 目前持有含費成本'),
  comprehensivePnl:env(p.totalPnl,'含費未實現 + 已實現含費稅損益 + 累積配息'),
  totalAssets:env(p.totalAssets,'持股總市值 + 證券現金資金'),
  todayPnl:env(p.todayPnl,'Σ ((即時行情 - 昨收) × 持有股數)'),
  cashBalance:env(p.cashBalance,'證券帳戶現金餘額','Ledger / Reconciliation'),
 };
 const bySymbol=Object.fromEntries(args.holdings.map(h=>{const m=holdingMetrics(h,args.quotes,args.ledger,args.dividends);return [h.symbol,{
  price:env(m.price,'最新有效行情','TWSE'),
  shares:env(h.shares,'目前持有股數','Holdings'),
  pureCost:env(m.pureCost,'移動平均純成交成本','Finance Engine 2.1'),
  cashBasis:env(m.totalCost,'移動平均純成交成本 + 分攤買進手續費','Finance Engine 2.1'),
  marketValue:env(m.marketValue,'即時行情 × 持有股數','TWSE + Finance Engine 2.1'),
  inventoryPnl:env(m.cashPnl,'即時市值 - 含費成本'),
  inventoryRoi:env(m.cashRoi,'含費未實現損益 ÷ 含費成本 × 100'),
  comprehensivePnl:env(m.comprehensivePnl,'含費未實現 + 已實現含費稅損益 + 累積配息'),
  comprehensiveRoi:env(m.comprehensiveRoi,'累積綜合損益 ÷ 歷史含費現金支出 × 100'),
  todayPnl:env(m.todayPnl,'(即時行情 - 昨收) × 持有股數'),
  todayPnlPct:env(m.todayPnlPct,'今日損益 ÷ 昨收市值 × 100'),
 }];}));
 return {global,bySymbol,raw:p};
}
