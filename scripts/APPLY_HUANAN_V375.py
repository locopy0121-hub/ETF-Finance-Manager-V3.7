from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text(encoding='utf-8')
def write(path,text): (ROOT/path).write_text(text,encoding='utf-8')
def rep(text,old,new,label):
    if old not in text:
        raise SystemExit(f'[HUANAN] missing anchor: {label}')
    return text.replace(old,new,1)

# -----------------------------------------------------------------------------
# Broker profile + Huanan calculation helpers
# -----------------------------------------------------------------------------
p=Path('src/data/tradeSettings.ts'); t=read(p)
t=rep(t,"export type FeeDiscountMode = 'instant' | 'monthlyRebate';","export type BrokerProfileId = 'custom' | 'huanan-yongchang';\nexport type FeeDiscountMode = 'instant' | 'monthlyRebate';",'BrokerProfileId')
t=rep(t,"export type FeeSettings = {\n  brokerName: string;","export type FeeSettings = {\n  brokerProfileId?: BrokerProfileId;\n  brokerName: string;",'FeeSettings profile')
t=rep(t,"export const defaultFeeSettings: FeeSettings = {\n  brokerName: '自訂券商',","export const defaultFeeSettings: FeeSettings = {\n  brokerProfileId: 'custom',\n  brokerName: '自訂券商',",'default profile')
old="""export function makeHuananFeeSettings(args:{discount:number;minimumFee:number;discountMode?:FeeDiscountMode;orderChannel?:OrderChannel;lotType?:TradeLotType}):FeeSettings{
  return {
    brokerName:'華南永昌證券',
    feeRate:0.001425,
    discount:args.discount,
    minimumFee:args.minimumFee,
    discountMode:args.discountMode??'monthlyRebate',
    orderChannel:args.orderChannel??'electronic',
    lotType:args.lotType??'board',
    etfSellTaxRate:0.001,
  };
}
"""
new="""export function makeHuananFeeSettings(args:{discount?:number;minimumFee?:number;discountMode?:FeeDiscountMode;orderChannel?:OrderChannel;lotType?:TradeLotType}={}):FeeSettings{
  return {
    brokerProfileId:'huanan-yongchang',
    brokerName:'華南永昌證券',
    feeRate:0.001425,
    discount:args.discount??1,
    minimumFee:args.minimumFee??1,
    // Photo-derived baseline: calculate each trade independently. Historical broker
    // corrections are recorded as explicit cost write-offs, never hard-coded here.
    discountMode:args.discountMode??'instant',
    orderChannel:args.orderChannel??'electronic',
    lotType:args.lotType??'board',
    etfSellTaxRate:0.001,
  };
}

export const huananYongchangFeeSettings:FeeSettings=makeHuananFeeSettings();
export function isHuananBroker(value?:string){return String(value??'').replace(/\\s+/g,'').includes('華南永昌');}
export function resolveBrokerFeeSettings(broker:string|undefined,settings:FeeSettings=defaultFeeSettings):FeeSettings{
  if(settings.brokerProfileId==='huanan-yongchang')return settings;
  return isHuananBroker(broker)?huananYongchangFeeSettings:settings;
}
export function truncateTowardZero(value:number,digits=2){
  if(!Number.isFinite(value))return 0;
  const f=10**Math.max(0,Math.trunc(digits));
  return Math.trunc(value*f)/f;
}
export type BrokerBookValueEstimate={grossAmount:number;sellFee:number;sellTax:number;bookValue:number};
export function estimateBrokerBookValue(tradeAmount:number,settings:FeeSettings):BrokerBookValueEstimate{
  const grossAmount=Math.floor(Math.max(0,Number(tradeAmount)||0));
  if(grossAmount<=0)return {grossAmount:0,sellFee:0,sellTax:0,bookValue:0};
  const sellFee=estimateSellFee(grossAmount,settings);
  const sellTax=estimateSellTaxBySettings(grossAmount,settings);
  return {grossAmount,sellFee,sellTax,bookValue:grossAmount-sellFee-sellTax};
}
"""
t=rep(t,old,new,'Huanan profile helper')
write(p,t)

