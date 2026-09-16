from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'[PATCH FAIL] {label}: source text not found')
    if text.count(old) != 1:
        raise SystemExit(f'[PATCH FAIL] {label}: expected 1 match, got {text.count(old)}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label):
    out, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'[PATCH FAIL] {label}: expected 1 regex match, got {count}')
    return out

# -----------------------------------------------------------------------------
# tradeSettings.ts — Default is always present; Huanan is initially seeded but
# remains a normal deletable/editable broker profile. Missing ids fall back Default.
# -----------------------------------------------------------------------------
p='src/data/tradeSettings.ts'
s=read(p)
s=regex_once(s,
    r"export function normalizeBrokerProfiles\(raw: unknown\): BrokerProfile\[\] \{.*?\n\}\n\nexport function isHuananBroker",
    """export function normalizeBrokerProfiles(raw: unknown): BrokerProfile[] {
  const hasPersistedList = Array.isArray(raw);
  const source = hasPersistedList ? raw as unknown[] : builtInBrokerProfiles;
  const byId = new Map<string, BrokerProfile>();
  byId.set(defaultBrokerProfile.id, { ...defaultBrokerProfile });
  for (const candidate of source) {
    if (!candidate || typeof candidate !== 'object') continue;
    const obj = candidate as Partial<BrokerProfile>;
    const id = String(obj.id ?? '').trim();
    if (!id) continue;
    const fallback = id === HUANAN_YONGCHANG_PROFILE_ID ? huananYongchangBrokerProfile : defaultBrokerProfile;
    byId.set(id, normalizeBrokerProfile(obj, fallback));
  }
  if (!byId.has(defaultBrokerProfile.id)) byId.set(defaultBrokerProfile.id, { ...defaultBrokerProfile });
  return Array.from(byId.values());
}

export function isHuananBroker""",
    'normalizeBrokerProfiles')
s=regex_once(s,
    r"export function resolveBrokerProfile\(.*?\n\}\n\nexport function applyRounding",
    """export function resolveBrokerProfile(
  brokerProfileId?: string | null,
  profiles: BrokerProfile[] = builtInBrokerProfiles,
  legacyBrokerName?: string | null,
): BrokerProfile {
  const normalized = normalizeBrokerProfiles(profiles);
  const id = String(brokerProfileId ?? '').trim();
  if (id) {
    const found = normalized.find(profile => profile.id === id);
    return found ? { ...found } : { ...normalized.find(profile => profile.id === DEFAULT_BROKER_PROFILE_ID) ?? defaultBrokerProfile };
  }
  if (isHuananBroker(legacyBrokerName)) {
    const legacyHuanan = normalized.find(profile => profile.id === HUANAN_YONGCHANG_PROFILE_ID);
    if (legacyHuanan) return { ...legacyHuanan };
  }
  return { ...normalized.find(profile => profile.id === DEFAULT_BROKER_PROFILE_ID) ?? defaultBrokerProfile };
}

export function applyRounding""",
    'resolveBrokerProfile')
write(p,s)

# -----------------------------------------------------------------------------
# model.ts — stable broker id on ledger + persisted profile list on V3 state.
# -----------------------------------------------------------------------------
p='src/v3/model.ts'
s=read(p)
s=replace_once(s,"import { FeeSettings } from '../data/tradeSettings';","import { BrokerProfile, FeeSettings } from '../data/tradeSettings';",'model import')
s=replace_once(s,"  broker?: string;\n  account?: string;","  broker?: string;\n  brokerProfileId?: string;\n  account?: string;",'ledger stable broker id')
s=replace_once(s,"  feeSettings: FeeSettings;\n  dailySnapshots: DailySnapshot[];","  feeSettings: FeeSettings;\n  brokerProfiles: BrokerProfile[];\n  dailySnapshots: DailySnapshot[];",'V3State brokerProfiles')
write(p,s)

