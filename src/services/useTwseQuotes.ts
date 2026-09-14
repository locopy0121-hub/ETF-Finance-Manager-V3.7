import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchTwseQuotes, QuoteState } from './twse';
import type { MarketPreferences } from '../v3/model';

export type QuoteControllerStatus='live'|'afterHours'|'paused'|'holiday'|'offline'|'stopped'|'immediate'|'error';
export type QuoteRefreshOptions={market?:MarketPreferences;refreshOnForeground?:boolean};

const mins=(hhmm:string)=>{const m=/^(\d{1,2}):(\d{2})$/.exec(hhmm||'');if(!m)return 0;return Math.max(0,Math.min(23,Number(m[1])))*60+Math.max(0,Math.min(59,Number(m[2])))};
export function inTimeRange(now:Date,start:string,end:string){const cur=now.getHours()*60+now.getMinutes(),a=mins(start),b=mins(end);return a===b?true:a<b?cur>=a&&cur<b:cur>=a||cur<b;}
export function isTaiwanTradingDay(date=new Date()){const day=date.getDay();return day!==0&&day!==6;}
export function isTaiwanTradingHours(date=new Date()){return isTaiwanTradingDay(date)&&inTimeRange(date,'09:00','13:30');}

function pickMode(now:Date,market:MarketPreferences){
 if(market.stopAll)return {status:'stopped' as QuoteControllerStatus,seconds:0};
 if(!market.scheduleEnabled)return {status:'paused' as QuoteControllerStatus,seconds:0};
 if(!isTaiwanTradingDay(now))return {status:'holiday' as QuoteControllerStatus,seconds:0};
 if(market.live.enabled&&inTimeRange(now,market.live.start,market.live.end))return {status:'live' as QuoteControllerStatus,seconds:Math.max(1,Number(market.live.refreshSeconds)||1)};
 if(market.afterHours.enabled&&inTimeRange(now,market.afterHours.start,market.afterHours.end))return {status:'afterHours' as QuoteControllerStatus,seconds:Math.max(1,Number(market.afterHours.refreshSeconds)||60)};
 return {status:'paused' as QuoteControllerStatus,seconds:0};
}

export function useTwseQuotes(symbols:string[], market:MarketPreferences, options:QuoteRefreshOptions={}) {
 const key=useMemo(()=>[...symbols].sort().join(','),[symbols]);
 const [state,setState]=useState<QuoteState>({quotes:{}});
 const [clock,setClock]=useState(Date.now());
 const [immediate,setImmediate]=useState(false);
 const mounted=useRef(true); const refreshing=useRef(false); const failCount=useRef(0); const retryTimer=useRef<ReturnType<typeof setTimeout>|null>(null); const nextAllowedAt=useRef(0);
 const foreground=options.refreshOnForeground!==false;
 const mode=pickMode(new Date(clock),market);

 const refresh=useCallback(async(force=false)=>{
  if(market.stopAll)return false;
  const current=pickMode(new Date(),market);
  if(!force&&(current.status==='stopped'||current.status==='paused'||current.status==='holiday'))return false;
  if(!force&&Date.now()<nextAllowedAt.current)return false;
  if(refreshing.current)return false;
  refreshing.current=true;
  const attempt=Date.now();
  setState((prev:QuoteState)=>({...prev,lastAttemptAt:attempt,error:undefined}));
  try{
   const quotes=await fetchTwseQuotes(key.split(',').filter(Boolean));
   if(!mounted.current)return false;
   failCount.current=0; nextAllowedAt.current=0; if(retryTimer.current){clearTimeout(retryTimer.current);retryTimer.current=null;} setState((prev:QuoteState)=>({quotes:{...prev.quotes,...quotes},lastAttemptAt:attempt,lastSuccessAt:Date.now(),error:undefined}));
   return true;
  }catch(error){
   failCount.current+=1; const delay=Math.min(30000,[2000,5000,10000,20000,30000][Math.min(4,failCount.current-1)]); nextAllowedAt.current=Date.now()+delay; if(mounted.current){setState((prev:QuoteState)=>({...prev,lastAttemptAt:attempt,error:'行情暫時中斷，正在重新連線'})); if(!retryTimer.current)retryTimer.current=setTimeout(()=>{retryTimer.current=null;void refresh(true)},delay);} return false;
  }finally{refreshing.current=false;}
 },[key,market]);

 const immediateRefresh=useCallback(async()=>{
  if(market.stopAll)return false;
  setImmediate(true);
  try{return await refresh(true);}finally{if(mounted.current)setImmediate(false);}
 },[market.stopAll,refresh]);

 useEffect(()=>{const id=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{
  mounted.current=true;
  if(mode.seconds<=0)return()=>{mounted.current=false};
  void refresh(false);
  const id=setInterval(()=>void refresh(false),Math.max(1000,mode.seconds*1000));
  return()=>{mounted.current=false;clearInterval(id);if(retryTimer.current){clearTimeout(retryTimer.current);retryTimer.current=null;}};
 },[key,mode.status,mode.seconds,refresh]);
 useEffect(()=>{
  if(!foreground)return;
  const sub=AppState.addEventListener('change',(next:string)=>{if(next==='active'&&!market.stopAll)void immediateRefresh();});
  return()=>sub.remove();
 },[foreground,immediateRefresh,market.stopAll]);

 const controllerStatus:QuoteControllerStatus=immediate?'immediate':market.stopAll?'stopped':state.error?'error':mode.status;
 return {...state,refresh:immediateRefresh,refreshMs:mode.seconds*1000,marketOpen:isTaiwanTradingHours(new Date(clock)),source:'TWSE' as const,controllerStatus,controllerMode:mode.status,controllerSeconds:mode.seconds};
}
