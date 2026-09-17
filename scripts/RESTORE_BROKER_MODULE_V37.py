from pathlib import Path
import re


def read(p): return Path(p).read_text(encoding='utf-8')
def write(p,s): Path(p).write_text(s,encoding='utf-8')
def replace_once(s,old,new,label):
    if old not in s: raise SystemExit(f'[PATCH FAIL] {label}: source not found')
    if s.count(old)!=1: raise SystemExit(f'[PATCH FAIL] {label}: expected 1, got {s.count(old)}')
    return s.replace(old,new,1)
def regex_once(s,pat,repl,label):
    out,n=re.subn(pat,repl,s,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'[PATCH FAIL] {label}: expected 1, got {n}')
    return out

broker='''export type BrokerProfileId = string;
export type RoundingMode = 'floor' | 'round' | 'ceil';
export type UnrealizedPLMode = 'NET' | 'GROSS';

export type BrokerProfile = {
  id: BrokerProfileId;
  name: string;
  commissionRate: number;
  commissionDiscount: number;
  minimumCommissionRoundLot: number;
  minimumCommissionOddLot: number;
  etfSellTaxRate: number;
  stockSellTaxRate: number;
  tradeAmountRounding: RoundingMode;
  commissionRounding: RoundingMode;
  taxRounding: RoundingMode;
  unrealizedPLMode: UnrealizedPLMode;
  includeEstimatedSellFee: boolean;
  includeEstimatedSellTax: boolean;
};

export const DEFAULT_BROKER_PROFILE_ID='default';
export const HUANAN_YONGCHANG_PROFILE_ID='huanan-yongchang';

export const defaultBrokerProfile:BrokerProfile={
  id:DEFAULT_BROKER_PROFILE_ID,name:'App 預設',commissionRate:0.001425,commissionDiscount:1,
  minimumCommissionRoundLot:20,minimumCommissionOddLot:1,etfSellTaxRate:0.001,stockSellTaxRate:0.003,
  tradeAmountRounding:'floor',commissionRounding:'floor',taxRounding:'floor',unrealizedPLMode:'GROSS',
  includeEstimatedSellFee:false,includeEstimatedSellTax:false,
};

// 華南永昌先恢復為正式 Profile；參數可從設定頁查看/調整，後續再用實際成交單校正。
export const huananYongchangBrokerProfile:BrokerProfile={
  ...defaultBrokerProfile,id:HUANAN_YONGCHANG_PROFILE_ID,name:'華南永昌證券',commissionDiscount:0.65,
  unrealizedPLMode:'NET',includeEstimatedSellFee:true,includeEstimatedSellTax:true,
};

export const builtInBrokerProfiles:BrokerProfile[]=[defaultBrokerProfile,huananYongchangBrokerProfile].map(x=>({...x}));
const n=(v:unknown,f:number)=>Number.isFinite(Number(v))?Number(v):f;
export function applyBrokerRounding(v:number,mode:RoundingMode){if(!Number.isFinite(v))return 0;return mode==='ceil'?Math.ceil(v):mode==='round'?Math.round(v):Math.floor(v)}
export function normalizeBrokerProfile(raw:Partial<BrokerProfile>|null|undefined,fallback:BrokerProfile=defaultBrokerProfile):BrokerProfile{const x=raw??{};return {...fallback,...x,id:String(x.id??fallback.id),name:String(x.name??fallback.name),commissionRate:Math.max(0,n(x.commissionRate,fallback.commissionRate)),commissionDiscount:Math.max(0,n(x.commissionDiscount,fallback.commissionDiscount)),minimumCommissionRoundLot:Math.max(0,n(x.minimumCommissionRoundLot,fallback.minimumCommissionRoundLot)),minimumCommissionOddLot:Math.max(0,n(x.minimumCommissionOddLot,fallback.minimumCommissionOddLot)),etfSellTaxRate:Math.max(0,n(x.etfSellTaxRate,fallback.etfSellTaxRate)),stockSellTaxRate:Math.max(0,n(x.stockSellTaxRate,fallback.stockSellTaxRate))}}
export function normalizeBrokerProfiles(raw:unknown):BrokerProfile[]{const src=Array.isArray(raw)?raw:builtInBrokerProfiles;const map=new Map<string,BrokerProfile>();map.set(DEFAULT_BROKER_PROFILE_ID,{...defaultBrokerProfile});for(const item of src){if(!item||typeof item!=='object')continue;const id=String((item as any).id??'').trim();if(!id)continue;const fb=id===HUANAN_YONGCHANG_PROFILE_ID?huananYongchangBrokerProfile:defaultBrokerProfile;map.set(id,normalizeBrokerProfile(item as Partial<BrokerProfile>,fb));}if(!Array.isArray(raw)&&!map.has(HUANAN_YONGCHANG_PROFILE_ID))map.set(HUANAN_YONGCHANG_PROFILE_ID,{...huananYongchangBrokerProfile});return [...map.values()]}
export function createBrokerProfile(name='新券商'):BrokerProfile{return {...defaultBrokerProfile,id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name}}
export function isHuananBroker(v?:string|null){const s=String(v??'').replace(/\\s+/g,'').toLowerCase();return s===HUANAN_YONGCHANG_PROFILE_ID||s.includes('華南永昌')}
export function resolveBrokerProfile(id?:string|null,profiles:BrokerProfile[]=builtInBrokerProfiles,legacyName?:string|null):BrokerProfile{const rows=normalizeBrokerProfiles(profiles);const key=String(id??'').trim();if(key){const hit=rows.find(x=>x.id===key);if(hit)return {...hit};}if(isHuananBroker(legacyName)){const h=rows.find(x=>x.id===HUANAN_YONGCHANG_PROFILE_ID);if(h)return {...h};}return {...(rows.find(x=>x.id===DEFAULT_BROKER_PROFILE_ID)??defaultBrokerProfile)}}
export function calculateBrokerTradeAmount(price:number,shares:number,p:BrokerProfile){return applyBrokerRounding(Math.max(0,price)*Math.max(0,shares),p.tradeAmountRounding)}
export function calculateBrokerCommission(amount:number,tradeMode:'ROUND_LOT'|'ODD_LOT',p:BrokerProfile){if(!(amount>0))return 0;const min=tradeMode==='ROUND_LOT'?p.minimumCommissionRoundLot:p.minimumCommissionOddLot;return Math.max(min,applyBrokerRounding(amount*p.commissionRate*p.commissionDiscount,p.commissionRounding))}
export function calculateBrokerSellTax(amount:number,p:BrokerProfile,instrument:'etf'|'stock'='etf'){const rate=instrument==='stock'?p.stockSellTaxRate:p.etfSellTaxRate;return amount>0?applyBrokerRounding(amount*rate,p.taxRounding):0}
'''
Path('src/data/brokerProfiles.ts').write_text(broker,encoding='utf-8')

