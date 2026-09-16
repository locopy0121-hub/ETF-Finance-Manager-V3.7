'use no memo';
import React from 'react';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { ProfitWidget, WidgetHolding } from './ProfitWidget';
import { fetchTwseQuotes } from '../services/twse';
import { configureAccountingFeeSettings, portfolioMetrics } from '../v3/engine';
import { widgetAppearance } from '../v3/themes';

const STATE_KEY='@etf-finance-manager/app-state';
const V3_STATE_KEY='@etf-finance-manager/v3-state';
const QUOTE_KEY='@etf-finance-manager/widget-quotes';
const META_KEY='@etf-finance-manager/widget-meta';
const PAYLOAD_KEY='@etf-finance-manager/widget-last-valid-payload';
const TAP_KEY='@etf-finance-manager/widget-last-tap';
const DOUBLE_TAP_MS=550;
type WidgetStatus='live'|'afterHours'|'delayed'|'error'|'stopped';
const trendLabel=(metric:string,source:string)=>`${source==='daily'?'每日':'盤中'}${({totalPnl:'總損益',todayPnl:'今日損益',totalAssets:'總資產',marketValue:'持股市值'} as Record<string,string>)[metric]??'走勢'}`;
const localDateKey=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
function deriveStateTrend(state:any,ws:any,fallback:any={}){
  const source=ws?.trendSource??'intraday',metric=ws?.trendMetric??'totalPnl',range=Math.max(2,Number(ws?.trendRange??(source==='daily'?30:120)));
  let values:number[]=[];
  if(source==='daily')values=(state?.dailySnapshots??[]).slice(-range).map((x:any)=>Number(metric==='totalAssets'?(x.totalAssets??x.marketValue):x?.[metric]??0)).filter(Number.isFinite);
  else values=(state?.intradayPnlPoints??[]).filter((x:any)=>x.date===localDateKey()).slice(-range).map((x:any)=>Number(x?.[metric]??0)).filter(Number.isFinite);
  if(values.length<2&&Array.isArray(fallback?.trendValues))values=fallback.trendValues.map(Number).filter(Number.isFinite).slice(-range);
  return {trendValues:values,trendLabel:trendLabel(metric,source)};
}
function appendCurrentTrend(state:any,ws:any,fallback:any,m:any){
  const source=ws?.trendSource??'intraday',metric=ws?.trendMetric??'totalPnl',range=Math.max(2,Number(ws?.trendRange??(source==='daily'?30:120)));
  if(source==='daily')return deriveStateTrend(state,ws,fallback);
  const base=deriveStateTrend(state,ws,fallback).trendValues;const current=Number(metric==='totalAssets'?m.totalAssets:metric==='marketValue'?m.marketValue:metric==='todayPnl'?m.todayPnl:m.totalPnl);
  return {trendValues:(Number.isFinite(current)?[...base,current]:base).slice(-range),trendLabel:trendLabel(metric,source)};
}

function inSchedule(start:string,end:string,weekdaysOnly:boolean){
  const d=new Date(),day=d.getDay();
  if(weekdaysOnly&&(day===0||day===6))return false;
  const hhmm=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  if(start<=end)return hhmm>=start&&hhmm<=end;
  return hhmm>=start||hhmm<=end; // support cross-midnight windows
}

async function readState(){
  const [v3raw,raw]=await Promise.all([AsyncStorage.getItem(V3_STATE_KEY),AsyncStorage.getItem(STATE_KEY)]);
  if(v3raw){try{return {state:JSON.parse(v3raw),isV3:true}}catch{}}
  if(raw){try{return {state:JSON.parse(raw),isV3:false}}catch{}}
  return {state:null,isV3:false};
}

