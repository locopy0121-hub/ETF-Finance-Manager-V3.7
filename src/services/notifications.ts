import * as Notifications from 'expo-notifications';
import { DailySnapshot, CloseNotificationSettings, CloseNotificationField } from '../storage/appStorage';

try { Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner:true, shouldShowList:true, shouldPlaySound:false, shouldSetBadge:false }) }); } catch {}

export async function ensureNotificationPermission(){try{const current=await Notifications.getPermissionsAsync(); if(current?.status==='granted')return true; const asked=await Notifications.requestPermissionsAsync(); return asked?.status==='granted';}catch{return false;}}

function signed(n:number){return `${n>=0?'+':'-'}${Math.round(Math.abs(n)).toLocaleString('zh-TW')}`;}
function pctRatio(n:number){return `${n>=0?'+':''}${(n*100).toFixed(2)}%`;}
function compactFields(fields:CloseNotificationField[],showPercent:boolean){
 const out:CloseNotificationField[]=[];
 for(const f of fields){
  // If the money row already carries its percentage, do not waste a notification line on a duplicate percent row.
  if(showPercent&&f==='todayPnlPct'&&fields.includes('todayPnl'))continue;
  if(showPercent&&f==='totalPnlPct'&&fields.includes('totalPnl'))continue;
  if(!out.includes(f))out.push(f);
 }
 return out;
}

export async function sendCloseProfitNotification(snapshot:DailySnapshot,settings:CloseNotificationSettings){
 if(!settings.enabled) return false; const ok=await ensureNotificationPermission(); if(!ok)return false;
 const s:any=snapshot as any;
 const map:Record<CloseNotificationField,string>={
  todayPnl:`今日損益 ${signed(snapshot.todayPnl)}${settings.showPercent?` (${pctRatio(snapshot.todayPnlPct)})`:''}`,
  todayPnlPct:`今日損益 ${pctRatio(snapshot.todayPnlPct)}`,
  totalPnl:`累積總損益 ${signed(snapshot.totalPnl)}${settings.showPercent?` (${pctRatio(snapshot.totalPnlPct)})`:''}`,
  totalPnlPct:`累積總損益 ${pctRatio(snapshot.totalPnlPct)}`,
  marketValue:`持股總市值 ${Math.round(snapshot.marketValue).toLocaleString('zh-TW')}`,
  totalAssets:`總資產 ${Math.round(snapshot.totalAssets??snapshot.marketValue).toLocaleString('zh-TW')}`,
  historicalTradeCost:`累積成交成本 ${Math.round(s.historicalTradeCost??snapshot.totalCost).toLocaleString('zh-TW')}`,
  historicalBuyFees:`累積買進手續費 ${Math.round(s.historicalBuyFees??0).toLocaleString('zh-TW')}`,
  historicalCashOutflow:`累積現金支出 ${Math.round(s.historicalCashOutflow??snapshot.totalCost).toLocaleString('zh-TW')}`,
  pricePnl:`價格損益 ${signed(s.pricePnl??snapshot.costPnl)}`,
  cashUnrealizedPnl:`含費未實現損益 ${signed(s.cashUnrealizedPnl??snapshot.costPnl)}`,
  totalCost:`目前持有現金成本 ${Math.round(snapshot.totalCost).toLocaleString('zh-TW')}`,
  costPnl:`價格損益 ${signed(snapshot.costPnl)}`,
  cumulativeDividend:`累積配息 ${Math.round(snapshot.cumulativeDividend).toLocaleString('zh-TW')}`,
  updatedAt:`更新 ${new Date(snapshot.createdAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'})}`,
  selectedEtfPnl:(settings.selectedSymbols||[]).map(sym=>{const h=snapshot.holdings.find(x=>x.symbol===sym);return h?`${sym} ${signed(h.todayPnl)}`:''}).filter(Boolean).join('｜')||'指定 ETF：未選擇',
 };
 const raw=(settings.displayFields?.length?settings.displayFields:['todayPnl','totalPnl','marketValue']) as CloseNotificationField[];
 const fields=compactFields(raw,settings.showPercent);
 const lines=fields.map(f=>map[f]).filter(Boolean).slice(0,settings.maxLines||3);
 try{await Notifications.scheduleNotificationAsync({content:{title:settings.title||'ETF財務管家｜今日收盤',body:lines.join('\n'),data:{route:'dailyProfit'}},trigger:null}); return true;}catch{return false;}
}
