'use no memo';
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { APP_STATE_KEY } from '../storage/appStorage';
import { V3_STATE_KEY } from '../v3/storage';
import { fetchTwseQuotes } from './twse';
import { ProfitWidget } from '../widgets/ProfitWidget';
import { configureAccountingFeeSettings, portfolioMetrics } from '../v3/engine';
import { widgetAppearance } from '../v3/themes';

const QUOTE_KEY='@etf-finance-manager/widget-quotes';
const META_KEY='@etf-finance-manager/widget-meta';
const PAYLOAD_KEY='@etf-finance-manager/widget-last-valid-payload';
export const WIDGET_BACKGROUND_TASK='ETF_FINANCE_WIDGET_QUOTES';
const trendLabel=(metric:string,source:string)=>`${source==='daily'?'每日':'盤中'}${({totalPnl:'總損益',todayPnl:'今日損益',totalAssets:'總資產',marketValue:'持股市值'} as Record<string,string>)[metric]??'走勢'}`;
const localDateKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function buildTrend(state:any,ws:any,previousExtras:any,metrics:any){
 const source=ws?.trendSource??'intraday',metric=ws?.trendMetric??'totalPnl',range=Math.max(2,Number(ws?.trendRange??(source==='daily'?30:120)));
 let values:number[]=[];
 if(source==='daily')values=(state?.dailySnapshots??[]).slice(-range).map((x:any)=>Number(metric==='totalAssets'?(x.totalAssets??x.marketValue):x?.[metric]??0)).filter(Number.isFinite);
 else {
   values=(state?.intradayPnlPoints??[]).filter((x:any)=>x.date===localDateKey()).slice(-range).map((x:any)=>Number(x?.[metric]??0)).filter(Number.isFinite);
   if(values.length<2&&Array.isArray(previousExtras?.trendValues))values=previousExtras.trendValues.map(Number).filter(Number.isFinite).slice(-range);
   const current=Number(metric==='totalAssets'?metrics?.totalAssets:metric==='marketValue'?metrics?.marketValue:metric==='todayPnl'?metrics?.todayPnl:metrics?.totalPnl);
   if(Number.isFinite(current))values=[...values,current].slice(-range);
 }
 return {trendValues:values,trendLabel:trendLabel(metric,source)};
}

function inWindow(start='09:00',end='13:30',weekdaysOnly=true){
  const d=new Date();
  if(weekdaysOnly&&(d.getDay()===0||d.getDay()===6))return false;
  const hhmm=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  if(start<=end)return hhmm>=start&&hhmm<=end;
  return hhmm>=start||hhmm<=end;
}
function controllerMode(market:any,ws:any){
  if(market?.stopAll===true||ws?.enabled===false)return {enabled:false,status:'stopped' as const};
  if(market?.scheduleEnabled===false)return {enabled:false,status:'stopped' as const};
  const live=market?.live??{};
  const after=market?.afterHours??{};
  if(live.enabled!==false&&inWindow(live.start??'08:30',live.end??'14:00',true))return {enabled:true,status:'live' as const};
  if(after.enabled!==false&&inWindow(after.start??'14:00',after.end??'08:30',false))return {enabled:true,status:'afterHours' as const};
  return {enabled:false,status:'delayed' as const};
}
async function readState(){
  const v3=await AsyncStorage.getItem(V3_STATE_KEY);
  if(v3){const s=JSON.parse(v3);return {isV3:true,holdings:s?.holdings??[],settings:s?.appSettings??{},preferences:s?.preferences??{},market:s?.preferences?.market??{},feeSettings:s?.feeSettings,ledger:s?.ledger??[],dividends:s?.dividends??[],cashBalance:Number(s?.cashBalance??0),intradayPnlPoints:s?.intradayPnlPoints??[],dailySnapshots:s?.dailySnapshots??[]};}
  const old=await AsyncStorage.getItem(APP_STATE_KEY);
  if(old){const s=JSON.parse(old);return {isV3:false,holdings:s?.holdings??[],settings:s?.settings??{},preferences:null,market:{scheduleEnabled:true,live:{enabled:true,start:s?.settings?.widget?.startTime??'09:00',end:s?.settings?.widget?.endTime??'13:30'}},ledger:[],dividends:[],cashBalance:0};}
  return null;
}

