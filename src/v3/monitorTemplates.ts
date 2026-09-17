import type {MonitorDisplayMode,MonitorField} from './monitoring';
import type {MonitorColorConfig,TemplateModeConfig} from '../types/monitor';
export type MonitorNativeMode='strip'|'table'|'puzzle';
export type MonitorTemplate={
 id:MonitorDisplayMode;
 name:string;
 fields:MonitorField[];
 columns:1|2|3;
 compact?:boolean;
 nativeMode:MonitorNativeMode;
 isDefault:true;
 normalConfig:TemplateModeConfig;
 miniConfig:TemplateModeConfig;
 colorConfig:Record<string,MonitorColorConfig>;
};

const mode=(fields:MonitorField[],layoutType:TemplateModeConfig['layoutType'],maxDisplayCount:number,fontSize:number,backgroundColor='#08111F'):TemplateModeConfig=>({
 displayFields:[...fields],fieldOrder:[...fields],maxDisplayCount,layoutType,fontSize,textAlign:'center',itemSpacing:4,backgroundColor,opacity:.92,borderRadius:12,borderWidth:1,borderColor:'#3AC7FF',
});
const colors=(fields:MonitorField[])=>Object.fromEntries(fields.map(field=>[field,{mode:['instantPnl','instantRoi','todayPnl','todayPnlPct','price','change','changePct','premium'].includes(field)?'THEME_PROFIT_LOSS':'THEME_GENERAL'} as MonitorColorConfig]));
const tpl=(id:MonitorDisplayMode,name:string,fields:MonitorField[],columns:1|2|3,nativeMode:MonitorNativeMode,compact=false,normalType:TemplateModeConfig['layoutType']='GRID',miniType:TemplateModeConfig['layoutType']='LIST'):MonitorTemplate=>({
 id,name,fields:[...fields],columns,nativeMode,compact,isDefault:true,
 normalConfig:mode(fields,normalType,10,13),
 miniConfig:mode(fields,miniType,3,11),
 colorConfig:colors(fields),
});

export const MONITOR_TEMPLATES:MonitorTemplate[]=[
 tpl('miniPnl','迷你損益條',['instantPnl','instantRoi'],2,'strip',true,'SINGLE_ROW','SINGLE_ROW'),
 tpl('holdingList','持股清單',['symbol','name','price','todayPnl'],1,'table',false,'LIST','LIST'),
 tpl('dualColumn','雙欄監控',['symbol','price','changePct','instantPnl'],2,'puzzle',false,'DUAL_ROW','DUAL_ROW'),
 tpl('cardMatrix','卡片矩陣',['symbol','price','changePct','instantPnl'],2,'puzzle',false,'GRID','GRID'),
 tpl('todayPnl','今日損益',['symbol','todayPnl','todayPnlPct'],2,'puzzle',false,'GRID','DUAL_ROW'),
 tpl('totalAssets','總資產',['totalAssets','marketValue','instantPnl'],2,'puzzle',false,'GRID','MINI_CARD'),
 tpl('dividendReminder','股息提醒',['symbol','dividend','updatedAt'],1,'table',false,'LIST','LIST'),
 tpl('watchlist','自選 ETF',['symbol','name','price','changePct'],1,'table',false,'LIST','LIST'),
 tpl('marketOverview','市場快覽',['symbol','price','change','changePct'],2,'puzzle',false,'GRID','GRID'),
 tpl('singleEtf','單一 ETF 深度',['symbol','name','price','nav','premium','volume'],1,'table',false,'LIST','LIST'),
 tpl('aiSummary','AI 摘要',['symbol','instantPnl','todayPnl','updatedAt'],1,'table',false,'LIST','MINI_CARD'),
 tpl('breathingLight','極簡呼吸燈',['updatedAt'],1,'strip',true,'SINGLE_ROW','SINGLE_ROW'),
];

export const monitorTemplate=(id:MonitorDisplayMode)=>MONITOR_TEMPLATES.find(x=>x.id===id)??MONITOR_TEMPLATES[1];
export const templateDefaultFields=(id:MonitorDisplayMode)=>[...monitorTemplate(id).fields];
export const resetMonitorTemplateToDefault=(id:MonitorDisplayMode):MonitorTemplate=>JSON.parse(JSON.stringify(monitorTemplate(id))) as MonitorTemplate;
export const mergeMonitorTemplate=(id:MonitorDisplayMode,override?:Partial<MonitorTemplate>):MonitorTemplate=>{
 const base=resetMonitorTemplateToDefault(id);
 if(!override)return base;
 return {...base,...override,id:base.id,isDefault:base.isDefault,normalConfig:{...base.normalConfig,...override.normalConfig},miniConfig:{...base.miniConfig,...override.miniConfig},colorConfig:{...base.colorConfig,...override.colorConfig},fields:Array.isArray(override.fields)?[...override.fields]:base.fields};
};
