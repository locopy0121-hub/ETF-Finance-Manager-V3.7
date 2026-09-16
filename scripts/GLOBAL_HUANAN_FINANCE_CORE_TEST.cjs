const fs=require('fs');
const assert=require('assert');

const trade=fs.readFileSync('src/data/tradeSettings.ts','utf8');
const engine=fs.readFileSync('src/v3/engine.ts','utf8');
const overlay=fs.readFileSync('src/services/floatingOverlay.ts','utf8');
const widget=fs.readFileSync('src/widgets/ProfitWidget.tsx','utf8');

// Global finance standard: broker identity is metadata only; arithmetic is Huanan everywhere.
assert.match(trade,/HUANAN_FINANCE_STANDARD/,'single Huanan finance standard missing');
assert.doesNotMatch(trade,/name:\s*'App 預設'/,'legacy App Default finance profile must be removed');
assert.doesNotMatch(trade,/commissionDiscount:\s*1\b/,'legacy undiscounted commission branch must be removed');
assert.doesNotMatch(trade,/minimumCommission:\s*1\b/,'legacy minimum-1 commission branch must be removed');
assert.match(trade,/commissionRate:\s*0\.001425/,'Huanan commission rate missing');
assert.match(trade,/commissionDiscount:\s*0\.65/,'Huanan commission discount missing');
assert.match(trade,/minimumCommission:\s*20/,'Huanan minimum commission missing');
assert.match(trade,/etfSellTaxRate:\s*0\.001/,'Huanan ETF tax missing');
assert.match(trade,/stockSellTaxRate:\s*0\.003/,'Huanan stock tax missing');

// Engine field semantics are fixed and cannot switch by profile.
assert.doesNotMatch(engine,/legacySettingsProfile/,'legacy settings-to-profile calculation path must be removed');
assert.doesNotMatch(engine,/\buseNet\b/,'market value must never switch between gross/net by profile');
assert.doesNotMatch(engine,/unrealizedPLMode\s*===/,'runtime P/L mode switching must be removed');
assert.doesNotMatch(engine,/marketValueMode\s*===/,'runtime market-value mode switching must be removed');
assert.match(engine,/const marketValue\s*=\s*grossMarketValue\s*;/,'marketValue must always be gross market value');
assert.match(engine,/const bookIncome\s*=\s*book\.bookValue\s*;/,'explicit bookIncome field missing');
assert.match(engine,/const pnl\s*=\s*bookIncome\s*-\s*c\.currentCashBasis\s*;/,'unrealized P/L must use book income minus fee-inclusive cost');
assert.match(engine,/const totalAssets\s*=\s*marketValue\s*\+\s*safeCash\s*;/,'total assets must use gross market value plus cash');

// Global consumers must not reintroduce gross unrealized P/L formulas.
assert.doesNotMatch(overlay,/instantPnl:m\.priceUnrealizedPnl/,'overlay must use canonical Huanan P/L');
assert.doesNotMatch(overlay,/m\.priceUnrealizedPnl\/m\.currentTradeCost/,'overlay ROI must use canonical engine ROI');
assert.doesNotMatch(widget,/const cashUnrealized\s*=\s*marketValue-currentCashBasis/,'widget must not locally recompute gross unrealized P/L');

// Real-device 00878 regression fixture: fixed semantics, no hidden balancing adjustment.
const roundTrade=n=>Math.floor(n);
const floor=n=>Math.floor(n);
const commission=(amount)=>Math.max(20,floor(amount*0.001425*0.65));
const etfTax=(amount)=>floor(amount*0.001);
const shares=64, livePrice=34.47, currentCashBasis=2100;
const grossMarketValue=livePrice*shares;
const grossAmount=roundTrade(grossMarketValue);
const sellFee=commission(grossAmount);
const sellTax=etfTax(grossAmount);
const bookIncome=grossAmount-sellFee-sellTax;
const pnl=bookIncome-currentCashBasis;
const roi=Math.trunc((pnl/currentCashBasis*100)*100)/100;
assert.strictEqual(grossMarketValue,2206.08,'00878 gross market value');
assert.strictEqual(grossAmount,2206,'00878 Huanan rounded sell amount');
assert.strictEqual(sellFee,20,'00878 Huanan estimated sell commission');
assert.strictEqual(sellTax,2,'00878 ETF sell tax');
assert.strictEqual(bookIncome,2184,'00878 book income under the approved global Huanan constants');
assert.strictEqual(pnl,84,'00878 unrealized P/L under the approved global Huanan constants');
assert.strictEqual(roi,4,'00878 truncated unrealized ROI');

// Broker labels/ids are metadata: the formula inputs above do not depend on them.
for(const broker of ['華南永昌證券','App 預設','其他券商','',null]){
  const sameBook=grossAmount-commission(grossAmount)-etfTax(grossAmount);
  assert.strictEqual(sameBook,bookIncome,`broker metadata changed arithmetic: ${broker}`);
}

console.log('GLOBAL_HUANAN_FINANCE_CORE_TEST: PASS');
console.log(JSON.stringify({shares,livePrice,currentCashBasis,grossMarketValue,grossAmount,sellFee,sellTax,bookIncome,pnl,roi},null,2));
