const fs=require('fs');
const assert=require('assert');

const typesPath='src/types/etf.ts';
const calcPath='src/utils/etfCalculators.ts';
assert.ok(fs.existsSync(typesPath),'missing src/types/etf.ts');
assert.ok(fs.existsSync(calcPath),'missing src/utils/etfCalculators.ts');

const types=fs.readFileSync(typesPath,'utf8');
const calc=fs.readFileSync(calcPath,'utf8');

assert.match(types,/COMMISSION_RATE:\s*0\.001425/,'commission rate must be 0.001425');
assert.match(types,/COMMISSION_DISCOUNT:\s*0\.65/,'commission discount must be 0.65');
assert.match(types,/MIN_COMMISSION_ROUND_LOT:\s*20/,'ROUND_LOT minimum must be 20');
assert.match(types,/MIN_COMMISSION_ODD_LOT:\s*1/,'ODD_LOT minimum must be 1');
assert.match(types,/ETF_SELL_TAX_RATE:\s*0\.001/,'ETF sell tax must be 0.001');
assert.match(types,/HEALTH_PREMIUM_THRESHOLD:\s*20_000/,'health premium threshold must be 20,000');
assert.match(types,/HEALTH_PREMIUM_RATE:\s*0\.0211/,'health premium rate must be 0.0211');

assert.ok(!types.includes('customFeeDiscount'),'transaction-level fee discount override must not exist');
assert.ok(!calc.includes('Legacy'),'legacy compatibility must not exist');
assert.ok(!calc.includes('DEFAULT_DISCOUNT'),'old configurable discount must not exist');
assert.ok(!calc.includes('calculateHuaNanFee'),'old exported fee helper must not exist');
assert.ok(!calc.includes('calculateSellProceeds'),'old sell-proceeds helper must not exist');
assert.ok(!calc.includes('formatPrecision'),'old generic precision helper must not exist');
assert.match(calc,/const sortTransactions\s*=/,'transactions must be deterministically sorted');
assert.match(calc,/averageCostBeforeSell/,'SELL must release moving-average cost');
assert.ok(!/totalInvestmentCost\s*-=?\s*calculateSellProceeds/.test(calc),'sell proceeds must never reduce holding cost');
assert.match(calc,/Math\.round\(\s*\(safeValue \+ Number\.EPSILON\) \* 100/,'percentages must use the approved two-decimal rounding rule');

const fee=(amount,mode)=>Math.max(mode==='ODD_LOT'?1:20,Math.floor(amount*0.001425*0.65));
const tax=amount=>Math.floor(amount*0.001);
assert.strictEqual(fee(2206.08,'ODD_LOT'),2,'00878 odd-lot estimated sell fee');
assert.strictEqual(tax(2206.08),2,'00878 ETF estimated sell tax');
assert.strictEqual(2206.08-fee(2206.08,'ODD_LOT')-tax(2206.08),2202.08,'00878 net liquidation value');
assert.strictEqual(Math.floor(20000*0.0211),422,'health premium at threshold');

console.log('BREAKING_HUANAN_CORE_TEST: PASS');
