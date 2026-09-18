const fs=require('fs');
const assert=require('assert');

const typesPath='src/types/etf.ts';
const calcPath='src/utils/etfCalculators.ts';
const brokerPath='src/data/brokerProfiles.ts';
assert.ok(fs.existsSync(typesPath),'missing src/types/etf.ts');
assert.ok(fs.existsSync(calcPath),'missing src/utils/etfCalculators.ts');
assert.ok(fs.existsSync(brokerPath),'missing src/data/brokerProfiles.ts');

const types=fs.readFileSync(typesPath,'utf8');
const calc=fs.readFileSync(calcPath,'utf8');
const broker=fs.readFileSync(brokerPath,'utf8');

assert.match(broker,/commissionRate:\s*0\.001425/,'default commission rate must be 0.001425');
assert.match(broker,/commissionDiscount:\s*0\.65/,'default commission discount must be 0.65');
assert.match(broker,/minimumCommissionRoundLot:\s*20/,'ROUND_LOT minimum must be 20');
assert.match(broker,/minimumCommissionOddLot:\s*1/,'ODD_LOT minimum must be 1');
assert.match(broker,/etfSellTaxRate:\s*0\.001/,'ETF sell tax must be 0.001');
assert.match(broker,/stockSellTaxRate:\s*0\.003/,'stock sell tax must be 0.003');
assert.match(types,/FINANCE_CORE_POLICY[\s\S]*HEALTH_PREMIUM_THRESHOLD:\s*20_000/,'health premium threshold must be 20,000');
assert.match(types,/HEALTH_PREMIUM_RATE:\s*0\.0211/,'health premium rate must be 0.0211');
assert.match(types,/DIVIDEND_TRANSFER_FEE:\s*10/,'dividend transfer fee must be 10');

assert.ok(!types.includes('customFeeDiscount'),'transaction-level fee discount override must not exist');
for(const forbidden of [
  'DEFAULT_DISCOUNT',
  'calculateHuaNanFee',
  'calculateSellProceeds',
  'formatPrecision',
  'FeeSettings',
]){
  assert.ok(!calc.includes(forbidden),`forbidden legacy calculation symbol remains: ${forbidden}`);
}

// Broker Profile is the single parameter source. Formula structure stays canonical,
 // while commission/tax parameters remain editable through settings.
assert.match(broker,/export type BrokerProfile/,'shared BrokerProfile definition must exist');
assert.match(broker,/HUANAN_YONGCHANG_PROFILE_ID/,'Huanan broker profile must exist');
assert.match(broker,/commissionDiscount:0\.65/,'default broker profile must start from Huanan 0.65 baseline');
assert.match(calc,/calculateBrokerCommission\(/,'canonical calculator must delegate commission to broker profile');
assert.match(calc,/calculateBrokerSellTax\(/,'canonical calculator must delegate sell tax to broker profile');
assert.match(calc,/defaultBrokerProfile/,'missing profile must fall back to the configured app default profile');
assert.ok(!/huananYongchangBrokerProfile/.test(calc),'canonical core must not bind directly to a named broker profile');
assert.match(calc,/Math\.floor\(shares \* price\)/,'buy trade amount must floor before commission');
assert.match(calc,/Math\.floor\(totalShares \* currentPrice\)/,'current market value must floor before liquidation charges');
assert.match(calc,/DIVIDEND_TRANSFER_FEE/,'net dividend must deduct the canonical transfer fee');

assert.match(calc,/const sortTransactions\s*=/,'transactions must be deterministically sorted');
assert.match(calc,/averageCostBeforeSell/,'SELL must release moving-average cost');
assert.ok(!/totalInvestmentCost\s*-=?\s*calculateSellProceeds/.test(calc),'sell proceeds must never reduce holding cost');
assert.match(calc,/Math\.round\(\s*\(safeValue \+ Number\.EPSILON\) \* 100/,'percentages must use the approved two-decimal rounding rule');

const floorAmount=(price,shares)=>Math.floor(price*shares);
const fee=(amount,mode)=>Math.max(mode==='ODD_LOT'?1:20,Math.floor(Math.floor(amount)*0.001425*0.65));
const etfTax=amount=>Math.floor(Math.floor(amount)*0.001);
const stockTax=amount=>Math.floor(Math.floor(amount)*0.003);
const gross=floorAmount(22.0608,100);
assert.strictEqual(gross,2206,'trade/current market value must floor first');
assert.strictEqual(fee(gross,'ODD_LOT'),2,'00878 odd-lot estimated sell fee');
assert.strictEqual(etfTax(gross),2,'00878 ETF estimated sell tax');
assert.strictEqual(gross-fee(gross,'ODD_LOT')-etfTax(gross),2202,'00878 net liquidation value');
assert.strictEqual(stockTax(20000),60,'stock sell tax must be 0.3%');
assert.strictEqual(Math.floor(20000*0.0211),422,'health premium at threshold');
assert.strictEqual(Math.max(0,Math.floor(1000*1.5)-0-10),1490,'dividend under threshold deducts 10 transfer fee');
assert.strictEqual(Math.max(0,20000-Math.floor(20000*0.0211)-10),19568,'dividend at threshold deducts NHI and 10 transfer fee');
assert.match(calc,/totalPnl:\s*comprehensivePnL/,'portfolio totalPnl must alias comprehensivePnL');

console.log('BREAKING_HUANAN_CORE_TEST: PASS');