# -----------------------------------------------------------------------------
# storage.ts — migrate to schema 17 and seed/normalize persisted broker profiles.
# -----------------------------------------------------------------------------
p='src/v3/storage.ts'
s=read(p)
s=replace_once(s,"import { defaultFeeSettings } from '../data/tradeSettings';","import { defaultFeeSettings, normalizeBrokerProfiles } from '../data/tradeSettings';",'storage profile import')
s=replace_once(s,"const SCHEMA=16;","const SCHEMA=17;",'schema 17')
s=replace_once(s,"  feeSettings:{...defaultFeeSettings,...(p.feeSettings??{})},\n  dailySnapshots:","  feeSettings:{...defaultFeeSettings,...(p.feeSettings??{})},\n  brokerProfiles:normalizeBrokerProfiles((p as any).brokerProfiles),\n  dailySnapshots:",'storage normalize profiles')
write(p,s)

# -----------------------------------------------------------------------------
# engine.ts — all call sites can consume the same runtime profile registry without
# duplicating formulas throughout screens/widget surfaces.
# -----------------------------------------------------------------------------
p='src/v3/engine.ts'
s=read(p)
s=replace_once(s,"  resolveBrokerProfile,\n  roundForDisplay,","  resolveBrokerProfile,\n  normalizeBrokerProfiles,\n  roundForDisplay,",'engine normalize import')
s=replace_once(s,"export * from './engineBase';\n\n/**","export * from './engineBase';\n\nlet runtimeBrokerProfiles:BrokerProfile[]=normalizeBrokerProfiles(undefined);\nexport function configureBrokerProfiles(profiles:BrokerProfile[]|undefined){ runtimeBrokerProfiles=normalizeBrokerProfiles(profiles); }\nexport function configuredBrokerProfiles(){ return runtimeBrokerProfiles.map(p=>({...p})); }\n\n/**",'engine runtime profiles')
s=s.replace("brokerProfiles:BrokerProfile[]=builtInBrokerProfiles,","brokerProfiles:BrokerProfile[]=runtimeBrokerProfiles,")
write(p,s)

# -----------------------------------------------------------------------------
# screensBase.tsx — broker CRUD in Settings + dropdown binding in bookkeeping.
# -----------------------------------------------------------------------------
p='src/v3/screensBase.tsx'
s=read(p)
s=replace_once(s,
 "import { estimateBuyFee, estimateSellFee, estimateSellTaxBySettings, FeeSettings } from '../data/tradeSettings';",
 "import { createBrokerProfileFromDefault, defaultBrokerProfile, estimateBuyFee, estimateSellFee, estimateSellTaxBySettings, normalizeBrokerProfiles, profileToFeeSettings, resolveBrokerProfile, type BrokerProfile, type FeeSettings } from '../data/tradeSettings';",
 'screens broker imports')
s=replace_once(s,
 "export type ScreenCommon={holdings:Holding[];quotes:Record<string,QuoteLike>;ledger:LedgerEntry[];cashBalance:number;dividends:DividendEvent[];prefs:V3Preferences;dailySnapshots:DailySnapshot[];intradayPnlPoints:IntradayPnlPoint[];feeSettings:FeeSettings;appSettings:AppSettings;onAi?:()=>void;onTogglePageCustomize?:(page:PageFieldKey)=>void;onSetSelectedEtfSymbols?:(symbols:string[])=>void;onSetWatchlistSymbols?:(symbols:string[])=>void};",
 "export type ScreenCommon={holdings:Holding[];quotes:Record<string,QuoteLike>;ledger:LedgerEntry[];cashBalance:number;dividends:DividendEvent[];prefs:V3Preferences;dailySnapshots:DailySnapshot[];intradayPnlPoints:IntradayPnlPoint[];feeSettings:FeeSettings;brokerProfiles:BrokerProfile[];appSettings:AppSettings;onAi?:()=>void;onTogglePageCustomize?:(page:PageFieldKey)=>void;onSetSelectedEtfSymbols?:(symbols:string[])=>void;onSetWatchlistSymbols?:(symbols:string[])=>void};",
 'ScreenCommon profiles')

