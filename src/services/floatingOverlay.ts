import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { Holding } from '../data/portfolio';
import type { DividendEvent } from '../screens/DividendCalendarScreen';
import type { LedgerEntry, V3Preferences } from '../v3/model';
import { holdingMetrics, portfolioMetrics } from '../v3/engine';
import type { MonitorField } from '../v3/monitoring';
import { monitorTemplate } from '../v3/monitorTemplates';

type NativeOverlay={hasOverlayPermission:()=>boolean;requestOverlayPermission:()=>boolean;start:(payload:string)=>boolean;update:(payload:string)=>boolean;stop:()=>boolean;getLayoutSnapshot:()=>string;setLayoutSize:(width:number,height:number)=>boolean};
const Native:NativeOverlay|null=Platform.OS==='android'?requireOptionalNativeModule<NativeOverlay>('FloatingInvestmentBot'):null;

export function hasFloatingOverlayPermission(){try{return !!Native?.hasOverlayPermission()}catch{return false}}
export function requestFloatingOverlayPermission(){try{return !!Native?.requestOverlayPermission()}catch{return false}}
export function stopFloatingOverlay(){try{return !!Native?.stop()}catch{return false}}
export function getFloatingOverlayLayoutSize(){try{const raw=Native?.getLayoutSnapshot?.();if(!raw)return undefined;const x=JSON.parse(raw);const width=Number(x.width),height=Number(x.height);return width>0&&height>0?{width,height}:undefined}catch{return undefined}}
export function setFloatingOverlayLayoutSize(width:number,height:number){try{return !!Native?.setLayoutSize?.(Math.max(120,Math.round(width)),Math.max(48,Math.round(height)))}catch{return false}}