# model
p='src/v3/model.ts';s=read(p)
s=replace_once(s,"import type { TradeMode } from '../types/etf';","import type { TradeMode } from '../types/etf';\nimport type { BrokerProfile } from '../data/brokerProfiles';",'model broker import')
s=replace_once(s,"  broker?: string;\n  account?: string;","  broker?: string;\n  brokerProfileId?: string;\n  account?: string;",'ledger profile id')
s=replace_once(s,"  appSettings: AppSettings;\n  dailySnapshots:","  appSettings: AppSettings;\n  brokerProfiles: BrokerProfile[];\n  defaultBrokerProfileId: string;\n  dailySnapshots:",'state broker registry')
write(p,s)

# types
p='src/types/etf.ts';s=read(p)
s=replace_once(s,"export type TransactionType = 'BUY' | 'SELL';","import type { BrokerProfile } from '../data/brokerProfiles';\n\nexport type TransactionType = 'BUY' | 'SELL';",'etf broker import')
s=replace_once(s,"  date: string;\n}","  date: string;\n  /** Resolved runtime brokerage parameters; supplied by Broker Profile Resolver. */\n  brokerProfile?: BrokerProfile;\n}",'transaction profile')
s=replace_once(s,"  dividendRecords: DividendRecord[];\n}","  dividendRecords: DividendRecord[];\n  /** Profile used for current-position liquidation estimates. */\n  brokerProfile?: BrokerProfile;\n}",'ETF item profile')
write(p,s)

