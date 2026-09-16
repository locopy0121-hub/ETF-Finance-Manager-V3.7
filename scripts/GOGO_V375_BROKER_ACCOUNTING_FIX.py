from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def rep(text,old,new,label):
    if old not in text:
        raise SystemExit(f'[PATCH] missing anchor: {label}')
    return text.replace(old,new,1)

# 1) Persist broker commission rebates per transaction.
p=Path('src/data/portfolio.ts'); t=read(p)
t=rep(t,"  fee: number;\n  totalCost: number;","  fee: number;\n  feeRebate?: number; // broker refund/rebate applied after the original commission charge\n  totalCost: number;",'portfolio feeRebate')
write(p,t)

p=Path('src/v3/model.ts'); t=read(p)
t=rep(t,"  fee?: number;\n  tax?: number;","  fee?: number;\n  feeRebate?: number; // commission refund/rebate; net fee = fee - feeRebate\n  tax?: number;",'ledger feeRebate')
write(p,t)

# 2) Canonical broker exit / recorded-fee reconciliation helpers.
p=Path('src/data/tradeSettings.ts'); t=read(p)
if 'export function estimateBrokerExit(' not in t:
    t += """

export type BrokerExitEstimate = {
  grossAmount:number;
  chargedFee:number;
  feeRebate:number;
  netFee:number;
  tax:number;
  netProceeds:number;
};

/** Broker-style liquidation estimate after the configured commission rebate/refund. */
export function estimateBrokerExit(tradeAmount:number,settings:FeeSettings,extraFeeRebate=0):BrokerExitEstimate{
  const grossAmount=Math.floor(Math.max(0,Number(tradeAmount)||0));
  if(grossAmount<=0)return {grossAmount:0,chargedFee:0,feeRebate:0,netFee:0,tax:0,netProceeds:0};
  const quote=estimateCommissionQuote(grossAmount,settings);
  const extra=Math.max(0,Math.floor(Number(extraFeeRebate)||0));
  const feeRebate=Math.min(quote.chargedFee,quote.expectedRebate+extra);
  const netFee=Math.max(0,quote.chargedFee-feeRebate);
  const tax=estimateSellTaxBySettings(grossAmount,settings);
  return {grossAmount,chargedFee:quote.chargedFee,feeRebate,netFee,tax,netProceeds:grossAmount-netFee-tax};
}

/**
 * Convert a recorded transaction-day commission into the economic fee after rebate.
 * Explicit transaction data always wins. For legacy entries with no rebate field,
 * a monthly-rebate profile may infer the configured expected rebate only when the
 * recorded fee exactly equals that profile's charged fee.
 */
export function effectiveRecordedCommission(tradeAmount:number,recordedFee:number,recordedRebate:number|undefined,settings:FeeSettings){
  const grossAmount=Math.floor(Math.max(0,Number(tradeAmount)||0));
  const chargedFee=Math.max(0,Math.floor(Number(recordedFee)||0));
  const quote=estimateCommissionQuote(grossAmount,settings);
  const explicit=recordedRebate==null||!Number.isFinite(Number(recordedRebate))?undefined:Math.max(0,Math.floor(Number(recordedRebate)));
  const inferred=explicit==null&&settings.discountMode==='monthlyRebate'&&chargedFee===quote.chargedFee?quote.expectedRebate:0;
  const feeRebate=Math.min(chargedFee,explicit??inferred);
  return {chargedFee,feeRebate,netFee:Math.max(0,chargedFee-feeRebate)};
}
"""
write(p,t)

