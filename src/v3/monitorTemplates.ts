import type {MonitorDisplayMode,MonitorField} from './monitoring';
export type MonitorNativeMode='strip'|'table'|'puzzle';
export type MonitorTemplate={id:MonitorDisplayMode;name:string;fields:MonitorField[];columns:1|2|3;compact?:boolean;nativeMode:MonitorNativeMode};
export const MONITOR_TEMPLATES:MonitorTemplate[]=[
 {id:'miniPnl',name:'迷你損益條',fields:['instantPnl','instantRoi'],columns:2,compact:true,nativeMode:'strip'},
 {id:'holdingList',name:'持股清單',fields:['symbol','name','price','todayPnl'],columns:1,nativeMode:'table'},
 {id:'dualColumn',name:'雙欄監控',fields:['symbol','price','changePct','instantPnl'],columns:2,nativeMode:'puzzle'},
 {id:'cardMatrix',name:'卡片矩陣',fields:['symbol','price','changePct','instantPnl'],columns:2,nativeMode:'puzzle'},
 {id:'todayPnl',name:'今日損益',fields:['symbol','todayPnl','todayPnlPct'],columns:2,nativeMode:'puzzle'},
 {id:'totalAssets',name:'總資產',fields:['totalAssets','marketValue','instantPnl'],columns:2,nativeMode:'puzzle'},
 {id:'dividendReminder',name:'股息提醒',fields:['symbol','dividend','updatedAt'],columns:1,nativeMode:'table'},
 {id:'watchlist',name:'自選 ETF',fields:['symbol','name','price','changePct'],columns:1,nativeMode:'table'},
 {id:'marketOverview',name:'市場快覽',fields:['symbol','price','change','changePct'],columns:2,nativeMode:'puzzle'},
 {id:'singleEtf',name:'單一 ETF 深度',fields:['symbol','name','price','nav','premium','volume'],columns:1,nativeMode:'table'},
 {id:'aiSummary',name:'AI 摘要',fields:['symbol','instantPnl','todayPnl','updatedAt'],columns:1,nativeMode:'table'},
 {id:'breathingLight',name:'極簡呼吸燈',fields:['updatedAt'],columns:1,compact:true,nativeMode:'strip'},
];
export const monitorTemplate=(id:MonitorDisplayMode)=>MONITOR_TEMPLATES.find(x=>x.id===id)??MONITOR_TEMPLATES[1];
export const templateDefaultFields=(id:MonitorDisplayMode)=>[...monitorTemplate(id).fields];