manager = r'''
function BrokerProfilePicker({profiles,value,onChange}:{profiles:BrokerProfile[];value:string;onChange:(profile:BrokerProfile)=>void}){
 const rows=normalizeBrokerProfiles(profiles);
 return <View style={{marginVertical:7}}><Text style={s.fieldLabel}>券商</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.wrapRow}>{rows.map(profile=><Choice key={profile.id} active={value===profile.id} label={profile.name} onPress={()=>onChange(profile)}/>)}</ScrollView></View>;
}

function BrokerProfileManager({profiles,onProfilesChange,feeSettings,onFeeChange}:{profiles:BrokerProfile[];onProfilesChange:(profiles:BrokerProfile[])=>void;feeSettings:FeeSettings;onFeeChange:(p:Partial<FeeSettings>)=>void}){
 const rows=normalizeBrokerProfiles(profiles);
 const [selectedId,setSelectedId]=useState(rows.some(p=>p.id===feeSettings.brokerProfileId)?String(feeSettings.brokerProfileId):defaultBrokerProfile.id);
 const selected=rows.find(p=>p.id===selectedId)??rows[0]??defaultBrokerProfile;
 useEffect(()=>{if(!rows.some(p=>p.id===selectedId))setSelectedId(defaultBrokerProfile.id)},[profiles,selectedId]);
 const commit=(patch:Partial<BrokerProfile>)=>{const next=rows.map(p=>p.id===selected.id?{...p,...patch}:p);onProfilesChange(next);const updated=next.find(p=>p.id===selected.id);if(updated&&(selected.id===defaultBrokerProfile.id||feeSettings.brokerProfileId===selected.id))onFeeChange(profileToFeeSettings(updated));};
 const addBrokerProfile=()=>{const base=rows.find(p=>p.id===defaultBrokerProfile.id)??defaultBrokerProfile;const id=`custom-${Date.now()}`;const created=createBrokerProfileFromDefault({id,name:'新券商',overrides:{...base,id,name:'新券商'}});onProfilesChange([...rows,created]);setSelectedId(id);};
 const deleteBrokerProfile=()=>{if(selected.id===defaultBrokerProfile.id)return;Alert.alert('刪除券商',`確定刪除「${selected.name}」？歷史交易不會刪除；找不到此 Profile 的舊紀錄將安全回到 App 預設。`,[{text:'取消',style:'cancel'},{text:'刪除券商',style:'destructive',onPress:()=>{onProfilesChange(rows.filter(p=>p.id!==selected.id));setSelectedId(defaultBrokerProfile.id)}}]);};
 const rounding=(key:'tradeAmountRounding'|'commissionRounding'|'taxRounding',label:string)=><SettingRow label={label}><Choice active={selected[key]==='floor'} label="無條件捨去" onPress={()=>commit({[key]:'floor'} as any)}/><Choice active={selected[key]==='round'} label="四捨五入" onPress={()=>commit({[key]:'round'} as any)}/><Choice active={selected[key]==='ceil'} label="無條件進位" onPress={()=>commit({[key]:'ceil'} as any)}/></SettingRow>;
 return <>
  <Card><SectionTitle title="券商 Profile 管理" right={`${rows.length} 組`}/><Text style={s.note}>所有券商共用同一套金融公式；這裡只管理參數。未指定券商使用 App 預設；新增券商會完整複製目前 App 預設值。</Text><BrokerProfilePicker profiles={rows} value={selected.id} onChange={p=>setSelectedId(p.id)}/><View style={s.manageRow}><TouchableOpacity style={s.editAction} onPress={addBrokerProfile}><Text style={s.editActionText}>＋ 新增券商</Text></TouchableOpacity><TouchableOpacity disabled={selected.id===defaultBrokerProfile.id} style={[s.deleteAction,selected.id===defaultBrokerProfile.id&&{opacity:.35}]} onPress={deleteBrokerProfile}><Text style={s.deleteActionText}>刪除券商</Text></TouchableOpacity></View></Card>
  <Card><SectionTitle title="基本參數" right={selected.id}/><Field label="券商名稱" value={selected.name} onChange={name=>commit({name})}/><DecimalSettingField label="手續費率" value={selected.commissionRate} min={0} max={1} digits={6} onCommit={commissionRate=>commit({commissionRate})}/><DecimalSettingField label="手續費折扣係數" value={selected.commissionDiscount} min={0} max={1} digits={4} onCommit={commissionDiscount=>commit({commissionDiscount})}/><Field label="最低手續費" value={String(selected.minimumCommission)} onChange={v=>commit({minimumCommission:Math.max(0,Number(v)||0)})} keyboard="number-pad" suffix="元"/><DecimalSettingField label="ETF 賣出證交稅率" value={selected.etfSellTaxRate} min={0} max={1} digits={6} onCommit={etfSellTaxRate=>commit({etfSellTaxRate})}/><DecimalSettingField label="股票賣出證交稅率" value={selected.stockSellTaxRate} min={0} max={1} digits={6} onCommit={stockSellTaxRate=>commit({stockSellTaxRate})}/></Card>
  <Card><SectionTitle title="金融核心參數"/>{rounding('tradeAmountRounding','成交金額取整')}{rounding('commissionRounding','手續費取整')}{rounding('taxRounding','稅額取整')}<SettingRow label="成本池"><Choice active label="移動加權平均" onPress={()=>commit({costPoolMethod:'movingWeightedAverage'})}/></SettingRow><SettingRow label="未實現損益模式"><Choice active={selected.unrealizedPLMode==='GROSS'} label="GROSS" onPress={()=>commit({unrealizedPLMode:'GROSS',marketValueMode:'gross',includeEstimatedSellFee:false,includeEstimatedSellTax:false})}/><Choice active={selected.unrealizedPLMode==='NET'} label="NET" onPress={()=>commit({unrealizedPLMode:'NET',marketValueMode:'netLiquidation'})}/></SettingRow><ToggleSetting label="NET 預扣預估賣出手續費" value={selected.includeEstimatedSellFee} onChange={includeEstimatedSellFee=>commit({includeEstimatedSellFee})}/><ToggleSetting label="NET 預扣預估賣出證交稅" value={selected.includeEstimatedSellTax} onChange={includeEstimatedSellTax=>commit({includeEstimatedSellTax})}/><SettingRow label="平均成本顯示"><Choice active={selected.avgCostDisplayMode==='raw'} label="原值" onPress={()=>commit({avgCostDisplayMode:'raw'})}/><Choice active={selected.avgCostDisplayMode==='truncate'} label="截斷" onPress={()=>commit({avgCostDisplayMode:'truncate'})}/><Choice active={selected.avgCostDisplayMode==='round'} label="四捨五入" onPress={()=>commit({avgCostDisplayMode:'round'})}/></SettingRow><Field label="平均成本小數位" value={String(selected.avgCostDigits)} onChange={v=>commit({avgCostDigits:Math.max(0,Math.min(8,Number(v)||0))})} keyboard="number-pad"/><SettingRow label="報酬率顯示"><Choice active={selected.roiDisplayMode==='raw'} label="原值" onPress={()=>commit({roiDisplayMode:'raw'})}/><Choice active={selected.roiDisplayMode==='truncate'} label="截斷" onPress={()=>commit({roiDisplayMode:'truncate'})}/><Choice active={selected.roiDisplayMode==='round'} label="四捨五入" onPress={()=>commit({roiDisplayMode:'round'})}/></SettingRow><Field label="報酬率小數位" value={String(selected.roiDigits)} onChange={v=>commit({roiDigits:Math.max(0,Math.min(8,Number(v)||0))})} keyboard="number-pad"/><SettingRow label="統一截斷規則"><Choice active={selected.truncateRule==='NONE'} label="不額外處理" onPress={()=>commit({truncateRule:'NONE'})}/><Choice active={selected.truncateRule==='TRUNCATE_2_DECIMALS'} label="截斷 2 位" onPress={()=>commit({truncateRule:'TRUNCATE_2_DECIMALS'})}/><Choice active={selected.truncateRule==='ROUND_2_DECIMALS'} label="四捨五入 2 位" onPress={()=>commit({truncateRule:'ROUND_2_DECIMALS'})}/></SettingRow><SettingRow label="折扣模式"><Choice active={selected.discountMode==='instant'} label="即時折扣" onPress={()=>commit({discountMode:'instant'})}/><Choice active={selected.discountMode==='monthlyRebate'} label="月退" onPress={()=>commit({discountMode:'monthlyRebate'})}/></SettingRow><SettingRow label="下單通路"><Choice active={selected.orderChannel==='electronic'} label="電子" onPress={()=>commit({orderChannel:'electronic'})}/><Choice active={selected.orderChannel==='manual'} label="人工" onPress={()=>commit({orderChannel:'manual'})}/><Choice active={selected.orderChannel==='sip'} label="定期定額" onPress={()=>commit({orderChannel:'sip'})}/></SettingRow><SettingRow label="交易單位"><Choice active={selected.lotType==='board'} label="整股" onPress={()=>commit({lotType:'board'})}/><Choice active={selected.lotType==='odd'} label="零股" onPress={()=>commit({lotType:'odd'})}/><Choice active={selected.lotType==='sip'} label="定期定額" onPress={()=>commit({lotType:'sip'})}/></SettingRow></Card>
 </>;
}
'''
s=replace_once(s,"export function SettingsModal(",manager+"\nexport function SettingsModal(",'insert broker manager')
s=replace_once(s,"feeSettings,marketMeta,holdings,quotes,ledger,dividends,cashBalance,lastSuccessAt,onChange","feeSettings,brokerProfiles,marketMeta,holdings,quotes,ledger,dividends,cashBalance,lastSuccessAt,onChange",'Settings args profiles')
s=replace_once(s,"feeSettings:FeeSettings;marketMeta:MarketMeta;","feeSettings:FeeSettings;brokerProfiles:BrokerProfile[];marketMeta:MarketMeta;",'Settings prop profile type')
s=replace_once(s,"onFeeChange:(p:Partial<FeeSettings>)=>void;onCheckOta","onFeeChange:(p:Partial<FeeSettings>)=>void;onBrokerProfilesChange:(profiles:BrokerProfile[])=>void;onCheckOta",'Settings profiles callback')
s=regex_once(s,
 r"\{section==='broker'\?<>.*?</>:null\}\n \{section==='monitor'",
 "{section==='broker'?<BrokerProfileManager profiles={brokerProfiles} onProfilesChange={onBrokerProfilesChange} feeSettings={feeSettings} onFeeChange={onFeeChange}/>:null}\n {section==='monitor'",
 'replace broker settings section')