# 3) Financial engine: use net buy fees + estimated sell fee/tax for broker-style P/L.
p=Path('src/v3/engine.ts'); t=read(p)
t=rep(t,"import { LedgerEntry, type MoneyPreferences } from './model';","import { LedgerEntry, type MoneyPreferences } from './model';\nimport { defaultFeeSettings, effectiveRecordedCommission, estimateBrokerExit, type FeeSettings } from '../data/tradeSettings';",'engine fee imports')
t=rep(t,"export function positionCostStats(h:Holding,ledger:LedgerEntry[]):PositionCostStats{","export function positionCostStats(h:Holding,ledger:LedgerEntry[],feeSettings:FeeSettings=defaultFeeSettings):PositionCostStats{",'positionCostStats signature')
t=rep(t,"   const fee=Math.max(0,Number(e.fee??0));\n   buyShares+=shares;historicalTradeCost+=amount;historicalBuyFees+=fee;","   const fee=effectiveRecordedCommission(amount,Number(e.fee??0),e.feeRebate,feeSettings).netFee;\n   buyShares+=shares;historicalTradeCost+=amount;historicalBuyFees+=fee;",'buy effective fee')
t=rep(t,"   const fee=Math.max(0,Number(e.fee??0)),tax=Math.max(0,Number(e.tax??0));\n   soldShares+=qty;","   const fee=effectiveRecordedCommission(proceeds,Number(e.fee??0),e.feeRebate,feeSettings).netFee,tax=Math.max(0,Number(e.tax??0));\n   soldShares+=qty;",'sell effective fee')
t=rep(t,"    const fee=Math.max(0,Number(r.fee??0));\n    buyShares+=sh;historicalTradeCost+=amount;historicalBuyFees+=fee;","    const fee=effectiveRecordedCommission(amount,Number(r.fee??0),r.feeRebate,feeSettings).netFee;\n    buyShares+=sh;historicalTradeCost+=amount;historicalBuyFees+=fee;",'purchase record effective fee')

old="""export function portfolioMetrics(holdings:Holding[],quotes:Record<string,QuoteLike>,cashBalance:number,ledger:LedgerEntry[],dividends:DividendEvent[]){
 let currentTradeCost=0,currentAllocatedBuyFees=0,currentCashBasis=0,marketValue=0,todayPnl=0,previousValue=0;
 let historicalTradeCost=0,historicalBuyFees=0,historicalCashOutflow=0,realizedPricePnl=0,realizedCashPnl=0;"""
new="""export function portfolioMetrics(holdings:Holding[],quotes:Record<string,QuoteLike>,cashBalance:number,ledger:LedgerEntry[],dividends:DividendEvent[],feeSettings:FeeSettings=defaultFeeSettings){
 let currentTradeCost=0,currentAllocatedBuyFees=0,currentCashBasis=0,marketValue=0,todayPnl=0,previousValue=0;
 let estimatedNetSellProceeds=0,estimatedSellFees=0,estimatedSellTaxes=0,estimatedSellFeeRebates=0;
 let historicalTradeCost=0,historicalBuyFees=0,historicalCashOutflow=0,realizedPricePnl=0,realizedCashPnl=0;"""
t=rep(t,old,new,'portfolioMetrics signature')
old="""  const c=positionCostStats(h,ledger); const price=quotePrice(h,quotes); const value=price*h.shares; const prev=Number(quotes[h.symbol]?.previousClose??price);
  currentTradeCost+=c.currentTradeCost; currentAllocatedBuyFees+=c.currentAllocatedBuyFees; currentCashBasis+=c.currentCashBasis;"""
new="""  const holdingFeeSettings:FeeSettings={...feeSettings,feeRate:Number(h.feeRate??feeSettings.feeRate),discount:Number(h.feeDiscount??feeSettings.discount)};
  const c=positionCostStats(h,ledger,holdingFeeSettings); const price=quotePrice(h,quotes); const value=price*h.shares; const prev=Number(quotes[h.symbol]?.previousClose??price);
  const exit=estimateBrokerExit(Math.floor(Math.max(0,value)),holdingFeeSettings);
  currentTradeCost+=c.currentTradeCost; currentAllocatedBuyFees+=c.currentAllocatedBuyFees; currentCashBasis+=c.currentCashBasis;
  estimatedNetSellProceeds+=exit.netProceeds; estimatedSellFees+=exit.netFee; estimatedSellTaxes+=exit.tax; estimatedSellFeeRebates+=exit.feeRebate;"""
t=rep(t,old,new,'portfolio holding exit estimate')
t=t.replace("const c=positionCostStats(fake,ledger); historicalTradeCost", "const c=positionCostStats(fake,ledger,feeSettings); historicalTradeCost")
old=""" const priceUnrealizedPnl=marketValue-currentTradeCost;
 const cashUnrealizedPnl=marketValue-currentCashBasis;
 const pricePnl=priceUnrealizedPnl+realizedPricePnl;
 const comprehensivePnl=cashUnrealizedPnl+realizedCashPnl+cumulativeDividends;"""
