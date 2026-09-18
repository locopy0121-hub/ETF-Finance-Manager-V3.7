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
 width:number; height:number; minWidth:number; minHeight:number; maxHeightRatio:number; snap:boolean; gridSnap:number; scrollAfterRows:number;
 dragHotspot:'all'|'handle'; tapAction:MonitorTapAction; doubleTapLayout:boolean; dockMode:MonitorDockMode; haptics:boolean; locked:boolean;
 refreshSeconds:number; afterHoursMode:'sleep'|'hourly'|'same'; wifiOnlyLive:boolean; showRefresh:boolean; showLock:boolean; showAdd:boolean;
 alertChangePct:number; alertPremiumPct:number; alertFlash:boolean; alertHaptic:boolean; alertNotification:boolean; alertCooldownMinutes:number;
 puzzleTiles:PuzzleTile[]; fieldStyles:Partial<Record<MonitorField,MonitorFieldStyle>>; schedule:MonitorSchedule;
};
export type GridMonitorSort='changePercent'|'price'|'volume'|'custom';
export type GridMonitorPreferences={
 enabled:boolean;
 showInHome:boolean;
 isFloating:boolean;
 columns:2;
 autoSortBy:GridMonitorSort;
 showFocusChips:boolean;
 showTrendLines:boolean;
 alertThreshold:number;
};
export const defaultGridMonitorPreferences:GridMonitorPreferences={
 enabled:false,
 showInHome:false,
 isFloating:false,
 columns:2,
 autoSortBy:'changePercent',
 showFocusChips:true,
 showTrendLines:true,
 alertThreshold:3,
};

export type UnifiedMonitorPreferences={
 appBoard:MonitorProfile;
 floating:MonitorProfile;
 widget:MonitorProfile;
 gridMonitor:GridMonitorPreferences;
 pageCustomize:Record<'dashboard'|'ledger'|'portfolio'|'dividend'|'calculator'|'detail',boolean>;
};
export const defaultMonitorFields:MonitorField[]=['symbol','price','changePct','todayPnl'];
export const makeMonitorProfile=(kind:'app'|'floating'|'widget'):MonitorProfile=>({
 enabled:kind!=='app'?false:true,customizeMode:false,displayMode:kind==='floating'?'holdingList':'cardMatrix',resizeMode:'fluid',symbolSource:'holdings',title:'即時監控器',statusTitle:'市場狀態',showBreathingLight:true,density:'auto',selectedSymbols:[],fields:[...defaultMonitorFields],fieldsCustomized:false,maxSymbols:10,sortMode:'custom',groupTabs:true,
 fontScale:100,fontWeight:'bold',colorMode:'tw',backgroundStyle:'glass',backgroundColor:'#08111F',activeOpacity:88,idleOpacity:36,radius:12,borderWidth:1,borderColor:'#3AC7FF',shadow:true,separators:true,zebra:false,
 width:390,height:240,minWidth:120,minHeight:48,maxHeightRatio:.72,snap:true,gridSnap:8,scrollAfterRows:5,dragHotspot:'handle',tapAction:'none',doubleTapLayout:true,dockMode:'peek',haptics:true,locked:false,
 refreshSeconds:5,afterHoursMode:'sleep',wifiOnlyLive:false,showRefresh:true,showLock:true,showAdd:false,alertChangePct:3,alertPremiumPct:1,alertFlash:true,alertHaptic:true,alertNotification:true,alertCooldownMinutes:10,
 fieldStyles:{},schedule:{enabled:false,days:[1,2,3,4,5],start:'08:30',end:'14:00',mode:'manual',hideAfterHours:true},
 puzzleTiles:[{id:'pnl',kind:'portfolio',x:0,y:0,w:2,h:1,fields:['todayPnl','instantPnl']},{id:'etf-1',kind:'etf',x:2,y:0,w:2,h:1,fields:['symbol','price','changePct']},{id:'dividend',kind:'dividend',x:0,y:1,w:2,h:1,fields:['dividend']},{id:'market',kind:'market',x:2,y:1,w:2,h:1,fields:['updatedAt']}]
});
export const defaultUnifiedMonitorPreferences:UnifiedMonitorPreferences={
 appBoard:makeMonitorProfile('app'),
 floating:{...makeMonitorProfile('floating'),enabled:false},
 widget:{...makeMonitorProfile('widget'),enabled:true,width:320,height:180,dockMode:'none',dragHotspot:'all'},
 gridMonitor:{...defaultGridMonitorPreferences},
 pageCustomize:{dashboard:false,ledger:false,portfolio:false,dividend:false,calculator:false,detail:false}
};
export function mergeMonitorProfile(base:MonitorProfile,raw:any):MonitorProfile{const legacyMode:Record<string,MonitorDisplayMode>={smart:'holdingList',list:'holdingList',puzzle:'cardMatrix'};const merged={...base,...(raw??{}),displayMode:legacyMode[raw?.displayMode]??raw?.displayMode??base.displayMode,selectedSymbols:Array.isArray(raw?.selectedSymbols)?raw.selectedSymbols:base.selectedSymbols,fields:Array.isArray(raw?.fields)?raw.fields:base.fields,fieldsCustomized:raw?.fieldsCustomized===true,puzzleTiles:Array.isArray(raw?.puzzleTiles)?raw.puzzleTiles:base.puzzleTiles,fieldStyles:{...base.fieldStyles,...(raw?.fieldStyles??{})},schedule:{...base.schedule,...(raw?.schedule??{})}};if(merged.tapAction==='openApp')merged.tapAction='none';return merged;}
export function mergeUnifiedMonitorPreferences(raw:any):UnifiedMonitorPreferences{return {
 appBoard:mergeMonitorProfile(defaultUnifiedMonitorPreferences.appBoard,raw?.appBoard),
 floating:mergeMonitorProfile(defaultUnifiedMonitorPreferences.floating,raw?.floating),
 widget:mergeMonitorProfile(defaultUnifiedMonitorPreferences.widget,raw?.widget),
 gridMonitor:{
  ...defaultGridMonitorPreferences,
  ...(raw?.gridMonitor??{}),
  columns:2,
  autoSortBy:['changePercent','price','volume','custom'].includes(raw?.gridMonitor?.autoSortBy)?raw.gridMonitor.autoSortBy:defaultGridMonitorPreferences.autoSortBy,
  alertThreshold:Math.max(0,Number(raw?.gridMonitor?.alertThreshold??defaultGridMonitorPreferences.alertThreshold)||0),
 },
 pageCustomize:{...defaultUnifiedMonitorPreferences.pageCustomize,...(raw?.pageCustomize??{})}
};}
