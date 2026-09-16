import AsyncStorage from '@react-native-async-storage/async-storage';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { APP_STATE_KEY, STORAGE_SCHEMA_VERSION } from '../storage/appStorage';
import { V3_STATE_KEY } from '../v3/storage';
import { fetchTwseQuotes } from './twse';
import { buildDailySnapshot, upsertSnapshot } from './dailySnapshots';
import { sendCloseProfitNotification } from './notifications';
import { configureAccountingFeeSettings } from '../v3/engine';

export const CLOSE_BACKGROUND_TASK='ETF_FINANCE_CLOSE_SNAPSHOT';
try {
  TaskManager.defineTask(CLOSE_BACKGROUND_TASK, async () => {
    try {
      const v3Raw=await AsyncStorage.getItem(V3_STATE_KEY); const oldRaw=v3Raw?null:await AsyncStorage.getItem(APP_STATE_KEY); const raw=v3Raw??oldRaw; if(!raw)return BackgroundTask.BackgroundTaskResult.Success;
      const state=JSON.parse(raw); const isV3=!!v3Raw; const cfg=(isV3?state?.appSettings?.closeNotification:state?.settings?.closeNotification); if(!cfg?.enabled)return BackgroundTask.BackgroundTaskResult.Success;
      const d=new Date(); if(cfg.weekdaysOnly&&(d.getDay()===0||d.getDay()===6))return BackgroundTask.BackgroundTaskResult.Success;
      const hhmm=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; if(hhmm<(cfg.time??'13:35'))return BackgroundTask.BackgroundTaskResult.Success;
      const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; const snapshots=Array.isArray(state.dailySnapshots)?state.dailySnapshots:[]; if(snapshots.some((x:any)=>x.date===date))return BackgroundTask.BackgroundTaskResult.Success;
      const holdings=Array.isArray(state.holdings)?state.holdings:[]; if(!holdings.length)return BackgroundTask.BackgroundTaskResult.Success;
      const quotes=await fetchTwseQuotes(holdings.map((h:any)=>h.symbol)); if(!Object.keys(quotes).length)return BackgroundTask.BackgroundTaskResult.Failed;
      const ledger=isV3&&Array.isArray(state.ledger)?state.ledger:[]; const dividends=isV3&&Array.isArray(state.dividends)?state.dividends:[]; const cashBalance=isV3?Number(state.cashBalance??0):0; if(isV3)configureAccountingFeeSettings(state.feeSettings); const snap=buildDailySnapshot(holdings,quotes,ledger,dividends,d,cashBalance); const next={...state,...(!isV3?{schemaVersion:STORAGE_SCHEMA_VERSION}:{}),dailySnapshots:upsertSnapshot(snapshots,snap),savedAt:Date.now()}; await AsyncStorage.setItem(isV3?V3_STATE_KEY:APP_STATE_KEY,JSON.stringify(next)); await sendCloseProfitNotification(snap,cfg); return BackgroundTask.BackgroundTaskResult.Success;
    } catch { return BackgroundTask.BackgroundTaskResult.Failed; }
  });
} catch {}
export async function setCloseBackgroundTaskEnabled(enabled:boolean){try{const registered=await TaskManager.isTaskRegisteredAsync(CLOSE_BACKGROUND_TASK); if(enabled&&!registered)await BackgroundTask.registerTaskAsync(CLOSE_BACKGROUND_TASK,{minimumInterval:15}); if(!enabled&&registered)await BackgroundTask.unregisterTaskAsync(CLOSE_BACKGROUND_TASK);}catch{}}