# -----------------------------------------------------------------------------
# Ledger model: cost write-off is an auditable event, not a mutation of the buy.
# -----------------------------------------------------------------------------
p=Path('src/v3/model.ts'); t=read(p)
t=rep(t,"export type LedgerKind = 'buy' | 'sell' | 'dividend' | 'cashIn' | 'cashOut';","export type LedgerKind = 'buy' | 'sell' | 'dividend' | 'cashIn' | 'cashOut' | 'costAdjustment';",'LedgerKind costAdjustment')
write(p,t)

# -----------------------------------------------------------------------------
# Finance engine: apply cost write-offs and Huanan net-book P/L selectively.
# -----------------------------------------------------------------------------
p=Path('src/v3/engine.ts'); t=read(p)
t=rep(t,"import { LedgerEntry, type MoneyPreferences } from './model';","import { LedgerEntry, type MoneyPreferences } from './model';\nimport { defaultFeeSettings, estimateBrokerBookValue, resolveBrokerFeeSettings, truncateTowardZero, type FeeSettings } from '../data/tradeSettings';",'engine imports')
t=rep(t," realizedCashPnl:number;\n};"," realizedCashPnl:number;\n costAdjustments:number;\n};",'PositionCostStats adjustment')
anchor=""" const currentShares=Math.max(0,Number(h.shares??poolShares));
 if(Math.abs(currentShares-poolShares)>1e-6&&poolShares>0){"""
insert=""" const costAdjustments=ledger.filter(e=>e.kind==='costAdjustment'&&e.symbol===h.symbol).reduce((sum,e)=>sum+Math.max(0,Number(e.amount??0)),0);
 if(costAdjustments>0){
  historicalBuyFees=Math.max(0,historicalBuyFees-costAdjustments);
  poolBuyFees=Math.max(0,poolBuyFees-costAdjustments);
 }
 const currentShares=Math.max(0,Number(h.shares??poolShares));
 if(Math.abs(currentShares-poolShares)>1e-6&&poolShares>0){"""
t=rep(t,anchor,insert,'cost adjustment application')
t=rep(t,"realizedPricePnl,realizedCashPnl};","realizedPricePnl,realizedCashPnl,costAdjustments};",'position return adjustment')

old="""export function portfolioMetrics(holdings:Holding[],quotes:Record<string,QuoteLike>,cashBalance:number,ledger:LedgerEntry[],dividends:DividendEvent[]){
 let currentTradeCost=0,currentAllocatedBuyFees=0,currentCashBasis=0,marketValue=0,todayPnl=0,previousValue=0;
 let historicalTradeCost=0,historicalBuyFees=0,historicalCashOutflow=0,realizedPricePnl=0,realizedCashPnl=0;"""
new="""export function portfolioMetrics(holdings:Holding[],quotes:Record<string,QuoteLike>,cashBalance:number,ledger:LedgerEntry[],dividends:DividendEvent[],feeSettings:FeeSettings=defaultFeeSettings){
 let currentTradeCost=0,currentAllocatedBuyFees=0,currentCashBasis=0,marketValue=0,todayPnl=0,previousValue=0;
 let brokerBookValue=0,brokerUnrealizedPnl=0,costAdjustments=0;
 let historicalTradeCost=0,historicalBuyFees=0,historicalCashOutflow=0,realizedPricePnl=0,realizedCashPnl=0;"""
t=rep(t,old,new,'portfolio signature')
old="""  const c=positionCostStats(h,ledger); const price=quotePrice(h,quotes); const value=price*h.shares; const prev=Number(quotes[h.symbol]?.previousClose??price);
  currentTradeCost+=c.currentTradeCost; currentAllocatedBuyFees+=c.currentAllocatedBuyFees; currentCashBasis+=c.currentCashBasis;
  historicalTradeCost+=c.historicalTradeCost; historicalBuyFees+=c.historicalBuyFees; historicalCashOutflow+=c.historicalCashOutflow;
  realizedPricePnl+=c.realizedPricePnl; realizedCashPnl+=c.realizedCashPnl;
  marketValue+=value; previousValue+=prev*h.shares; todayPnl+=(price-prev)*h.shares;"""
