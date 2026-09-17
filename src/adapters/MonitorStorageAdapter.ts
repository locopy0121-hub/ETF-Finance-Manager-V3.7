import AsyncStorage from '@react-native-async-storage/async-storage';
import type {MonitorPersistedSettings,TemplateModeConfig} from '../types/monitor';
import {DEFAULT_MINI_LAYOUT,DEFAULT_NORMAL_LAYOUT} from '../types/monitor';

export const MONITOR_SETTINGS_KEY='monitor_settings_v3';

export const defaultMiniConfig:TemplateModeConfig={
 displayFields:['symbol','price','changePct'],
 fieldOrder:['symbol','price','changePct'],
 maxDisplayCount:3,
 layoutType:'LIST',
 fontSize:11,
 textAlign:'center',
 itemSpacing:4,
 backgroundColor:'#08111F',
 opacity:.92,
 borderRadius:12,
 borderWidth:1,
 borderColor:'#3AC7FF',
};

export const defaultMonitorSettings:MonitorPersistedSettings={
 normalLayout:{...DEFAULT_NORMAL_LAYOUT},
 miniLayout:{...DEFAULT_MINI_LAYOUT},
 isMinimized:false,
 activeTemplateId:'holdingList',
 templateOverrides:{},
 miniConfig:{...defaultMiniConfig,displayFields:[...defaultMiniConfig.displayFields],fieldOrder:[...defaultMiniConfig.fieldOrder]},
 refreshInterval:5,
 colorSettings:{},
};

const rect=(raw:any,fallback:typeof DEFAULT_NORMAL_LAYOUT)=>({
 x:Number.isFinite(Number(raw?.x))?Number(raw.x):fallback.x,
 y:Number.isFinite(Number(raw?.y))?Number(raw.y):fallback.y,
 width:Math.max(48,Number(raw?.width)||fallback.width),
 height:Math.max(32,Number(raw?.height)||fallback.height),
});

const normalize=(raw:any):MonitorPersistedSettings=>({
 ...defaultMonitorSettings,
 ...(raw??{}),
 normalLayout:rect(raw?.normalLayout,DEFAULT_NORMAL_LAYOUT),
 miniLayout:rect(raw?.miniLayout,DEFAULT_MINI_LAYOUT),
 isMinimized:Boolean(raw?.isMinimized),
 activeTemplateId:String(raw?.activeTemplateId??defaultMonitorSettings.activeTemplateId),
 templateOverrides:raw?.templateOverrides&&typeof raw.templateOverrides==='object'?raw.templateOverrides:{},
 miniConfig:{...defaultMiniConfig,...(raw?.miniConfig??{}),displayFields:Array.isArray(raw?.miniConfig?.displayFields)?raw.miniConfig.displayFields:[...defaultMiniConfig.displayFields],fieldOrder:Array.isArray(raw?.miniConfig?.fieldOrder)?raw.miniConfig.fieldOrder:[...defaultMiniConfig.fieldOrder]},
 refreshInterval:Math.max(1,Number(raw?.refreshInterval)||5),
 colorSettings:raw?.colorSettings&&typeof raw.colorSettings==='object'?raw.colorSettings:{},
});

export const MonitorStorageAdapter={
 async load():Promise<MonitorPersistedSettings>{
  try{const raw=await AsyncStorage.getItem(MONITOR_SETTINGS_KEY);return raw?normalize(JSON.parse(raw)):normalize(null);}catch{return normalize(null);}
 },
 async save(settings:MonitorPersistedSettings):Promise<void>{await AsyncStorage.setItem(MONITOR_SETTINGS_KEY,JSON.stringify(normalize(settings)));},
 async patch(patch:Partial<MonitorPersistedSettings>):Promise<MonitorPersistedSettings>{const current=await this.load();const next=normalize({...current,...patch});await this.save(next);return next;},
 async clear():Promise<void>{await AsyncStorage.removeItem(MONITOR_SETTINGS_KEY);},
};
