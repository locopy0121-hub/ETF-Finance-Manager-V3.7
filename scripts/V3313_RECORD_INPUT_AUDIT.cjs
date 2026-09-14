const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function must(name,file,needles){const text=read(file);const missing=needles.filter(x=>!text.includes(x));if(missing.length)throw new Error(`${name}: missing ${missing.join(' | ')}`);console.log(`- ${name}: PASS`);}
function mustNot(name,file,needles){const text=read(file);const found=needles.filter(x=>text.includes(x));if(found.length)throw new Error(`${name}: forbidden ${found.join(' | ')}`);console.log(`- ${name}: PASS`);}
must('V3.3.13 version constants','src/v3/version.ts',["APP_DISPLAY_VERSION='V3.3.13'","APP_SEMVER='3.3.13'","OTA_RUNTIME_VERSION='3.2.0'"]);
must('manual transaction date picker','src/v3/screens.tsx',['function ManualDatePickerRow','<ManualDatePickerRow label="交易日期" value={dateText} onChange={setDateText}/>','onChange(next);setOpen(false)']);
must('execution price is manual only','src/v3/screens.tsx',['成交價格完全依券商實際成交紀錄手動輸入；不讀取即時價、不自動帶價。']);
must('ETF lookup only fills identity','src/v3/screens.tsx',['ETF 代號只用來帶入名稱；此記錄表單不讀取即時行情，也不會修改交易日期或成交價格。']);
mustNot('ledger form does not fetch live quote','src/v3/screens.tsx',["import { fetchTwseQuotes } from '../services/twse';",'setMarketReference(','marketReference?','setPrice(row.price','quotePrice={holdingMetrics']);
must('new holding purchase uses execution price terminology','src/screens/AddHoldingScreen.tsx',['成交價格 *','成交價格必須大於 0','購入日期、股數與實際成交價格建立單筆購入紀錄']);
mustNot('new holding purchase has no execution quote auto-fill','src/screens/AddHoldingScreen.tsx',['fetchTwseQuotes','setTradeAvgPrice(row.price','setTradeAvgPrice(quote']);
must('new record in holding editor starts with blank manual price','src/v3/screens.tsx',["date:fmtDate(new Date()),shares:'0',tradePrice:'',fee:'0'"]);
must('theme cards fix retained','src/v3/screens.tsx',['全局卡片｜目前佈景','載入目前佈景的卡片外觀設定','換主題不會清空卡片資料']);
console.log('V3313_RECORD_INPUT_AUDIT: PASS');