export function floatingOverlayPayload(args:{prefs:V3Preferences;holdings:Holding[];quotes:Record<string,any>;ledger:LedgerEntry[];dividends:DividendEvent[];cashBalance:number;lastSuccessAt?:number;marketState:string}){
 const {prefs,holdings,quotes,ledger,dividends,cashBalance,lastSuccessAt,marketState}=args;
 const profile=prefs.monitoring?.floating,m=portfolioMetrics(holdings,quotes,cashBalance,ledger,dividends);
 const selectedSymbols=profile?.selectedSymbols??[];const sourceSymbols=profile?.symbolSource==='watchlist'?prefs.watchlistSymbols:profile?.symbolSource==='all'?Array.from(new Set([...Object.keys(quotes),...prefs.watchlistSymbols,...holdings.map(h=>h.symbol)])):holdings.map(h=>h.symbol);const wanted=selectedSymbols.length?sourceSymbols.filter(x=>selectedSymbols.includes(x)):sourceSymbols;const selected=Array.from(new Set(wanted));
 const rowLimit=Math.max(1,Math.min(30,profile?.maxSymbols??6)); const allPositions=selected.map(symbol=>{const h=holdings.find(x=>x.symbol===symbol);const q=quotes[symbol]??{};if(!h)return {symbol,name:String(q.name??symbol),shares:0,price:Number(q.price??0),previousClose:Number(q.previousClose??q.price??0),open:Number(q.open??0),high:Number(q.high??0),low:Number(q.low??0),volume:Number(q.volume??0),pureCost:0,marketValue:0,instantPnl:0,instantRoi:0,nav:Number(q.nav??0),premium:Number(q.nav??0)>0?(Number(q.price??0)/Number(q.nav)-1)*100:0,todayPnl:0,todayPnlPct:Number(q.changePercent??0),change:Number(q.change??Number(q.price??0)-Number(q.previousClose??q.price??0)),changePct:Number(q.changePercent??0)};
  const hm=holdingMetrics(h,quotes,ledger,dividends);
  return {
   symbol:h.symbol,name:h.name,shares:h.shares,price:hm.price,previousClose:Number(hm.previousClose??hm.price),
   open:Number(hm.open??0),high:Number(hm.high??0),low:Number(hm.low??0),volume:Number(hm.volume??0),
   pureCost:hm.pureCost,marketValue:hm.marketValue,instantPnl:hm.pnl,instantRoi:hm.roi,nav:Number(hm.nav??0),premium:Number(hm.nav??0)>0?(hm.price/Number(hm.nav)-1)*100:0,
   todayPnl:hm.todayPnl,todayPnlPct:hm.todayPnlPct,
   change:hm.price-Number(hm.previousClose??hm.price),
   changePct:Number(hm.previousClose??hm.price)>0?(hm.price/Number(hm.previousClose??hm.price)-1)*100:0
  };
 });
 const positions=[...allPositions];
 if(profile?.sortMode==='changePct')positions.sort((a,b)=>b.changePct-a.changePct);
 else if(profile?.sortMode==='premium')positions.sort((a,b)=>b.premium-a.premium);
 else if(selectedSymbols?.length){const rank=new Map<string,number>(selectedSymbols.map((s,i)=>[s,i] as [string,number]));positions.sort((a,b)=>(rank.get(a.symbol)??999)-(rank.get(b.symbol)??999));}
 positions.splice(rowLimit);
 const d0=new Date(),today=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,'0')}-${String(d0.getDate()).padStart(2,'0')}`;
 const upcoming=dividends.filter(d=>d.payDate&&d.payDate>=today).sort((a,b)=>String(a.payDate).localeCompare(String(b.payDate)))[0];
 const template=monitorTemplate(profile?.displayMode??'holdingList');
 const fields:MonitorField[]=[...(profile?.fieldsCustomized===true&&profile?.fields?.length?profile.fields:template.fields)];
 fields.sort((a,b)=>(profile?.fieldStyles?.[a]?.order??999)-(profile?.fieldStyles?.[b]?.order??999));
 return JSON.stringify({
  enabled:profile?.enabled??false,
  mode:template.nativeMode,displayMode:profile?.displayMode??'holdingList',template:template.id,templateFields:template.fields,title:profile?.title??'即時監控器',statusTitle:profile?.statusTitle??'市場狀態',showBreathingLight:profile?.showBreathingLight!==false,density:profile?.density??'auto',symbolSource:profile?.symbolSource??'holdings',resizeMode:profile?.resizeMode??'fluid',opacity:(profile?.activeOpacity??92)/100,idleOpacity:(profile?.idleOpacity??36)/100,scale:1,fontScale:(profile?.fontScale??100)/100,
  snap:profile?.snap??true,gridSnap:profile?.gridSnap??8,refreshSeconds:Math.max(0,Number(profile?.refreshSeconds??5)),rotateSeconds:Math.max(.5,4),
  width:profile?.width??390,height:profile?.height??240,minWidth:profile?.minWidth??120,minHeight:profile?.minHeight??48,maxHeightRatio:profile?.maxHeightRatio??.72,autoHeight:template.compact===true,
  fontMin:8,fontMax:22,autoFont:profile?.resizeMode==='scale',dragHotspot:profile?.dragHotspot??'handle',dockMode:profile?.dockMode??'peek',locked:profile?.locked??false,haptics:profile?.haptics??true,doubleTapLayout:profile?.doubleTapLayout??true,tapAction:'none',scrollAfterRows:profile?.scrollAfterRows??5,
  moneyMode:prefs.money.moneyMode,moneyDigits:prefs.money.moneyDigits,customMoneyDigits:prefs.money.customMoneyDigits,
  fields,fieldStyles:profile?.fieldStyles??{},uiNodes:prefs.editorNodes??{},schedule:profile?.schedule??null,pinnedFields:['symbol'],rows:profile?.maxSymbols??6,
  symbolStyle:'inventory',background:profile?.backgroundColor??'#08111F',textColor:prefs.primaryTextColor??'#FFFFFF',
  borderColor:profile?.borderColor??'#3AC7FF',borderWidth:profile?.borderWidth??1,radius:profile?.radius??16,separators:profile?.separators!==false,zebra:profile?.zebra===true,showRefresh:profile?.showRefresh!==false,showLock:profile?.showLock!==false,showAdd:profile?.showAdd===true,alertChangePct:profile?.alertChangePct??3,alertPremiumPct:profile?.alertPremiumPct??1,
  healthy:!!lastSuccessAt&&Date.now()-lastSuccessAt<Math.max(20000,(prefs.market.live.refreshSeconds||1)*8000),
  accent:prefs.accentColor,
  positive:prefs.positiveColor,negative:prefs.negativeColor,neutral:prefs.secondaryTextColor,
  instantPnl:m.priceUnrealizedPnl,todayPnl:m.todayPnl,totalAssets:m.totalAssets,marketValue:m.marketValue,cashBalance:m.cashBalance,totalCost:m.currentTradeCost,totalRoi:m.currentTradeCost>0?m.priceUnrealizedPnl/m.currentTradeCost*100:0,
  marketState,updatedAt:lastSuccessAt?new Date(lastSuccessAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--:--:--',
  dividendSymbol:upcoming?.symbol??'',dividendDate:upcoming?.payDate??'',dividendAmount:Number(upcoming?.estimatedAmount??upcoming?.actualAmount??0),positions
 });
}
export function startOrUpdateFloatingOverlay(payload:string,start=false){if(!Native||!hasFloatingOverlayPermission())return false;try{return start?!!Native.start(payload):!!Native.update(payload)}catch{return false}}
