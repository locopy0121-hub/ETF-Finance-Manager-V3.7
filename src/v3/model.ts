import { Holding, PurchaseRecord } from '../data/portfolio';
import { DividendEvent } from '../screens/DividendCalendarScreen';
import { defaultUnifiedMonitorPreferences, type UnifiedMonitorPreferences } from './monitoring';
import { AppSettings, DailySnapshot } from '../storage/appStorage';
import type { TradeMode } from '../types/etf';
import type { UniversalEditorNode } from '../ui/editorSchema';

export type LedgerKind = 'buy' | 'sell' | 'dividend' | 'cashIn' | 'cashOut';
export type CashReconciliation = { actualBalance?:number; checkedAt?:number; broker?:string; account?:string; note?:string; };
export type StrategyKind = 'long' | 'swing';
export type ThemeId='obsidianGold'|'deepSeaTech'|'classicFinance'|'forestEye'|'amethystNight'|'sunriseOrange'|'glacierLight'|'mistMinimal'|'copperRed'|'neonNight'|`custom${1|2|3|4|5}`;
export type OfficialThemeId=Exclude<ThemeId,`custom${1|2|3|4|5}`>;
export type NavDisplayMode='iconText'|'text'|'icon';
export type IconDisplaySettings={enabled:boolean;section:boolean;nav:boolean;ai:boolean;widget:boolean};
export type CustomThemeSlot={slot:1|2|3|4|5;name:string;baseThemeId:OfficialThemeId;tokens:{backgroundPreset:V3Preferences['backgroundPreset'];backgroundImageUri?:string;backgroundOpacity?:number;primaryTextColor:string;secondaryTextColor:string;accentColor:string;positiveColor:string;negativeColor:string;cardOpacity:number;cardRadius:number;overlayOpacity:number;cardBackgroundImageUri?:string;cardBackgroundImageOpacity?:number;fontScale?:number;navMode:NavDisplayMode;iconDisplay?:IconDisplaySettings};savedAt:number};

export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  symbol?: string;
  name?: string;
  date: string;
  shares?: number;
  price?: number;
  tradeMode?: TradeMode;
  amount: number; // 成交金額或現金流原始金額，不混入手續費
  fee?: number;
  tax?: number;
  strategy?: StrategyKind;
  broker?: string;
  account?: string;
  dividendEventId?: string;
  note?: string;
  purchaseRecordId?: string;
};

export type HomeMetricKey =
  | 'historicalTradeCost'
  | 'historicalBuyFees'
  | 'historicalCashOutflow'
  | 'currentTradeCost'
  | 'currentCashBasis'
  | 'totalAssets'
  | 'totalPnl'
  | 'totalRoi'
  | 'pricePnl'
  | 'marketValue'
  | 'cashBalance'
  | 'cumulativeDividends'
  | 'todayPnl'
  | 'todayPnlPct'
  | 'unrealizedPnl'
  | 'cashUnrealizedPnl'
  | 'realizedPnl'
  | 'holdingCount'
  | 'pendingDividends';