new=""" const priceUnrealizedPnl=marketValue-currentTradeCost;
 const cashUnrealizedPnl=marketValue-currentCashBasis;
 const brokerUnrealizedPnl=estimatedNetSellProceeds-currentCashBasis;
 const pricePnl=priceUnrealizedPnl+realizedPricePnl;
 const comprehensivePnl=brokerUnrealizedPnl+realizedCashPnl+cumulativeDividends;"""
t=rep(t,old,new,'broker unrealized portfolio formula')
old="""  marketValue,cashBalance,totalAssets,accountEquity,priceUnrealizedPnl,cashUnrealizedPnl,realizedPricePnl,realizedCashPnl,pricePnl,cumulativeDividends,totalPnl,totalRoi,priceRoi,todayPnl,todayPnlPct,pendingDividends,holdingCount:holdings.length,comprehensivePnl,
  totalInvestedCost:historicalCashOutflow,currentCost:currentCashBasis,pureCost:currentTradeCost,totalFees:historicalBuyFees,unrealizedPnl:cashUnrealizedPnl,realizedPnl:realizedCashPnl,"""
new="""  marketValue,cashBalance,totalAssets,accountEquity,priceUnrealizedPnl,cashUnrealizedPnl,brokerUnrealizedPnl,estimatedNetSellProceeds,estimatedSellFees,estimatedSellTaxes,estimatedSellFeeRebates,realizedPricePnl,realizedCashPnl,pricePnl,cumulativeDividends,totalPnl,totalRoi,priceRoi,todayPnl,todayPnlPct,pendingDividends,holdingCount:holdings.length,comprehensivePnl,
  totalInvestedCost:historicalCashOutflow,currentCost:currentCashBasis,pureCost:currentTradeCost,totalFees:historicalBuyFees,unrealizedPnl:brokerUnrealizedPnl,realizedPnl:realizedCashPnl,"""
t=rep(t,old,new,'portfolio return fields')

old="""export function holdingMetrics(h:Holding,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[]=[],dividends:DividendEvent[]=[]){
 const q=quotes[h.symbol]??{}; const price=quotePrice(h,quotes), c=positionCostStats(h,ledger), marketValue=price*h.shares;
 const pricePnl=marketValue-c.currentTradeCost;
 const cashPnl=marketValue-c.currentCashBasis;
 const priceRoi=c.currentTradeCost>0?pricePnl/c.currentTradeCost*100:0;
 const cashRoi=c.currentCashBasis>0?cashPnl/c.currentCashBasis*100:0;
 const pnl=cashPnl;
 const roi=cashRoi;"""
new="""export function holdingMetrics(h:Holding,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[]=[],dividends:DividendEvent[]=[],feeSettings:FeeSettings=defaultFeeSettings){
 const q=quotes[h.symbol]??{}; const price=quotePrice(h,quotes), holdingFeeSettings:FeeSettings={...feeSettings,feeRate:Number(h.feeRate??feeSettings.feeRate),discount:Number(h.feeDiscount??feeSettings.discount)}, c=positionCostStats(h,ledger,holdingFeeSettings), marketValue=price*h.shares;
 const exit=estimateBrokerExit(Math.floor(Math.max(0,marketValue)),holdingFeeSettings);
 const pricePnl=marketValue-c.currentTradeCost;
 const cashPnl=marketValue-c.currentCashBasis;
 const brokerUnrealizedPnl=exit.netProceeds-c.currentCashBasis;
 const priceRoi=c.currentTradeCost>0?pricePnl/c.currentTradeCost*100:0;
 const cashRoi=c.currentCashBasis>0?cashPnl/c.currentCashBasis*100:0;
 const brokerRoi=c.currentCashBasis>0?brokerUnrealizedPnl/c.currentCashBasis*100:0;
 const pnl=brokerUnrealizedPnl;
 const roi=brokerRoi;"""
