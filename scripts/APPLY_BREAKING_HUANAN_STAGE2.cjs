const fs=require('fs');
const path=require('path');
const read=f=>fs.readFileSync(f,'utf8');
const write=(f,s)=>fs.writeFileSync(f,s);
const must=(f,from,to)=>{let s=read(f);if(!s.includes(from))throw new Error(`${f}: missing expected text: ${from.slice(0,140)}`);write(f,s.replace(from,to));};
const rx=(f,re,to,label)=>{let s=read(f);if(!re.test(s))throw new Error(`${f}: regex miss ${label}`);write(f,s.replace(re,to));};

// Remove inactive V2 finance screens/domain implementations rather than carrying old algorithms.
for(const f of [
 'src/domain/metrics.ts','src/domain/simulation.ts',
 'src/screens/AddHoldingScreen.tsx','src/screens/DataScreen.tsx','src/screens/EditHoldingScreen.tsx',
 'src/screens/GoalScreen.tsx','src/screens/HomeScreen.tsx','src/screens/PortfolioScreen.tsx','src/screens/ScenarioScreen.tsx',
]){if(fs.existsSync(f))fs.unlinkSync(f);}

// Canonical transaction type must remain a literal union.
must('src/v3/engine.ts',`   type:e.kind==='buy'?'BUY':'SELL',`,`   type:(e.kind==='buy'?'BUY':'SELL') as const,`);

// App root: only canonical finance core may price transactions.
must('App.tsx',
`import { preciseTradeAmount } from './src/v3/financeFormat';`,
`import { preciseTradeAmount } from './src/v3/financeFormat';\nimport type { TradeMode } from './src/types/etf';\nimport { calculateETFSummary, calculatePurchaseCost } from './src/utils/etfCalculators';`);

rx('App.tsx',/function rebuildHoldingsFromLedger\([\s\S]*?\n}\n\nfunction Root/,`function rebuildHoldingsFromLedger(holdings:Holding[],ledger:LedgerEntry[],symbols:string[]){
 const wanted=new Set(symbols.filter(Boolean)); const unaffected=holdings.filter(h=>!wanted.has(h.symbol)); const rebuilt:Holding[]=[];
 for(const symbol of wanted){
  const existing=holdings.find(h=>h.symbol===symbol); const buys=ledger.filter(e=>e.kind==='buy'&&e.symbol===symbol).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  if(!buys.length){if(existing)rebuilt.push(existing);continue;}
  const records:PurchaseRecord[]=buys.map(e=>{const shares=Math.max(0,Number(e.shares||0)),price=Math.max(0,Number(e.price||0)),tradeMode=(e.tradeMode==='ROUND_LOT'||e.tradeMode==='ODD_LOT')?e.tradeMode:(shares>=1000&&shares%1000===0?'ROUND_LOT':'ODD_LOT');const buy=calculatePurchaseCost({id:e.id,etfCode:symbol,type:'BUY',tradeMode,shares,price,date:e.date});return {id:e.purchaseRecordId||e.id,date:e.date,shares,tradePrice:price,purchaseCost:buy.tradeAmount,fee:buy.commission,totalCost:buy.settlementAmount,tradeMode};});
  const gross=records.reduce((a,r)=>a+r.shares,0),pure=records.reduce((a,r)=>a+r.purchaseCost,0),fees=records.reduce((a,r)=>a+r.fee,0),sold=ledger.filter(e=>e.kind==='sell'&&e.symbol===symbol).reduce((a,e)=>a+Number(e.shares||0),0),current=Math.max(0,gross-sold),first=buys[0];
  const mode=(existing?.liquidationTradeMode??first.tradeMode??(current>=1000&&current%1000===0?'ROUND_LOT':'ODD_LOT')) as TradeMode;
  rebuilt.push({...((existing??{}) as Partial<Holding>),symbol,name:first.name||existing?.name||symbol,subtitle:existing?.subtitle||'由帳務紀錄重建持倉',shares:current,avgCost:gross?pure/gross:0,tradeAvgPrice:gross?pure/gross:0,buyFee:fees,liquidationTradeMode:mode,dividendFrequency:existing?.dividendFrequency??1,fallbackPrice:existing?.fallbackPrice||(gross?pure/gross:0),targetWeight:existing?.targetWeight??0,annualDividendPerShare:existing?.annualDividendPerShare??0,tag:existing?.tag||'帳務重建',broker:'華南永昌證券',account:first.account||existing?.account,purchaseRecords:records} as Holding);
 }
 return [...unaffected,...rebuilt];
}

function Root`, 'rebuildHoldingsFromLedger');