new="""  const c=positionCostStats(h,ledger); const price=quotePrice(h,quotes); const value=price*h.shares; const prev=Number(quotes[h.symbol]?.previousClose??price);
  const localSettings=resolveBrokerFeeSettings(h.broker,feeSettings); const huanan=localSettings.brokerProfileId==='huanan-yongchang'; const book=estimateBrokerBookValue(value,localSettings); const effectiveBook=huanan?book.bookValue:value;
  currentTradeCost+=c.currentTradeCost; currentAllocatedBuyFees+=c.currentAllocatedBuyFees; currentCashBasis+=c.currentCashBasis;
  historicalTradeCost+=c.historicalTradeCost; historicalBuyFees+=c.historicalBuyFees; historicalCashOutflow+=c.historicalCashOutflow; costAdjustments+=c.costAdjustments;
  realizedPricePnl+=c.realizedPricePnl; realizedCashPnl+=c.realizedCashPnl;
  marketValue+=value; brokerBookValue+=effectiveBook; brokerUnrealizedPnl+=effectiveBook-c.currentCashBasis; previousValue+=prev*h.shares; todayPnl+=(price-prev)*h.shares;"""
t=rep(t,old,new,'portfolio Huanan loop')
t=rep(t," const comprehensivePnl=cashUnrealizedPnl+realizedCashPnl+cumulativeDividends;"," const comprehensivePnl=brokerUnrealizedPnl+realizedCashPnl+cumulativeDividends;",'portfolio broker pnl')
t=rep(t,"  marketValue,cashBalance,totalAssets,accountEquity,priceUnrealizedPnl,cashUnrealizedPnl,realizedPricePnl,realizedCashPnl,pricePnl,cumulativeDividends,totalPnl,totalRoi,priceRoi,todayPnl,todayPnlPct,pendingDividends,holdingCount:holdings.length,comprehensivePnl,","  marketValue,brokerBookValue,brokerUnrealizedPnl,costAdjustments,cashBalance,totalAssets,accountEquity,priceUnrealizedPnl,cashUnrealizedPnl,realizedPricePnl,realizedCashPnl,pricePnl,cumulativeDividends,totalPnl,totalRoi,priceRoi,todayPnl,todayPnlPct,pendingDividends,holdingCount:holdings.length,comprehensivePnl,",'portfolio broker fields')
t=rep(t,"  totalInvestedCost:historicalCashOutflow,currentCost:currentCashBasis,pureCost:currentTradeCost,totalFees:historicalBuyFees,unrealizedPnl:cashUnrealizedPnl,realizedPnl:realizedCashPnl,","  totalInvestedCost:historicalCashOutflow,currentCost:currentCashBasis,pureCost:currentTradeCost,totalFees:historicalBuyFees,unrealizedPnl:brokerUnrealizedPnl,realizedPnl:realizedCashPnl,",'portfolio default pnl')

old="""export function holdingMetrics(h:Holding,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[]=[],dividends:DividendEvent[]=[]){
 const q=quotes[h.symbol]??{}; const price=quotePrice(h,quotes), c=positionCostStats(h,ledger), marketValue=price*h.shares;
 const pricePnl=marketValue-c.currentTradeCost;
 const cashPnl=marketValue-c.currentCashBasis;
 const priceRoi=c.currentTradeCost>0?pricePnl/c.currentTradeCost*100:0;
 const cashRoi=c.currentCashBasis>0?cashPnl/c.currentCashBasis*100:0;
 const pnl=cashPnl;
 const roi=cashRoi;"""