try{
 TaskManager.defineTask(WIDGET_BACKGROUND_TASK,async()=>{
  try{
   const state=await readState();if(!state)return BackgroundTask.BackgroundTaskResult.Success;
   if(state.isV3)configureAccountingFeeSettings((state as any).feeSettings);
   const ws=state.settings?.widget??{};const mode=controllerMode(state.market,ws);
   if(!mode.enabled)return BackgroundTask.BackgroundTaskResult.Success;
   const holdings=Array.isArray(state.holdings)?state.holdings:[];if(!holdings.length)return BackgroundTask.BackgroundTaskResult.Success;
   let previousPayload:any=null;try{const raw=await AsyncStorage.getItem(PAYLOAD_KEY);previousPayload=raw?JSON.parse(raw):null}catch{}

   const fresh=await fetchTwseQuotes(holdings.map((h:any)=>h.symbol));
   const oldRaw=await AsyncStorage.getItem(QUOTE_KEY);let old:any={};
   try{old=oldRaw?JSON.parse(oldRaw):{}}catch{}
   const now=Date.now(),snapshot:any={...old,__updatedAt:now};
   holdings.forEach((h:any)=>{
     const q:any=fresh[h.symbol],prev:any=old[h.symbol]??{};
     const price=Number(q?.price??prev.price??h.fallbackPrice??h.avgCost);
     const previousClose=Number(q?.previousClose??prev.previousClose??prev.price??h.fallbackPrice??h.avgCost);
     if(Number.isFinite(price)&&price>0)snapshot[h.symbol]={price,previousClose:Number.isFinite(previousClose)&&previousClose>0?previousClose:price};
   });
   await AsyncStorage.setItem(QUOTE_KEY,JSON.stringify(snapshot));

   const widgetHoldings=holdings.map((h:any)=>({...h,price:snapshot[h.symbol]?.price??h.fallbackPrice??h.avgCost,previousClose:snapshot[h.symbol]?.previousClose??snapshot[h.symbol]?.price??h.fallbackPrice??h.avgCost}));
   const month=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
   const metrics=state.isV3?portfolioMetrics(holdings,fresh as any,state.cashBalance,state.ledger,state.dividends):null;
   const monthDividend=state.isV3?state.dividends.filter((e:any)=>(e.payDate||'').startsWith(month)).reduce((a:number,e:any)=>a+Number(e.actualAmount??0),0):0;
   const monthContribution=state.isV3?state.ledger.filter((e:any)=>e.kind==='buy'&&String(e.date||'').startsWith(month)).reduce((a:number,e:any)=>a+Number(e.amount??0)+Number(e.fee??0),0):0;
   const extras=metrics?{...(previousPayload?.extras??{}),cumulativeDividend:metrics.cumulativeDividends,monthDividend,monthContribution,holdingCount:holdings.length,cashBalance:state.cashBalance,totalPnl:metrics.totalPnl,totalRoi:metrics.totalRoi,totalAssets:metrics.totalAssets,historicalTradeCost:metrics.historicalTradeCost,historicalBuyFees:metrics.historicalBuyFees,historicalCashOutflow:metrics.historicalCashOutflow,currentTradeCost:metrics.currentTradeCost,currentCashBasis:metrics.currentCashBasis,pricePnl:metrics.pricePnl,cashUnrealizedPnl:metrics.cashUnrealizedPnl,realizedPnl:metrics.realizedCashPnl,...buildTrend(state,ws,previousPayload?.extras??{},metrics),...(state.preferences?widgetAppearance(state.preferences):{})}:(previousPayload?.extras??{});
   const payload={holdings:widgetHoldings,opacity:Number(ws.opacity??85),isActive:mode.status==='live',updatedAt:now,displayFields:ws.displayFields,selectedSymbols:ws.selectedSymbols,fontScale:Number(ws.fontScale??100),align:ws.align??'left',extras,showStatusLight:ws.showStatusLight!==false,showTrendChart:ws.showTrendChart!==false,trendChartType:ws.trendChartType??previousPayload?.trendChartType??'area',status:mode.status};
   await AsyncStorage.setItem(PAYLOAD_KEY,JSON.stringify(payload));
   try{const raw=await AsyncStorage.getItem(META_KEY);const prev=raw?JSON.parse(raw):{};await AsyncStorage.setItem(META_KEY,JSON.stringify({...prev,version:Number(prev.version??0)+1,appWrittenAt:now,widgetRenderedAt:now,source:'Background TWSE Snapshot',status:mode.status}))}catch{}
   try{await requestWidgetUpdate({widgetName:'ETFProfit',renderWidget:(info:any)=><ProfitWidget {...payload} width={Number(info.width??320)} height={Number(info.height??140)}/>});}catch{}
   return BackgroundTask.BackgroundTaskResult.Success;
  }catch{
    try{const raw=await AsyncStorage.getItem(META_KEY);const prev=raw?JSON.parse(raw):{};await AsyncStorage.setItem(META_KEY,JSON.stringify({...prev,status:'error'}))}catch{}
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
 });
}catch{}

export async function setWidgetBackgroundTaskEnabled(enabled:boolean){
 try{
   const registered=await TaskManager.isTaskRegisteredAsync(WIDGET_BACKGROUND_TASK);
   if(enabled&&!registered)await BackgroundTask.registerTaskAsync(WIDGET_BACKGROUND_TASK,{minimumInterval:15});
   if(!enabled&&registered)await BackgroundTask.unregisterTaskAsync(WIDGET_BACKGROUND_TASK);
 }catch{}
}
