import type {ColorTargetType,MonitorColorConfig,QuoteStatus} from '../types/monitor';

export interface MonitorThemeColors{
 textPrimary:string;
 gain:string;
 loss:string;
 neutral:string;
 limitUp:string;
 limitDown:string;
}

export interface ResolveColorParams{
 targetType:ColorTargetType;
 value?:number;
 quoteStatus?:QuoteStatus;
 config:MonitorColorConfig;
 themeColors:MonitorThemeColors;
}

export const resolveMonitorColor=({targetType,value=0,quoteStatus,config,themeColors}:ResolveColorParams):string=>{
 if(config.mode==='CUSTOM'&&config.customColor)return config.customColor;
 // General text must never accidentally inherit P/L semantics even when a stale
 // template contains THEME_PROFIT_LOSS from an older editor.
 if(config.mode==='THEME_GENERAL'||targetType==='GENERAL_TEXT')return themeColors.textPrimary;
 if(targetType==='PROFIT_LOSS'){
  if(value>0)return themeColors.gain;
  if(value<0)return themeColors.loss;
  return themeColors.neutral;
 }
 if(targetType==='MARKET_QUOTE'){
  switch(quoteStatus){
   case 'LIMIT_UP':return themeColors.limitUp;
   case 'LIMIT_DOWN':return themeColors.limitDown;
   case 'UP':return themeColors.gain;
   case 'DOWN':return themeColors.loss;
   case 'FLAT':default:return themeColors.neutral;
  }
 }
 return themeColors.textPrimary;
};

const PROFIT_LOSS_FIELDS=new Set(['unrealizedProfit','totalProfit','todayProfit','roi','instantPnl','instantRoi','todayPnl','todayPnlPct']);
const MARKET_QUOTE_FIELDS=new Set(['currentPrice','changeAmount','changePercent','price','change','changePct']);

export const monitorColorTargetForField=(field:string):ColorTargetType=>
 PROFIT_LOSS_FIELDS.has(field)?'PROFIT_LOSS':MARKET_QUOTE_FIELDS.has(field)?'MARKET_QUOTE':'GENERAL_TEXT';

export const quoteStatusFromValues=(price:number,previousClose:number,limitUp?:number,limitDown?:number):QuoteStatus=>{
 if(Number.isFinite(limitUp)&&Number(limitUp)>0&&Math.abs(price-Number(limitUp))<0.0001)return 'LIMIT_UP';
 if(Number.isFinite(limitDown)&&Number(limitDown)>0&&Math.abs(price-Number(limitDown))<0.0001)return 'LIMIT_DOWN';
 if(price>previousClose)return 'UP';
 if(price<previousClose)return 'DOWN';
 return 'FLAT';
};