# Ledger segment only.
start=s.index('export function LedgerScreen(')
end=s.index('export type HoldingEditPayload',start)
seg=s[start:end]
seg=seg.replace("onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'|'swing';broker:string;account:string})=>void;","onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'|'swing';broker:string;brokerProfileId:string;account:string})=>void;")
seg=seg.replace("onSell:(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number})=>void;","onSell:(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number;brokerProfileId:string})=>void;")
seg=seg.replace("onCash:(x:{amount:number;date:string;broker:string;account:string;note?:string})=>void;","onCash:(x:{amount:number;date:string;broker:string;brokerProfileId:string;account:string;note?:string})=>void;")
seg=replace_once(seg,"const [fee,setFee]=useState('0'); const [tax,setTax]=useState('0'); const [amount,setAmount]=useState(''); const [cashNote,setCashNote]=useState(''); const [actualCash,setActualCash]=useState(cashReconciliation.actualBalance!=null?String(cashReconciliation.actualBalance):''); const [reconcileNote,setReconcileNote]=useState(cashReconciliation.note??''); const [strategy,setStrategy]=useState<'long'|'swing'>('long'); const [broker,setBroker]=useState(first?.broker??common.feeSettings.brokerName); const [account,setAccount]=useState(first?.account??'');",
"const [fee,setFee]=useState('0'); const [tax,setTax]=useState('0'); const [amount,setAmount]=useState(''); const [cashNote,setCashNote]=useState(''); const [actualCash,setActualCash]=useState(cashReconciliation.actualBalance!=null?String(cashReconciliation.actualBalance):''); const [reconcileNote,setReconcileNote]=useState(cashReconciliation.note??''); const [strategy,setStrategy]=useState<'long'|'swing'>('long'); const initialBrokerProfile=resolveBrokerProfile(first?.brokerProfileId??common.feeSettings.brokerProfileId,common.brokerProfiles,first?.broker??common.feeSettings.brokerName); const [brokerProfileId,setBrokerProfileId]=useState(initialBrokerProfile.id); const [broker,setBroker]=useState(initialBrokerProfile.name); const [account,setAccount]=useState(first?.account??'');",
'ledger profile state')
seg=replace_once(seg,"if(held){setName(held.name);setBroker(held.broker??common.feeSettings.brokerName);setAccount(held.account??'');}else if(exact){setName(exact.name);}","if(held){const hp=resolveBrokerProfile(held.brokerProfileId,common.brokerProfiles,held.broker);setName(held.name);setBrokerProfileId(hp.id);setBroker(hp.name);setAccount(held.account??'');}else if(exact){setName(exact.name);}",'ledger holding broker sync')
seg=replace_once(seg," const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const calcFee=(kind==='buy'||kind==='sell')&&autoFee?(kind==='buy'?estimateBuyFee(tradeAmount,common.feeSettings):estimateSellFee(tradeAmount,common.feeSettings)):Number(fee||0); const calcTax=kind==='sell'&&autoFee?estimateSellTaxBySettings(tradeAmount,common.feeSettings):Number(tax||0);"," const activeBrokerProfile=resolveBrokerProfile(brokerProfileId,common.brokerProfiles,broker); const activeFeeSettings=profileToFeeSettings(activeBrokerProfile); const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const calcFee=(kind==='buy'||kind==='sell')&&autoFee?(kind==='buy'?estimateBuyFee(tradeAmount,activeFeeSettings):estimateSellFee(tradeAmount,activeFeeSettings)):Number(fee||0); const calcTax=kind==='sell'&&autoFee?estimateSellTaxBySettings(tradeAmount,activeFeeSettings):Number(tax||0);",'ledger profile fee calc')
seg=seg.replace("onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,strategy,broker,account});","onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,strategy,broker:activeBrokerProfile.name,brokerProfileId:activeBrokerProfile.id,account});")
seg=seg.replace("onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,tax:calcTax});","onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),fee:calcFee,tax:calcTax,brokerProfileId:activeBrokerProfile.id});")
seg=seg.replace("onCash({amount:Number(amount),date:dateText,broker,account,note:cashNote.trim()||undefined});","onCash({amount:Number(amount),date:dateText,broker:activeBrokerProfile.name,brokerProfileId:activeBrokerProfile.id,account,note:cashNote.trim()||undefined});")
seg=seg.replace("{common.feeSettings.brokerName} · 費率設定來自全局設定","{activeBrokerProfile.name} · 費率設定來自券商 Profile")
seg=seg.replace("{common.feeSettings.brokerName} · 依全局券商費用設定與 ETF 稅率","{activeBrokerProfile.name} · 依券商 Profile 費率與 ETF 稅率")
picker="<BrokerProfilePicker profiles={common.brokerProfiles} value={brokerProfileId} onChange={p=>{setBrokerProfileId(p.id);setBroker(p.name)}}/>"
if seg.count('<Field label="券商" value={broker} onChange={setBroker}/>')<2: raise SystemExit('[PATCH FAIL] ledger broker fields')
seg=seg.replace('<Field label="券商" value={broker} onChange={setBroker}/>',picker,2)
s=s[:start]+seg+s[end:]
write(p,s)