t=rep(t,old,new,'holding broker formula')
t=rep(t," const comprehensivePnl=cashPnl+c.realizedCashPnl+cumulativeDividend;"," const comprehensivePnl=brokerUnrealizedPnl+c.realizedCashPnl+cumulativeDividend;",'holding comprehensive broker pnl')
old="""  marketValue,pnl,pricePnl,cashPnl,roi,priceRoi,cashRoi,comprehensivePnl,comprehensiveRoi,"""
new="""  marketValue,pnl,pricePnl,cashPnl,brokerUnrealizedPnl,estimatedNetSellProceeds:exit.netProceeds,estimatedSellFee:exit.netFee,estimatedSellTax:exit.tax,estimatedSellFeeRebate:exit.feeRebate,roi,priceRoi,cashRoi,brokerRoi,comprehensivePnl,comprehensiveRoi,"""
t=rep(t,old,new,'holding return broker fields')
write(p,t)

# 4) App transaction ledger: fee rebate is first-class and cash/cost use the post-rebate fee.
p=Path('App.tsx'); t=read(p)
t=rep(t,"const ledgerCash=(ledger:LedgerEntry[])=>ledger.reduce((bal,e)=>e.kind==='cashIn'?bal+Number(e.amount||0):e.kind==='cashOut'?bal-Number(e.amount||0):e.kind==='buy'?bal-Number(e.amount||0)-Number(e.fee||0):e.kind==='sell'?bal+Number(e.amount||0)-Number(e.fee||0)-Number(e.tax||0):e.kind==='dividend'?bal+Number(e.amount||0):bal,0);","const ledgerCash=(ledger:LedgerEntry[])=>ledger.reduce((bal,e)=>e.kind==='cashIn'?bal+Number(e.amount||0):e.kind==='cashOut'?bal-Number(e.amount||0):e.kind==='buy'?bal-Number(e.amount||0)-Number(e.fee||0)+Number(e.feeRebate||0):e.kind==='sell'?bal+Number(e.amount||0)-Number(e.fee||0)+Number(e.feeRebate||0)-Number(e.tax||0):e.kind==='dividend'?bal+Number(e.amount||0):bal,0);",'ledger cash rebate')
t=rep(t,"const records:PurchaseRecord[]=buys.map(e=>{const shares=Math.max(0,Number(e.shares||0)),price=Math.max(0,Number(e.price||0)),purchaseCost=preciseTradeAmount(price,shares),fee=Math.max(0,Number(e.fee||0));return {id:e.purchaseRecordId||e.id,date:e.date,shares,tradePrice:price,purchaseCost,fee,totalCost:Math.round((purchaseCost+fee+Number.EPSILON)*100)/100}});","const records:PurchaseRecord[]=buys.map(e=>{const shares=Math.max(0,Number(e.shares||0)),price=Math.max(0,Number(e.price||0)),purchaseCost=preciseTradeAmount(price,shares),fee=Math.max(0,Number(e.fee||0)),feeRebate=Math.min(fee,Math.max(0,Number(e.feeRebate||0)));return {id:e.purchaseRecordId||e.id,date:e.date,shares,tradePrice:price,purchaseCost,fee,feeRebate,totalCost:Math.round((purchaseCost+fee-feeRebate+Number.EPSILON)*100)/100}});",'rebuild holding rebate')
t=rep(t,"const gross=records.reduce((a,r)=>a+r.shares,0),pure=records.reduce((a,r)=>a+r.purchaseCost,0),fees=records.reduce((a,r)=>a+r.fee,0),sold=ledger.filter","const gross=records.reduce((a,r)=>a+r.shares,0),pure=records.reduce((a,r)=>a+r.purchaseCost,0),fees=records.reduce((a,r)=>a+r.fee-Number(r.feeRebate??0),0),sold=ledger.filter",'rebuild net fees')

