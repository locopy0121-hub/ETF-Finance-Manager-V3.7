const fs=require('fs');

const read=(p)=>fs.readFileSync(p,'utf8');
const must=(ok,msg)=>{if(!ok){console.error(`FAIL: ${msg}`);process.exit(1)}};
const has=(text,needle,msg)=>must(text.includes(needle),msg);

const monitoring=read('src/v3/monitoring.ts');
const editor=read('src/v3/MonitorFieldEditor.tsx');
const twse=read('src/services/twse.ts');
const overlay=read('src/services/floatingOverlay.ts');
const native=read('modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt');

has(monitoring,'limitUpTextColor?:string','MonitorFieldStyle must persist limit-up text color');
has(monitoring,'limitUpBackgroundColor?:string','MonitorFieldStyle must persist limit-up background color');
has(monitoring,'limitDownTextColor?:string','MonitorFieldStyle must persist limit-down text color');
has(monitoring,'limitDownBackgroundColor?:string','MonitorFieldStyle must persist limit-down background color');

must(/PNL=new Set<MonitorField>\(\[[^\]]*'price'/.test(editor),'price must use the existing market color controls');
has(editor,'市場行情色','existing 即時行情 editor must expose market color toggle');
has(editor,'漲停文字顏色','existing 即時行情 editor must expose limit-up text color');
has(editor,'漲停背景顏色','existing 即時行情 editor must expose limit-up background color');
has(editor,'跌停文字顏色','existing 即時行情 editor must expose limit-down text color');
has(editor,'跌停背景顏色','existing 即時行情 editor must expose limit-down background color');
has(editor,"field==='price'?'#F4D35E':'#8E9BAE'",'flat price must default to yellow without changing other neutral P/L colors');

has(twse,'limitUp?: number;','TWSE quote must carry official limit-up price');
has(twse,'limitDown?: number;','TWSE quote must carry official limit-down price');
has(twse,'limitUp: toNumber(raw?.u)','TWSE MIS upper-limit field u must be parsed');
has(twse,'limitDown: toNumber(raw?.w)','TWSE MIS lower-limit field w must be parsed');

has(overlay,'limitUp:Number(q.limitUp??0)','overlay snapshot must forward limit-up price');
has(overlay,'limitDown:Number(q.limitDown??0)','overlay snapshot must forward limit-down price');

has(native,'private fun priceMarketState','native monitor must classify price against previous close and limits');
has(native,'limitUpBackgroundColor','native monitor must render configured limit-up background');
has(native,'limitDownBackgroundColor','native monitor must render configured limit-down background');
has(native,'val nextPositions = JSONArray(positions.toString())','native quote refresh must build an off-screen portfolio candidate');
has(native,'payload.put("positions", nextPositions)','native quote refresh must atomically swap the candidate snapshot');
must(!native.includes('val q = map[pos.optString("symbol")] ?: continue'),'missing one TWSE symbol must not drop that holding from totals');
has(native,'pos.put("limitUp"','native batch refresh must update limit-up price');
has(native,'pos.put("limitDown"','native batch refresh must update limit-down price');

console.log('PASS: V3.7.4 market quote snapshot/editor contract');
