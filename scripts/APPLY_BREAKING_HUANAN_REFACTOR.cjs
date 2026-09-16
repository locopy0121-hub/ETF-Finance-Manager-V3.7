const fs=require('fs');
const path=require('path');

function read(file){return fs.readFileSync(file,'utf8');}
function write(file,s){fs.writeFileSync(file,s);}
function mustReplace(file,from,to){let s=read(file);if(!s.includes(from))throw new Error(`${file}: expected text not found:\n${from.slice(0,180)}`);s=s.replace(from,to);write(file,s);}
function replaceAllInFile(file,from,to){let s=read(file);s=s.split(from).join(to);write(file,s);}
function walk(dir,out=[]){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const st=fs.statSync(p);if(st.isDirectory())walk(p,out);else if(/\.(ts|tsx)$/.test(p))out.push(p);}return out;}

// 1) Rename the old public calculation entry points everywhere in the active app.
for(const file of ['App.tsx',...walk('src')]){
  if(['src/domain/metrics.ts','src/domain/simulation.ts'].includes(file))continue;
  let s=read(file);
  s=s.replace(/\bholdingMetrics\b/g,'calculateHoldingView');
  s=s.replace(/\bportfolioMetrics\b/g,'calculatePortfolioView');
  s=s.replace(/\bdividendTotals\b/g,'calculateDividendIncome');
  write(file,s);
}

// 2) Holding is no longer allowed to carry fee/profile overrides.
mustReplace('src/data/portfolio.ts',
`export type PurchaseRecord = {`,
`import type { DividendFrequency, TradeMode } from '../types/etf';\n\nexport type PurchaseRecord = {`);
mustReplace('src/data/portfolio.ts',
`  buyFee?: number;\n  feeRate?: number;\n  feeDiscount?: number;\n  fallbackPrice: number;`,
`  buyFee?: number;\n  liquidationTradeMode: TradeMode;\n  dividendFrequency: DividendFrequency;\n  fallbackPrice: number;`);
mustReplace('src/data/portfolio.ts',
`  // Stable accounting binding. Display broker text is retained for compatibility/history.\n  brokerProfileId?: string;\n  broker?: string;`,
`  broker?: string;`);
replaceAllInFile('src/data/portfolio.ts',`    buyFee: 0,\n    fallbackPrice:`,`    buyFee: 0,\n    liquidationTradeMode: 'ROUND_LOT',\n    dividendFrequency: 1,\n    fallbackPrice:`);

// 3) Ledger/state types remove broker profile configuration and carry explicit TradeMode.
mustReplace('src/v3/model.ts',
`import { BrokerProfile, FeeSettings } from '../data/tradeSettings';`,
`import type { TradeMode } from '../types/etf';`);
mustReplace('src/v3/model.ts',
`  price?: number;\n  amount: number;`,
`  price?: number;\n  tradeMode?: TradeMode;\n  amount: number;`);
mustReplace('src/v3/model.ts',`  brokerProfileId?: string;\n`,``);
mustReplace('src/v3/model.ts',
`  appSettings: AppSettings;\n  feeSettings: FeeSettings;\n  brokerProfiles: BrokerProfile[];\n  dailySnapshots: DailySnapshot[];`,
`  appSettings: AppSettings;\n  dailySnapshots: DailySnapshot[];`);
replaceAllInFile('src/v3/model.ts',
`        broker:h.broker,account:h.account,`,
`        tradeMode:h.liquidationTradeMode,broker:h.broker,account:h.account,`);
replaceAllInFile('src/v3/model.ts',
`        strategy: 'long', note: '由舊版既有庫存轉入', broker:h.broker,account:h.account,`,
`        tradeMode:h.liquidationTradeMode,strategy: 'long', note: '由既有庫存轉入', broker:h.broker,account:h.account,`);

// 4) Old V2 persisted state cannot expose FeeSettings anymore.
mustReplace('src/storage/appStorage.ts',`import { FeeSettings } from '../data/tradeSettings';\n`,``);
mustReplace('src/storage/appStorage.ts',
`export type PersistedAppState = { schemaVersion:number; holdings:Holding[]; feeSettings:FeeSettings; dividendEvents:DividendEvent[]; settings:AppSettings; dailySnapshots:DailySnapshot[]; savedAt:number; };`,
`export type PersistedAppState = { schemaVersion:number; holdings:Holding[]; dividendEvents:DividendEvent[]; settings:AppSettings; dailySnapshots:DailySnapshot[]; savedAt:number; };`);
mustReplace('src/storage/appStorage.ts',
` return {schemaVersion:STORAGE_SCHEMA_VERSION,holdings:input.holdings??[],feeSettings:input.feeSettings as FeeSettings,dividendEvents:Array.isArray(input.dividendEvents)?input.dividendEvents:[],settings,dailySnapshots:Array.isArray(input.dailySnapshots)?input.dailySnapshots:[],savedAt:input.savedAt??Date.now()};`,
` return {schemaVersion:STORAGE_SCHEMA_VERSION,holdings:input.holdings??[],dividendEvents:Array.isArray(input.dividendEvents)?input.dividendEvents:[],settings,dailySnapshots:Array.isArray(input.dailySnapshots)?input.dailySnapshots:[],savedAt:input.savedAt??Date.now()};`);