export type PageFieldKey = 'dashboard'|'ledger'|'portfolio'|'dividend'|'calculator'|'detail';
export type PageFieldSelection = Record<PageFieldKey,string[]>;
export type V3CardSpan = 12|9|8|6|4|3;
export type V3FieldHeight = 'auto'|1|2|3|4|'custom';
export type V3VerticalAlign='top'|'center'|'bottom';
export type V3ValueColorMode='theme'|'profitLoss'|'custom';
export type V3TextConfig={visible:boolean;fontScale:number;fontWeight:'400'|'600'|'700'|'800'|'900';color?:string;colorMode?:V3ValueColorMode;align:V3CardAlign;verticalAlign:V3VerticalAlign;lineHeightScale?:number};
export type V3FieldEffect='none'|'shadow'|'glow'|'outline';
export type V3FieldConfig={span:V3CardSpan;height:V3FieldHeight;customHeight?:number;customWidth?:number;label:V3TextConfig;value:V3TextConfig;labelValueGap?:number;backgroundOpacity:number;backgroundColor?:string;borderColor?:string;radius:number;padding:number;paddingTop?:number;paddingRight?:number;paddingBottom?:number;paddingLeft?:number;effect?:V3FieldEffect;effectStrength?:number};
export type PageFieldSpans = Record<PageFieldKey,Record<string,V3CardSpan>>;
export type V3CardAlign='left'|'center'|'right';
export type V3CardStyle={fontScale:number;align:V3CardAlign;backgroundOpacity:number;radius:number;padding:number};
export type V3ChartMetric='todayPnl'|'totalPnl'|'totalAssets'|'marketValue'|'cumulativeDividend';
export type V3ChartSource='intraday'|'daily';
export type V3ChartType='line'|'area'|'bar'|'positiveBar'|'multiLine'|'pie'|'donut'|'stackedBar'|'candlestick'|'volume'|'pnlTrend'|'progress'|'heatmap'|'waterfall'|'radar'|'scatter';
export type V3ChartColorMode='theme'|'profitLoss'|'custom';
export type V3ChartConfig={enabled?:boolean;source:V3ChartSource;metric:V3ChartMetric;range:number;showPoints:boolean;showZeroLine:boolean;chartType?:V3ChartType;colorMode?:V3ChartColorMode;primaryColor?:string;positiveColor?:string;negativeColor?:string;seriesColors?:string[];fillOpacity?:number;lineWidth?:number;barRadius?:number;showGrid?:boolean;showAxis?:boolean;showLabels?:boolean;showLegend?:boolean;animation?:boolean;targetValue?:number;layout:'chartOnly'|'dataLeftChartRight'|'chartLeftDataRight'|'dataTopChartBottom'|'chartTopDataBottom';dataRatio:'1/4'|'1/3'|'1/2'|'2/3'|'3/4'};
export type V3PageCard={id:string;title:string;kind:'system'|'custom'|'chart'|'mixed';role?:'summary'|'listTemplate'|'normal'|'module';fields:string[];fieldSpans?:Record<string,V3CardSpan>;fieldConfigs?:Record<string,V3FieldConfig>;fieldGap?:number;chartConfig?:V3ChartConfig;x:number;y:number;w:number;h:number;hidden:boolean;style:V3CardStyle};
export type V3PageLayout={columns:5|6;cards:V3PageCard[]};
export type V3PageLayouts=Record<PageFieldKey,V3PageLayout>;
export type V3EditorPreset={id:string;name:string;page:PageFieldKey;cardId:string;card:V3PageCard;savedAt:number};

export type SavingsPlanAllocation = { symbol:string; name?:string; weight:number };
export type SavingsPlan = {
  id:string;
  name:string;
  createdAt:number;
  updatedAt:number;
  active:boolean;
  startDate:string;
  targetDate?:string;
  sourceMode?:'current'|'custom';
  sourceSnapshotAt?:number;
  sourceMarketValue?:number;
  sourceTradeCost?:number;
  sourceCashBasis?:number;
  sourceCumulativeDividend?:number;
  initialCapital:number;
  monthlyContribution:number;
  years:number;
  annualReturn:number;
  annualDividendYield:number;
  reinvest:boolean;
  reinvestMode:'original'|'single'|'ratio';
  reinvestTargetSymbol?:string;
  allocations:SavingsPlanAllocation[];
  reminderDay:number;
  note?:string;
};

export type MarketSchedule={enabled:boolean;start:string;end:string;refreshSeconds:number};
export type MarketPreferences = {
  autoRefresh:boolean; // legacy compatibility; mirrors scheduleEnabled
  refreshSeconds:number; // legacy compatibility; mirrors live.refreshSeconds
  onlyTradingHours:boolean; // legacy compatibility
  refreshOnForeground:boolean;
  useCloseSnapshotAfterHours:boolean;
  scheduleEnabled:boolean;
  stopAll:boolean;
  live:MarketSchedule;
  afterHours:MarketSchedule;
  source:'TWSE';
};

