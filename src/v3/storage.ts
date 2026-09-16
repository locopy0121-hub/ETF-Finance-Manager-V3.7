import AsyncStorage from '@react-native-async-storage/async-storage';
import { defaultAppSettings, loadAppState } from '../storage/appStorage';
import type { DividendFrequency, ETFItem, TradeMode, Transaction } from '../types/etf';
import { calculateETFSummary, calculatePurchaseCost } from '../utils/etfCalculators';
import { initialHoldings } from '../data/portfolio';
import { mergeUnifiedMonitorPreferences } from './monitoring';
import { defaultPageCardFields, defaultPageCardSpans, defaultV3Preferences, makeDefaultPageLayouts, seedLedgerFromHoldings, V3State } from './model';
import { defaultRegisteredNodes } from '../ui/universalRegistry';

export const V3_STATE_KEY='@etf-finance-manager/v3-state';
const KEY=V3_STATE_KEY;
const SCHEMA=18;

const LEGACY_FIELD_KEYS:Record<string,string>={
 totalInvestedCost:'historicalCashOutflow',
};
const normalizeFieldKey=(key:string)=>LEGACY_FIELD_KEYS[key]??key;
const normalizeFieldList=(raw:any, fallback:string[]=[])=>Array.isArray(raw)?Array.from(new Set(raw.map((x:any)=>normalizeFieldKey(String(x))))):fallback;

const validMode=(value:unknown):value is TradeMode=>value==='ROUND_LOT'||value==='ODD_LOT';
const inferMode=(shares:unknown):TradeMode=>{const n=Math.max(0,Number(shares)||0);return n>=1000&&n%1000===0?'ROUND_LOT':'ODD_LOT';};
const validFrequency=(value:unknown):value is DividendFrequency=>value===1||value===2||value===4||value===6||value===12;
function canonicalSellCharges(symbol:string,shares:number,price:number,mode:TradeMode){const tx:Transaction={id:'migration-probe',etfCode:symbol,type:'BUY',tradeMode:mode,shares,price,date:'2000-01-01'};const item:ETFItem={etfCode:symbol,name:symbol,currentPrice:price,liquidationTradeMode:mode,dividendFrequency:1,transactions:[tx],dividendRecords:[]};const s=calculateETFSummary(item);return {amount:s.currentMarketValue,fee:s.estimatedSellCommission,tax:s.estimatedSellTax};}