// 5) V3 storage performs a one-time destructive data migration. Runtime finance has no fallback.
mustReplace('src/v3/storage.ts',
`import { defaultFeeSettings, normalizeBrokerProfiles } from '../data/tradeSettings';\n`,
`import type { DividendFrequency, ETFItem, TradeMode, Transaction } from '../types/etf';\nimport { calculateETFSummary, calculatePurchaseCost } from '../utils/etfCalculators';\n`);
replaceAllInFile('src/v3/storage.ts',`const SCHEMA=17;`,`const SCHEMA=18;`);
mustReplace('src/v3/storage.ts',
`function mergeState(p:Partial<V3State>):V3State{`,
`const validMode=(value:unknown):value is TradeMode=>value==='ROUND_LOT'||value==='ODD_LOT';\nconst inferMode=(shares:unknown):TradeMode=>{const n=Math.max(0,Number(shares)||0);return n>=1000&&n%1000===0?'ROUND_LOT':'ODD_LOT';};\nconst validFrequency=(value:unknown):value is DividendFrequency=>value===1||value===2||value===4||value===6||value===12;\nfunction canonicalSellCharges(symbol:string,shares:number,price:number,mode:TradeMode){const tx:Transaction={id:'migration-probe',etfCode:symbol,type:'BUY',tradeMode:mode,shares,price,date:'2000-01-01'};const item:ETFItem={etfCode:symbol,name:symbol,currentPrice:price,liquidationTradeMode:mode,dividendFrequency:1,transactions:[tx],dividendRecords:[]};const s=calculateETFSummary(item);return {amount:s.currentMarketValue,fee:s.estimatedSellCommission,tax:s.estimatedSellTax};}\n\nfunction mergeState(p:Partial<V3State>):V3State{`);
mustReplace('src/v3/storage.ts',
` const reconciledCash=Number((p as any).cashReconciliation?.actualBalance);\n return {`,
` const reconciledCash=Number((p as any).cashReconciliation?.actualBalance);\n const normalizedHoldings=(Array.isArray(p.holdings)?p.holdings:[]).map((raw:any)=>{const {feeRate,feeDiscount,brokerProfileId,...rest}=raw;return {...rest,liquidationTradeMode:validMode(raw.liquidationTradeMode)?raw.liquidationTradeMode:inferMode(raw.shares),dividendFrequency:validFrequency(raw.dividendFrequency)?raw.dividendFrequency:1};});\n const rawLedger=(Array.isArray(p.ledger)&&p.ledger.length?p.ledger:seedLedgerFromHoldings(normalizedHoldings)).map((raw:any)=>{const {brokerProfileId,...rest}=raw;if(raw.kind!=='buy'&&raw.kind!=='sell')return rest;const shares=Math.max(0,Number(raw.shares)||0),price=Math.max(0,Number(raw.price)||0),tradeMode=validMode(raw.tradeMode)?raw.tradeMode:inferMode(shares);if(raw.kind==='buy'){const buy=calculatePurchaseCost({id:String(raw.id),etfCode:String(raw.symbol??''),type:'BUY',tradeMode,shares,price,date:String(raw.date??'')});return {...rest,tradeMode,amount:buy.tradeAmount,fee:buy.commission,tax:0};}const sell=canonicalSellCharges(String(raw.symbol??''),shares,price,tradeMode);return {...rest,tradeMode,amount:sell.amount,fee:sell.fee,tax:sell.tax};});\n return {`);
mustReplace('src/v3/storage.ts',`  holdings:Array.isArray(p.holdings)?p.holdings:[],`,`  holdings:normalizedHoldings,`);
mustReplace('src/v3/storage.ts',`  ledger:Array.isArray(p.ledger)?p.ledger:[],`,`  ledger:rawLedger,`);
mustReplace('src/v3/storage.ts',`  feeSettings:{...defaultFeeSettings,...(p.feeSettings??{})},\n  brokerProfiles:normalizeBrokerProfiles((p as any).brokerProfiles),\n`,``);
mustReplace('src/v3/storage.ts',`  feeSettings:old?.feeSettings??defaultFeeSettings,\n`,``);

// 6) App root no longer configures or resolves broker profiles.
replaceAllInFile('App.tsx',`configureBrokerProfiles, `,``);
replaceAllInFile('App.tsx',`import { estimateSellFee, estimateSellTaxBySettings, resolveBrokerProfile } from './src/data/tradeSettings';\n`,``);
replaceAllInFile('App.tsx',` configureBrokerProfiles(state.brokerProfiles);\n`,``);

// Keep this script deterministic: it only rewrites files. Later stages remove remaining broker UI and old files.
console.log('APPLY_BREAKING_HUANAN_REFACTOR stage 1 complete');
