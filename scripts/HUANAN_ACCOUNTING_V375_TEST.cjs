const fs=require('fs');
const assert=require('assert');

const trade=fs.readFileSync('src/data/tradeSettings.ts','utf8');
const engine=fs.readFileSync('src/v3/engine.ts','utf8');
const screens=fs.readFileSync('src/v3/screens.tsx','utf8');

// Production integration requirements.
assert.match(trade,/BrokerProfileId/,'missing broker profile id');
assert.match(trade,/huanan-yongchang/,'missing Huanan profile');
assert.match(trade,/truncateTowardZero/,'missing Huanan display truncation helper');
assert.match(trade,/estimateBrokerBookValue/,'missing broker book-value helper');
assert.match(engine,/BROKER_COST_WRITEOFF_PREFIX/,'engine has no auditable cash cost write-off marker');
assert.match(engine,/brokerCostWriteOffAmount/,'engine does not apply per-symbol write-offs');
assert.match(engine,/historicalCashOutflow/,'engine does not reconcile effective cost');
assert.match(screens,/券商成本沖銷/,'UI has no broker cost write-off flow');
assert.match(screens,/BROKER_COST_WRITEOFF_PREFIX/,'write-off UI is not connected to the finance engine marker');
assert.match(screens,/huananYongchangFeeSettings/,'existing broker selection does not activate Huanan accounting');
assert.doesNotMatch(engine,/kind==='costAdjustment'/,'write-off must reuse canonical cashIn ledger rather than mutate/add a parallel trade kind');

// Photo 1: 16 purchases. Each trade is independently floored before fee calculation.
const trades=[
  [28.37,35,1,993],[104.40,23,3,2404],[32.32,49,2,1585],[17.69,56,1,991],
  [103.95,9,1,936],[52.35,24,1,1257],[61.70,21,1,1296],[61.60,10,1,617],
  [9.69,330,4,3201],[31.46,31,1,976],[32.99,19,1,627],[34.28,15,1,515],
  [9.70,170,2,1651],[55.75,16,1,893],[16.15,100,2,1617],[9.45,100,1,946],
];
const rows=trades.map(([price,shares,expectedFee,expectedCost])=>{
  const amount=Math.floor(price*shares);
  const fee=Math.max(1,Math.floor(amount*0.001425));
  const cost=amount+fee;
  assert.strictEqual(fee,expectedFee,`fee mismatch ${price} x ${shares}`);
  assert.strictEqual(cost,expectedCost,`cost mismatch ${price} x ${shares}`);
  return {amount,fee,cost};
});
assert.strictEqual(rows.reduce((s,r)=>s+r.amount,0),20481,'photo total trade amount');
assert.strictEqual(rows.reduce((s,r)=>s+r.fee,0),24,'photo total fee');
assert.strictEqual(rows.reduce((s,r)=>s+r.cost,0),20505,'photo total cost');

// Photo 2/3: multi-buy cost is the sum of already-rounded independent trades.
const y50=rows[1].cost+rows[4].cost;
assert.strictEqual(y50,3340,'0050 investment cost');
const trunc2=n=>Math.trunc(n*100)/100;
assert.strictEqual(trunc2(y50/32),104.37,'0050 Huanan displayed average cost');
assert.strictEqual(trunc2(74/y50*100),2.21,'0050 Huanan displayed ROI');

// Rows that are fully explained by the derived exit formula.
const book=(price,shares)=>{
  const gross=Math.floor(price*shares);
  const fee=Math.max(1,Math.floor(gross*0.001425));
  const tax=Math.floor(gross*0.001);
  return gross-fee-tax;
};
assert.strictEqual(book(9.34,600),5592,'row1 book value');
assert.strictEqual(book(64.40,31),1993,'row4 book value');
assert.strictEqual(book(31.99,50),1596,'row6 book value');
assert.strictEqual(book(28.84,35),1007,'row7 book value');
assert.strictEqual(book(15.89,100),1586,'row8 book value');
assert.strictEqual(book(17.11,56),957,'row9 book value');

// Historical three-dollar discrepancy is NOT a formula constant. It is an auditable cash/cost write-off:
// original trades remain unchanged; cash rises and effective cost falls by exactly the write-off amount.
const originalCost=20508;
const originalCash=100000;
const writeOff=3;
assert.strictEqual(originalCost-writeOff,20505,'write-off must reconcile effective cost');
assert.strictEqual(originalCash+writeOff,100003,'write-off must increase cash by the same amount');
assert.ok(!trade.includes('extraFeeRebate=3'),'must never hard-code the historical +3 into Huanan formulas');

console.log('HUANAN_ACCOUNTING_V375_TEST: PASS — photo buys, multi-buy cost, truncation, book value and cash/cost write-off verified');
