import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { Holding } from '../data/portfolio';
import type { DividendEvent } from '../screens/DividendCalendarScreen';
import type { LedgerEntry, V3Preferences } from '../v3/model';
import type { MonitorField } from '../v3/monitoring';
import { monitorTemplate } from '../v3/monitorTemplates';
import { createMonitorSnapshot } from '../engine/createMonitorSnapshot';
import { DEFAULT_MINI_LAYOUT, DEFAULT_NORMAL_LAYOUT, type MarketStatus, type MonitorInstanceState, type WindowRect } from '../types/monitor';

type NativeOverlay={
 hasOverlayPermission:()=>boolean;requestOverlayPermission:()=>boolean;start:(payload:string)=>boolean;update:(payload:string)=>boolean;stop:()=>boolean;
 getLayoutSnapshot:()=>string;setLayoutSize:(width:number,height:number)=>boolean;setLayoutRect?:(mode:'NORMAL'|'MINI',x:number,y:number,width:number,height:number)=>boolean;setMinimized?:(value:boolean)=>boolean;
};
type NativeLayoutState={normalLayout:WindowRect;miniLayout:WindowRect;isMinimized:boolean};
const Native:NativeOverlay|null=Platform.OS==='android'?requireOptionalNativeModule<NativeOverlay>('FloatingInvestmentBot'):null;

export function hasFloatingOverlayPermission(){try{return !!Native?.hasOverlayPermission()}catch{return false}}
export function requestFloatingOverlayPermission(){try{return !!Native?.requestOverlayPermission()}catch{return false}}
export function stopFloatingOverlay(){try{return !!Native?.stop()}catch{return false}}

const normalizeRect=(value:Partial<WindowRect>|undefined,fallback:WindowRect):WindowRect=>({
 x:Number.isFinite(value?.x)?Number(value?.x):fallback.x,
 y:Number.isFinite(value?.y)?Number(value?.y):fallback.y,
 width:Math.max(48,Number.isFinite(value?.width)?Number(value?.width):fallback.width),
 height:Math.max(36,Number.isFinite(value?.height)?Number(value?.height):fallback.height),
});

export function getFloatingOverlayLayoutState():NativeLayoutState|undefined{
 try{
  const raw=Native?.getLayoutSnapshot?.();if(!raw)return undefined;const parsed=JSON.parse(raw);
  return {normalLayout:normalizeRect(parsed.normalLayout,DEFAULT_NORMAL_LAYOUT),miniLayout:normalizeRect(parsed.miniLayout,DEFAULT_MINI_LAYOUT),isMinimized:parsed.isMinimized===true};
 }catch{return undefined}
}
// App 回前景只同步 normal 尺寸，禁止 Mini 尺寸倒灌舊 width/height。
export function getFloatingOverlayLayoutSize(){const state=getFloatingOverlayLayoutState();return state?{width:state.normalLayout.width,height:state.normalLayout.height}:undefined}
export function setFloatingOverlayLayoutSize(width:number,height:number){try{return !!Native?.setLayoutSize?.(Math.max(120,Math.round(width)),Math.max(48,Math.round(height)))}catch{return false}}
export function setFloatingOverlayLayoutRect(mode:'NORMAL'|'MINI',rect:WindowRect){try{return !!Native?.setLayoutRect?.(mode,Math.round(rect.x),Math.round(rect.y),Math.round(rect.width),Math.round(rect.height))}catch{return false}}
export function setFloatingOverlayMinimized(value:boolean){try{return !!Native?.setMinimized?.(value)}catch{return false}}

const marketStatusFrom=(marketState:string):MarketStatus=>{
 const s=marketState.toUpperCase();
 if(s.includes('盤前')||s.includes('PRE'))return 'PRE_MARKET';
 if(s.includes('盤後')||s.includes('POST'))return 'POST_MARKET';
 if(s.includes('盤中')||s.includes('OPEN'))return 'OPEN';
 return 'CLOSED';
};