new="""export function holdingMetrics(h:Holding,quotes:Record<string,QuoteLike>,ledger:LedgerEntry[]=[],dividends:DividendEvent[]=[],feeSettings:FeeSettings=defaultFeeSettings){
 const q=quotes[h.symbol]??{}; const price=quotePrice(h,quotes), c=positionCostStats(h,ledger), marketValue=price*h.shares;
 const localSettings=resolveBrokerFeeSettings(h.broker,feeSettings),huanan=localSettings.brokerProfileId==='huanan-yongchang',book=estimateBrokerBookValue(marketValue,localSettings),brokerBookValue=huanan?book.bookValue:marketValue;
 const pricePnl=marketValue-c.currentTradeCost;
 const cashPnl=marketValue-c.currentCashBasis;
 const brokerPnl=brokerBookValue-c.currentCashBasis;
 const priceRoi=c.currentTradeCost>0?pricePnl/c.currentTradeCost*100:0;
 const cashRoi=c.currentCashBasis>0?cashPnl/c.currentCashBasis*100:0;
 const brokerRoi=c.currentCashBasis>0?brokerPnl/c.currentCashBasis*100:0;
 const pnl=huanan?brokerPnl:cashPnl;
 const roi=huanan?truncateTowardZero(brokerRoi,2):cashRoi;"""
t=rep(t,old,new,'holding Huanan formula')
t=rep(t," const comprehensivePnl=cashPnl+c.realizedCashPnl+cumulativeDividend;"," const comprehensivePnl=pnl+c.realizedCashPnl+cumulativeDividend;",'holding comprehensive')
t=rep(t,"  marketValue,pnl,pricePnl,cashPnl,roi,priceRoi,cashRoi,comprehensivePnl,comprehensiveRoi,\n  avgCost:c.avgTradePrice,\n  cashAvgCost:h.shares>0?c.currentCashBasis/h.shares:0,","  marketValue,brokerBookValue,brokerSellFee:book.sellFee,brokerSellTax:book.sellTax,brokerPnl,costAdjustments:c.costAdjustments,pnl,pricePnl,cashPnl,roi,priceRoi,cashRoi,brokerRoi,comprehensivePnl,comprehensiveRoi,\n  avgCost:huanan?truncateTowardZero(h.shares>0?c.currentCashBasis/h.shares:0,2):c.avgTradePrice,\n  cashAvgCost:huanan?truncateTowardZero(h.shares>0?c.currentCashBasis/h.shares:0,2):(h.shares>0?c.currentCashBasis/h.shares:0),",'holding return fields')
write(p,t)

# -----------------------------------------------------------------------------
# App state/actions: a write-off raises cash AND lowers effective cost.
# -----------------------------------------------------------------------------
p=Path('App.tsx'); t=read(p)
t=rep(t,"const ledgerCash=(ledger:LedgerEntry[])=>ledger.reduce((bal,e)=>e.kind==='cashIn'?bal+Number(e.amount||0):e.kind==='cashOut'?bal-Number(e.amount||0):e.kind==='buy'?bal-Number(e.amount||0)-Number(e.fee||0):e.kind==='sell'?bal+Number(e.amount||0)-Number(e.fee||0)-Number(e.tax||0):e.kind==='dividend'?bal+Number(e.amount||0):bal,0);","const ledgerCash=(ledger:LedgerEntry[])=>ledger.reduce((bal,e)=>e.kind==='cashIn'?bal+Number(e.amount||0):e.kind==='cashOut'?bal-Number(e.amount||0):e.kind==='buy'?bal-Number(e.amount||0)-Number(e.fee||0):e.kind==='sell'?bal+Number(e.amount||0)-Number(e.fee||0)-Number(e.tax||0):e.kind==='dividend'?bal+Number(e.amount||0):e.kind==='costAdjustment'?bal+Number(e.amount||0):bal,0);",'ledger cash adjustment')
t=rep(t,"  const gross=records.reduce((a,r)=>a+r.shares,0),pure=records.reduce((a,r)=>a+r.purchaseCost,0),fees=records.reduce((a,r)=>a+r.fee,0),sold=ledger.filter","  const gross=records.reduce((a,r)=>a+r.shares,0),pure=records.reduce((a,r)=>a+r.purchaseCost,0),rawFees=records.reduce((a,r)=>a+r.fee,0),adjustments=ledger.filter(e=>e.kind==='costAdjustment'&&e.symbol===symbol).reduce((a,e)=>a+Number(e.amount||0),0),fees=Math.max(0,rawFees-adjustments),sold=ledger.filter",'rebuild adjusted fees')
anchor=""" const addCash=(x:{amount:number;date:string;broker:string;account:string;note?:string})=>patch(s=>({...s,cashBalance:s.cashBalance+x.amount,ledger:[...s.ledger,{id:id(),kind:x.amount>=0?'cashIn':'cashOut',date:x.date,amount:Math.abs(x.amount),broker:x.broker||undefined,account:x.account||undefined,note:x.note}]}));"""
insert=""" const addCash=(x:{amount:number;date:string;broker:string;account:string;note?:string})=>patch(s=>({...s,cashBalance:s.cashBalance+x.amount,ledger:[...s.ledger,{id:id(),kind:x.amount>=0?'cashIn':'cashOut',date:x.date,amount:Math.abs(x.amount),broker:x.broker||undefined,account:x.account||undefined,note:x.note}]}));
 const addCostAdjustment=(x:{symbol:string;amount:number;date:string;broker:string;account:string;note?:string})=>patch(s=>{const h=s.holdings.find(z=>z.symbol===x.symbol);const amount=Math.max(0,Math.floor(Number(x.amount)||0));if(!h||amount<=0){Alert.alert('沖銷失敗','請選擇目前持有 ETF 並輸入大於 0 的沖銷金額。');return s;}const hm=holdingMetrics(h,{},s.ledger,s.dividends,s.feeSettings);if(amount>hm.totalFees+1e-9){Alert.alert('沖銷失敗',`沖銷金額不可大於目前可調整買進手續費 ${money(hm.totalFees)} 元。`);return s;}const e:LedgerEntry={id:id(),kind:'costAdjustment',symbol:x.symbol,name:h.name,date:x.date,amount,broker:x.broker||h.broker,account:x.account||h.account,note:x.note||'券商成本沖銷'};const ledger=[...s.ledger,e];return {...s,ledger,holdings:rebuildHoldingsFromLedger(s.holdings,ledger,[x.symbol]),cashBalance:s.cashBalance+amount};});"""
