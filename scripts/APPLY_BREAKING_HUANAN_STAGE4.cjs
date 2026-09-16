const fs=require('fs');
const read=f=>fs.readFileSync(f,'utf8');
const write=(f,s)=>fs.writeFileSync(f,s);
const rep=(f,re,to)=>{let s=read(f);write(f,s.replace(re,to));};
const must=(f,re,to,label)=>{let s=read(f);if(!re.test(s))throw new Error(`${f}: missing ${label}`);write(f,s.replace(re,to));};

// Daily profit is display-only; no deleted legacy domain helper imports.
rep('src/screens/DailyProfitScreen.tsx',/import \{ money, signedMoney, signedPercent \} from '\.\.\/v3\/engine';/,`import { money } from '../v3/engine';\nconst signedMoney=(n:number)=>\`${'${'}Number(n)>=0?'+':'-'}\${money(Math.abs(Number(n)||0))}\`;\nconst signedPercent=(n:number)=>\`${'${'}Number(n)>=0?'+':''}\${Number(n||0).toFixed(2)}%\`;`);
rep('src/screens/DailyProfitScreen.tsx',/money\(h\.marketValue,0\)/g,`money(h.marketValue)`);

// AI confirmation uses the one canonical Huanan calculator rather than a fee field supplied by the draft.
rep('src/v3/AiAssistantModal.tsx',/import type \{ TradeMode \} from '\.\.\/types\/etf';/,`import type { TradeMode } from '../types/etf';\nimport { calculatePurchaseCost } from '../utils/etfCalculators';`);
rep('src/v3/AiAssistantModal.tsx',/<Text style=\{a\.confirmText\}>手續費　　\$\{money\(draft\.fee\)\}<\/Text>/g,`<Text style={a.confirmText}>手續費　　${'${'}money(calculatePurchaseCost({id:'ai-preview',etfCode:draft.symbol,type:'BUY',tradeMode:draft.tradeMode,shares:draft.shares,price:draft.price,date:draft.date}).commission)}</Text>`);

// Holding editor records are canonical transactions: tradeMode is explicit and fees are never manually entered.
rep('src/v3/screensBase.tsx',/return \{id:`legacy-\$\{holding\.symbol\}`,date:'既有庫存',shares:holding\.shares\+soldShares,tradePrice:price,purchaseCost,fee,totalCost:purchaseCost\+fee\};/g,`return {id:\`legacy-${'${'}holding.symbol}\`,date:'既有庫存',shares:holding.shares+soldShares,tradePrice:price,purchaseCost,fee,totalCost:purchaseCost+fee,tradeMode:holding.liquidationTradeMode};`);
rep('src/v3/screensBase.tsx',/source\.map\(r=>\(\{id:r\.id,date:r\.date,shares:String\(r\.shares\),tradePrice:String\(r\.tradePrice\),fee:String\(r\.fee\)\}\)\)/g,`source.map(r=>({id:r.id,date:r.date,shares:String(r.shares),tradePrice:String(r.tradePrice),tradeMode:r.tradeMode}))`);
rep('src/v3/screensBase.tsx',/Partial<\{date:string;shares:string;tradePrice:string;fee:string\}>/g,`Partial<{date:string;shares:string;tradePrice:string;tradeMode:TradeMode}>`);
rep('src/v3/screensBase.tsx',/date:fmtDate\(new Date\(\)\),shares:'0',tradePrice:'',fee:'0'/g,`date:fmtDate(new Date()),shares:'0',tradePrice:'',tradeMode:holding.liquidationTradeMode`);
must('src/v3/screensBase.tsx',/ const normalized=records\.map\(r=>\{const shares=Number\(r\.shares\.replace\(\/,\/g,''\)\);const tradePrice=Number\(r\.tradePrice\.replace\(\/,\/g,''\)\);[\s\S]*?\}\); const grossShares=/,` const normalized=records.map(r=>{const shares=Number(r.shares.replace(/,/g,''));const tradePrice=Number(r.tradePrice.replace(/,/g,''));const buy=calculatePurchaseCost({id:r.id,etfCode:holding.symbol,type:'BUY',tradeMode:r.tradeMode,shares,price:tradePrice,date:r.date});return {id:r.id,date:r.date,shares,tradePrice,purchaseCost:buy.tradeAmount,fee:buy.commission,totalCost:buy.settlementAmount,tradeMode:r.tradeMode};}); const grossShares=`,'holding normalized rows');
rep('src/v3/screensBase.tsx',/\|\|!Number\.isFinite\(r\.fee\)\|\|r\.fee<0/g,'');
rep('src/v3/screensBase.tsx',/<Field label="手續費" value=\{r\.fee\} onChange=\{v=>patchRecord\(r\.id,\{fee:v\}\)\} keyboard="number-pad" suffix="元"\/>/g,`<SettingRow label="交易模式"><Choice active={r.tradeMode==='ROUND_LOT'} label="整股" onPress={()=>patchRecord(r.id,{tradeMode:'ROUND_LOT'})}/><Choice active={r.tradeMode==='ODD_LOT'} label="盤後零股 / 定期定額" onPress={()=>patchRecord(r.id,{tradeMode:'ODD_LOT'})}/></SettingRow><Text style={s.note}>手續費由華南永昌金融核心自動計算。</Text>`);

// SettingsModal no longer accepts any finance-profile configuration props.
rep('src/v3/screensBase.tsx',/feeSettings,brokerProfiles,/g,'');
rep('src/v3/screensBase.tsx',/;feeSettings:FeeSettings;brokerProfiles:BrokerProfile\[\]/g,'');
rep('src/v3/screensBase.tsx',/;onFeeChange:\(p:Partial<FeeSettings>\)=>void;onBrokerProfilesChange:\(profiles:BrokerProfile\[\]\)=>void/g,'');

console.log('APPLY_BREAKING_HUANAN_STAGE4 complete');