export function floatingOverlayPayload(args:{prefs:V3Preferences;holdings:Holding[];quotes:Record<string,any>;ledger:LedgerEntry[];dividends:DividendEvent[];cashBalance:number;lastSuccessAt?:number;marketState:string;monitorInstance?:MonitorInstanceState}){
 const {prefs,holdings,quotes,ledger,dividends,cashBalance,lastSuccessAt,marketState,monitorInstance}=args;
 const profile=prefs.monitoring?.floating;
 const snapshot=createMonitorSnapshot({holdings,quotes,ledger,dividends,cashBalance,timestamp:lastSuccessAt??Date.now(),marketStatus:marketStatusFrom(marketState)});
 const m=snapshot.portfolioSummary as any;
 const normalLayout=normalizeRect(monitorInstance?.normalLayout,{...DEFAULT_NORMAL_LAYOUT,width:profile?.width??DEFAULT_NORMAL_LAYOUT.width,height:profile?.height??DEFAULT_NORMAL_LAYOUT.height});
 const miniLayout=normalizeRect(monitorInstance?.miniLayout,DEFAULT_MINI_LAYOUT);
 const isMinimized=monitorInstance?.isMinimized??false;
 const selectedSymbols=profile?.selectedSymbols??[];
 const sourceSymbols=profile?.symbolSource==='watchlist'?prefs.watchlistSymbols:profile?.symbolSource==='all'?Array.from(new Set([...Object.keys(snapshot.rawQuotes),...prefs.watchlistSymbols,...holdings.map(h=>h.symbol)])):holdings.map(h=>h.symbol);
 const wanted=selectedSymbols.length?sourceSymbols.filter(x=>selectedSymbols.includes(x)):sourceSymbols;
 const selected=Array.from(new Set(wanted));
 const rowLimit=Math.max(1,Math.min(30,profile?.maxSymbols??6));
 const allPositions=selected.map(symbol=>{
  const h=holdings.find(x=>x.symbol===symbol);const q=(snapshot.rawQuotes[symbol] as any)??{};const hm=(snapshot.etfSummaries[symbol] as any)??{};
  if(!h)return {symbol,name:String(hm.name??q.name??symbol),shares:0,price:Number(hm.price??q.price??0),previousClose:Number(hm.previousClose??q.previousClose??q.price??0),open:Number(q.open??0),high:Number(q.high??0),low:Number(q.low??0),volume:Number(q.volume??0),limitUp:Number(q.limitUp??0),limitDown:Number(q.limitDown??0),pureCost:0,marketValue:0,instantPnl:0,instantRoi:0,nav:Number(q.nav??0),premium:Number(q.nav??0)>0?(Number(q.price??0)/Number(q.nav)-1)*100:0,todayPnl:0,todayPnlPct:Number(hm.changePct??q.changePercent??0),change:Number(hm.change??q.change??Number(q.price??0)-Number(q.previousClose??q.price??0)),changePct:Number(hm.changePct??q.changePercent??0)};
  return {symbol:h.symbol,name:h.name,shares:h.shares,price:Number(hm.price??0),previousClose:Number(hm.previousClose??hm.price??0),open:Number(hm.open??0),high:Number(hm.high??0),low:Number(hm.low??0),volume:Number(hm.volume??0),limitUp:Number(q.limitUp??0),limitDown:Number(q.limitDown??0),pureCost:Number(hm.pureCost??0),marketValue:Number(hm.marketValue??0),instantPnl:Number(hm.pnl??0),instantRoi:Number(hm.roi??0),nav:Number(hm.nav??0),premium:Number(hm.nav??0)>0?(Number(hm.price??0)/Number(hm.nav)-1)*100:0,todayPnl:Number(hm.todayPnl??0),todayPnlPct:Number(hm.todayPnlPct??0),change:Number(hm.price??0)-Number(hm.previousClose??hm.price??0),changePct:Number(hm.previousClose??hm.price??0)>0?(Number(hm.price??0)/Number(hm.previousClose??hm.price??0)-1)*100:0};
 });
 const positions=[...allPositions];
 if(profile?.sortMode==='changePct')positions.sort((a,b)=>b.changePct-a.changePct);else if(profile?.sortMode==='premium')positions.sort((a,b)=>b.premium-a.premium);else if(selectedSymbols?.length){const rank=new Map<string,number>(selectedSymbols.map((s,i)=>[s,i] as [string,number]));positions.sort((a,b)=>(rank.get(a.symbol)??999)-(rank.get(b.symbol)??999));}
 positions.splice(rowLimit);
 const d0=new Date(),today=`${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,'0')}-${String(d0.getDate()).padStart(2,'0')}`;const upcoming=dividends.filter(d=>d.payDate&&d.payDate>=today).sort((a,b)=>String(a.payDate).localeCompare(String(b.payDate)))[0];
 const template=monitorTemplate(profile?.displayMode??'holdingList');const modeConfig=isMinimized?template.miniConfig:template.normalConfig;
 const fields:MonitorField[]=[...(profile?.fieldsCustomized===true&&profile?.fields?.length?profile.fields:modeConfig.displayFields as MonitorField[])];fields.sort((a,b)=>(profile?.fieldStyles?.[a]?.order??999)-(profile?.fieldStyles?.[b]?.order??999));const activeLayout=isMinimized?miniLayout:normalLayout;
 return JSON.stringify({
  enabled:profile?.enabled??false,snapshotTimestamp:snapshot.timestamp,normalLayout,miniLayout,isMinimized,activeTemplateId:template.id,normalConfig:template.normalConfig,miniConfig:template.miniConfig,modeConfig,colorConfig:template.colorConfig,
  mode:template.nativeMode,displayMode:profile?.displayMode??'holdingList',template:template.id,templateFields:modeConfig.displayFields,title:profile?.title??'即時監控器',statusTitle:profile?.statusTitle??'市場狀態',showBreathingLight:profile?.showBreathingLight!==false,density:profile?.density??'auto',symbolSource:profile?.symbolSource??'holdings',resizeMode:profile?.resizeMode??'fluid',opacity:(profile?.activeOpacity??92)/100,idleOpacity:(profile?.idleOpacity??36)/100,scale:1,fontScale:(profile?.fontScale??100)/100,
  snap:profile?.snap??true,gridSnap:profile?.gridSnap??8,refreshSeconds:Math.max(0,Number(profile?.refreshSeconds??5)),rotateSeconds:Math.max(.5,4),width:activeLayout.width,height:activeLayout.height,minWidth:profile?.minWidth??120,minHeight:profile?.minHeight??48,maxHeightRatio:profile?.maxHeightRatio??.72,autoHeight:false,
  fontMin:8,fontMax:22,autoFont:false,dragHotspot:profile?.dragHotspot??'handle',dockMode:profile?.dockMode??'peek',locked:profile?.locked??false,haptics:profile?.haptics??true,doubleTapLayout:true,tapAction:'none',scrollAfterRows:profile?.scrollAfterRows??5,moneyMode:prefs.money.moneyMode,moneyDigits:prefs.money.moneyDigits,customMoneyDigits:prefs.money.customMoneyDigits,
  fields,fieldStyles:profile?.fieldStyles??{},uiNodes:prefs.editorNodes??{},schedule:profile?.schedule??null,pinnedFields:['symbol'],rows:profile?.maxSymbols??6,symbolStyle:'inventory',background:modeConfig.backgroundColor,textColor:prefs.primaryTextColor??'#FFFFFF',borderColor:modeConfig.borderColor,borderWidth:modeConfig.borderWidth,radius:modeConfig.borderRadius,separators:profile?.separators!==false,zebra:profile?.zebra===true,showRefresh:profile?.showRefresh!==false,showLock:profile?.showLock!==false,showAdd:profile?.showAdd===true,alertChangePct:profile?.alertChangePct??3,alertPremiumPct:profile?.alertPremiumPct??1,
  healthy:!!lastSuccessAt&&Date.now()-lastSuccessAt<Math.max(20000,(prefs.market.live.refreshSeconds||1)*8000),accent:prefs.accentColor,positive:prefs.positiveColor,negative:prefs.negativeColor,neutral:'#F4D35E',colorSettings:{textPrimary:prefs.primaryTextColor??'#FFFFFF',gain:prefs.positiveColor,loss:prefs.negativeColor,neutral:'#F4D35E',limitUp:prefs.positiveColor,limitDown:prefs.negativeColor},
  instantPnl:Number(m.priceUnrealizedPnl??0),todayPnl:Number(m.todayPnl??0),totalAssets:Number(m.totalAssets??0),marketValue:Number(m.marketValue??0),cashBalance:Number(m.cashBalance??cashBalance),totalCost:Number(m.currentTradeCost??0),totalRoi:Number(m.currentTradeCost??0)>0?Number(m.priceUnrealizedPnl??0)/Number(m.currentTradeCost)*100:0,marketState,updatedAt:lastSuccessAt?new Date(lastSuccessAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'--:--:--',dividendSymbol:upcoming?.symbol??'',dividendDate:upcoming?.payDate??'',dividendAmount:Number(upcoming?.estimatedAmount??upcoming?.actualAmount??0),positions
 });
}
export function startOrUpdateFloatingOverlay(payload:string,start=false){if(!Native||!hasFloatingOverlayPermission())return false;try{return start?!!Native.start(payload):!!Native.update(payload)}catch{return false}}
