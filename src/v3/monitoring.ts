import type {MiniLayoutType,MonitorColorConfig,TemplateModeConfig,WindowRect} from '../types/monitor';

export type MonitorDisplayMode='miniPnl'|'holdingList'|'dualColumn'|'cardMatrix'|'todayPnl'|'totalAssets'|'dividendReminder'|'watchlist'|'marketOverview'|'singleEtf'|'aiSummary'|'breathingLight';
export type MonitorSymbolSource='holdings'|'watchlist'|'all';
export type MonitorResizeMode='fluid'|'scale';
export type MonitorSortMode='custom'|'changePct'|'premium';
export type MonitorTapAction='openApp'|'toggleMetric'|'none';
export type MonitorDockMode='none'|'edge'|'peek';
export type MonitorFieldStyle={visible:boolean;order:number;fixed:boolean;fontScale:number;fontWeight:'normal'|'bold';textColor:string;backgroundColor:string;backgroundOpacity:number;align:'left'|'center'|'right';verticalAlign:'top'|'center'|'bottom';padding:number;radius:number;effect:'none'|'shadow'|'glow'|'outline';effectStrength:number;profitLossColor:boolean;positiveColor:string;negativeColor:string;neutralColor:string;limitUpTextColor?:string;limitUpBackgroundColor?:string;limitDownTextColor?:string;limitDownBackgroundColor?:string;};
export type MonitorSchedule={enabled:boolean;days:number[];start:string;end:string;mode:'manual'|'schedule'|'smart';hideAfterHours:boolean;};
export type MonitorField='symbol'|'name'|'price'|'nav'|'premium'|'change'|'changePct'|'shares'|'marketValue'|'pureCost'|'instantPnl'|'instantRoi'|'todayPnl'|'todayPnlPct'|'previousClose'|'open'|'high'|'low'|'volume'|'updatedAt'|'totalAssets'|'dividend';
export type PuzzleTile={id:string;kind:'portfolio'|'etf'|'dividend'|'market'|'ai';symbol?:string;x:number;y:number;w:number;h:number;fields:MonitorField[];};
export type MonitorProfile={
 enabled:boolean; customizeMode:boolean; displayMode:MonitorDisplayMode; resizeMode:MonitorResizeMode; symbolSource:MonitorSymbolSource;
 title:string;statusTitle:string;showBreathingLight:boolean;density:'auto'|'standard'|'compact';
 selectedSymbols:string[]; fields:MonitorField[]; fieldsCustomized:boolean; maxSymbols:number; sortMode:MonitorSortMode; groupTabs:boolean;
 fontScale:number; fontWeight:'normal'|'bold'; colorMode:'tw'|'us'|'contrast'; backgroundStyle:'solid'|'glass'; backgroundColor:string;
 activeOpacity:number; idleOpacity:number; radius:number; borderWidth:number; borderColor:string; shadow:boolean; separators:boolean; zebra:boolean;
 /** Legacy normal size mirrors kept for old settings screens. normalLayout is authoritative. */
 width:number; height:number; minWidth:number; minHeight:number; maxHeightRatio:number; snap:boolean; gridSnap:number; scrollAfterRows:number;
 normalLayout:WindowRect; miniLayout:WindowRect; isMinimized:boolean; miniLayoutType:MiniLayoutType; miniConfig:TemplateModeConfig;
 activeTemplateId:MonitorDisplayMode; templateOverrides:Record<string,unknown>; colorSettings:Partial<Record<MonitorField,MonitorColorConfig>>;
 dragHotspot:'all'|'handle'; tapAction:MonitorTapAction; doubleTapLayout:boolean; dockMode:MonitorDockMode; haptics:boolean; locked:boolean;
 refreshSeconds:number; afterHoursMode:'sleep'|'hourly'|'same'; wifiOnlyLive:boolean; showRefresh:boolean; showLock:boolean; showAdd:boolean;
 alertChangePct:number; alertPremiumPct:number; alertFlash:boolean; alertHaptic:boolean; alertNotification:boolean; alertCooldownMinutes:number;
 puzzleTiles:PuzzleTile[]; fieldStyles:Partial<Record<MonitorField,MonitorFieldStyle>>; schedule:MonitorSchedule;
};
export type UnifiedMonitorPreferences={appBoard:MonitorProfile;floating:MonitorProfile;widget:MonitorProfile;pageCustomize:Record<'dashboard'|'ledger'|'portfolio'|'dividend'|'calculator'|'detail',boolean>;};

export const defaultMonitorFields:MonitorField[]=['symbol','price','changePct','todayPnl'];
const normal=(kind:'app'|'floating'|'widget'):WindowRect=>({x:18,y:180,width:kind==='widget'?320:390,height:kind==='widget'?180:240});
const mini=():WindowRect=>({x:18,y:180,width:180,height:72});
const miniConfig=():TemplateModeConfig=>({displayFields:['symbol','price','changePct'],fieldOrder:['symbol','price','changePct'],maxDisplayCount:3,layoutType:'LIST',fontSize:11,textAlign:'center',itemSpacing:4,backgroundColor:'#08111F',opacity:.92,borderRadius:12,borderWidth:1,borderColor:'#3AC7FF'});