function mergeState(p:Partial<V3State>):V3State{
 const sourceSchema=Number((p as any).schemaVersion??0);
 const pp:any=p.preferences??{};
 const oldMarket=pp.market??{};
 const market={...defaultV3Preferences.market,...oldMarket,live:{...defaultV3Preferences.market.live,...(oldMarket.live??{}),refreshSeconds:Number(oldMarket.live?.refreshSeconds??oldMarket.refreshSeconds??defaultV3Preferences.market.live.refreshSeconds)},afterHours:{...defaultV3Preferences.market.afterHours,...(oldMarket.afterHours??{})},scheduleEnabled:oldMarket.scheduleEnabled??oldMarket.autoRefresh??defaultV3Preferences.market.scheduleEnabled,stopAll:Boolean(oldMarket.stopAll??false),autoRefresh:oldMarket.scheduleEnabled??oldMarket.autoRefresh??defaultV3Preferences.market.autoRefresh,refreshSeconds:Number(oldMarket.live?.refreshSeconds??oldMarket.refreshSeconds??defaultV3Preferences.market.refreshSeconds)};
 const rawAi=pp.ai??{}; const ai={...defaultV3Preferences.ai,enabled:rawAi.enabled??defaultV3Preferences.ai.enabled,showHeaderButton:rawAi.showHeaderButton??defaultV3Preferences.ai.showHeaderButton,confirmWrites:true,localParser:rawAi.localParser??defaultV3Preferences.ai.localParser,fontScale:Number(rawAi.fontScale??defaultV3Preferences.ai.fontScale)};
 const visibility={...defaultV3Preferences.visibility,...(pp.visibility??{})};
 const money={...defaultV3Preferences.money,...(pp.money??{}),currencyStyle:'plain' as const};
 const calendar={...defaultV3Preferences.calendar,...(pp.calendar??{})};
 const lifestyleProgress={...defaultV3Preferences.lifestyleProgress,...(pp.lifestyleProgress??{})};
 const ticker={...defaultV3Preferences.ticker,...(pp.ticker??{})};
 const dailyPnl={...defaultV3Preferences.dailyPnl,...(pp.dailyPnl??{})};
 const chartInteraction={...defaultV3Preferences.chartInteraction,...(pp.chartInteraction??{})};
 const pageCardFields={...defaultPageCardFields,...(pp.pageCardFields??{})} as any;
 for(const key of Object.keys(pageCardFields))pageCardFields[key]=normalizeFieldList(pageCardFields[key],(defaultPageCardFields as any)[key]??[]);
 const pageCardSpans={...defaultPageCardSpans,...(pp.pageCardSpans??{})};
 const homeRaw=Array.isArray(pp.homeCardFields)?pp.homeCardFields:defaultV3Preferences.homeCardFields;
 const home=homeRaw.map((row:any,i:number)=>normalizeFieldList(row,defaultV3Preferences.homeCardFields[i]??[]));
 const rawLayouts=(pp.pageLayouts&&typeof pp.pageLayouts==='object')?pp.pageLayouts:makeDefaultPageLayouts(home,pageCardFields);
 const pageLayouts=JSON.parse(JSON.stringify(rawLayouts));
 const requiredLayouts=makeDefaultPageLayouts(home,pageCardFields);
 for(const pageKey of Object.keys(requiredLayouts) as Array<keyof typeof requiredLayouts>){
  const target=(pageLayouts as any)[pageKey];const required=(requiredLayouts as any)[pageKey];
  if(!target){(pageLayouts as any)[pageKey]=JSON.parse(JSON.stringify(required));continue;}
  target.cards=Array.isArray(target.cards)?target.cards:[];
  const ids=new Set(target.cards.map((c:any)=>c.id));
  for(const requiredCard of required.cards??[])if(!ids.has(requiredCard.id))target.cards.push(JSON.parse(JSON.stringify(requiredCard)));
 }
 for(const layout of Object.values(pageLayouts) as any[]){
  for(const card of layout.cards??[]){
   card.kind=card.kind??'custom';
   card.fields=normalizeFieldList(card.fields,[]);
   card.fieldSpans=card.fieldSpans??{};
   card.fieldConfigs=card.fieldConfigs??{};
   card.fieldGap=Math.max(0,Math.min(32,Number(card.fieldGap??7)));
   for(const [legacy,current] of Object.entries(LEGACY_FIELD_KEYS)){
    if(card.fieldSpans[legacy]!=null&&card.fieldSpans[current]==null)card.fieldSpans[current]=card.fieldSpans[legacy];
    if(card.fieldConfigs[legacy]!=null&&card.fieldConfigs[current]==null)card.fieldConfigs[current]=card.fieldConfigs[legacy];
    delete card.fieldSpans[legacy];delete card.fieldConfigs[legacy];
   }
   if(card.chartConfig){
    card.chartConfig={enabled:card.kind==='chart'||card.kind==='mixed'||Boolean(card.chartConfig.enabled),chartType:'line',colorMode:'theme',fillOpacity:14,lineWidth:3,barRadius:4,showGrid:true,showAxis:true,showLabels:false,showLegend:true,animation:true,...card.chartConfig};
   }
   for(const key of card.fields??[]){
    const existing=card.fieldConfigs?.[key]??{};
    const span=existing.span??card.fieldSpans?.[key]??6;
    const baseLabel={visible:true,fontScale:100,fontWeight:'800',align:card.style?.align??'left',verticalAlign:'top'};
    const baseValue={visible:true,fontScale:100,fontWeight:'900',colorMode:'theme',align:card.style?.align??'left',verticalAlign:'bottom'};
    card.fieldConfigs[key]={span,height:'auto',labelValueGap:6,backgroundOpacity:3,radius:10,padding:8,effect:'none',effectStrength:35,paddingTop:existing.paddingTop??existing.padding??8,paddingRight:existing.paddingRight??existing.padding??8,paddingBottom:existing.paddingBottom??existing.padding??8,paddingLeft:existing.paddingLeft??existing.padding??8,...existing,label:{...baseLabel,lineHeightScale:125,...(existing.label??{})},value:{...baseValue,lineHeightScale:125,...(existing.value??{})}};
    card.fieldSpans[key]=span;
   }
  }
 }
 const dashboard=pageLayouts.dashboard;
 if(dashboard?.cards?.length){
  const hero=dashboard.cards.find((c:any)=>c.id==='dashboard-core-1')??dashboard.cards[0];
  if(hero&&sourceSchema<5){
   // V3.3.10: restore the V3.3.7 blueprint behavior without deleting custom cards.
   hero.x=0;hero.y=0;hero.w=dashboard.columns;hero.h=Math.max(3,Number(hero.h??2));
   hero.fields=['totalAssets','todayPnl','todayPnlPct'];
   hero.chartConfig={source:'intraday',metric:'totalAssets',range:120,showPoints:false,showZeroLine:false,chartType:'area',layout:'dataLeftChartRight',dataRatio:'1/2',...(hero.chartConfig??{}),enabled:true};
  }
 }
 const portfolio=pageLayouts.portfolio;
 if(portfolio&&!portfolio.cards?.some((c:any)=>c.role==='listTemplate'||c.id==='portfolio-list')){
  const src=portfolio.cards?.find((c:any)=>c.id==='portfolio-summary')??portfolio.cards?.[0];
  if(src){const clone=JSON.parse(JSON.stringify(src));clone.id='portfolio-list';clone.title='庫存清單模板';clone.role='listTemplate';clone.y=(src.y??0)+(src.h??2);portfolio.cards.push(clone);}
 }
 const portfolioList=portfolio?.cards?.find((c:any)=>c.role==='listTemplate'||c.id==='portfolio-list');
 if(portfolioList&&sourceSchema<13){
  const spans=(portfolioList.fields??[]).map((k:string)=>Number(portfolioList.fieldConfigs?.[k]?.span??portfolioList.fieldSpans?.[k]??6));
  const full=spans.filter((v:number)=>v===12).length;
  if(spans.length>=4&&full>=Math.ceil(spans.length*.6)){
   for(const key of portfolioList.fields??[]){
    const cfg=portfolioList.fieldConfigs?.[key]??{};
    if(Number(cfg.span??portfolioList.fieldSpans?.[key]??6)===12){portfolioList.fieldConfigs[key]={...cfg,span:6};portfolioList.fieldSpans[key]=6;}
   }
  }
 }
 const migratedEditorNodes=(pp.editorNodes&&typeof pp.editorNodes==='object')?{...pp.editorNodes}:{};
 if(sourceSchema<16){for(const id of Object.keys(migratedEditorNodes))if(id.startsWith('metric:daily-history:')||id.startsWith('metric:dividend-event:'))delete migratedEditorNodes[id];}
 const reconciledCash=Number((p as any).cashReconciliation?.actualBalance);
 const stripRemovedFinanceOverrides=(raw:any)=>{const rest={...raw};for(const key of Object.keys(rest))if(/^(feeRate|feeDiscount)$|broker.*profile/i.test(key))delete rest[key];return rest;};
 const normalizedHoldings=(Array.isArray(p.holdings)?p.holdings:[]).map((raw:any)=>{const rest=stripRemovedFinanceOverrides(raw);return {...rest,liquidationTradeMode:validMode(raw.liquidationTradeMode)?raw.liquidationTradeMode:inferMode(raw.shares),dividendFrequency:validFrequency(raw.dividendFrequency)?raw.dividendFrequency:1};});
 const rawLedger=(Array.isArray(p.ledger)&&p.ledger.length?p.ledger:seedLedgerFromHoldings(normalizedHoldings)).map((raw:any)=>{const rest=stripRemovedFinanceOverrides(raw);if(raw.kind!=='buy'&&raw.kind!=='sell')return rest;const shares=Math.max(0,Number(raw.shares)||0),price=Math.max(0,Number(raw.price)||0),tradeMode=validMode(raw.tradeMode)?raw.tradeMode:inferMode(shares);if(raw.kind==='buy'){const buy=calculatePurchaseCost({id:String(raw.id),etfCode:String(raw.symbol??''),type:'BUY',tradeMode,shares,price,date:String(raw.date??'')});return {...rest,tradeMode,amount:buy.tradeAmount,fee:buy.commission,tax:0};}const sell=canonicalSellCharges(String(raw.symbol??''),shares,price,tradeMode);return {...rest,tradeMode,amount:sell.amount,fee:sell.fee,tax:sell.tax};});
 return {
  schemaVersion:SCHEMA,
  holdings:normalizedHoldings,
  dividends:Array.isArray(p.dividends)?p.dividends:[],
  ledger:rawLedger,
  cashBalance:Number.isFinite(reconciledCash)?reconciledCash:Number(p.cashBalance??0),
  cashReconciliation:(p as any).cashReconciliation&&typeof (p as any).cashReconciliation==='object'?(p as any).cashReconciliation:{},
  preferences:{...defaultV3Preferences,...pp,market,ai,visibility,money,calendar,lifestyleProgress,ticker,dailyPnl,chartInteraction,themeId:pp.themeId??defaultV3Preferences.themeId,navDisplayMode:pp.navDisplayMode??defaultV3Preferences.navDisplayMode,iconDisplay:{...defaultV3Preferences.iconDisplay,...(pp.iconDisplay??{})},customThemes:Array.isArray(pp.customThemes)?pp.customThemes.slice(0,5):[],pageCardFields,pageCardSpans,homeCardFields:home,homeCardSpans:Array.isArray(pp.homeCardSpans)?pp.homeCardSpans:[{},{},{}],pageLayouts,selectedEtfFields:normalizeFieldList(pp.selectedEtfFields,defaultV3Preferences.selectedEtfFields),selectedEtfFieldSpans:(pp.selectedEtfFieldSpans&&typeof pp.selectedEtfFieldSpans==='object')?pp.selectedEtfFieldSpans:{},selectedEtfSymbols:Array.isArray(pp.selectedEtfSymbols)?pp.selectedEtfSymbols:[],watchlistSymbols:normalizeFieldList(pp.watchlistSymbols,[]),globalEditMode:Boolean(pp.globalEditMode??false),editorPresets:Array.isArray(pp.editorPresets)?pp.editorPresets.slice(-30):[],editorNodes:{...defaultRegisteredNodes(),...migratedEditorNodes},holdingFocusSort:pp.holdingFocusSort??defaultV3Preferences.holdingFocusSort,holdingFocusMax:Number(pp.holdingFocusMax??defaultV3Preferences.holdingFocusMax),holdingFocusOnDashboard:pp.holdingFocusOnDashboard??defaultV3Preferences.holdingFocusOnDashboard,holdingFocusOnPortfolio:pp.holdingFocusOnPortfolio??defaultV3Preferences.holdingFocusOnPortfolio,pageTitles:(pp.pageTitles&&typeof pp.pageTitles==='object')?pp.pageTitles:{},customMetrics:Array.isArray(pp.customMetrics)?pp.customMetrics:[],monitoring:mergeUnifiedMonitorPreferences(pp.monitoring)},
  appSettings:{...defaultAppSettings,...(p.appSettings??{}),widget:{...defaultAppSettings.widget,...(p.appSettings?.widget??{})},ota:{...defaultAppSettings.ota,...(p.appSettings?.ota??{})},goals:{...defaultAppSettings.goals,...(p.appSettings?.goals??{})},closeNotification:{...defaultAppSettings.closeNotification,...(p.appSettings?.closeNotification??{})},layout:{...defaultAppSettings.layout,...(p.appSettings?.layout??{})}},
  dailySnapshots:Array.isArray(p.dailySnapshots)?p.dailySnapshots:[],
  intradayPnlPoints:Array.isArray((p as any).intradayPnlPoints)?(p as any).intradayPnlPoints:[],
  savingsPlans:Array.isArray((p as any).savingsPlans)?(p as any).savingsPlans:[],
  savedAt:Number(p.savedAt??Date.now()),
 };
}