# calculators: replace hard-wired commission/tax path with profile-driven path
p='src/utils/etfCalculators.ts';s=read(p)
s=replace_once(s,"} from '../types/etf';","} from '../types/etf';\nimport { calculateBrokerCommission, calculateBrokerSellTax, defaultBrokerProfile, type BrokerProfile } from '../data/brokerProfiles';",'calculator broker import')
s=regex_once(s,r"const getMinimumCommission = \(tradeMode: TradeMode\): number => \{.*?\n\};\n\nconst calculateCommission = \(.*?\n\};\n\nconst calculateETFSellTax = \(.*?\n\};","""export const resolveTransactionBrokerProfile=(profile?:BrokerProfile)=>profile??defaultBrokerProfile;\n\nconst calculateCommission = (tradeAmount:number,tradeMode:TradeMode,profile?:BrokerProfile):number => calculateBrokerCommission(nonNegative(tradeAmount),tradeMode,resolveTransactionBrokerProfile(profile));\n\nconst calculateETFSellTax = (tradeAmount:number,profile?:BrokerProfile):number => calculateBrokerSellTax(nonNegative(tradeAmount),resolveTransactionBrokerProfile(profile),'etf');""",'calculator hardcoded charges')
s=s.replace("    transaction.tradeMode,\n  );","    transaction.tradeMode,\n    transaction.brokerProfile,\n  );",1)
s=s.replace("          etf.liquidationTradeMode,\n        )","          etf.liquidationTradeMode,\n          etf.brokerProfile,\n        )",1)
s=s.replace("      ? calculateETFSellTax(currentMarketValue)","      ? calculateETFSellTax(currentMarketValue, etf.brokerProfile)",1)
write(p,s)

# engine
p='src/v3/engine.ts';s=read(p)
s=replace_once(s,"import type { LedgerEntry, MoneyPreferences } from './model';","import type { LedgerEntry, MoneyPreferences } from './model';\nimport { builtInBrokerProfiles, normalizeBrokerProfiles, resolveBrokerProfile, type BrokerProfile } from '../data/brokerProfiles';",'engine broker import')
s=replace_once(s,"let DISPLAY_MONEY:MoneyPreferences|undefined;","let RUNTIME_BROKER_PROFILES:BrokerProfile[]=normalizeBrokerProfiles(builtInBrokerProfiles);\nexport function configureBrokerProfiles(profiles?:BrokerProfile[]){RUNTIME_BROKER_PROFILES=normalizeBrokerProfiles(profiles);}\nexport function configuredBrokerProfiles(){return RUNTIME_BROKER_PROFILES.map(x=>({...x}));}\n\nlet DISPLAY_MONEY:MoneyPreferences|undefined;",'engine runtime profiles')
s=replace_once(s,"   date:e.date,\n  }))","   date:e.date,\n   brokerProfile:resolveBrokerProfile(e.brokerProfileId,RUNTIME_BROKER_PROFILES,e.broker),\n  }))",'engine transaction resolver')
s=replace_once(s," const transactions=canonicalTransactions(h.symbol,ledger);"," const transactions=canonicalTransactions(h.symbol,ledger);\n const holdingProfileId=(h as Holding&{brokerProfileId?:string}).brokerProfileId??[...ledger].reverse().find(e=>e.symbol===h.symbol&&(e.kind==='buy'||e.kind==='sell'))?.brokerProfileId;\n const brokerProfile=resolveBrokerProfile(holdingProfileId,RUNTIME_BROKER_PROFILES,h.broker);",'engine holding resolver')
s=replace_once(s,"  dividendRecords:canonicalDividendRecords(h.symbol,dividends),","  dividendRecords:canonicalDividendRecords(h.symbol,dividends),\n  brokerProfile,",'ETF profile binding')
s=replace_once(s,"  dividendRecords:[],\n };","  dividendRecords:[],\n  brokerProfile:tx.brokerProfile,\n };",'sale profile binding')
write(p,s)

