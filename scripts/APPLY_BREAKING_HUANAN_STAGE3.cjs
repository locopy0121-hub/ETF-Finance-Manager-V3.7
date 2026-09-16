const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const write=(f,s)=>fs.writeFileSync(f,s);
const rep=(f,re,to)=>{let s=read(f);write(f,s.replace(re,to));};
const must=(f,re,to,label)=>{let s=read(f);if(!re.test(s))throw new Error(`${f}: missing ${label}`);write(f,s.replace(re,to));};

// Purchase records carry the immutable trade mode used for their canonical fee.
must('src/data/portfolio.ts',/  totalCost: number;\n};/,`  totalCost: number;\n  tradeMode: TradeMode;\n};`,'PurchaseRecord.tradeMode');

// Fix literal typing in canonical engine/App.
rep('src/v3/engine.ts',/type:\(e\.kind==='buy'\?'BUY':'SELL'\) as const,/g,`type:e.kind==='buy'?('BUY' as const):('SELL' as const),`);
rep('App.tsx',/dividendFrequency:1,broker:'華南永昌證券'/g,`dividendFrequency:1 as const,broker:'華南永昌證券'`);

// AI buy flow cannot supply user-entered fees/broker profiles; it must select TradeMode and let core calculate.
rep('src/v3/AiAssistantModal.tsx',/^import React/m,`import type { TradeMode } from '../types/etf';\nimport React`);
rep('src/v3/AiAssistantModal.tsx',/export type AiBuyDraft=\{symbol:string;name:string;date:string;shares:number;price:number;fee:number;strategy:'long'\|'swing';broker:string;account:string\};/,`export type AiBuyDraft={symbol:string;name:string;date:string;shares:number;price:number;tradeMode:TradeMode;strategy:'long'|'swing';account:string};`);
must('src/v3/AiAssistantModal.tsx',/function parseBuy\(text:string,common:ScreenCommon\):AiBuyDraft\|null\{[\s\S]*?\nfunction answerQuery/,`function parseBuy(text:string,common:ScreenCommon):AiBuyDraft|null{if(!/(買進|購入|買入|買了|買)/.test(text))return null;const sym=text.toUpperCase().match(/\\b\\d{4,6}[A-Z]?\\b/)?.[0];if(!sym)return null;const shares=normalizeNumber(text.match(/([\\d,]+)\\s*股/)?.[1]);if(!(shares>0))return null;const after=text.slice(text.toUpperCase().indexOf(sym)+sym.length);let price=normalizeNumber(after.match(/(?:成交(?:價|行情)?|價格|買進價|@)?\\s*([0-9]+(?:\\.[0-9]+)?)/)?.[1]);if(price===shares){const nums=[...after.matchAll(/([0-9]+(?:\\.[0-9]+)?)/g)].map(m=>Number(m[1])).filter(n=>n!==shares);price=nums[0]??0}if(!(price>0))return null;const h=common.holdings.find(x=>x.symbol===sym);const tradeMode:TradeMode=h?.liquidationTradeMode??(shares>=1000&&shares%1000===0?'ROUND_LOT':'ODD_LOT');return {symbol:sym,name:resolveName(sym,common),date:parseDateText(text),shares,price,tradeMode,strategy:'long',account:h?.account??''};}\nfunction answerQuery`,'AI parseBuy');

// One legacy daily screen still imported the deleted V2 domain calculator.
rep('src/screens/DailyProfitScreen.tsx',/from '\.\.\/domain\/metrics'/g,`from '../v3/engine'`);

// Remove the last profile references from the active Ledger screen.
rep('src/v3/screensBase.tsx',/,common\.feeSettings\.brokerName\]/g,`]`);
rep('src/v3/screensBase.tsx',/onReconcile\(\{actualBalance:n,checkedAt:Date\.now\(\),broker,account,/g,`onReconcile({actualBalance:n,checkedAt:Date.now(),broker:'華南永昌證券',account,`);

// Replace the complete buy/sell controls with canonical, non-overridable Huanan controls.
must('src/v3/screensBase.tsx',/   \{\(kind==='buy'\|\|kind==='sell'\)\?<><Field label="成交價格"[\s\S]*?   \{\(kind==='dividend'\|\|kind==='cash'\)\?/,`   {(kind==='buy'||kind==='sell')?<><Field label="成交價格" value={price} onChange={setPrice} keyboard="decimal-pad" suffix="元"/><Text style={s.note}>成交價格完全依券商實際成交紀錄手動輸入；費率、折扣、最低費用與 ETF 稅率固定由華南永昌金融核心計算。</Text><Field label="股數" value={shares} onChange={setShares} keyboard="number-pad" suffix="股"/><SettingRow label="交易模式"><Choice active={tradeMode==='ROUND_LOT'} label="整股" onPress={()=>setTradeMode('ROUND_LOT')}/><Choice active={tradeMode==='ODD_LOT'} label="盤後零股 / 定期定額" onPress={()=>setTradeMode('ODD_LOT')}/></SettingRow><View style={s.calcBox}><Text style={s.muted}>成交金額</Text><Text style={s.calcVal}>{money(tradeAmount)}</Text></View><View style={s.calcBox}><Text style={s.muted}>華南永昌手續費</Text><Text style={s.calcVal}>{money(calcFee)}</Text></View>{kind==='sell'?<View style={s.calcBox}><Text style={s.muted}>ETF 證券交易稅</Text><Text style={s.calcVal}>{money(calcTax)}</Text></View>:null}<Field label="帳戶 / 交割戶" value={account} onChange={setAccount}/>{kind==='buy'?<View style={s.strategyRow}><Choice active={strategy==='long'} label="長期存股" onPress={()=>setStrategy('long')}/><Choice active={strategy==='swing'} label="短期波段" onPress={()=>setStrategy('swing')}/></View>:null}<View style={s.calcBox}><Text style={s.muted}>{kind==='buy'?'實際現金支出':'實際現金流入'}</Text><Text style={s.calcVal}>{money(kind==='buy'?tradeAmount+calcFee:tradeAmount-calcFee-calcTax)}</Text></View></>:null}\n   {(kind==='dividend'||kind==='cash')?`,'ledger buy/sell JSX');

// Cash/dividend UI has no broker selector; broker is globally fixed.
must('src/v3/screensBase.tsx',/   \{\(kind==='dividend'\|\|kind==='cash'\)\?<><Field[\s\S]*?<TouchableOpacity style=\{s\.primary\}/,`   {(kind==='dividend'||kind==='cash')?<><Field label={kind==='dividend'?'實收配息':'現金資金變動（正數存入、負數提出）'} value={amount} onChange={setAmount} keyboard="decimal-pad" suffix="元"/>{kind==='cash'?<><Text style={s.note}>券商固定：華南永昌證券</Text><Field label="帳戶 / 交割戶" value={account} onChange={setAccount}/><Field label="核帳備註" value={cashNote} onChange={setCashNote}/></>:null}</>:null}\n   <TouchableOpacity style={s.primary}`,'ledger cash JSX');

// Ledger editor must not permit manual fee/tax/broker mutations. It keeps TradeMode and recomputes in App on save path.
rep('src/v3/screensBase.tsx',/\{draft\.kind==='buy'\|\|draft\.kind==='sell'\?<><Field label="股數"[\s\S]*?<Field label="券商" value=\{draft\.broker\?\?''\} onChange=\{v=>patch\(\{broker:v\}\)\}\/>/,`{draft.kind==='buy'||draft.kind==='sell'?<><Field label="股數" value={String(draft.shares??'')} onChange={v=>patch({shares:Number(v)||0})} keyboard="decimal-pad" suffix="股"/><Field label="成交價格" value={String(draft.price??'')} onChange={v=>patch({price:Number(v)||0})} keyboard="decimal-pad" suffix="元"/><SettingRow label="交易模式"><Choice active={draft.tradeMode==='ROUND_LOT'} label="整股" onPress={()=>patch({tradeMode:'ROUND_LOT'})}/><Choice active={draft.tradeMode==='ODD_LOT'} label="盤後零股 / 定期定額" onPress={()=>patch({tradeMode:'ODD_LOT'})}/></SettingRow><Text style={s.note}>手續費與 ETF 稅由華南永昌金融核心重新計算，不可手動覆寫。</Text></>:<Field label="帳務金額" value={String(draft.amount??0)} onChange={v=>patch({amount:Number(v)||0})} keyboard="decimal-pad" suffix="元"/>}<Text style={s.note}>券商：華南永昌證券</Text>`);
rep('src/v3/screensBase.tsx',/fee:draft\.fee==null\?undefined:Number\(draft\.fee\|\|0\),tax:draft\.tax==null\?undefined:Number\(draft\.tax\|\|0\)/g,`fee:undefined,tax:undefined,broker:'華南永昌證券'`);

// Settings function destructuring must match its already-reduced prop type.
rep('src/v3/screensBase.tsx',/export function SettingsModal\(\{visible,embedded,prefs,appSettings,feeSettings,brokerProfiles,marketMeta,/g,`export function SettingsModal({visible,embedded,prefs,appSettings,marketMeta,`);
rep('src/v3/screensBase.tsx',/,onFeeChange,onBrokerProfilesChange,onCheckOta/g,`,onCheckOta`);

// Remove any remaining broker picker JSX after profile components were deleted.
rep('src/v3/screensBase.tsx',/<BrokerProfilePicker[\s\S]*?\/>/g,`<Text style={s.note}>券商固定：華南永昌證券</Text>`);

console.log('APPLY_BREAKING_HUANAN_STAGE3 complete');
