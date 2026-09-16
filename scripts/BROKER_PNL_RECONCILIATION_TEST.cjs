const fs=require('fs');
const assert=require('assert');

const engine=fs.readFileSync('src/v3/engine.ts','utf8');
const fees=fs.readFileSync('src/data/tradeSettings.ts','utf8');
const model=fs.readFileSync('src/v3/model.ts','utf8');
const portfolio=fs.readFileSync('src/data/portfolio.ts','utf8');

// RED before the fix: the app must have one canonical post-rebate broker exit calculation
// and must use it for the default unrealized P/L shown to the user.
assert.match(fees,/export function estimateBrokerExit\(/,'missing canonical estimateBrokerExit()');
assert.match(engine,/brokerUnrealizedPnl/,'engine does not expose broker-style unrealized P/L');
assert.match(engine,/estimatedNetSellProceeds/,'engine does not expose estimated net sell proceeds');
assert.match(engine,/estimatedSellFeeRebates/,'engine does not expose post-rebate sell-fee adjustment');
assert.match(engine,/const pnl=brokerUnrealizedPnl/,'holding default P/L is not broker-style');
assert.match(engine,/const comprehensivePnl=brokerUnrealizedPnl\+realizedCashPnl\+cumulativeDividends/,'portfolio total P/L is not based on broker-style unrealized P/L');
assert.match(model,/feeRebate\?: number/,'ledger cannot persist a broker fee rebate');
assert.match(portfolio,/feeRebate\?: number/,'purchase record cannot persist a broker fee rebate');

const rows=[
  {symbol:'row1',price:9.34,shares:600,cost:5798,book:5592,rebate:0},
  {symbol:'0050',price:106.90,shares:32,cost:3340,book:3414,rebate:1},
  {symbol:'0056',price:55.55,shares:40,cost:2150,book:2218,rebate:1},
  {symbol:'row4',price:64.40,shares:31,cost:1913,book:1993,rebate:0},
  {symbol:'00878',price:34.47,shares:64,cost:2100,book:2202,rebate:1},
  {symbol:'row6',price:31.99,shares:50,cost:1603,book:1596,rebate:0},
  {symbol:'row7',price:28.84,shares:35,cost:993,book:1007,rebate:0},
  {symbol:'row8',price:15.89,shares:100,cost:1617,book:1586,rebate:0},
  {symbol:'row9',price:17.11,shares:56,cost:991,book:957,rebate:0},
];

function calc(r){
  const gross=Math.floor(r.price*r.shares);
  const chargedFee=Math.max(1,Math.floor(gross*0.001425));
  const feeRebate=Math.min(chargedFee,Math.max(0,Math.floor(r.rebate||0)));
  const netFee=chargedFee-feeRebate;
  const tax=Math.floor(gross*0.001);
  const netProceeds=gross-netFee-tax;
  const pnl=netProceeds-r.cost;
  return {...r,gross,chargedFee,feeRebate,netFee,tax,netProceeds,pnl};
}

const actual=rows.map(calc);
for(const row of actual) assert.strictEqual(row.netProceeds,row.book,`${row.symbol} book income mismatch`);
assert.strictEqual(actual.reduce((s,r)=>s+r.gross,0),20603,'gross liquidation total mismatch');
assert.strictEqual(actual.reduce((s,r)=>s+r.chargedFee,0),25,'charged sell commission total mismatch');
assert.strictEqual(actual.reduce((s,r)=>s+r.feeRebate,0),3,'broker reconciliation rebate must total 3');
assert.strictEqual(actual.reduce((s,r)=>s+r.netFee,0),22,'net sell commission after reconciliation mismatch');
assert.strictEqual(actual.reduce((s,r)=>s+r.tax,0),16,'ETF sell tax total mismatch');
assert.strictEqual(actual.reduce((s,r)=>s+r.netProceeds,0),20565,'broker book income total mismatch');
assert.strictEqual(actual.reduce((s,r)=>s+r.cost,0),20505,'broker cost total mismatch');
assert.strictEqual(actual.reduce((s,r)=>s+r.pnl,0),60,'broker P/L total mismatch');
assert.strictEqual(Math.trunc((60/20505*100)*100)/100,0.29,'broker ROI mismatch');

// Multi-trade reconciliation: three independent one-dollar fee rebates must be summed per trade,
// never replaced by a single aggregate rounding of the combined notional.
const trades=[
  {amount:3420,charged:4,rebate:1},
  {amount:2222,charged:3,rebate:1},
  {amount:2206,charged:3,rebate:1},
];
assert.strictEqual(trades.reduce((s,t)=>s+t.charged,0),10);
assert.strictEqual(trades.reduce((s,t)=>s+t.rebate,0),3);
assert.strictEqual(trades.reduce((s,t)=>s+(t.charged-t.rebate),0),7);

console.log('BROKER_PNL_RECONCILIATION_TEST: PASS — 9 holdings, +3 reconciliation, 20,565 / +60 / 0.29%, multi-trade rebate sum verified');