# storage
p='src/v3/storage.ts';s=read(p)
s=replace_once(s,"import { defaultRegisteredNodes } from '../ui/universalRegistry';","import { defaultRegisteredNodes } from '../ui/universalRegistry';\nimport { DEFAULT_BROKER_PROFILE_ID, HUANAN_YONGCHANG_PROFILE_ID, normalizeBrokerProfiles, resolveBrokerProfile } from '../data/brokerProfiles';",'storage broker import')
s=replace_once(s,"const SCHEMA=18;","const SCHEMA=19;",'schema 19')
s=replace_once(s,"function canonicalSellCharges(symbol:string,shares:number,price:number,mode:TradeMode){const tx:Transaction={id:'migration-probe',etfCode:symbol,type:'BUY',tradeMode:mode,shares,price,date:'2000-01-01'};const item:ETFItem={etfCode:symbol,name:symbol,currentPrice:price,liquidationTradeMode:mode,dividendFrequency:1,transactions:[tx],dividendRecords:[]};const s=calculateETFSummary(item);return {amount:s.currentMarketValue,fee:s.estimatedSellCommission,tax:s.estimatedSellTax};}","function canonicalSellCharges(symbol:string,shares:number,price:number,mode:TradeMode,brokerProfile:any){const tx:Transaction={id:'migration-probe',etfCode:symbol,type:'BUY',tradeMode:mode,shares,price,date:'2000-01-01',brokerProfile};const item:ETFItem={etfCode:symbol,name:symbol,currentPrice:price,liquidationTradeMode:mode,dividendFrequency:1,transactions:[tx],dividendRecords:[],brokerProfile};const s=calculateETFSummary(item);return {amount:s.currentMarketValue,fee:s.estimatedSellCommission,tax:s.estimatedSellTax};}",'migration sell profile')
s=replace_once(s," const stripRemovedFinanceOverrides=(raw:any)=>{const rest={...raw};for(const key of Object.keys(rest))if(/^(feeRate|feeDiscount)$|broker.*profile/i.test(key))delete rest[key];return rest;};"," const stripRemovedFinanceOverrides=(raw:any)=>{const rest={...raw};for(const key of Object.keys(rest))if(/^(feeRate|feeDiscount)$/i.test(key))delete rest[key];return rest;};\n const brokerProfiles=normalizeBrokerProfiles((p as any).brokerProfiles);\n const defaultBrokerProfileId=String((p as any).defaultBrokerProfileId??DEFAULT_BROKER_PROFILE_ID);",'preserve broker profile ids')
old="const rawLedger=(Array.isArray(p.ledger)&&p.ledger.length?p.ledger:seedLedgerFromHoldings(normalizedHoldings)).map((raw:any)=>{const rest=stripRemovedFinanceOverrides(raw);if(raw.kind!=='buy'&&raw.kind!=='sell')return rest;const shares=Math.max(0,Number(raw.shares)||0),price=Math.max(0,Number(raw.price)||0),tradeMode=validMode(raw.tradeMode)?raw.tradeMode:inferMode(shares);if(raw.kind==='buy'){const buy=calculatePurchaseCost({id:String(raw.id),etfCode:String(raw.symbol??''),type:'BUY',tradeMode,shares,price,date:String(raw.date??'')});return {...rest,tradeMode,amount:buy.tradeAmount,fee:buy.commission,tax:0};}const sell=canonicalSellCharges(String(raw.symbol??''),shares,price,tradeMode);return {...rest,tradeMode,amount:sell.amount,fee:sell.fee,tax:sell.tax};});"
new="const rawLedger=(Array.isArray(p.ledger)&&p.ledger.length?p.ledger:seedLedgerFromHoldings(normalizedHoldings)).map((raw:any)=>{const rest=stripRemovedFinanceOverrides(raw);if(raw.kind!=='buy'&&raw.kind!=='sell')return rest;const shares=Math.max(0,Number(raw.shares)||0),price=Math.max(0,Number(raw.price)||0),tradeMode=validMode(raw.tradeMode)?raw.tradeMode:inferMode(shares);const inferredId=raw.brokerProfileId??(String(raw.broker??'').includes('華南永昌')?HUANAN_YONGCHANG_PROFILE_ID:defaultBrokerProfileId);const profile=resolveBrokerProfile(inferredId,brokerProfiles,raw.broker);if(raw.kind==='buy'){const buy=calculatePurchaseCost({id:String(raw.id),etfCode:String(raw.symbol??''),type:'BUY',tradeMode,shares,price,date:String(raw.date??''),brokerProfile:profile});return {...rest,broker:raw.broker??profile.name,brokerProfileId:profile.id,tradeMode,amount:buy.tradeAmount,fee:buy.commission,tax:0};}const sell=canonicalSellCharges(String(raw.symbol??''),shares,price,tradeMode,profile);return {...rest,broker:raw.broker??profile.name,brokerProfileId:profile.id,tradeMode,amount:sell.amount,fee:sell.fee,tax:sell.tax};});"
s=replace_once(s,old,new,'ledger broker migration')
s=replace_once(s,"  appSettings:{...defaultAppSettings,","  brokerProfiles,\n  defaultBrokerProfileId,\n  appSettings:{...defaultAppSettings,",'persist broker registry')
write(p,s)