async function buildData(){
  const [{state,isV3},quoteRaw,payloadRaw]=await Promise.all([
    readState(),
    AsyncStorage.getItem(QUOTE_KEY),
    AsyncStorage.getItem(PAYLOAD_KEY)
  ]);
  let payload:any=null,quotes:any={};
  try{payload=payloadRaw?JSON.parse(payloadRaw):null}catch{}
  try{quotes=quoteRaw?JSON.parse(quoteRaw):{}}catch{}
  if(!state&&payload)return payload;

  const holdingsSource=state?.holdings??[];
  if(!holdingsSource.length&&payload?.holdings?.length)return payload;

  const holdings=holdingsSource.map((h:any)=>{
    const old=quotes[h.symbol]??{};
    const fallback=payload?.holdings?.find?.((x:any)=>x.symbol===h.symbol);
    const price=Number(old.price??fallback?.price??h.fallbackPrice??h.avgCost??0);
    const previousClose=Number(old.previousClose??fallback?.previousClose??old.price??fallback?.price??h.fallbackPrice??h.avgCost??0);
    return {...h,price,previousClose};
  }) as WidgetHolding[];

  const ws=state?.appSettings?.widget??state?.settings?.widget??{};
  const isActive=ws.enabled!==false&&inSchedule(ws.startTime??'09:00',ws.endTime??'13:30',ws.weekdaysOnly!==false);
  const ledger=isV3?(state?.ledger??[]):[];
  const dividends=isV3?(state?.dividends??[]):[];
  const cashBalance=isV3?Number(state?.cashBalance??0):0;
  if(isV3)configureAccountingFeeSettings(state?.feeSettings);
  let extras:any=payload?.extras??{};
  if(isV3&&holdings.length){
    const m=portfolioMetrics(holdingsSource,quotes as any,cashBalance,ledger,dividends);
    const month=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    extras={
      ...extras,
      cumulativeDividend:m.cumulativeDividends,
      monthDividend:dividends.filter((e:any)=>(e.payDate||'').startsWith(month)).reduce((a:number,e:any)=>a+Number(e.actualAmount??0),0),
      monthContribution:ledger.filter((e:any)=>e.kind==='buy'&&String(e.date||'').startsWith(month)).reduce((a:number,e:any)=>a+Number(e.amount??0)+Number(e.fee??0),0),
      holdingCount:holdings.length,
      cashBalance,
      totalPnl:m.totalPnl,totalRoi:m.totalRoi,totalAssets:m.totalAssets,
      historicalTradeCost:m.historicalTradeCost,historicalBuyFees:m.historicalBuyFees,historicalCashOutflow:m.historicalCashOutflow,
      currentTradeCost:m.currentTradeCost,currentCashBasis:m.currentCashBasis,pricePnl:m.pricePnl,cashUnrealizedPnl:m.cashUnrealizedPnl,realizedPnl:m.realizedCashPnl
    };
  }
  if(isV3)extras={...extras,...deriveStateTrend(state,ws,extras),...widgetAppearance(state.preferences)};
  const updatedAt=Number(quotes.__updatedAt??payload?.updatedAt??state?.savedAt??0)||undefined;
  return {
    holdings,
    opacity:Number(ws.opacity??payload?.opacity??85),
    isActive,
    updatedAt,
    displayFields:ws.displayFields??payload?.displayFields,
    selectedSymbols:ws.selectedSymbols??payload?.selectedSymbols,
    fontScale:Number(ws.fontScale??payload?.fontScale??100),
    align:ws.align??payload?.align??'left',
    extras,
    showStatusLight:ws.showStatusLight!==false,
    showTrendChart:ws.showTrendChart??payload?.showTrendChart??true,
    trendChartType:ws.trendChartType??payload?.trendChartType??'area',
    trendShowLastValue:ws.trendShowLastValue??payload?.trendShowLastValue??true,
    trendShowPercent:ws.trendShowPercent??payload?.trendShowPercent??true,
    trendHeight:Number(ws.trendHeight??payload?.trendHeight??64),
    trendLineWidth:Number(ws.trendLineWidth??payload?.trendLineWidth??3),
    trendShowGrid:ws.trendShowGrid??payload?.trendShowGrid??true,
    trendShowAxis:ws.trendShowAxis??payload?.trendShowAxis??false,
    trendShowUpdatedAt:ws.trendShowUpdatedAt??payload?.trendShowUpdatedAt??true,
    compactChart:ws.compactChart??payload?.compactChart??true,
    status:(ws.enabled===false?'stopped':isActive?'live':'afterHours') as WidgetStatus
  };
}

async function renderSafe(props:WidgetTaskHandlerProps,data?:any,statusOverride?:WidgetStatus){
  const info:any=props.widgetInfo;
  const d=data??await buildData();
  const safe={...d,status:statusOverride??d.status};
  // Do not render a zero/empty initialization over a last valid Widget.
  if(!safe.holdings?.length){
    const raw=await AsyncStorage.getItem(PAYLOAD_KEY);
    if(raw){try{Object.assign(safe,JSON.parse(raw),{status:statusOverride??safe.status})}catch{}}
  }
  props.renderWidget(<ProfitWidget {...safe} width={Number(info.width??info.widgetWidth??320)} height={Number(info.height??info.widgetHeight??140)}/>);
  try{
    const raw=await AsyncStorage.getItem(META_KEY);const meta=raw?JSON.parse(raw):{};
    await AsyncStorage.setItem(META_KEY,JSON.stringify({...meta,widgetRenderedAt:Date.now(),status:safe.status}));
  }catch{}
}

