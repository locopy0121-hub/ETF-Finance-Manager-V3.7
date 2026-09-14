import type {MonitorDisplayMode,MonitorField} from './monitoring';
export type MonitorTemplate={id:MonitorDisplayMode;name:string;fields:MonitorField[];columns:1|2|3;compact?:boolean};
export const MONITOR_TEMPLATES:MonitorTemplate[]=[
 {id:'miniPnl',name:'迷你損益條',fields:['instantPnl','instantRoi'],columns:2,compact:true},
 {id:'holdingList',name:'持股清單',fields:['symbol','price','instantPnl'],columns:1},
 {id:'dualColumn',name:'雙欄監控',fields:['symbol','price','changePct','instantPnl'],columns:2},
 {id:'cardMatrix',name:'卡片矩陣',fields:['symbol','price','changePct'],columns:2},
 {id:'todayPnl',name:'今日損益',fields:['todayPnl','todayPnlPct'],columns:2},
 {id:'totalAssets',name:'總資產',fields:['totalAssets','instantPnl'],columns:2},
 {id:'dividendReminder',name:'股息提醒',fields:['symbol','dividend'],columns:1},
 {id:'watchlist',name:'自選 ETF',fields:['symbol','price','changePct'],columns:1},
 {id:'marketOverview',name:'市場快覽',fields:['symbol','change','changePct'],columns:2},
 {id:'singleEtf',name:'單一 ETF 深度',fields:['symbol','price','nav','premium','volume'],columns:1},
 {id:'aiSummary',name:'AI 摘要',fields:['symbol','instantPnl','updatedAt'],columns:1},
 {id:'breathingLight',name:'極簡呼吸燈',fields:['updatedAt'],columns:1,compact:true},
];
export const monitorTemplate=(id:MonitorDisplayMode)=>MONITOR_TEMPLATES.find(x=>x.id===id)??MONITOR_TEMPLATES[1];