# screens imports and common
p='src/v3/screensBase.tsx';s=read(p)
s=replace_once(s,"import { EffectSurface } from '../ui/EffectSurface';","import { EffectSurface } from '../ui/EffectSurface';\nimport { createBrokerProfile, normalizeBrokerProfiles, resolveBrokerProfile, type BrokerProfile } from '../data/brokerProfiles';",'screens broker import')
s=replace_once(s,"export type ScreenCommon={holdings:Holding[];quotes:Record<string,QuoteLike>;ledger:LedgerEntry[];cashBalance:number;dividends:DividendEvent[];prefs:V3Preferences;dailySnapshots:DailySnapshot[];intradayPnlPoints:IntradayPnlPoint[];appSettings:AppSettings;","export type ScreenCommon={holdings:Holding[];quotes:Record<string,QuoteLike>;ledger:LedgerEntry[];cashBalance:number;dividends:DividendEvent[];prefs:V3Preferences;dailySnapshots:DailySnapshot[];intradayPnlPoints:IntradayPnlPoint[];brokerProfiles:BrokerProfile[];defaultBrokerProfileId:string;appSettings:AppSettings;",'ScreenCommon broker registry')
# Ledger signatures
s=replace_once(s,"onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;tradeMode:TradeMode;strategy:'long'|'swing';account:string})=>void;onSell:(x:{symbol:string;date:string;shares:number;price:number;tradeMode:TradeMode})=>void;","onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;tradeMode:TradeMode;strategy:'long'|'swing';account:string;brokerProfileId:string})=>void;onSell:(x:{symbol:string;date:string;shares:number;price:number;tradeMode:TradeMode;brokerProfileId:string})=>void;",'Ledger broker payloads')
s=replace_once(s,"const [amount,setAmount]=useState(''); const [cashNote,setCashNote]=useState('');","const [amount,setAmount]=useState(''); const [cashNote,setCashNote]=useState(''); const [brokerProfileId,setBrokerProfileId]=useState(common.defaultBrokerProfileId); const selectedBroker=resolveBrokerProfile(brokerProfileId,common.brokerProfiles);",'Ledger selected broker')
s=replace_once(s,"const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const previewTx:Transaction={id:'preview',etfCode:symbol||'PREVIEW',type:'BUY',tradeMode,shares:Math.max(0,Number(shares||0)),price:Math.max(0,Number(price||0)),date:dateText};","const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const previewTx:Transaction={id:'preview',etfCode:symbol||'PREVIEW',type:'BUY',tradeMode,shares:Math.max(0,Number(shares||0)),price:Math.max(0,Number(price||0)),date:dateText,brokerProfile:selectedBroker};",'Ledger preview broker')
s=s.replace("onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),tradeMode,strategy,account});","onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),tradeMode,strategy,account,brokerProfileId});",1)
s=s.replace("onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),tradeMode});","onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),tradeMode,brokerProfileId});",1)
s=s.replace("Alert.alert('完成','已依華南永昌唯一金融核心寫入帳務資料。');","Alert.alert('完成',`已依「${selectedBroker.name}」Profile 寫入共用帳務核心。`);",1)
# insert ledger broker selector after metrics
s=regex_once(s,r"(<SelectedMetrics page=\"ledger\".*?/>\n)(\s*<Card><SectionTitle title=\"現金資金)",r"\1  <Card><SectionTitle title=\"交易券商\" right={selectedBroker.name}/><Text style={s.note}>券商只提供費率、最低費用、稅率與取整參數；所有券商共用同一套金融公式。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.symbolChips}>{normalizeBrokerProfiles(common.brokerProfiles).map(b=><Choice key={b.id} active={brokerProfileId===b.id} label={b.name} onPress={()=>setBrokerProfileId(b.id)}/>)}</ScrollView></Card>\n  \2",'ledger broker picker')
# settings manager component
insert='''\nfunction BrokerProfileManager({profiles,defaultId,onProfilesChange,onDefaultChange}:{profiles:BrokerProfile[];defaultId:string;onProfilesChange:(x:BrokerProfile[])=>void;onDefaultChange:(id:string)=>void}){\n const rows=normalizeBrokerProfiles(profiles); const [selectedId,setSelectedId]=useState(defaultId); const selected=rows.find(x=>x.id===selectedId)??rows[0]; if(!selected)return null;\n const commit=(patch:Partial<BrokerProfile>)=>onProfilesChange(rows.map(x=>x.id===selected.id?{...x,...patch}:x));\n const num=(label:string,key:keyof BrokerProfile,digits=6)=><Field label={label} value={String(selected[key]??'')} onChange={v=>commit({[key]:Math.max(0,Number(v)||0)} as Partial<BrokerProfile>)} keyboard=\"decimal-pad\"/>;\n return <><Card><SectionTitle title=\"券商 Profile 管理\" right={`${rows.length} 組`}/><Text style={s.note}>這裡就是帳務系統的券商參數來源。交易保存穩定 brokerProfileId；刪除 Profile 不刪歷史交易，無法解析時回到 App 預設。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.symbolChips}>{rows.map(b=><Choice key={b.id} active={selected.id===b.id} label={b.name} onPress={()=>setSelectedId(b.id)}/>)}</ScrollView><View style={s.manageRow}><TouchableOpacity style={s.editAction} onPress={()=>{const b=createBrokerProfile();onProfilesChange([...rows,b]);setSelectedId(b.id)}}><Text style={s.editActionText}>＋ 新增券商</Text></TouchableOpacity><TouchableOpacity style={s.secondarySmall} onPress={()=>onDefaultChange(selected.id)}><Text style={s.secondaryText}>{defaultId===selected.id?'✓ App 預設':'設為 App 預設'}</Text></TouchableOpacity>{selected.id!=='default'?<TouchableOpacity style={s.deleteAction} onPress={()=>Alert.alert('刪除券商',`確定刪除「${selected.name}」？歷史交易不刪除。`,[{text:'取消',style:'cancel'},{text:'刪除',style:'destructive',onPress:()=>{onProfilesChange(rows.filter(x=>x.id!==selected.id));setSelectedId('default')}}])}><Text style={s.deleteActionText}>刪除</Text></TouchableOpacity>:null}</View></Card><Card><SectionTitle title=\"帳務參數\" right={selected.id}/><Field label=\"券商名稱\" value={selected.name} onChange={name=>commit({name})}/>{num('手續費率', 'commissionRate')}{num('手續費折扣係數', 'commissionDiscount',4)}{num('整股最低手續費', 'minimumCommissionRoundLot',0)}{num('零股 / 定期定額最低手續費', 'minimumCommissionOddLot',0)}{num('ETF 賣出證交稅率', 'etfSellTaxRate')}{num('股票賣出證交稅率', 'stockSellTaxRate')}<SettingRow label=\"成交金額取整\"><Choice active={selected.tradeAmountRounding==='floor'} label=\"無條件捨去\" onPress={()=>commit({tradeAmountRounding:'floor'})}/><Choice active={selected.tradeAmountRounding==='round'} label=\"四捨五入\" onPress={()=>commit({tradeAmountRounding:'round'})}/><Choice active={selected.tradeAmountRounding==='ceil'} label=\"無條件進位\" onPress={()=>commit({tradeAmountRounding:'ceil'})}/></SettingRow><SettingRow label=\"手續費取整\"><Choice active={selected.commissionRounding==='floor'} label=\"無條件捨去\" onPress={()=>commit({commissionRounding:'floor'})}/><Choice active={selected.commissionRounding==='round'} label=\"四捨五入\" onPress={()=>commit({commissionRounding:'round'})}/><Choice active={selected.commissionRounding==='ceil'} label=\"無條件進位\" onPress={()=>commit({commissionRounding:'ceil'})}/></SettingRow><SettingRow label=\"稅額取整\"><Choice active={selected.taxRounding==='floor'} label=\"無條件捨去\" onPress={()=>commit({taxRounding:'floor'})}/><Choice active={selected.taxRounding==='round'} label=\"四捨五入\" onPress={()=>commit({taxRounding:'round'})}/><Choice active={selected.taxRounding==='ceil'} label=\"無條件進位\" onPress={()=>commit({taxRounding:'ceil'})}/></SettingRow><SettingRow label=\"未實現損益 / 帳面價值\"><Choice active={selected.unrealizedPLMode==='GROSS'} label=\"GROSS 毛市值\" onPress={()=>commit({unrealizedPLMode:'GROSS',includeEstimatedSellFee:false,includeEstimatedSellTax:false})}/><Choice active={selected.unrealizedPLMode==='NET'} label=\"NET 淨清算\" onPress={()=>commit({unrealizedPLMode:'NET'})}/></SettingRow><ToggleSetting label=\"NET 扣預估賣出手續費\" value={selected.includeEstimatedSellFee} onChange={includeEstimatedSellFee=>commit({includeEstimatedSellFee})}/><ToggleSetting label=\"NET 扣預估 ETF 證交稅\" value={selected.includeEstimatedSellTax} onChange={includeEstimatedSellTax=>commit({includeEstimatedSellTax})}/></Card></>;\n}\n\n'''
s=replace_once(s,"\n\nexport function SettingsModal(",insert+"export function SettingsModal(",'insert broker manager')
s=replace_once(s,"cashBalance,lastSuccessAt,onChange,onWidgetChange","cashBalance,lastSuccessAt,brokerProfiles,defaultBrokerProfileId,onBrokerProfilesChange,onDefaultBrokerProfileChange,onChange,onWidgetChange",'settings destructure broker')
s=replace_once(s,"cashBalance:number;lastSuccessAt?:number;onChange:","cashBalance:number;lastSuccessAt?:number;brokerProfiles:BrokerProfile[];defaultBrokerProfileId:string;onBrokerProfilesChange:(x:BrokerProfile[])=>void;onDefaultBrokerProfileChange:(id:string)=>void;onChange:",'settings broker props')
s=replace_once(s,"|'monitor'|'ota'|'data'>('theme')","|'monitor'|'broker'|'ota'|'data'>('theme')",'settings broker union')
s=replace_once(s," {section==='theme'?<>"," {section==='broker'?<BrokerProfileManager profiles={brokerProfiles} defaultId={defaultBrokerProfileId} onProfilesChange={onBrokerProfilesChange} onDefaultChange={onDefaultBrokerProfileChange}/>:null}\n {section==='theme'?<>",'render broker section')
write(p,s)