rx('App.tsx',/ const addBuy=\([\s\S]*?\n \}\);\n const addSell=/,` const addBuy=(x:{symbol:string;name:string;date:string;shares:number;price:number;tradeMode:TradeMode;strategy:'long'|'swing';account:string})=>patch(s=>{
  const purchase=calculatePurchaseCost({id:id(),etfCode:x.symbol,type:'BUY',tradeMode:x.tradeMode,shares:x.shares,price:x.price,date:x.date}); const purchaseCost=purchase.tradeAmount,totalCost=purchase.settlementAmount; const r:PurchaseRecord={id:id(),date:x.date,shares:x.shares,tradePrice:x.price,purchaseCost,fee:purchase.commission,totalCost,tradeMode:x.tradeMode}; const found=s.holdings.find(h=>h.symbol===x.symbol); let holdings:Holding[];
  if(found){const grossOld=(found.purchaseRecords??[]).reduce((a,z)=>a+z.shares,0)||found.shares;const newGross=grossOld+x.shares;const oldPure=(found.purchaseRecords??[]).reduce((a,z)=>a+z.purchaseCost,0)||grossOld*(found.tradeAvgPrice??found.avgCost);const oldFees=(found.purchaseRecords??[]).reduce((a,z)=>a+z.fee,0)||found.buyFee||0;const pure=oldPure+purchaseCost,fees=oldFees+purchase.commission;const sold=s.ledger.filter(e=>e.kind==='sell'&&e.symbol===x.symbol).reduce((a,e)=>a+Number(e.shares??0),0);const current=Math.max(0,newGross-sold);holdings=s.holdings.map(h=>h.symbol!==x.symbol?h:{...h,shares:current,avgCost:newGross?pure/newGross:0,tradeAvgPrice:newGross?pure/newGross:0,buyFee:fees,liquidationTradeMode:x.tradeMode,broker:'華南永昌證券',account:x.account||h.account,purchaseRecords:[...(h.purchaseRecords??[]),r]});}
  else holdings=[...s.holdings,{symbol:x.symbol,name:x.name,subtitle:'使用者自訂 ETF',shares:x.shares,avgCost:x.price,tradeAvgPrice:x.price,buyFee:purchase.commission,liquidationTradeMode:x.tradeMode,dividendFrequency:1,broker:'華南永昌證券',account:x.account,fallbackPrice:x.price,targetWeight:0,annualDividendPerShare:0,tag:x.strategy==='long'?'長期存股':'短期波段',purchaseRecords:[r]}].sort((a,b)=>a.symbol.localeCompare(b.symbol));
  const e:LedgerEntry={id:id(),kind:'buy',symbol:x.symbol,name:x.name,date:x.date,shares:x.shares,price:x.price,tradeMode:x.tradeMode,amount:purchaseCost,fee:purchase.commission,strategy:x.strategy,broker:'華南永昌證券',account:x.account,purchaseRecordId:r.id};return {...s,holdings,cashBalance:s.cashBalance-purchase.settlementAmount,ledger:[...s.ledger,e]};
 });
 const addSell=`, 'addBuy');

