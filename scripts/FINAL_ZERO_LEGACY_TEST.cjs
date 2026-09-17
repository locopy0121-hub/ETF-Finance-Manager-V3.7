const fs=require('fs');
const path=require('path');
const assert=require('assert');
const expectFail=process.argv.includes('--expect-fail');
const stripComments=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|\s)\/\/.*$/gm,'$1');
function walk(dir,out=[]){for(const name of fs.readdirSync(dir)){const p=path.join(dir,name);const st=fs.statSync(p);if(st.isDirectory())walk(p,out);else if(/\.(ts|tsx)$/.test(p))out.push(p);}return out;}
const violations=[];
for(const f of ['src/data/tradeSettings.ts','src/v3/engineBase.ts'])if(fs.existsSync(f))violations.push(`${f}: forbidden file still exists`);
const banned=[/\bFeeSettings\b/g,/\bholdingMetrics\b/g,/\bportfolioMetrics\b/g,/['"]\.\.\/data\/tradeSettings['"]/g,/['"]\.\/engineBase['"]/g];
for(const file of walk('src')){const code=stripComments(fs.readFileSync(file,'utf8'));for(const re of banned){re.lastIndex=0;if(re.test(code))violations.push(`${file}: ${re}`);}}
if(expectFail){assert.ok(violations.length>0,'RED gate expected legacy violations before final removal');console.log(`FINAL_ZERO_LEGACY_TEST RED: ${violations.length} violation(s) detected as expected`);process.exit(0);}
const widget=fs.readFileSync('src/widgets/ProfitWidget.tsx','utf8');
assert.match(widget,/portfolioSummary\?\s*:\s*PortfolioSummary/,'Widget must consume canonical PortfolioSummary');
assert.match(widget,/unrealizedProfit/,'Widget must render canonical unrealizedProfit');
assert.match(widget,/netLiquidationValue/,'Widget must render canonical netLiquidationValue');
assert.ok(!/shares\s*\*\s*(?:h\.)?price/.test(widget),'Widget must not calculate market value');
assert.ok(!/marketValue\s*-\s*(?:current|investment|cost)/i.test(widget),'Widget must not calculate P/L from market value minus cost');
const task=fs.readFileSync('src/widgets/widgetTaskHandler.tsx','utf8');
assert.match(task,/calculatePortfolioCoreSummary/,'Widget task adapter must subscribe to canonical portfolio core summary');
assert.match(task,/portfolioSummary\s*:/,'Widget task payload must carry canonical portfolio summary');
const engine=fs.readFileSync('src/v3/engine.ts','utf8');
assert.match(engine,/return calculatePortfolioSummary\(/,'portfolio adapter must delegate directly to calculatePortfolioSummary');
assert.match(engine,/requiredTradeMode/,'tradeMode must be runtime-required with no fallback');
assert.match(engine,/brokerProfileId/,'brokerProfileId must remain as the stable broker-profile reference in the current architecture');
if(violations.length){console.error(violations.join('\n'));process.exit(1);}
console.log('FINAL_ZERO_LEGACY_TEST: PASS');