export type CustomMetricDefinition={id:string;title:string;expression:string;format:'money'|'percent'|'number';digits?:number;colorMode?:'theme'|'profitLoss'|'custom';color?:string;};
export type AiPreferences={
  enabled:boolean; showHeaderButton:boolean; confirmWrites:boolean; localParser:boolean; fontScale:number;
};
export type GlobalVisibility={
  nav:boolean; premium:boolean; liveQuote:boolean; todayPnl:boolean; totalPnl:boolean;
  dividends:boolean; marketNews:boolean; aiInsights:boolean; smartTicker:boolean; updatedAt:boolean;
};
export type MoneyDisplayMode='smart'|'fixed'|'custom';
export type MoneyPreferences={
  currencyStyle:'plain';
  moneyMode:MoneyDisplayMode;
  moneyDigits:number;
  customMoneyDigits:number;
  percentMode:MoneyDisplayMode;
  percentDigits:number;
  customPercentDigits:number;
  dividendDigits:number;
  plainMode:MoneyDisplayMode;
  plainDigits:number;
};
export type CalendarPreferences={followTheme:boolean;backgroundOpacity:number;cellRadius:number;cellHeight:number;fontScale:number;grid:boolean;density:'compact'|'standard'|'spacious';eventStyle:'dot'|'underline'|'block';todayStyle:'outline'|'fill'|'glow';selectedStyle:'outline'|'fill';weekendEmphasis:boolean;backgroundColor:string;textColor:string;accentColor:string;weekendColor:string;eventColor:string};
export type LifestyleProgressPreferences={enabled:boolean;title:string;targetMode:'monthlyDividend'|'custom';customTarget:number;showPercent:boolean;showAmounts:boolean;animation:'none'|'pulse'|'shimmer';fontScale:number;radius:number;opacity:number;followTheme:boolean;accentColor:string;backgroundColor:string;textColor:string};
export type TickerAnimation='scroll'|'pingpong'|'bounce'|'center'|'blink'|'jump'|'pulse'|'wave'|'scale'|'fade';
export type TickerSource='todayPnl'|'totalPnl'|'dividend'|'nextDividend'|'lastBuy'|'market';
export type TickerPreferences={enabled:boolean;fontScale:number;fontWeight:'600'|'700'|'800'|'900';textColor?:string;backgroundColor?:string;opacity:number;radius:number;speedSeconds:number;pauseSeconds:number;direction:'left'|'right';animation:TickerAnimation;animationStrength:number;reduceMotion:boolean;followTheme:boolean;maxItems:number;sources:TickerSource[]};
export type DailyPnlPreferences={symbolStyle:'solid'|'outline'|'text'|'soft';fontScale:number;radius:number;opacity:number;showName:boolean;showMarketValue:boolean;showPercent:boolean;showUpdatedAt:boolean;positiveColor:string;negativeColor:string;neutralColor:string};
export type ChartInteractionPreferences={singleTapCycle:boolean;doubleTapZoom:boolean;rememberStyle:boolean;defaultRange:'1d'|'1w'|'1m'|'3m'|'1y'|'all'};


export type V3Preferences = {
  privacyMode: boolean;
  colorMode: 'tw' | 'us';
  themeId: ThemeId;
  navDisplayMode: NavDisplayMode;
  iconDisplay: IconDisplaySettings;
  appIconKey:'icon-01'|'icon-02'|'icon-03'|'icon-04'|'icon-05'|'icon-06'|'icon-07'|'icon-08'|'icon-09'|'icon-10';
  immersiveEditor:boolean;
  globalEditMode:boolean;
  editorPresets:V3EditorPreset[];
  customThemes: CustomThemeSlot[];
  backgroundPreset: 'deepFinance' | 'taipeiDawn' | 'emeraldGlass' | 'goldenValley' | 'greenGrowth' | 'neonCity' | 'futureEarth' | 'mistyGrowth' | 'glassTech' | 'tealCity' | 'custom';
  backgroundImageUri: string;
  backgroundOpacity: number;
  overlayOpacity: number;
  cardOpacity: number;
  cardRadius: number;
  cardBackgroundImageUri:string;
  cardBackgroundImageOpacity:number;
  fontScale: number;
  primaryTextColor:string;
  secondaryTextColor:string;
  accentColor:string;
  positiveColor:string;
  negativeColor:string;
  followThemeProfitLossColors:boolean;
  market:MarketPreferences;
  ai:AiPreferences;
  visibility:GlobalVisibility;
  money:MoneyPreferences;
  calendar:CalendarPreferences;
  lifestyleProgress:LifestyleProgressPreferences;
  ticker:TickerPreferences;
  dailyPnl:DailyPnlPreferences;
  chartInteraction:ChartInteractionPreferences;
  // Three prominent dashboard cards. Each card can contain any number of metrics.
  homeCardFields: HomeMetricKey[][];
  // Per-page field pools. Selection count is intentionally unlimited.
  pageCardFields: PageFieldSelection;
  pageCardSpans: PageFieldSpans;
  homeCardSpans: Record<string,V3CardSpan>[];
  pageLayouts: V3PageLayouts;
  // One reusable single-ETF template, then choose which ETF symbols use it.
  selectedEtfFields: string[];
  selectedEtfFieldSpans: Record<string,V3CardSpan>;
  selectedEtfSymbols: string[];
  // Presentation-only: never use this list in accounting or portfolio formulas.
  watchlistSymbols:string[];
  editorNodes:Record<string,UniversalEditorNode>;
  holdingFocusSort:'custom'|'marketValue'|'pnl'|'todayPnl';
  holdingFocusMax:number;
  holdingFocusOnDashboard:boolean;
  holdingFocusOnPortfolio:boolean;
  pageTitles:Partial<Record<PageFieldKey,string>>;
  customMetrics:CustomMetricDefinition[];
  monitoring:UnifiedMonitorPreferences;
};

