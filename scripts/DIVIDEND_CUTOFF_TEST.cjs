const fs=require('fs');const path=require('path');const vm=require('vm');const ts=require('typescript');
const root=path.resolve(__dirname,'..');const source=fs.readFileSync(path.join(root,'src','services','twseDividends.ts'),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},fileName:'twseDividends.ts'});
const moduleObj={exports:{}};
const holidayHtml=`<table><tr><td>2026-02-11</td><td>農曆春節前最後交易日</td><td>最後交易</td></tr><tr><td>2026-02-12</td><td>市場無交易</td></tr><tr><td>2026-02-13</td><td>市場無交易</td></tr><tr><td>2026-02-16</td><td>農曆春節</td></tr><tr><td>2026-02-17</td><td>農曆春節</td></tr><tr><td>2026-02-18</td><td>農曆春節</td></tr><tr><td>2026-02-19</td><td>農曆春節</td></tr><tr><td>2026-02-20</td><td>農曆春節補假</td></tr><tr><td>2026-02-23</td><td>春節後開始交易日</td></tr></table>`;
const fakeFetch=async(url)=>({ok:true,status:200,text:async()=>String(url).includes('holidaySchedule')?holidayHtml:'',json:async()=>({})});
vm.runInNewContext(output.outputText,{module:moduleObj,exports:moduleObj.exports,require,fetch:fakeFetch,AbortController,setTimeout,clearTimeout,Map,Set,Date,Math,Number,String,RegExp,Promise,console});
const d=moduleObj.exports;
function eq(actual,expected,label){if(actual!==expected)throw new Error(`${label}: expected ${expected}, got ${actual}`)}
eq(d.previousTradingDay('2026-08-18'),'2026-08-17','weekday previous trading day');
eq(d.previousTradingDay('2026-02-23'),'2026-02-20','weekend-only fallback intentionally sees Friday');
(async()=>{eq(await d.previousTwseTradingDay('2026-08-18'),'2026-08-17','TWSE normal previous trading day');eq(await d.previousTwseTradingDay('2026-02-23'),'2026-02-11','TWSE holiday-aware last buy day');console.log('DIVIDEND_CUTOFF_TEST: PASS')})().catch(e=>{console.error(e);process.exit(1)});
