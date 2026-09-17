const fs = require('fs');
const assert = require('assert');

const read = (path) => fs.readFileSync(path, 'utf8');
const types = read('src/types/etf.ts');
const brokers = read('src/data/brokerProfiles.ts');
const core = read('src/utils/etfCalculators.ts');
const engine = read('src/v3/engine.ts');

// Canonical constants: one approved Huanan rule set.
assert.match(types, /COMMISSION_RATE:\s*0\.001425/);
assert.match(types, /COMMISSION_DISCOUNT:\s*0\.65/);
assert.match(types, /MIN_COMMISSION_ROUND_LOT:\s*20/);
assert.match(types, /MIN_COMMISSION_ODD_LOT:\s*1/);
assert.match(types, /ETF_SELL_TAX_RATE:\s*0\.001/);
assert.match(types, /STOCK_SELL_TAX_RATE:\s*0\.003/);
assert.match(types, /HEALTH_PREMIUM_THRESHOLD:\s*20_000/);
assert.match(types, /HEALTH_PREMIUM_RATE:\s*0\.0211/);
assert.match(types, /DIVIDEND_REMITTANCE_FEE:\s*10/);

// Broker profiles may identify a broker, but they must derive finance rules from HUANAN_CONFIG.
assert.match(brokers, /import\s*\{\s*HUANAN_CONFIG\s*\}/);
assert.ok(!/commissionDiscount:\s*1(?:\D|$)/.test(brokers), 'broker profile must not restore an undiscounted finance rule');
assert.ok(!/unrealizedPLMode:\s*'GROSS'/.test(brokers), 'broker profile must not restore gross unrealized PnL');

// Canonical core owns floor rules and payout deductions.
assert.match(core, /Math\.floor\(\s*price\s*\*\s*shares\s*\)/, 'trade amount must be floored');
assert.match(core, /Math\.floor\(\s*currentPrice\s*\*\s*totalShares\s*\)/, 'current market value must be floored');
assert.match(core, /DIVIDEND_REMITTANCE_FEE/, 'dividend remittance fee must be applied in finance core');
assert.match(core, /realizedProfit/, 'realized PnL must be produced by finance core');
assert.match(core, /totalRealizedProfit/, 'portfolio must aggregate realized PnL');
assert.match(core, /totalNetDividends/, 'portfolio must aggregate net dividends');
assert.match(core, /totalPnl/, 'portfolio must expose comprehensive total PnL');

// Application adapter must bind, not rebuild, the canonical totals.
assert.match(engine, /totalPnl:\s*canonical\.totalPnl/);
assert.match(engine, /realizedPnl:\s*canonical\.totalRealizedProfit/);
assert.match(engine, /cumulativeDividends:\s*canonical\.totalNetDividends/);
assert.ok(!/totalPnl:\s*canonical\.totalUnrealizedProfit/.test(engine), 'totalPnl must not alias unrealized PnL');

// Arithmetic reference vectors from the approved design.
const floor = Math.floor;
const commission = (amount, mode) => Math.max(mode === 'ROUND_LOT' ? 20 : 1, floor(amount * 0.001425 * 0.65));
const tax = (amount, instrument) => floor(amount * (instrument === 'stock' ? 0.003 : 0.001));
const dividend = (perShare, shares) => {
  const gross = floor(perShare * shares);
  if (gross <= 0) return { gross: 0, nhi: 0, remittance: 0, net: 0 };
  const nhi = gross >= 20000 ? floor(gross * 0.0211) : 0;
  const remittance = 10;
  return { gross, nhi, remittance, net: Math.max(0, gross - nhi - remittance) };
};

assert.deepStrictEqual(
  { amount: floor(104.4 * 23), fee: commission(floor(104.4 * 23), 'ODD_LOT') },
  { amount: 2401, fee: 2 },
);
assert.strictEqual(commission(100000, 'ROUND_LOT'), 92);
assert.strictEqual(commission(10000, 'ROUND_LOT'), 20);
assert.strictEqual(tax(100000, 'etf'), 100);
assert.strictEqual(tax(100000, 'stock'), 300);
assert.deepStrictEqual(dividend(1.337, 14958), { gross: 19998, nhi: 0, remittance: 10, net: 19988 });
assert.deepStrictEqual(dividend(2, 10000), { gross: 20000, nhi: 422, remittance: 10, net: 19568 });

const remainingCost = 100100;
const market = floor(110 * 1000);
const netLiquidation = market - commission(market, 'ROUND_LOT') - tax(market, 'etf');
const unrealized = netLiquidation - remainingCost;
const realized = 750;
const netDividends = 300;
assert.strictEqual(unrealized, 9679);
assert.strictEqual(unrealized + realized + netDividends, 10729);

console.log('HUANAN_CANONICAL_FINANCE_CORE_TEST: PASS');