async function refreshFromTwse(props:WidgetTaskHandlerProps){
  const {state,isV3}=await readState();
  const existing=await buildData();
  if(!state||!existing.holdings?.length)return renderSafe(props,existing);
  const ws=state?.appSettings?.widget??state?.settings?.widget??{};
  const market=state?.preferences?.market??{};
  if(ws.enabled===false||market.stopAll===true){
    return renderSafe(props,existing,'stopped');
  }
  try{
    const symbols=existing.holdings.map((h:any)=>h.symbol).filter(Boolean);
    const fresh=await fetchTwseQuotes(symbols);
    const oldRaw=await AsyncStorage.getItem(QUOTE_KEY);let old:any={};
    try{old=oldRaw?JSON.parse(oldRaw):{}}catch{}
    const now=Date.now(),snapshot:any={...old,__updatedAt:now};
    existing.holdings.forEach((h:any)=>{
      const q:any=fresh[h.symbol],prev:any=old[h.symbol]??{};
      const price=Number(q?.price??prev.price??h.price);
      const previousClose=Number(q?.previousClose??prev.previousClose??prev.price??h.previousClose??price);
      if(Number.isFinite(price)&&price>0)snapshot[h.symbol]={price,previousClose:Number.isFinite(previousClose)&&previousClose>0?previousClose:price};
    });
    await AsyncStorage.setItem(QUOTE_KEY,JSON.stringify(snapshot));

    const rawHoldings=state?.holdings??existing.holdings;
    const ledger=isV3?(state?.ledger??[]):[];
    const dividends=isV3?(state?.dividends??[]):[];
    const cashBalance=isV3?Number(state?.cashBalance??0):0;
    let extras=existing.extras??{};
    if(isV3){
      const m=portfolioMetrics(rawHoldings,fresh as any,cashBalance,ledger,dividends);
      const month=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
      extras={...extras,cumulativeDividend:m.cumulativeDividends,
        monthDividend:dividends.filter((e:any)=>(e.payDate||'').startsWith(month)).reduce((a:number,e:any)=>a+Number(e.actualAmount??0),0),
        monthContribution:ledger.filter((e:any)=>e.kind==='buy'&&String(e.date||'').startsWith(month)).reduce((a:number,e:any)=>a+Number(e.amount??0)+Number(e.fee??0),0),
        holdingCount:rawHoldings.length,cashBalance,totalPnl:m.totalPnl,totalRoi:m.totalRoi,totalAssets:m.totalAssets,
        historicalTradeCost:m.historicalTradeCost,historicalBuyFees:m.historicalBuyFees,historicalCashOutflow:m.historicalCashOutflow,
        currentTradeCost:m.currentTradeCost,currentCashBasis:m.currentCashBasis,pricePnl:m.pricePnl,cashUnrealizedPnl:m.cashUnrealizedPnl,realizedPnl:m.realizedCashPnl};
      extras={...extras,...appendCurrentTrend(state,ws,extras,m)};
    }
    const data={...existing,updatedAt:now,holdings:existing.holdings.map((h:any)=>({...h,price:snapshot[h.symbol]?.price??h.price,previousClose:snapshot[h.symbol]?.previousClose??h.previousClose})),extras,status:'live' as WidgetStatus};
    await AsyncStorage.setItem(PAYLOAD_KEY,JSON.stringify(data));
    try{
      const raw=await AsyncStorage.getItem(META_KEY);const meta=raw?JSON.parse(raw):{};
      await AsyncStorage.setItem(META_KEY,JSON.stringify({...meta,version:Number(meta.version??0)+1,appWrittenAt:now,source:'Widget 手動 TWSE 更新',status:'live'}));
    }catch{}
    return renderSafe(props,data,'live');
  }catch{
    try{
      const raw=await AsyncStorage.getItem(META_KEY);const meta=raw?JSON.parse(raw):{};
      await AsyncStorage.setItem(META_KEY,JSON.stringify({...meta,status:'error',widgetRenderedAt:Date.now()}));
    }catch{}
    return renderSafe(props,existing,'error');
  }
}

export async function widgetTaskHandler(props:WidgetTaskHandlerProps){
  if(props.widgetInfo.widgetName!=='ETFProfit'||props.widgetAction==='WIDGET_DELETED')return;


  if(props.widgetAction==='WIDGET_CLICK'&&props.clickAction==='ETF_WIDGET_SELECT'){
    const symbol=String((props.clickActionData as any)?.symbol??'');
    const raw=await AsyncStorage.getItem(V3_STATE_KEY).catch(()=>null);
    if(raw){try{const state=JSON.parse(raw);const widget=state?.appSettings?.widget??{};state.appSettings={...(state.appSettings??{}),widget:{...widget,selectedSymbols:symbol?[symbol]:[]}};await AsyncStorage.setItem(V3_STATE_KEY,JSON.stringify(state));}catch{}}
    return renderSafe(props);
  }

  if(props.widgetAction==='WIDGET_CLICK'&&props.clickAction==='ETF_WIDGET_TAP'){
    const now=Date.now();
    const prev=Number(await AsyncStorage.getItem(TAP_KEY).catch(()=>null)||0);
    const target=(props.clickActionData as any)?.target==='daily-profit'?'daily-profit':'dashboard';
    if(prev&&now-prev<=DOUBLE_TAP_MS){
      await AsyncStorage.removeItem(TAP_KEY).catch(()=>{});
      try{await Linking.openURL(`etffinance://${target}`);}catch{try{await Linking.openURL('etffinance://dashboard')}catch{}}
      return;
    }
    // First tap: arm the double-tap window before network work, then refresh.
    await AsyncStorage.setItem(TAP_KEY,String(now));
    return refreshFromTwse(props);
  }

  return renderSafe(props);
}