export const makeMonitorProfile=(kind:'app'|'floating'|'widget'):MonitorProfile=>{
 const nl=normal(kind);const mc=miniConfig();
 return {
  enabled:kind!=='app'?false:true,customizeMode:false,displayMode:kind==='floating'?'holdingList':'cardMatrix',resizeMode:'fluid',symbolSource:'holdings',title:'即時監控器',statusTitle:'市場狀態',showBreathingLight:true,density:'auto',selectedSymbols:[],fields:[...defaultMonitorFields],fieldsCustomized:false,maxSymbols:10,sortMode:'custom',groupTabs:true,
  fontScale:100,fontWeight:'bold',colorMode:'tw',backgroundStyle:'glass',backgroundColor:'#08111F',activeOpacity:88,idleOpacity:36,radius:12,borderWidth:1,borderColor:'#3AC7FF',shadow:true,separators:true,zebra:false,
  width:nl.width,height:nl.height,minWidth:120,minHeight:48,maxHeightRatio:.72,snap:true,gridSnap:8,scrollAfterRows:5,
  normalLayout:nl,miniLayout:mini(),isMinimized:false,miniLayoutType:'LIST',miniConfig:mc,activeTemplateId:kind==='floating'?'holdingList':'cardMatrix',templateOverrides:{},colorSettings:{},
  dragHotspot:'handle',tapAction:'none',doubleTapLayout:true,dockMode:'peek',haptics:true,locked:false,
  refreshSeconds:5,afterHoursMode:'sleep',wifiOnlyLive:false,showRefresh:true,showLock:true,showAdd:false,alertChangePct:3,alertPremiumPct:1,alertFlash:true,alertHaptic:true,alertNotification:true,alertCooldownMinutes:10,
  fieldStyles:{},schedule:{enabled:false,days:[1,2,3,4,5],start:'08:30',end:'14:00',mode:'manual',hideAfterHours:true},
  puzzleTiles:[{id:'pnl',kind:'portfolio',x:0,y:0,w:2,h:1,fields:['todayPnl','instantPnl']},{id:'etf-1',kind:'etf',x:2,y:0,w:2,h:1,fields:['symbol','price','changePct']},{id:'dividend',kind:'dividend',x:0,y:1,w:2,h:1,fields:['dividend']},{id:'market',kind:'market',x:2,y:1,w:2,h:1,fields:['updatedAt']}]
 };
};

export const defaultUnifiedMonitorPreferences:UnifiedMonitorPreferences={appBoard:makeMonitorProfile('app'),floating:{...makeMonitorProfile('floating'),enabled:false},widget:{...makeMonitorProfile('widget'),enabled:true,dockMode:'none',dragHotspot:'all'},pageCustomize:{dashboard:false,ledger:false,portfolio:false,dividend:false,calculator:false,detail:false}};

const validRect=(raw:any,fallback:WindowRect):WindowRect=>({x:Number.isFinite(Number(raw?.x))?Number(raw.x):fallback.x,y:Number.isFinite(Number(raw?.y))?Number(raw.y):fallback.y,width:Math.max(48,Number(raw?.width)||fallback.width),height:Math.max(32,Number(raw?.height)||fallback.height)});
export function mergeMonitorProfile(base:MonitorProfile,raw:any):MonitorProfile{
 const legacyMode:Record<string,MonitorDisplayMode>={smart:'holdingList',list:'holdingList',puzzle:'cardMatrix'};
 const displayMode=legacyMode[raw?.displayMode]??raw?.displayMode??base.displayMode;
 const legacyNormal={...base.normalLayout,width:Number(raw?.width??base.normalLayout.width),height:Number(raw?.height??base.normalLayout.height)};
 const normalLayout=validRect(raw?.normalLayout,legacyNormal);
 const miniLayout=validRect(raw?.miniLayout,base.miniLayout);
 const merged:MonitorProfile={...base,...(raw??{}),displayMode,activeTemplateId:legacyMode[raw?.activeTemplateId]??raw?.activeTemplateId??displayMode,selectedSymbols:Array.isArray(raw?.selectedSymbols)?raw.selectedSymbols:base.selectedSymbols,fields:Array.isArray(raw?.fields)?raw.fields:base.fields,fieldsCustomized:raw?.fieldsCustomized===true,puzzleTiles:Array.isArray(raw?.puzzleTiles)?raw.puzzleTiles:base.puzzleTiles,fieldStyles:{...base.fieldStyles,...(raw?.fieldStyles??{})},schedule:{...base.schedule,...(raw?.schedule??{})},normalLayout,miniLayout,isMinimized:Boolean(raw?.isMinimized),miniConfig:{...base.miniConfig,...(raw?.miniConfig??{}),displayFields:Array.isArray(raw?.miniConfig?.displayFields)?raw.miniConfig.displayFields:base.miniConfig.displayFields,fieldOrder:Array.isArray(raw?.miniConfig?.fieldOrder)?raw.miniConfig.fieldOrder:base.miniConfig.fieldOrder},templateOverrides:raw?.templateOverrides&&typeof raw.templateOverrides==='object'?raw.templateOverrides:{},colorSettings:{...base.colorSettings,...(raw?.colorSettings??{})},width:normalLayout.width,height:normalLayout.height};
 if(merged.tapAction==='openApp')merged.tapAction='none';
 return merged;
}
export function mergeUnifiedMonitorPreferences(raw:any):UnifiedMonitorPreferences{return {appBoard:mergeMonitorProfile(defaultUnifiedMonitorPreferences.appBoard,raw?.appBoard),floating:mergeMonitorProfile(defaultUnifiedMonitorPreferences.floating,raw?.floating),widget:mergeMonitorProfile(defaultUnifiedMonitorPreferences.widget,raw?.widget),pageCustomize:{...defaultUnifiedMonitorPreferences.pageCustomize,...(raw?.pageCustomize??{})}};}
