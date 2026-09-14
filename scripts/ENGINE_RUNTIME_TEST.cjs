const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'v3', 'engine.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: 'engine.ts',
  reportDiagnostics: true,
});
if (output.diagnostics?.length) {
  const text = output.diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')).join('\n');
  throw new Error(`engine.ts transpile diagnostics:\n${text}`);
}
const moduleObj = { exports: {} };
vm.runInNewContext(output.outputText, {
  module: moduleObj,
  exports: moduleObj.exports,
  require,
  console,
  Intl,
  Number,
  Math,
  Set,
  Date,
}, { filename: 'engine.runtime.cjs' });
const engine = moduleObj.exports;

function approx(actual, expected, eps = 1e-8, label = 'value') {
  if (Math.abs(actual - expected) > eps) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

// 100@100 fee10 + 50@120 fee5 -> sell 30@130 fee6 tax12 -> dividend 240 -> quote 125.
const holdings = [{
  symbol: '0050', name: '測試 ETF', shares: 120,
  avgCost: 16000 / 150, tradeAvgPrice: 16000 / 150, buyFee: 15, fallbackPrice: 125,
  purchaseRecords: [
    { id: 'b1', date: '2026-01-01', shares: 100, tradePrice: 100, purchaseCost: 10000, fee: 10, totalCost: 10010 },
    { id: 'b2', date: '2026-02-01', shares: 50, tradePrice: 120, purchaseCost: 6000, fee: 5, totalCost: 6005 },
  ],
}];
const ledger = [
  { id: 'b1', kind: 'buy', symbol: '0050', date: '2026-01-01', shares: 100, price: 100, amount: 10000, fee: 10 },
  { id: 'b2', kind: 'buy', symbol: '0050', date: '2026-02-01', shares: 50, price: 120, amount: 6000, fee: 5 },
  { id: 's1', kind: 'sell', symbol: '0050', date: '2026-03-01', shares: 30, price: 130, amount: 3900, fee: 6, tax: 12 },
  { id: 'd1', kind: 'dividend', symbol: '0050', date: '2026-04-01', amount: 240, dividendEventId: 'ev1' },
];
const dividends = [{ id: 'ev1', symbol: '0050', actualAmount: 240, exDate: '2026-03-15', payDate: '2026-04-01' }];
const quotes = { '0050': { price: 125, previousClose: 124 } };
const r = engine.portfolioMetrics(holdings, quotes, 5000, ledger, dividends);
const expected = {
  historicalTradeCost: 16000,
  historicalBuyFees: 15,
  historicalCashOutflow: 16015,
  currentTradeCost: 12800,
  currentCashBasis: 12812,
  marketValue: 15000,
  totalAssets: 15000, // V3.3.8+: investment total assets = holdings market value; tracked cash is an independent reconciliation ledger.
  realizedPricePnl: 700,
  realizedCashPnl: 679,
  priceUnrealizedPnl: 2200,
  cashUnrealizedPnl: 2188,
  cumulativeDividends: 240,
  totalPnl: 3107,
};
for (const [key, value] of Object.entries(expected)) approx(r[key], value, 1e-8, key);
approx(r.totalRoi, 3107 / 16015 * 100, 1e-8, 'totalRoi');

// Dividend event + linked ledger must count once, never twice.
approx(engine.dividendTotals(ledger, dividends, '0050'), 240, 1e-8, 'dividend de-duplication');
// Eligibility snapshot helper must respect buys/sells up to the event date.
approx(engine.sharesOnDate('0050', '2026-03-15', ledger, 0), 120, 1e-8, 'sharesOnDate');
// Canonical single-holding instant P&L includes allocated buy fees, while today P&L is separate.
const hm = engine.holdingMetrics(holdings[0], quotes, ledger, dividends);
approx(hm.pnl, 2188, 1e-8, 'holding instant P&L incl fees');
approx(hm.cashPnl, 2188, 1e-8, 'holding cashPnl');
approx(hm.pricePnl, 2200, 1e-8, 'holding price-only P&L');
approx(hm.todayPnl, 120, 1e-8, 'holding today P&L');

// Dividend cutoff must exclude buys after last-buy day and must not be reduced by sells after cutoff.
const cutoffLedger = [
  { id:'cb1', kind:'buy', symbol:'00878', date:'2026-08-17', shares:1000, price:20, amount:20000, fee:20 },
  { id:'cb2', kind:'buy', symbol:'00878', date:'2026-08-18', shares:500, price:20, amount:10000, fee:10 },
  { id:'cs1', kind:'sell', symbol:'00878', date:'2026-08-20', shares:300, price:21, amount:6300, fee:6, tax:19 },
];
approx(engine.sharesOnDate('00878','2026-08-17',cutoffLedger,0),1000,1e-8,'dividend cutoff shares');
approx(engine.sharesOnDate('00878','2026-08-18',cutoffLedger,0),1500,1e-8,'post-cutoff next-period shares');
approx(engine.sharesOnDate('00878','2026-08-17',cutoffLedger,1200),1000,1e-8,'post-cutoff sell does not alter qualified snapshot');

// Effective annual 12% must not use 12% / 12.
const sim = engine.simulateMonthly(100000, 0, 1, 12, 0, true);
approx(sim.monthlyRate, Math.pow(1.12, 1 / 12) - 1, 1e-12, 'effective monthly rate');


const postCutoffOnly=[{id:'after-only',kind:'buy',symbol:'00878',date:'2026-08-18',shares:500,price:20,amount:10000,fee:10}];
approx(engine.sharesOnDate('00878','2026-08-17',postCutoffOnly,500),0,1e-8,'post-cutoff-only buy must not qualify for prior dividend');
console.log('ENGINE_RUNTIME_TEST: PASS');