t=rep(t,anchor,insert,'addCostAdjustment')
t=rep(t," {tab==='ledger'?<LedgerScreen common={common} cashReconciliation={state.cashReconciliation} onReconcile={saveCashReconciliation} onBuy={addBuy} onSell={addSell} onCash={addCash} onDividend={addDividend}"," {tab==='ledger'?<LedgerScreen common={common} cashReconciliation={state.cashReconciliation} onReconcile={saveCashReconciliation} onBuy={addBuy} onSell={addSell} onCash={addCash} onCostAdjustment={addCostAdjustment} onDividend={addDividend}",'pass cost adjustment action')
write(p,t)

# -----------------------------------------------------------------------------
# Screens: profile selector + explicit cash/cost write-off flow.
# -----------------------------------------------------------------------------
p=Path('src/v3/screens.tsx'); t=read(p)
t=rep(t,"import { estimateBuyFee, estimateSellFee, estimateSellTaxBySettings, FeeSettings } from '../data/tradeSettings';","import { estimateBuyFee, estimateSellFee, estimateSellTaxBySettings, huananYongchangFeeSettings, FeeSettings } from '../data/tradeSettings';",'screens trade imports')
old="""export function LedgerScreen({common,cashReconciliation,onReconcile,onBuy,onSell,onCash,onDividend,onUpdateLedger,onDeleteLedger,onSettings}:{common:ScreenCommon;cashReconciliation:CashReconciliation;onReconcile:(x:CashReconciliation)=>void;onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'|'swing';broker:string;account:string})=>void;onSell:(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number})=>void;onCash:(x:{amount:number;date:string;broker:string;account:string;note?:string})=>void;onDividend:(symbol:string,amount:number,date:string)=>void;onUpdateLedger:(x:LedgerEntry)=>void;onDeleteLedger:(id:string)=>void;onSettings:()=>void}){
 const {catalog,loading:catalogLoading,error:catalogError}=useEtfCatalog();
 const [kind,setKind]=useState<'buy'|'sell'|'dividend'|'cash'>('buy'); const first=common.holdings[0];"""