# Buy/sell payloads and persistence.
t=rep(t,"const addBuy=(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'|'swing';broker:string;account:string})=>patch(s=>{\n  const purchaseCost=preciseTradeAmount(x.price,x.shares),totalCost=Math.round((purchaseCost+x.fee+Number.EPSILON)*100)/100; const r:PurchaseRecord={id:id(),date:x.date,shares:x.shares,tradePrice:x.price,purchaseCost,fee:x.fee,totalCost};","const addBuy=(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;feeRebate:number;strategy:'long'|'swing';broker:string;account:string})=>patch(s=>{\n  const feeRebate=Math.min(Math.max(0,x.fee),Math.max(0,x.feeRebate||0)); const purchaseCost=preciseTradeAmount(x.price,x.shares),totalCost=Math.round((purchaseCost+x.fee-feeRebate+Number.EPSILON)*100)/100; const r:PurchaseRecord={id:id(),date:x.date,shares:x.shares,tradePrice:x.price,purchaseCost,fee:x.fee,feeRebate,totalCost};",'addBuy rebate payload')
t=t.replace("const oldFees=(found.purchaseRecords??[]).reduce((a,z)=>a+z.fee,0)||found.buyFee||0;const pure=oldPure+purchaseCost,fees=oldFees+x.fee;","const oldFees=(found.purchaseRecords??[]).reduce((a,z)=>a+z.fee-Number(z.feeRebate??0),0)||found.buyFee||0;const pure=oldPure+purchaseCost,fees=oldFees+x.fee-feeRebate;")
t=rep(t,"const e:LedgerEntry={id:id(),kind:'buy',symbol:x.symbol,name:x.name,date:x.date,shares:x.shares,price:x.price,amount:purchaseCost,fee:x.fee,strategy:x.strategy,broker:x.broker,account:x.account,purchaseRecordId:r.id};return {...s,holdings,cashBalance:s.cashBalance-purchaseCost-x.fee,ledger:[...s.ledger,e]};","const e:LedgerEntry={id:id(),kind:'buy',symbol:x.symbol,name:x.name,date:x.date,shares:x.shares,price:x.price,amount:purchaseCost,fee:x.fee,feeRebate,strategy:x.strategy,broker:x.broker,account:x.account,purchaseRecordId:r.id};return {...s,holdings,cashBalance:s.cashBalance-purchaseCost-x.fee+feeRebate,ledger:[...s.ledger,e]};",'addBuy ledger rebate')
t=rep(t,"const addSell=(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number})=>patch(s=>{","const addSell=(x:{symbol:string;date:string;shares:number;price:number;fee:number;feeRebate:number;tax:number})=>patch(s=>{",'addSell rebate payload')
t=rep(t,"const fee=x.fee>0?x.fee:estimateSellFee(gross,s.feeSettings);const tax=x.tax>0?x.tax:estimateSellTaxBySettings(gross,s.feeSettings);if(fee<0||tax<0||!(fee+tax<=gross)){Alert.alert('賣出失敗','手續費與交易稅不可為負，且合計不可超過成交金額。');return s;}const proceeds=gross-fee-tax;const e:LedgerEntry={id:id(),kind:'sell',symbol:x.symbol,name:h.name,date:x.date,shares:x.shares,price:x.price,amount:gross,fee,tax,broker:h.broker,account:h.account};return {...s,holdings,cashBalance:s.cashBalance+proceeds,ledger:[...s.ledger,e]};","const fee=x.fee>0?x.fee:estimateSellFee(gross,s.feeSettings);const feeRebate=Math.min(fee,Math.max(0,x.feeRebate||0));const tax=x.tax>0?x.tax:estimateSellTaxBySettings(gross,s.feeSettings);if(fee<0||tax<0||!(fee-feeRebate+tax<=gross)){Alert.alert('賣出失敗','手續費、核退與交易稅設定不正確，且淨費稅不可超過成交金額。');return s;}const proceeds=gross-fee+feeRebate-tax;const e:LedgerEntry={id:id(),kind:'sell',symbol:x.symbol,name:h.name,date:x.date,shares:x.shares,price:x.price,amount:gross,fee,feeRebate,tax,broker:h.broker,account:h.account};return {...s,holdings,cashBalance:s.cashBalance+proceeds,ledger:[...s.ledger,e]};",'addSell net rebate')
t=rep(t,"fee:entry.fee==null?undefined:Math.max(0,Number(entry.fee||0)),tax:entry.tax==null?undefined:Math.max(0,Number(entry.tax||0))","fee:entry.fee==null?undefined:Math.max(0,Number(entry.fee||0)),feeRebate:entry.feeRebate==null?undefined:Math.max(0,Number(entry.feeRebate||0)),tax:entry.tax==null?undefined:Math.max(0,Number(entry.tax||0))",'normalize feeRebate')
t=t.replace("const gross=x.records.reduce((a,r)=>a+r.shares,0),pureCost=x.records.reduce((a,r)=>a+r.purchaseCost,0),fees=x.records.reduce((a,r)=>a+r.fee,0);","const gross=x.records.reduce((a,r)=>a+r.shares,0),pureCost=x.records.reduce((a,r)=>a+r.purchaseCost,0),fees=x.records.reduce((a,r)=>a+r.fee-Number(r.feeRebate??0),0);")
t=t.replace("amount:r.purchaseCost,fee:r.fee,strategy:","amount:r.purchaseCost,fee:r.fee,feeRebate:r.feeRebate,strategy:")
# All root-level portfolio calculations use current broker settings.
t=re.sub(r"portfolioMetrics\(state\.holdings,quotes\.quotes as any,state\.cashBalance,state\.ledger,state\.dividends\)","portfolioMetrics(state.holdings,quotes.quotes as any,state.cashBalance,state.ledger,state.dividends,state.feeSettings)",t)
write(p,t)