export type IntradayPnlPoint={date:string;time:string;at:number;todayPnl:number;totalPnl:number;totalAssets:number;marketValue:number;cumulativeDividend:number};

export type V3State = {
  schemaVersion: number;
  holdings: Holding[];
  dividends: DividendEvent[];
  ledger: LedgerEntry[];
  cashBalance: number;
  cashReconciliation: CashReconciliation;
  preferences: V3Preferences;
  appSettings: AppSettings;
  dailySnapshots: DailySnapshot[];
  intradayPnlPoints:IntradayPnlPoint[];
  savingsPlans:SavingsPlan[];
  savedAt: number;
};

export const defaultPageCardFields:PageFieldSelection={
  dashboard:['totalAssets','historicalCashOutflow','totalPnl','totalRoi','todayPnl','cumulativeDividends','cashBalance','holdingCount'],
  ledger:['monthContribution','historicalTradeCost','historicalBuyFees','historicalCashOutflow','realizedPnl','cashBalance','lastTrade','ledgerCount'],
  portfolio:['shares','avgCost','price','marketValue','pureCost','totalFees','totalCost','pnl','roi','cashPnl','cashRoi','weight','cumulativeDividend','lastBuyDate'],
  dividend:['cumulativeDividends','yearReceived','yearExpected','monthlyAverage','pendingDividend','nextPayDate','costYield','nextExDate','eligibleShares'],
  calculator:['sourceMode','initialCapital','currentSnapshotValue','monthlyContribution','years','annualReturn','annualDividendYield','invested','futureValue','pnl','roi','cumulativeDividend'],
  detail:['shares','purchaseCount','pureCost','totalFees','totalCost','historicalTradeCost','historicalBuyFees','historicalCashOutflow','avgCost','cashAvgCost','broker','account','lastBuyDate','price','previousClose','open','high','low','volume','todayPnl','todayPnlPct','marketValue','pnl','roi','cashPnl','cashRoi','realizedPricePnl','realizedCashPnl','cumulativeDividend','annualDividend','costYield','weight','nav','premium','updatedAt'],
};

export const defaultPageCardSpans:PageFieldSpans={
  dashboard:{},ledger:{},portfolio:{},dividend:{},calculator:{},detail:{},
};