rx('App.tsx',/ const addSell=\([\s\S]*?\n const saveCashReconciliation=/,` const addSell=(x:{symbol:string;date:string;shares:number;price:number;tradeMode:TradeMode})=>patch(s=>{const h=s.holdings.find(z=>z.symbol===x.symbol);if(!h||x.shares<=0||x.shares>h.shares){Alert.alert('賣出失敗','賣出股數不可超過目前持有股數。');return s;}const remaining=h.shares-x.shares;const holdings=remaining===0?s.holdings.filter(z=>z.symbol!==x.symbol):s.holdings.map(z=>z.symbol!==x.symbol?z:{...z,shares:remaining,liquidationTradeMode:x.tradeMode});const probe=calculateETFSummary({etfCode:x.symbol,name:h.name,currentPrice:x.price,liquidationTradeMode:x.tradeMode,dividendFrequency:1,transactions:[{id:'sell-preview',etfCode:x.symbol,type:'BUY',tradeMode:x.tradeMode,shares:x.shares,price:x.price,date:x.date}],dividendRecords:[]});const gross=probe.currentMarketValue,fee=probe.estimatedSellCommission,tax=probe.estimatedSellTax,proceeds=probe.netLiquidationValue;const e:LedgerEntry={id:id(),kind:'sell',symbol:x.symbol,name:h.name,date:x.date,shares:x.shares,price:x.price,tradeMode:x.tradeMode,amount:gross,fee,tax,broker:'華南永昌證券',account:h.account};return {...s,holdings,cashBalance:s.cashBalance+proceeds,ledger:[...s.ledger,e]};});
 const saveCashReconciliation=`, 'addSell');

rx('App.tsx',/ const addCash=[\s\S]*?\n const updateLedgerEntry=/,` const addCash=(x:{amount:number;date:string;account:string;note?:string})=>patch(s=>({...s,cashBalance:s.cashBalance+x.amount,ledger:[...s.ledger,{id:id(),kind:x.amount>=0?'cashIn':'cashOut',date:x.date,amount:Math.abs(x.amount),broker:'華南永昌證券',account:x.account||undefined,note:x.note}]}));\n const updateLedgerEntry=`, 'addCash');

// Holding edit ledger writes must retain canonical transaction modes, never profile IDs.
replace('App.tsx',/brokerProfileId:old\.brokerProfileId,/g,'tradeMode:r.tradeMode??old.liquidationTradeMode,');

function replace(file,re,to){let s=read(file);write(file,s.replace(re,to));}

// Remove removed V3State fields from common/settings wiring.
replace('App.tsx',/feeSettings:state\.feeSettings,brokerProfiles:state\.brokerProfiles,/g,'');
replace('App.tsx',/ feeSettings=\{state\.feeSettings\} brokerProfiles=\{state\.brokerProfiles\}/g,'');
replace('App.tsx',/ onFeeChange=\{[\s\S]*?\} onBrokerProfilesChange=\{brokerProfiles=>patch\(s=>\(\{\.\.\.s,brokerProfiles\}\)\)\}/g,'');

// Active screens: remove configurable broker/profile finance layer.
replace('src/v3/screensBase.tsx',/^import \{ createBrokerProfileFromDefault,[^\n]+from '\.\.\/data\/tradeSettings';\n/m,`import type { TradeMode, Transaction } from '../types/etf';\nimport { calculateETFSummary, calculatePurchaseCost } from '../utils/etfCalculators';\n`);
replace('src/v3/screensBase.tsx',/;feeSettings:FeeSettings;brokerProfiles:BrokerProfile\[\]/g,'');

// Ledger form state and canonical preview calculations.
rx('src/v3/screensBase.tsx',/ const \[fee,setFee\][\s\S]*?const \[editingLedger,setEditingLedger\]=useState<LedgerEntry\|null>\(null\);/,` const [amount,setAmount]=useState(''); const [cashNote,setCashNote]=useState(''); const [actualCash,setActualCash]=useState(cashReconciliation.actualBalance!=null?String(cashReconciliation.actualBalance):''); const [reconcileNote,setReconcileNote]=useState(cashReconciliation.note??''); const [strategy,setStrategy]=useState<'long'|'swing'>('long'); const [tradeMode,setTradeMode]=useState<TradeMode>(first?.liquidationTradeMode??'ODD_LOT'); const [account,setAccount]=useState(first?.account??''); const [dateText,setDateText]=useState(()=>fmtDate(new Date())); const [editingLedger,setEditingLedger]=useState<LedgerEntry|null>(null);`, 'ledger state');
replace('src/v3/screensBase.tsx',/if\(held\)\{const hp=resolveBrokerProfile\([\s\S]*?setAccount\(held\.account\?\?''\);\}else if\(exact\)/g,`if(held){setName(held.name);setTradeMode(held.liquidationTradeMode);setAccount(held.account??'');}else if(exact)`);
rx('src/v3/screensBase.tsx',/ const activeBrokerProfile=resolveBrokerProfile\([\s\S]*? const calcTax=kind==='sell'&&autoFee\?estimateSellTaxBySettings\(tradeAmount,activeFeeSettings\):Number\(tax\|\|0\);/,` const tradeAmount=preciseTradeAmount(Number(price||0),Number(shares||0)); const previewTx:Transaction={id:'preview',etfCode:symbol||'PREVIEW',type:'BUY',tradeMode,shares:Math.max(0,Number(shares||0)),price:Math.max(0,Number(price||0)),date:dateText}; const buyPreview=calculatePurchaseCost(previewTx); const sellPreview=calculateETFSummary({etfCode:symbol||'PREVIEW',name:name||symbol||'PREVIEW',currentPrice:Math.max(0,Number(price||0)),liquidationTradeMode:tradeMode,dividendFrequency:1,transactions:[previewTx],dividendRecords:[]}); const calcFee=kind==='sell'?sellPreview.estimatedSellCommission:buyPreview.commission; const calcTax=kind==='sell'?sellPreview.estimatedSellTax:0;`, 'ledger preview');
rx('src/v3/screensBase.tsx',/ const submit=\(\)=>\{[\s\S]*?Alert\.alert\('完成','已寫入帳務資料。成交金額與費用會分開保存。'\);\};/,` const submit=()=>{if(kind==='buy'){if(!symbol||tradeAmount<=0)return Alert.alert('資料不足','請輸入 ETF 代號、股數與實際成交價格。');onBuy({symbol,name:name||symbol,date:dateText,shares:Number(shares),price:Number(price),tradeMode,strategy,account});}else if(kind==='sell'){if(!symbol||tradeAmount<=0)return Alert.alert('資料不足','請輸入 ETF、賣出股數與實際成交價格。');onSell({symbol,date:dateText,shares:Number(shares),price:Number(price),tradeMode});}else if(kind==='dividend'){if(!symbol||Number(amount)<=0)return Alert.alert('資料不足','請輸入 ETF 與實收配息。');onDividend(symbol,Number(amount),dateText);}else{if(!Number(amount))return Alert.alert('資料不足','請輸入現金變動金額。');onCash({amount:Number(amount),date:dateText,account,note:cashNote.trim()||undefined});}Alert.alert('完成','已依華南永昌唯一金融核心寫入帳務資料。');};`, 'ledger submit');

// Ledger prop contract follows canonical TradeMode; profile ids are gone.
replace('src/v3/screensBase.tsx',/onBuy:\(x:\{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'\|'swing';broker:string;brokerProfileId:string;account:string\}\)=>void;onSell:\(x:\{symbol:string;date:string;shares:number;price:number;fee:number;tax:number;brokerProfileId:string\}\)=>void;onCash:\(x:\{amount:number;date:string;broker:string;brokerProfileId:string;account:string;note\?:string\}\)=>void;/g,`onBuy:(x:{symbol:string;name:string;date:string;shares:number;price:number;tradeMode:TradeMode;strategy:'long'|'swing';account:string})=>void;onSell:(x:{symbol:string;date:string;shares:number;price:number;tradeMode:TradeMode})=>void;onCash:(x:{amount:number;date:string;account:string;note?:string})=>void;`);

// Strip broker picker/manager implementation and its configurable settings section.
rx('src/v3/screensBase.tsx',/function BrokerProfilePicker\([\s\S]*?\nexport function SettingsModal/,`export function SettingsModal`, 'broker profile components');
replace('src/v3/screensBase.tsx',/;feeSettings:FeeSettings;brokerProfiles:BrokerProfile\[\]/g,'');
replace('src/v3/screensBase.tsx',/;onFeeChange:\(p:Partial<FeeSettings>\)=>void;onBrokerProfilesChange:\(profiles:BrokerProfile\[\]\)=>void/g,'');
replace('src/v3/screensBase.tsx',/\|'broker'/g,'');
replace('src/v3/screensBase.tsx',/\{section==='broker'\?[\s\S]*?:null\}/g,'');

// Remove finance controls from Ledger JSX: fixed Huanan fee/tax are display-only and TradeMode is the only required choice.
replace('src/v3/screensBase.tsx',/<View style=\{s\.switchRow\}>[\s\S]*?<View style=\{s\.calcBox\}><Text style=\{s\.muted\}>實際現金支出<\/Text><Text style=\{s\.calcVal\}>\{money\(tradeAmount\+calcFee\)\}<\/Text><\/View>/g,`<SettingRow label="交易模式"><Choice active={tradeMode==='ROUND_LOT'} label="整股" onPress={()=>setTradeMode('ROUND_LOT')}/><Choice active={tradeMode==='ODD_LOT'} label="盤後零股 / 定期定額" onPress={()=>setTradeMode('ODD_LOT')}/></SettingRow><View style={s.calcBox}><Text style={s.muted}>華南永昌買進手續費</Text><Text style={s.calcVal}>{money(calcFee)}</Text></View><View style={s.calcBox}><Text style={s.muted}>實際現金支出</Text><Text style={s.calcVal}>{money(tradeAmount+calcFee)}</Text></View>`);
replace('src/v3/screensBase.tsx',/<><View style=\{s\.switchRow\}>[\s\S]*?<View style=\{s\.calcBox\}><Text style=\{s\.muted\}>實際現金流入<\/Text><Text style=\{s\.calcVal\}>\{money\(tradeAmount-calcFee-calcTax\)\}<\/Text><\/View><\/>/g,`<><SettingRow label="交易模式"><Choice active={tradeMode==='ROUND_LOT'} label="整股" onPress={()=>setTradeMode('ROUND_LOT')}/><Choice active={tradeMode==='ODD_LOT'} label="盤後零股 / 定期定額" onPress={()=>setTradeMode('ODD_LOT')}/></SettingRow><View style={s.calcBox}><Text style={s.muted}>華南永昌賣出手續費</Text><Text style={s.calcVal}>{money(calcFee)}</Text></View><View style={s.calcBox}><Text style={s.muted}>ETF 交易稅</Text><Text style={s.calcVal}>{money(calcTax)}</Text></View><View style={s.calcBox}><Text style={s.muted}>實際現金流入</Text><Text style={s.calcVal}>{money(tradeAmount-calcFee-calcTax)}</Text></View></>`);
replace('src/v3/screensBase.tsx',/<BrokerProfilePicker[^>]+\/>/g,'<Text style={s.note}>券商：華南永昌證券（全局固定）</Text>');
replace('src/v3/screensBase.tsx',/broker:activeBrokerProfile\.name,brokerProfileId:activeBrokerProfile\.id,/g,'');

// PurchaseRecord editor is canonical: tradeMode travels with every buy row and fee is recalculated, not editable.
replace('src/v3/screensBase.tsx',/fee:roundHalfUp\(Number\(r\.fee\.replace\(\/,\/g,''\)\),2\);const purchaseCost=preciseTradeAmount\(tradePrice,shares\);return \{id:r\.id,date:r\.date,shares,tradePrice,purchaseCost,fee,totalCost:roundHalfUp\(purchaseCost\+fee,2\)\};/g,`tradeMode:(r as any).tradeMode==='ROUND_LOT'?'ROUND_LOT':'ODD_LOT' as TradeMode;const buy=calculatePurchaseCost({id:r.id,etfCode:holding.symbol,type:'BUY',tradeMode,shares,price:tradePrice,date:r.date});return {id:r.id,date:r.date,shares,tradePrice,purchaseCost:buy.tradeAmount,fee:buy.commission,totalCost:buy.settlementAmount,tradeMode};`);

console.log('APPLY_BREAKING_HUANAN_STAGE2 complete');