# 5) Screens: broker settings feed all metrics; transaction form shows charged fee, rebate and net fee.
p=Path('src/v3/screens.tsx'); t=read(p)
t=t.replace("import { estimateBuyFee, estimateSellFee, estimateSellTaxBySettings, FeeSettings } from '../data/tradeSettings';","import { estimateBuyFee, estimateCommissionQuote, estimateSellFee, estimateSellTaxBySettings, FeeSettings } from '../data/tradeSettings';")
t=t.replace("holdingMetrics(h,quotes,ledger,dividends)","holdingMetrics(h,quotes,ledger,dividends,common.feeSettings)")
t=t.replace("holdingMetrics(z,quotes,ledger,dividends)","holdingMetrics(z,quotes,ledger,dividends,common.feeSettings)")
t=t.replace("portfolioMetrics(common.holdings,common.quotes,common.cashBalance,common.ledger,common.dividends)","portfolioMetrics(common.holdings,common.quotes,common.cashBalance,common.ledger,common.dividends,common.feeSettings)")
# monitor setting closure does not have common; it has feeSettings prop.
t=t.replace("holdingMetrics(mh,quotes,ledger,dividends)","holdingMetrics(mh,quotes,ledger,dividends,feeSettings)")
t=t.replace("portfolioMetrics(holdings,quotes,cashBalance,ledger,dividends)","portfolioMetrics(holdings,quotes,cashBalance,ledger,dividends,feeSettings)")