# App wiring
p='App.tsx';s=read(p)
s=replace_once(s,"import { configureDisplayPreferences, calculateDividendIncome,","import { configureBrokerProfiles, configureDisplayPreferences, calculateDividendIncome,",'App engine broker config')
s=replace_once(s,"import { setImmersiveEditor } from './src/services/nativeUi';","import { setImmersiveEditor } from './src/services/nativeUi';\nimport { HUANAN_YONGCHANG_PROFILE_ID, resolveBrokerProfile, type BrokerProfile } from './src/data/brokerProfiles';",'App broker import')
s=replace_once(s,"function rebuildHoldingsFromLedger(holdings:Holding[],ledger:LedgerEntry[],symbols:string[]){","function rebuildHoldingsFromLedger(holdings:Holding[],ledger:LedgerEntry[],symbols:string[],brokerProfiles:BrokerProfile[]){",'rebuild signature')
s=s.replace("const buy=calculatePurchaseCost({id:e.id,etfCode:symbol,type:'BUY',tradeMode,shares,price,date:e.date});","const brokerProfile=resolveBrokerProfile(e.brokerProfileId,brokerProfiles,e.broker);const buy=calculatePurchaseCost({id:e.id,etfCode:symbol,type:'BUY',tradeMode,shares,price,date:e.date,brokerProfile});",1)
s=s.replace("broker:'華南永昌證券',account:first.account||existing?.account","broker:first.broker||existing?.broker,brokerProfileId:first.brokerProfileId,account:first.account||existing?.account",1)
s=replace_once(s," const p=state.preferences; configureDisplayPreferences(p.money);"," const p=state.preferences; configureBrokerProfiles(state.brokerProfiles); configureDisplayPreferences(p.money);",'configure runtime profiles')
s=replace_once(s,"const common:ScreenCommon={holdings:state.holdings,quotes:quotes.quotes as any,ledger:state.ledger,cashBalance:state.cashBalance,dividends:state.dividends,prefs:p,dailySnapshots:state.dailySnapshots,intradayPnlPoints:state.intradayPnlPoints??[],appSettings:state.appSettings,","const common:ScreenCommon={holdings:state.holdings,quotes:quotes.quotes as any,ledger:state.ledger,cashBalance:state.cashBalance,dividends:state.dividends,prefs:p,dailySnapshots:state.dailySnapshots,intradayPnlPoints:state.intradayPnlPoints??[],brokerProfiles:state.brokerProfiles,defaultBrokerProfileId:state.defaultBrokerProfileId,appSettings:state.appSettings,",'common broker registry')
# buy/sell handlers
s=replace_once(s,"const addBuy=(x:{symbol:string;name:string;date:string;shares:number;price:number;tradeMode:TradeMode;strategy:'long'|'swing';account:string})=>patch(s=>{","const addBuy=(x:{symbol:string;name:string;date:string;shares:number;price:number;tradeMode:TradeMode;strategy:'long'|'swing';account:string;brokerProfileId:string})=>patch(s=>{\n  const brokerProfile=resolveBrokerProfile(x.brokerProfileId,s.brokerProfiles);",'addBuy broker payload')
s=s.replace("const purchase=calculatePurchaseCost({id:id(),etfCode:x.symbol,type:'BUY',tradeMode:x.tradeMode,shares:x.shares,price:x.price,date:x.date});","const purchase=calculatePurchaseCost({id:id(),etfCode:x.symbol,type:'BUY',tradeMode:x.tradeMode,shares:x.shares,price:x.price,date:x.date,brokerProfile});",1)
s=s.replace("broker:'華南永昌證券',account:x.account||h.account","broker:brokerProfile.name,brokerProfileId:brokerProfile.id,account:x.account||h.account",1)
s=s.replace("broker:'華南永昌證券',account:x.account,fallbackPrice","broker:brokerProfile.name,brokerProfileId:brokerProfile.id,account:x.account,fallbackPrice",1)
s=s.replace("strategy:x.strategy,broker:'華南永昌證券',account:x.account","strategy:x.strategy,broker:brokerProfile.name,brokerProfileId:brokerProfile.id,account:x.account",1)
s=replace_once(s,"const addSell=(x:{symbol:string;date:string;shares:number;price:number;tradeMode:TradeMode})=>patch(s=>{","const addSell=(x:{symbol:string;date:string;shares:number;price:number;tradeMode:TradeMode;brokerProfileId:string})=>patch(s=>{const brokerProfile=resolveBrokerProfile(x.brokerProfileId,s.brokerProfiles);",'addSell broker payload')
s=s.replace("transactions:[{id:'sell-preview',etfCode:x.symbol,type:'BUY',tradeMode:x.tradeMode,shares:x.shares,price:x.price,date:x.date}],dividendRecords:[]","transactions:[{id:'sell-preview',etfCode:x.symbol,type:'BUY',tradeMode:x.tradeMode,shares:x.shares,price:x.price,date:x.date,brokerProfile}],dividendRecords:[],brokerProfile",1)
s=s.replace("tax,broker:'華南永昌證券',account:h.account","tax,broker:brokerProfile.name,brokerProfileId:brokerProfile.id,account:h.account",1)
s=s.replace("rebuildHoldingsFromLedger(s.holdings,ledger,affected)","rebuildHoldingsFromLedger(s.holdings,ledger,affected,s.brokerProfiles)")
# Settings props
s=replace_once(s,"cashBalance={state.cashBalance} lastSuccessAt={quotes.lastSuccessAt} onChange=","cashBalance={state.cashBalance} lastSuccessAt={quotes.lastSuccessAt} brokerProfiles={state.brokerProfiles} defaultBrokerProfileId={state.defaultBrokerProfileId} onBrokerProfilesChange={brokerProfiles=>patch(s=>({...s,brokerProfiles}))} onDefaultBrokerProfileChange={defaultBrokerProfileId=>patch(s=>({...s,defaultBrokerProfileId}))} onChange=",'Settings broker props')
write(p,s)

print('BROKER_MODULE_RESTORE_PATCH_OK')
