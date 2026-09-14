import AsyncStorage from '@react-native-async-storage/async-storage';
import type { V3State } from './model';

const KEY='@etf-finance-manager/safety-backups-v341';
export type SafetyBackupKind='records'|'portfolio'|'cash'|'pnl'|'all';
export type SafetyBackup={id:string;createdAt:number;kind:SafetyBackupKind;reason:string;range?:string;count:number;state:V3State};
const MAX_BACKUPS=8;

export async function listSafetyBackups():Promise<SafetyBackup[]>{
  try{const raw=await AsyncStorage.getItem(KEY);const rows=raw?JSON.parse(raw):[];return Array.isArray(rows)?rows:[];}catch{return []}
}
export async function createSafetyBackup(state:V3State,kind:SafetyBackupKind,reason:string,range?:string){
  const rows=await listSafetyBackups();
  const count=kind==='portfolio'?state.holdings.length:kind==='cash'?state.ledger.filter(x=>x.kind==='cashIn'||x.kind==='cashOut').length:kind==='pnl'?state.dailySnapshots.length:kind==='records'?state.ledger.length:state.ledger.length+state.holdings.length+state.dailySnapshots.length;
  const item:SafetyBackup={id:`safe-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,createdAt:Date.now(),kind,reason,range,count,state:JSON.parse(JSON.stringify(state))};
  const next=[item,...rows].slice(0,MAX_BACKUPS);
  await AsyncStorage.setItem(KEY,JSON.stringify(next));
  return item;
}
export async function restoreSafetyBackup(id:string){
  const rows=await listSafetyBackups();
  const found=rows.find(x=>x.id===id);
  return found?JSON.parse(JSON.stringify(found.state)) as V3State:null;
}
export async function deleteSafetyBackup(id:string){
  const rows=await listSafetyBackups();
  await AsyncStorage.setItem(KEY,JSON.stringify(rows.filter(x=>x.id!==id)));
}