t=rep(t,"onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'|'swing';broker:string;account:string})=>void;onSell:(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number})=>void;","onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;feeRebate:number;strategy:'long'|'swing';broker:string;account:string})=>void;onSell:(x:{symbol:string;date:string;shares:number;price:number;fee:number;feeRebate:number;tax:number})=>void;",'ledger screen payload types')
t=rep(t," const [fee,setFee]=useState('0'); const [tax,setTax]=useState('0');"," const [fee,setFee]=useState('0'); const [feeRebate,setFeeRebate]=useState('0'); const [tax,setTax]=useState('0');",'fee rebate state')
old=""" const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const calcFee=(kind==='buy'||kind==='sell')&&autoFee?(kind==='buy'?estimateBuyFee(tradeAmount,common.feeSettings):estimateSellFee(tradeAmount,common.feeSettings)):Number(fee||0); const calcTax=kind==='sell'&&autoFee?estimateSellTaxBySettings(tradeAmount,common.feeSettings):Number(tax||0);"""
new=""" const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const commissionQuote=(kind==='buy'||kind==='sell')?estimateCommissionQuote(tradeAmount,common.feeSettings):{chargedFee:0,expectedRebate:0,netFee:0}; const calcFee=(kind==='buy'||kind==='sell')&&autoFee?(kind==='buy'?estimateBuyFee(tradeAmount,common.feeSettings):estimateSellFee(tradeAmount,common.feeSettings)):Number(fee||0); const calcFeeRebate=(kind==='buy'||kind==='sell')?(autoFee?commissionQuote.expectedRebate:Math.max(0,Number(feeRebate||0))):0; const calcNetFee=Math.max(0,calcFee-Math.min(calcFee,calcFeeRebate)); const calcTax=kind==='sell'&&autoFee?estimateSellTaxBySettings(tradeAmount,common.feeSettings):Number(tax||0);"""
t=rep(t,old,new,'commission form calculations')
old=""" const m=portfolioMetrics(common.holdings,common.quotes,common.cashBalance,common.ledger,common.dividends,common.feeSettings); const systemCash=common.ledger.reduce((bal,e)=>e.kind==='cashIn'?bal+Number(e.amount||0):e.kind==='cashOut'?bal-Number(e.amount||0):e.kind==='buy'?bal-Number(e.amount||0)-Number(e.fee||0):e.kind==='sell'?bal+Number(e.amount||0)-Number(e.fee||0)-Number(e.tax||0):e.kind==='dividend'?bal+Number(e.amount||0):bal,0);"""
new=""" const m=portfolioMetrics(common.holdings,common.quotes,common.cashBalance,common.ledger,common.dividends,common.feeSettings); const systemCash=common.ledger.reduce((bal,e)=>e.kind==='cashIn'?bal+Number(e.amount||0):e.kind==='cashOut'?bal-Number(e.amount||0):e.kind==='buy'?bal-Number(e.amount||0)-Number(e.fee||0)+Number(e.feeRebate||0):e.kind==='sell'?bal+Number(e.amount||0)-Number(e.fee||0)+Number(e.feeRebate||0)-Number(e.tax||0):e.kind==='dividend'?bal+Number(e.amount||0):bal,0);"""
t=rep(t,old,new,'screen cash rebate')
t=t.replace("reduce((a,x)=>a+x.amount+(x.fee??0),0)","reduce((a,x)=>a+x.amount+(x.fee??0)-Number(x.feeRebate??0),0)")
t=rep(t,"onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,strategy,broker,account});","onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,feeRebate:Math.min(calcFee,calcFeeRebate),strategy,broker,account});",'submit buy rebate')
t=rep(t,"onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,tax:calcTax});","onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,feeRebate:Math.min(calcFee,calcFeeRebate),tax:calcTax});",'submit sell rebate')
# Replace compact buy/sell fee UI with rebate-aware breakdown.
t=t.replace("{autoFee?<View style={s.calcBox}><Text style={s.muted}>買進手續費</Text><Text style={s.calcVal}>{money(calcFee)}</Text></View>:<Field label=\"買進手續費\" value={fee} onChange={setFee} keyboard=\"number-pad\" suffix=\"元\"/>}","{autoFee?<><View style={s.calcBox}><Text style={s.muted}>買進手續費（預扣）</Text><Text style={s.calcVal}>{money(calcFee)}</Text></View>{calcFeeRebate>0?<View style={s.calcBox}><Text style={s.muted}>券商核退 / 折讓</Text><Text style={s.calcVal}>-{money(calcFeeRebate)}</Text></View>:null}<View style={s.calcBox}><Text style={s.muted}>核退後淨手續費</Text><Text style={s.calcVal}>{money(calcNetFee)}</Text></View></>:<><Field label=\"買進手續費（預扣）\" value={fee} onChange={setFee} keyboard=\"number-pad\" suffix=\"元\"/><Field label=\"券商核退 / 折讓\" value={feeRebate} onChange={setFeeRebate} keyboard=\"number-pad\" suffix=\"元\"/></>}")
t=t.replace("<Text style={s.muted}>實際現金支出</Text><Text style={s.calcVal}>{money(tradeAmount+calcFee)}</Text>","<Text style={s.muted}>核退後實際成本</Text><Text style={s.calcVal}>{money(tradeAmount+calcNetFee)}</Text>")
t=t.replace("{autoFee?<><View style={s.calcBox}><Text style={s.muted}>賣出手續費</Text><Text style={s.calcVal}>{money(calcFee)}</Text></View><View style={s.calcBox}><Text style={s.muted}>ETF 交易稅</Text><Text style={s.calcVal}>{money(calcTax)}</Text></View></>:<><Field label=\"賣出手續費\" value={fee} onChange={setFee} keyboard=\"number-pad\" suffix=\"元\"/><Field label=\"證交稅\" value={tax} onChange={setTax} keyboard=\"number-pad\" suffix=\"元\"/></>}","{autoFee?<><View style={s.calcBox}><Text style={s.muted}>賣出手續費（預扣）</Text><Text style={s.calcVal}>{money(calcFee)}</Text></View>{calcFeeRebate>0?<View style={s.calcBox}><Text style={s.muted}>券商核退 / 折讓</Text><Text style={s.calcVal}>-{money(calcFeeRebate)}</Text></View>:null}<View style={s.calcBox}><Text style={s.muted}>核退後淨手續費</Text><Text style={s.calcVal}>{money(calcNetFee)}</Text></View><View style={s.calcBox}><Text style={s.muted}>ETF 交易稅</Text><Text style={s.calcVal}>{money(calcTax)}</Text></View></>:<><Field label=\"賣出手續費（預扣）\" value={fee} onChange={setFee} keyboard=\"number-pad\" suffix=\"元\"/><Field label=\"券商核退 / 折讓\" value={feeRebate} onChange={setFeeRebate} keyboard=\"number-pad\" suffix=\"元\"/><Field label=\"證交稅\" value={tax} onChange={setTax} keyboard=\"number-pad\" suffix=\"元\"/></>}")
t=t.replace("<Text style={s.muted}>實際現金流入</Text><Text style={s.calcVal}>{money(tradeAmount-calcFee-calcTax)}</Text>","<Text style={s.muted}>核退後預估淨收入</Text><Text style={s.calcVal}>{money(tradeAmount-calcNetFee-calcTax)}</Text>")
# Broker settings expose rebate timing semantics.
old="""<DecimalSettingField label=\"折扣係數\" value={feeSettings.discount} min={0} max={1} digits={4} hint={`${Math.round(feeSettings.discount*100)}%（${(feeSettings.discount*10).toFixed(2).replace(/\\.00$/,'')} 折）`} onCommit={v=>onFeeChange({discount:v})}/><Field label=\"最低手續費\""""
new="""<DecimalSettingField label=\"折扣係數\" value={feeSettings.discount} min={0} max={1} digits={4} hint={`${Math.round(feeSettings.discount*100)}%（${(feeSettings.discount*10).toFixed(2).replace(/\\.00$/,'')} 折）`} onCommit={v=>onFeeChange({discount:v})}/><SettingRow label=\"折扣入帳方式\"><Choice active={(feeSettings.discountMode??'instant')==='instant'} label=\"成交即折\" onPress={()=>onFeeChange({discountMode:'instant'})}/><Choice active={feeSettings.discountMode==='monthlyRebate'} label=\"先扣後核退\" onPress={()=>onFeeChange({discountMode:'monthlyRebate'})}/></SettingRow><Text style={s.note}>「先扣後核退」會保留券商預扣手續費，同時以每筆核退金額計入最終成本；多筆交易逐筆核平，不會把三筆差額合併後再四捨五入。</Text><Field label=\"最低手續費\""""
t=rep(t,old,new,'broker discount mode UI')
# Add selectable broker-style metrics.
t=t.replace("['cashPnl','即時損益（含費）'],['cashRoi','即時報酬率（含費）']","['cashPnl','毛市值損益（含買費）'],['cashRoi','毛市值報酬率（含買費）'],['brokerUnrealizedPnl','券商式預估淨損益'],['estimatedNetSellProceeds','預估賣出淨收入'],['estimatedSellFee','預估賣出淨手續費'],['estimatedSellTax','預估賣出證交稅']")
write(p,t)

# 6) Storage schema + version.
p=Path('src/v3/storage.ts'); t=read(p); t=t.replace('const SCHEMA=16;','const SCHEMA=17;'); write(p,t)
p=Path('app.json'); t=read(p); t=t.replace('ETF財務管家 V3.7.4','ETF財務管家 V3.7.5').replace('"version": "3.7.4"','"version": "3.7.5"').replace('"runtimeVersion": "3.7.4"','"runtimeVersion": "3.7.5"').replace('"versionCode": 42','"versionCode": 43').replace('"buildNumber": "42"','"buildNumber": "43"'); write(p,t)
p=Path('src/v3/version.ts'); t=read(p); t=t.replace("APP_SEMVER='3.7.4'","APP_SEMVER='3.7.5'").replace('APP_BUILD=42','APP_BUILD=43'); write(p,t)

print('[PATCH] V3.7.5 broker accounting fix applied')
