import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { SavingsPlan, V3State } from './model';
import { normalizeImportedV3State } from './storage';
import { APP_SEMVER } from './version';

const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
const root=()=>FileSystem.documentDirectory??FileSystem.cacheDirectory??'';

export async function exportFullBackup(state:V3State){
 const payload={format:'ETF_FINANCE_MANAGER_V3_BACKUP',schemaVersion:3,createdAt:new Date().toISOString(),appVersion:APP_SEMVER,state};
 const uri=`${root()}ETF-FINANCE-MANAGER-V3-BACKUP-${stamp()}.json`;
 await FileSystem.writeAsStringAsync(uri,JSON.stringify(payload,null,2),{encoding:FileSystem.EncodingType.UTF8});
 if(await Sharing.isAvailableAsync())await Sharing.shareAsync(uri,{mimeType:'application/json',dialogTitle:'匯出 ETF財務管家完整備份'});
 return uri;
}

export async function importFullBackup():Promise<{state:V3State;summary:string}|null>{
 const picked:any=await DocumentPicker.getDocumentAsync({type:['application/json','text/json','text/plain'],copyToCacheDirectory:true,multiple:false});
 if(picked.canceled)return null; const asset=picked.assets?.[0]; if(!asset?.uri)throw new Error('未取得備份檔案。');
 const text=await FileSystem.readAsStringAsync(asset.uri,{encoding:FileSystem.EncodingType.UTF8}); const raw=JSON.parse(text);
 if(raw?.format!=='ETF_FINANCE_MANAGER_V3_BACKUP'||!raw?.state)throw new Error('這不是 ETF財務管家 V3 完整備份檔。');
 const state=normalizeImportedV3State(raw.state);
 const summary=`庫存 ${state.holdings.length} 檔、帳務 ${state.ledger.length} 筆、配息事件 ${state.dividends.length} 筆、存股計畫 ${state.savingsPlans.length} 組`;
 return {state,summary};
}

export async function exportSavingsPlan(plan:SavingsPlan){
 const payload={format:'ETF_FINANCE_MANAGER_V3_SAVINGS_PLAN',schemaVersion:1,createdAt:new Date().toISOString(),plan};
 const safe=plan.name.replace(/[\\/:*?"<>|]/g,'-').slice(0,40)||'plan'; const uri=`${root()}ETF-PLAN-${safe}-${stamp()}.json`;
 await FileSystem.writeAsStringAsync(uri,JSON.stringify(payload,null,2),{encoding:FileSystem.EncodingType.UTF8});
 if(await Sharing.isAvailableAsync())await Sharing.shareAsync(uri,{mimeType:'application/json',dialogTitle:'匯出存股計畫'});
 return uri;
}

export async function importSavingsPlan():Promise<SavingsPlan|null>{
 const picked:any=await DocumentPicker.getDocumentAsync({type:['application/json','text/json','text/plain'],copyToCacheDirectory:true,multiple:false});
 if(picked.canceled)return null; const asset=picked.assets?.[0]; if(!asset?.uri)throw new Error('未取得存股計畫檔案。');
 const text=await FileSystem.readAsStringAsync(asset.uri,{encoding:FileSystem.EncodingType.UTF8}); const raw=JSON.parse(text);
 if(raw?.format!=='ETF_FINANCE_MANAGER_V3_SAVINGS_PLAN'||!raw?.plan)throw new Error('這不是 ETF財務管家存股計畫檔。');
 const p=raw.plan as SavingsPlan; if(!p.id||!p.name||!Array.isArray(p.allocations))throw new Error('存股計畫內容不完整。');
 return {...p,id:`import-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name:`${p.name}（匯入）`,createdAt:Date.now(),updatedAt:Date.now()};
}
