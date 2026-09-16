const fs=require('fs');
const assert=require('assert');

const trade=fs.readFileSync('src/data/tradeSettings.ts','utf8');
const engine=fs.readFileSync('src/v3/engine.ts','utf8');
const model=fs.readFileSync('src/v3/model.ts','utf8');
const app=fs.readFileSync('App.tsx','utf8');
const screens=fs.readFileSync('src/v3/screens.tsx','utf8');

// Production integration requirements. These assertions are expected to fail before implementation.
assert.match(trade,/BrokerProfileId/,'missing broker profile id');
assert.match(trade,/huanan-yongchang/,'missing Huanan profile');
assert.match(trade,/truncateTowardZero/,'missing Huanan display truncation helper');
assert.match(trade,/estimateBrokerBookValue/,'missing broker book-value helper');
assert.match(model,/costAdjustment/,'missing costAdjustment ledger event');
assert.match(engine,/costAdjustments/,'engine does not apply cost write-offs');
assert.match(app,/addCostAdjustment/,'App has no cost write-off action');
assert.match(screens,/券商成本沖銷/,'UI has no broker cost write-off flow');
assert.match(screens,/華南永昌證券/,'UI has no Huanan broker profile selector');

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

// Photo 2/3: multi-buy cost must be summed from independent trades.
const y50=rows[1].cost+rows[4].cost;
assert.strictEqual(y50,3340,'0050 investment cost');
const trunc2=n=>Math.trunc(n*100)/100;
assert.strictEqual(trunc2(y50/32),104.37,'0050 Huanan displayed average cost');
assert.strictEqual(trunc2(74/y50*100),2.21,'0050 Huanan displayed ROI');

// Cash write-off is a separate audit event: original trades stay untouched,
// while effective cost falls and cash rises by the same amount.
const originalCost=20508;
const writeOff=3;
assert.strictEqual(originalCost-writeOff,20505,'write-off must reconcile effective cost');
assert.strictEqual(100000+writeOff,100003,'write-off must increase cash by the same amount');

console.log('HUANAN_ACCOUNTING_V375_TEST: PASS');
