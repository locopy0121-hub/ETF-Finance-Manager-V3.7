import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { Holding } from '../data/portfolio';
import { ProfitWidget, WidgetExtras } from './ProfitWidget';
import { WidgetSettings } from '../storage/appStorage';

export const WIDGET_QUOTE_KEY='@etf-finance-manager/widget-quotes';
export const WIDGET_META_KEY='@etf-finance-manager/widget-meta';
export const WIDGET_PAYLOAD_KEY='@etf-finance-manager/widget-last-valid-payload';

export async function syncProfitWidget(
  holdings:Holding[],
  quotes:Record<string,any>,
  settings:WidgetSettings,
  isActive=true,
  extras:WidgetExtras={}
){
  if(Platform.OS!=='android')return;
  const now=Date.now();
  const previousRaw=await AsyncStorage.getItem(WIDGET_QUOTE_KEY).catch(()=>null);
  let previous:any={};
  try{previous=previousRaw?JSON.parse(previousRaw):{}}catch{}
  const snapshot:any={...previous,__updatedAt:now};

  holdings.forEach(h=>{
    const q:any=quotes[h.symbol];
    const old:any=previous[h.symbol]??{};
    const price=Number(q?.price??old.price??h.fallbackPrice??h.avgCost);
    const previousClose=Number(q?.previousClose??q?.y??old.previousClose??old.price??h.fallbackPrice??h.avgCost);
    // Never replace a last valid quote with an uninitialized zero.
    if(Number.isFinite(price)&&price>0)snapshot[h.symbol]={price,previousClose:Number.isFinite(previousClose)&&previousClose>0?previousClose:price};
  });
  await AsyncStorage.setItem(WIDGET_QUOTE_KEY,JSON.stringify(snapshot));

  let version=1;
  try{
    const raw=await AsyncStorage.getItem(WIDGET_META_KEY);
    version=(raw?Number(JSON.parse(raw)?.version??0):0)+1;
  }catch{}

  const status:'stopped'|'live'|'afterHours'=settings.enabled===false?'stopped':isActive?'live':'afterHours';
  const payload={
    holdings:holdings.map(h=>{
      const q=snapshot[h.symbol]??{};
      return {...h,price:Number(q.price??h.fallbackPrice??h.avgCost),previousClose:Number(q.previousClose??q.price??h.fallbackPrice??h.avgCost)};
    }),
    opacity:settings.opacity,
    isActive,
    updatedAt:now,
    displayFields:settings.displayFields,
    selectedSymbols:settings.selectedSymbols,
    fontScale:settings.fontScale,
    align:settings.align,
    extras,
    showStatusLight:settings.showStatusLight!==false,
    showTrendChart:settings.showTrendChart!==false,
    trendChartType:settings.trendChartType??'area',
    trendShowLastValue:settings.trendShowLastValue!==false,
    trendShowPercent:settings.trendShowPercent!==false,
    trendHeight:settings.trendHeight??64,
    trendLineWidth:settings.trendLineWidth??3,
    trendShowGrid:settings.trendShowGrid!==false,
    trendShowAxis:settings.trendShowAxis===true,
    trendShowUpdatedAt:settings.trendShowUpdatedAt!==false,
    compactChart:settings.compactChart!==false,
    status
  };
  // Last-valid payload is the Widget safety net. Empty/uninitialized renders must not overwrite it.
  if(payload.holdings.length&&payload.holdings.some(h=>Number.isFinite(h.price)&&h.price>0)){
    await AsyncStorage.setItem(WIDGET_PAYLOAD_KEY,JSON.stringify(payload));
  }
  await AsyncStorage.setItem(WIDGET_META_KEY,JSON.stringify({
    version,
    appWrittenAt:now,
    widgetRenderedAt:now,
    source:'App Snapshot',
    status,
    fields:settings.displayFields
  }));

  try{
    await requestWidgetUpdate({
      widgetName:'ETFProfit',
      renderWidget:(info:any)=><ProfitWidget {...payload} width={Number(info.width??320)} height={Number(info.height??140)}/>
    });
  }catch{
    await AsyncStorage.setItem(WIDGET_META_KEY,JSON.stringify({
      version,appWrittenAt:now,widgetRenderedAt:0,source:'App Snapshot',status:'error'
    }));
  }
}