export async function loadV3State():Promise<V3State>{
 try{
  const raw=await AsyncStorage.getItem(KEY);
  if(raw)return mergeState(JSON.parse(raw) as Partial<V3State>);
 }catch{}
 const old=await loadAppState();
 const holdings=old?.holdings?.length?old.holdings:initialHoldings;
 return mergeState({
  holdings,
  dividends:old?.dividendEvents??[],
  ledger:seedLedgerFromHoldings(holdings),
  cashBalance:0,
  cashReconciliation:{},
  preferences:{...defaultV3Preferences,fontScale:old?.settings?.layout?.fontScale??100,cardRadius:old?.settings?.layout?.cardRadius??16,cardOpacity:old?.settings?.layout?.cardOpacity??82,market:{...defaultV3Preferences.market,refreshSeconds:old?.settings?.widget?.refreshSeconds??5}},
  appSettings:old?.settings??defaultAppSettings,
  dailySnapshots:old?.dailySnapshots??[],
  intradayPnlPoints:[],
  savingsPlans:[],
  savedAt:Date.now(),
 });
}

export async function saveV3State(state:V3State){
 await AsyncStorage.setItem(KEY,JSON.stringify({...state,schemaVersion:SCHEMA,savedAt:Date.now()}));
}

export function normalizeImportedV3State(input:unknown):V3State{
 if(!input||typeof input!=='object')throw new Error('備份內容不是有效的 V3 資料。');
 return mergeState(input as Partial<V3State>);
}