# -----------------------------------------------------------------------------
# App.tsx — thread profile list through common/settings and stable ids through ledger.
# -----------------------------------------------------------------------------
p='App.tsx'
s=read(p)
s=replace_once(s,"import { configureDisplayPreferences, dividendTotals, holdingMetrics, portfolioMetrics, sharesOnDate, money, pct } from './src/v3/engine';","import { configureBrokerProfiles, configureDisplayPreferences, dividendTotals, holdingMetrics, portfolioMetrics, sharesOnDate, money, pct } from './src/v3/engine';",'App engine import')
s=replace_once(s,"broker:first.broker||existing?.broker,account:first.account||existing?.account,purchaseRecords:records","brokerProfileId:first.brokerProfileId||existing?.brokerProfileId,broker:first.broker||existing?.broker,account:first.account||existing?.account,purchaseRecords:records",'rebuild holding profile')
s=replace_once(s,"const addBuy=(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'|'swing';broker:string;account:string})","const addBuy=(x:{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'|'swing';broker:string;brokerProfileId:string;account:string})",'addBuy type')
s=s.replace("broker:x.broker||h.broker,account:x.account||h.account","brokerProfileId:x.brokerProfileId||h.brokerProfileId,broker:x.broker||h.broker,account:x.account||h.account",1)
s=s.replace("buyFee:x.fee,broker:x.broker,account:x.account","buyFee:x.fee,brokerProfileId:x.brokerProfileId,broker:x.broker,account:x.account",1)
s=s.replace("strategy:x.strategy,broker:x.broker,account:x.account,purchaseRecordId:r.id","strategy:x.strategy,broker:x.broker,brokerProfileId:x.brokerProfileId,account:x.account,purchaseRecordId:r.id",1)
s=replace_once(s,"const addSell=(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number})","const addSell=(x:{symbol:string;date:string;shares:number;price:number;fee:number;tax:number;brokerProfileId:string})",'addSell type')
s=s.replace("fee,tax,broker:h.broker,account:h.account};return {...s,holdings","fee,tax,broker:h.broker,brokerProfileId:x.brokerProfileId||h.brokerProfileId,account:h.account};return {...s,holdings",1)
s=replace_once(s,"const addCash=(x:{amount:number;date:string;broker:string;account:string;note?:string})","const addCash=(x:{amount:number;date:string;broker:string;brokerProfileId:string;account:string;note?:string})",'addCash type')
s=s.replace("broker:x.broker||undefined,account:x.account||undefined,note:x.note","broker:x.broker||undefined,brokerProfileId:x.brokerProfileId||undefined,account:x.account||undefined,note:x.note",1)
s=s.replace("broker:x.broker,account:x.account,note:'由庫存購入紀錄同步'","broker:x.broker,brokerProfileId:old.brokerProfileId,account:x.account,note:'由庫存購入紀錄同步'",1)
s=replace_once(s,"if(!state)return <View style={styles.loading}","if(!state)return <View style={styles.loading}",'state guard presence') if "if(!state)return <View style={styles.loading}" in s else s
# Configure synchronously once state exists; finance surfaces then share the same registry.
marker=" const p=state.preferences;"
if marker in s:
    s=replace_once(s,marker," configureBrokerProfiles(state.brokerProfiles);\n const p=state.preferences;",'configure profiles')
else:
    # Alternate current layout: inject before editor/nav values.
    marker=" const navIcons=currentIcons(p);"
    if marker in s: s=replace_once(s,marker," configureBrokerProfiles(state.brokerProfiles);\n "+marker,'configure profiles alternate')
    else: raise SystemExit('[PATCH FAIL] App configure marker')
s=replace_once(s,"feeSettings:state.feeSettings,appSettings:state.appSettings","feeSettings:state.feeSettings,brokerProfiles:state.brokerProfiles,appSettings:state.appSettings",'common profiles')
s=replace_once(s,"feeSettings={state.feeSettings} marketMeta={marketMeta}","feeSettings={state.feeSettings} brokerProfiles={state.brokerProfiles} marketMeta={marketMeta}",'Settings profiles prop')
s=replace_once(s,"onFeeChange={x=>patch(s=>({...s,feeSettings:{...s.feeSettings,...x}}))} onCheckOta","onFeeChange={x=>patch(s=>({...s,feeSettings:{...s.feeSettings,...x}}))} onBrokerProfilesChange={brokerProfiles=>patch(s=>({...s,brokerProfiles}))} onCheckOta",'Settings profiles callback')
write(p,s)

print('APPLY_BROKER_PROFILES_V375: PATCHED')