new="""export function LedgerScreen({common,cashReconciliation,onReconcile,onBuy,onSell,onCash,onCostAdjustment,onDividend,onUpdateLedger,onDeleteLedger,onSettings}:{common:ScreenCommon;cashReconciliation:CashReconciliation;onReconcile:(x:CashReconciliation)=>void;onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'|'swing';broker:string;account:string})=>void;onSell:(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number})=>void;onCash:(x:{amount:number;date:string;broker:string;account:string;note?:string})=>void;onCostAdjustment:(x:{symbol:string;amount:number;date:string;broker:string;account:string;note?:string})=>void;onDividend:(symbol:string,amount:number,date:string)=>void;onUpdateLedger:(x:LedgerEntry)=>void;onDeleteLedger:(id:string)=>void;onSettings:()=>void}){
 const {catalog,loading:catalogLoading,error:catalogError}=useEtfCatalog();
 const [kind,setKind]=useState<'buy'|'sell'|'dividend'|'cash'|'adjustment'>('buy'); const first=common.holdings[0];"""
t=rep(t,old,new,'LedgerScreen props')
t=rep(t,"const m=portfolioMetrics(common.holdings,common.quotes,common.cashBalance,common.ledger,common.dividends); const systemCash=common.ledger.reduce((bal,e)=>e.kind==='cashIn'?bal+Number(e.amount||0):e.kind==='cashOut'?bal-Number(e.amount||0):e.kind==='buy'?bal-Number(e.amount||0)-Number(e.fee||0):e.kind==='sell'?bal+Number(e.amount||0)-Number(e.fee||0)-Number(e.tax||0):e.kind==='dividend'?bal+Number(e.amount||0):bal,0);","const m=portfolioMetrics(common.holdings,common.quotes,common.cashBalance,common.ledger,common.dividends,common.feeSettings); const systemCash=common.ledger.reduce((bal,e)=>e.kind==='cashIn'?bal+Number(e.amount||0):e.kind==='cashOut'?bal-Number(e.amount||0):e.kind==='buy'?bal-Number(e.amount||0)-Number(e.fee||0):e.kind==='sell'?bal+Number(e.amount||0)-Number(e.fee||0)-Number(e.tax||0):e.kind==='dividend'?bal+Number(e.amount||0):e.kind==='costAdjustment'?bal+Number(e.amount||0):bal,0);",'Ledger metrics and cash')
old_submit=""" const submit=()=>{if(kind==='buy'){if(!symbol||tradeAmount<=0)return Alert.alert('資料不足','請輸入 ETF 代號、股數與實際成交價格。');onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,strategy,broker,account});}else if(kind==='sell'){if(!symbol||tradeAmount<=0)return Alert.alert('資料不足','請輸入 ETF、賣出股數與實際成交價格。');if(calcFee<0||calcTax<0||!(calcFee+calcTax<=tradeAmount))return Alert.alert('費稅錯誤','手續費與交易稅不可為負，且合計不可超過成交金額。');onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,tax:calcTax});}else if(kind==='dividend'){if(!symbol||Number(amount)<=0)return Alert.alert('資料不足','請輸入 ETF 與實收配息。');onDividend(symbol,Number(amount),dateText);}else{if(!Number(amount))return Alert.alert('資料不足','請輸入現金變動金額。');onCash({amount:Number(amount),date:dateText,broker,account,note:cashNote.trim()||undefined});}Alert.alert('完成','已寫入帳務資料。成交金額與費用會分開保存。');};"""
new_submit=""" const submit=()=>{if(kind==='buy'){if(!symbol||tradeAmount<=0)return Alert.alert('資料不足','請輸入 ETF 代號、股數與實際成交價格。');onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,strategy,broker,account});}else if(kind==='sell'){if(!symbol||tradeAmount<=0)return Alert.alert('資料不足','請輸入 ETF、賣出股數與實際成交價格。');if(calcFee<0||calcTax<0||!(calcFee+calcTax<=tradeAmount))return Alert.alert('費稅錯誤','手續費與交易稅不可為負，且合計不可超過成交金額。');onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,tax:calcTax});}else if(kind==='dividend'){if(!symbol||Number(amount)<=0)return Alert.alert('資料不足','請輸入 ETF 與實收配息。');onDividend(symbol,Number(amount),dateText);}else if(kind==='adjustment'){if(!symbol||Number(amount)<=0)return Alert.alert('資料不足','請選擇 ETF 並輸入券商退回的沖銷金額。');onCostAdjustment({symbol,date:dateText,amount:Number(amount),broker,account,note:cashNote.trim()||undefined});}else{if(!Number(amount))return Alert.alert('資料不足','請輸入現金變動金額。');onCash({amount:Number(amount),date:dateText,broker,account,note:cashNote.trim()||undefined});}Alert.alert('完成','已寫入帳務資料。原始成交紀錄保留，衍生成本與現金同步重新計算。');};"""
t=rep(t,old_submit,new_submit,'submit adjustment')
t=rep(t,"<View style={s.tabs}>{(['buy','sell','dividend','cash'] as const).map(k=><TouchableOpacity key={k} style={[s.tab,kind===k&&s.tabActive]} onPress={()=>setKind(k)}><Text style={[s.tabText,kind===k&&s.tabTextActive]}>{k==='buy'?'買進':k==='sell'?'賣出':k==='dividend'?'配息入帳':'現金資金'}</Text></TouchableOpacity>)}</View>","<View style={s.tabs}>{(['buy','sell','dividend','cash','adjustment'] as const).map(k=><TouchableOpacity key={k} style={[s.tab,kind===k&&s.tabActive]} onPress={()=>setKind(k)}><Text style={[s.tabText,kind===k&&s.tabTextActive]}>{k==='buy'?'買進':k==='sell'?'賣出':k==='dividend'?'配息入帳':k==='adjustment'?'現金沖銷':'現金資金'}</Text></TouchableOpacity>)}</View>",'tabs adjustment')
t=rep(t,"<Card><SectionTitle title={kind==='buy'?'新增買進紀錄':kind==='sell'?'新增賣出紀錄':kind==='dividend'?'新增配息入帳':'現金資金流水'}/>","<Card><SectionTitle title={kind==='buy'?'新增買進紀錄':kind==='sell'?'新增賣出紀錄':kind==='dividend'?'新增配息入帳':kind==='adjustment'?'券商成本沖銷':'現金資金流水'}/>",'section title adjustment')
t=rep(t,"{(kind==='dividend'||kind==='cash')?<><Field label={kind==='dividend'?'實收配息':'現金資金變動（正數存入、負數提出）'} value={amount} onChange={setAmount} keyboard=\"decimal-pad\" suffix=\"元\"/>{kind==='cash'?<><Field label=\"券商\" value={broker} onChange={setBroker}/><Field label=\"帳戶 / 交割戶\" value={account} onChange={setAccount}/><Field label=\"核帳備註\" value={cashNote} onChange={setCashNote}/><Text style={s.note}>現金資金為獨立帳目流水，用於核對證券 / 交割帳戶實際金額；不會修改 ETF 成本或損益，但會正確反映在證券帳戶總資產。</Text></>:null}</>:null}","{(kind==='dividend'||kind==='cash'||kind==='adjustment')?<><Field label={kind==='dividend'?'實收配息':kind==='adjustment'?'券商退回 / 沖銷金額':'現金資金變動（正數存入、負數提出）'} value={amount} onChange={setAmount} keyboard=\"decimal-pad\" suffix=\"元\"/>{kind==='cash'||kind==='adjustment'?<><Field label=\"券商\" value={broker} onChange={setBroker}/><Field label=\"帳戶 / 交割戶\" value={account} onChange={setAccount}/><Field label={kind==='adjustment'?'沖銷原因':'核帳備註'} value={cashNote} onChange={setCashNote}/><Text style={s.note}>{kind==='adjustment'?'券商成本沖銷會保留原始買進與手續費紀錄，只新增一筆調整事件：現金增加同額、目前持有成本降低同額；股數與成交價完全不變。':'現金資金為獨立帳目流水，用於核對證券 / 交割帳戶實際金額；一般現金進出不會修改 ETF 成本或損益。'}</Text></>:null}</>:null}",'adjustment input')
t=t.replace("x.kind==='buy'?'買':x.kind==='sell'?'賣':x.kind==='dividend'?'息':'現'","x.kind==='buy'?'買':x.kind==='sell'?'賣':x.kind==='dividend'?'息':x.kind==='costAdjustment'?'沖':'現'")
t=t.replace("const kindLabel=draft.kind==='buy'?'買進':draft.kind==='sell'?'賣出':draft.kind==='dividend'?'配息':draft.kind==='cashIn'?'現金存入':'現金提出';","const kindLabel=draft.kind==='buy'?'買進':draft.kind==='sell'?'賣出':draft.kind==='dividend'?'配息':draft.kind==='costAdjustment'?'券商成本沖銷':draft.kind==='cashIn'?'現金存入':'現金提出';")
t=t.replace("(draft.kind==='dividend'||draft.kind==='cashIn'||draft.kind==='cashOut')&&!(amount>0)","(draft.kind==='dividend'||draft.kind==='cashIn'||draft.kind==='cashOut'||draft.kind==='costAdjustment')&&!(amount>0)")
# Settings: explicit profile choice. Keep editable fields for future broker-specific account settings.
old_broker="""{section==='broker'?<><Card><SectionTitle title=\"券商手續費設定\" right=\"歷史交易不回寫\"/><Text style={s.note}>折扣係數支援小數暫態輸入：例如 0.65 = 65%（6.5 折）、0.28 = 28%（2.8 折）。只有失焦／完成輸入後才轉成數值，不會在輸入「0.」時把小數點吃掉。</Text></Card><Field label=\"預設券商\" value={feeSettings.brokerName} onChange={v=>onFeeChange({brokerName:v})}/><DecimalSettingField label=\"牌告手續費率\""""
new_broker="""{section==='broker'?<><Card><SectionTitle title=\"券商手續費設定\" right=\"歷史交易不回寫\"/><SettingRow label=\"券商運算 Profile\"><Choice active={(feeSettings.brokerProfileId??'custom')==='custom'} label=\"自訂券商\" onPress={()=>onFeeChange({brokerProfileId:'custom',brokerName:'自訂券商'})}/><Choice active={feeSettings.brokerProfileId==='huanan-yongchang'} label=\"華南永昌證券\" onPress={()=>onFeeChange({...huananYongchangFeeSettings})}/></SettingRow><Text style={s.note}>{feeSettings.brokerProfileId==='huanan-yongchang'?'華南永昌：每筆成交金額先無條件捨去至元，再逐筆計算手續費；多筆成本逐筆加總。成本均價與券商式報酬率顯示採小數二位向 0 截斷。特殊歷史差額不寫死在公式，請由「智慧記帳 → 現金沖銷」核平。':'折扣係數支援小數暫態輸入；歷史交易保留原始實際手續費。'}</Text></Card><Field label=\"預設券商\" value={feeSettings.brokerName} onChange={v=>onFeeChange({brokerName:v})}/><DecimalSettingField label=\"牌告手續費率\""""
t=rep(t,old_broker,new_broker,'broker profile settings')
write(p,t)

# -----------------------------------------------------------------------------
# Storage/version
# -----------------------------------------------------------------------------
p=Path('src/v3/storage.ts'); t=read(p); t=t.replace('const SCHEMA=16;','const SCHEMA=17;'); write(p,t)
p=Path('app.json'); t=read(p); t=t.replace('ETF財務管家 V3.7.4','ETF財務管家 V3.7.5').replace('"version": "3.7.4"','"version": "3.7.5"').replace('"runtimeVersion": "3.7.4"','"runtimeVersion": "3.7.5"').replace('"versionCode": 42','"versionCode": 43').replace('"buildNumber": "42"','"buildNumber": "43"'); write(p,t)
p=Path('src/v3/version.ts'); t=read(p); t=t.replace("APP_SEMVER='3.7.4'","APP_SEMVER='3.7.5'").replace('APP_BUILD=42','APP_BUILD=43'); write(p,t)

print('[HUANAN] V3.7.5 Huanan accounting + cost write-off patch applied')