export function makeDefaultPageLayouts(homeCards:HomeMetricKey[][]=[['totalAssets','todayPnl','todayPnlPct'],['marketValue','cashBalance','cumulativeDividends'],['totalPnl','totalRoi','pricePnl','holdingCount']],pageFields:PageFieldSelection=defaultPageCardFields):V3PageLayouts{
 const style:V3CardStyle={fontScale:100,align:'left',backgroundOpacity:82,radius:6,padding:12};
 const text=(align:V3CardAlign='left'):V3TextConfig=>({visible:true,fontScale:100,fontWeight:'800',align,verticalAlign:'top'});
 const field=(span:V3CardSpan=6):V3FieldConfig=>({span,height:'auto',label:{...text('left'),lineHeightScale:125},value:{...text('left'),fontWeight:'900',verticalAlign:'bottom',lineHeightScale:125},labelValueGap:6,backgroundOpacity:3,radius:10,padding:8,paddingTop:8,paddingRight:8,paddingBottom:8,paddingLeft:8});
 const card=(id:string,title:string,fields:string[],x:number,y:number,w:number,h:number):V3PageCard=>({id,title,kind:'system',fields:[...fields],fieldSpans:Object.fromEntries(fields.map(k=>[k,6])) as Record<string,V3CardSpan>,fieldConfigs:Object.fromEntries(fields.map(k=>[k,field(6)])) as Record<string,V3FieldConfig>,x,y,w,h,hidden:false,style:{...style}});
 const hero=card('dashboard-core-1','總資產與核心指標',homeCards[0]??['totalAssets','todayPnl','todayPnlPct'],0,0,6,3);
 hero.chartConfig={enabled:true,source:'intraday',metric:'totalAssets',range:120,showPoints:false,showZeroLine:false,chartType:'area',layout:'dataLeftChartRight',dataRatio:'1/2'};
 return {
  dashboard:{columns:6,cards:[hero,card('dashboard-core-2','資產與現金',homeCards[1]??[],0,3,3,2),card('dashboard-core-3','損益與股息',homeCards[2]??[],3,3,3,2),{...card('dashboard-market','市場總覽｜熱門 ETF',[],0,5,6,2),role:'module'},{...card('dashboard-watchlist','ETF 搜尋 / 自選管理',[],0,7,6,2),role:'module'},{...card('dashboard-pnl-history','累積損益紀錄',[],0,9,6,2),role:'module'},{...card('dashboard-daily-pnl','每日損益紀錄',[],0,11,6,2),role:'module'},{...card('dashboard-wealth','資產成長｜投入 vs 資產',[],0,13,6,2),role:'module'},{...card('dashboard-allocation','資產配置',[],0,15,6,2),role:'module'}]},
  ledger:{columns:6,cards:[card('ledger-summary','智慧記帳摘要',pageFields.ledger??[],0,0,6,2)]},
  portfolio:{columns:6,cards:[{...card('portfolio-summary','庫存摘要',pageFields.portfolio??[],0,0,6,2),role:'summary'},{...card('portfolio-list','庫存清單模板',pageFields.portfolio??[],0,2,6,2),role:'listTemplate'},{...card('portfolio-contribution','損益貢獻排行',[],0,4,6,2),role:'module'},{...card('portfolio-recent','最近交易 / 股息',[],0,6,6,2),role:'module'},{...card('portfolio-allocation','ETF 市值配置',[],0,8,6,2),role:'module'}]},
  dividend:{columns:6,cards:[card('dividend-summary','股息摘要',pageFields.dividend??[],0,0,6,2)]},
  calculator:{columns:6,cards:[card('calculator-summary','試算摘要',pageFields.calculator??[],0,0,6,2)]},
  detail:{columns:6,cards:[card('detail-summary','ETF 詳情摘要',pageFields.detail??[],0,0,6,2)]},
 };
}

