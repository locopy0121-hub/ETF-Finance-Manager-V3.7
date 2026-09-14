const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function must(name,file,needles){const text=read(file);const missing=needles.filter(x=>!text.includes(x));if(missing.length)throw new Error(`${name}: missing ${missing.join(' | ')}`);console.log(`- ${name}: PASS`);}
function mustNot(name,file,needles){const text=read(file);const found=needles.filter(x=>text.includes(x));if(found.length)throw new Error(`${name}: forbidden ${found.join(' | ')}`);console.log(`- ${name}: PASS`);}

must('V3.3.14 version constants','src/v3/version.ts',["APP_DISPLAY_VERSION='V3.3.14'","APP_SEMVER='3.3.14'","OTA_RUNTIME_VERSION='3.2.0'"]);
must('trade amount keeps two decimals','src/v3/financeFormat.ts',['return roundHalfUp(normalizedPrice*units,2);']);
mustNot('trade amount no longer truncates cents','src/v3/financeFormat.ts',['Math.trunc((cents*units)/100)']);
must('V3 money displays two decimals','src/v3/engine.ts',['minimumFractionDigits:2','maximumFractionDigits:2']);
must('legacy money defaults to two decimals','src/domain/metrics.ts',['export const money = (value: number, decimals = 2) =>','export const signedMoney = (value: number, decimals = 2) =>']);
must('new purchase uses decimal-safe amount','src/screens/AddHoldingScreen.tsx',['preciseTradeAmount(roundedTradePrice, roundedShares)','roundHalfUp(tradeAmount + appliedFee, 2)','purchaseCost: preciseTradeAmount(price, sh)']);
mustNot('new purchase no integer truncation','src/screens/AddHoldingScreen.tsx',['Math.trunc(roundedShares * roundedTradePrice)','Math.trunc(sh * price)','Math.trunc(appliedFee)']);
must('holding editor uses decimal-safe amount','src/screens/EditHoldingScreen.tsx',['preciseTradeAmount(price, sh)','roundHalfUp(amount + fee, 2)','money(values.amount, 2)','money(values.totalCost, 2)']);
mustNot('holding editor no integer truncation','src/screens/EditHoldingScreen.tsx',['Math.trunc(sh * price)','Math.trunc(fee)']);
must('V3 holding editor stores two-decimal total','src/v3/screens.tsx',['totalCost:roundHalfUp(purchaseCost+fee,2)']);

const roundHalfUp=(v,d=2)=>Math.round((v+Number.EPSILON)*(10**d))/(10**d);
const amount=roundHalfUp(roundHalfUp(15.68,2)*101,2);
if(amount!==1583.68)throw new Error(`decimal example failed: expected 1583.68 got ${amount}`);
const shown=amount.toLocaleString('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2});
if(shown!=='1,583.68')throw new Error(`format example failed: expected 1,583.68 got ${shown}`);
console.log('- example 15.68 × 101 = 1,583.68: PASS');
console.log('V3314_MONEY_DECIMAL_AUDIT: PASS');