export const defaultV3Preferences: V3Preferences = {
  privacyMode: false,
  colorMode: 'tw',
  themeId:'obsidianGold',
  navDisplayMode:'iconText',
  iconDisplay:{enabled:true,section:true,nav:true,ai:true,widget:true},
  appIconKey:'icon-01',
  immersiveEditor:true,
  globalEditMode:false,
  editorPresets:[],
  customThemes:[],
  backgroundPreset: 'deepFinance',
  backgroundImageUri: '',
  backgroundOpacity: 100,
  overlayOpacity: 26,
  cardOpacity: 82,
  cardRadius: 6,
  cardBackgroundImageUri:'',
  cardBackgroundImageOpacity:22,
  fontScale: 100,
  primaryTextColor:'#FFFFFF',
  secondaryTextColor:'#8E9BAE',
  accentColor:'#D4AF37',
  positiveColor:'#E54A45',
  negativeColor:'#12A875',
  followThemeProfitLossColors:true,
  market:{autoRefresh:true,refreshSeconds:5,onlyTradingHours:true,refreshOnForeground:true,useCloseSnapshotAfterHours:true,scheduleEnabled:true,stopAll:false,live:{enabled:true,start:'08:30',end:'14:00',refreshSeconds:1},afterHours:{enabled:true,start:'14:00',end:'08:30',refreshSeconds:600},source:'TWSE'},
  ai:{enabled:true,showHeaderButton:true,confirmWrites:true,localParser:true,fontScale:100},
  visibility:{nav:true,premium:false,liveQuote:true,todayPnl:true,totalPnl:true,dividends:true,marketNews:true,aiInsights:true,smartTicker:true,updatedAt:true},
  money:{currencyStyle:'plain',moneyMode:'smart',moneyDigits:2,customMoneyDigits:2,percentMode:'smart',percentDigits:2,customPercentDigits:2,dividendDigits:4,plainMode:'smart',plainDigits:0},
  calendar:{followTheme:true,backgroundOpacity:72,cellRadius:10,cellHeight:42,fontScale:100,grid:true,density:'standard',eventStyle:'dot',todayStyle:'outline',selectedStyle:'fill',weekendEmphasis:true,backgroundColor:'#101A2A',textColor:'#F8FAFC',accentColor:'#D4AF37',weekendColor:'#FCA5A5',eventColor:'#4CC9F0'},
  lifestyleProgress:{enabled:true,title:'生活感加薪進度',targetMode:'monthlyDividend',customTarget:20000,showPercent:true,showAmounts:true,animation:'pulse',fontScale:100,radius:10,opacity:100,followTheme:true,accentColor:'#4CC9F0',backgroundColor:'#101A2A',textColor:'#F8FAFC'},
  ticker:{enabled:true,fontScale:100,fontWeight:'800',opacity:92,radius:12,speedSeconds:4,pauseSeconds:1,direction:'left',animation:'scroll',animationStrength:50,reduceMotion:false,followTheme:true,maxItems:8,sources:['todayPnl','totalPnl','dividend','nextDividend','lastBuy','market']},
  dailyPnl:{symbolStyle:'solid',fontScale:100,radius:10,opacity:100,showName:true,showMarketValue:true,showPercent:true,showUpdatedAt:true,positiveColor:'#E54A45',negativeColor:'#12A875',neutralColor:'#64748B'},
  chartInteraction:{singleTapCycle:true,doubleTapZoom:true,rememberStyle:true,defaultRange:'1m'},
  homeCardFields: [
    ['totalAssets','todayPnl','todayPnlPct'],
    ['marketValue','cashBalance','cumulativeDividends'],
    ['totalPnl','totalRoi','pricePnl','holdingCount'],
  ],
  pageCardFields:defaultPageCardFields,
  pageCardSpans:defaultPageCardSpans,
  homeCardSpans:[{},{},{}],
  pageLayouts:makeDefaultPageLayouts(),
  selectedEtfFields: ['price','shares','marketValue','avgCost','pureCost','totalFees','pnl','roi','cumulativeDividend'],
  selectedEtfFieldSpans:{},
  selectedEtfSymbols: [],
  watchlistSymbols:[],
  editorNodes:{},
  holdingFocusSort:'custom',
  holdingFocusMax:8,
  holdingFocusOnDashboard:true,
  holdingFocusOnPortfolio:true,
  pageTitles:{},
  customMetrics:[],
  monitoring:defaultUnifiedMonitorPreferences,
};

export function seedLedgerFromHoldings(holdings: Holding[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const h of holdings) {
    const records: PurchaseRecord[] = h.purchaseRecords ?? [];
    if (records.length) {
      for (const r of records) out.push({
        id: `migrate-${h.symbol}-${r.id}`,
        kind: 'buy', symbol: h.symbol, name: h.name,
        date: r.date, shares: r.shares, price: r.tradePrice,
        amount: r.purchaseCost, fee: r.fee, strategy: 'long', note: '由既有購入紀錄轉入',
        tradeMode:h.liquidationTradeMode,broker:h.broker,account:h.account,
      });
    } else {
      const avg=Number(h.tradeAvgPrice??h.avgCost??0);
      out.push({
        id: `migrate-${h.symbol}`,
        kind: 'buy', symbol: h.symbol, name: h.name,
        date: '既有庫存', shares: h.shares, price: avg,
        amount: h.shares * avg, fee: h.buyFee ?? 0,
        tradeMode:h.liquidationTradeMode,strategy: 'long', note: '由既有庫存轉入', broker:h.broker,account:h.account,
      });
    }
  }
  return out;
}
