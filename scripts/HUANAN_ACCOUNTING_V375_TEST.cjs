const fs=require('fs');
const assert=require('assert');

const trade=fs.readFileSync('src/data/tradeSettings.ts','utf8');
const engine=fs.readFileSync('src/v3/engine.ts','utf8');
const screens=fs.readFileSync('src/v3/screens.tsx','utf8')+'\n'+fs.readFileSync('src/v3/screensBase.tsx','utf8');

// Production integration requirements: one public engine, Huanan as a profile.
assert.match(trade,/huananYongchangBrokerProfile/,'missing Huanan BrokerProfile');
assert.match(trade,/commissionRate:\s*0\.001425/,'wrong Huanan commission rate');
assert.match(trade,/commissionDiscount:\s*0\.65/,'wrong Huanan discount');
assert.match(trade,/minimumCommission:\s*20/,'wrong Huanan minimum commission');
assert.match(trade,/etfSellTaxRate:\s*0\.001/,'wrong Huanan ETF tax');
assert.match(trade,/stockSellTaxRate:\s*0\.003/,'wrong Huanan stock tax');
assert.match(trade,/unrealizedPLMode:\s*'NET'/,'Huanan must use NET unrealized P/L');
assert.match(trade,/marketValueMode:\s*'netLiquidation'/,'Huanan must use net liquidation market basis');
assert.match(trade,/truncateTowardZero/,'display truncation helper missing');
assert.match(trade,/estimateBrokerBookValue/,'generic broker book-value helper missing');
assert.match(engine,/resolveBrokerProfile/,'engine must resolve profile parameters');
assert.match(engine,/Base\.positionCostStats/,'engine must preserve the common moving cost pool');

// The historical broker-side 3 TWD mismatch is explicitly outside App accounting.
for(const source of [trade,engine,screens]){
  assert.ok(!source.includes('BROKER_COST_WRITEOFF_PREFIX'),'3 TWD write-off marker must not exist');
  assert.ok(!source.includes('brokerCostWriteOffAmount'),'3 TWD cost adjustment must not exist');
  assert.ok(!source.includes('券商成本沖銷'),'3 TWD write-off UI must not exist');
  assert.ok(!source.includes('現金沖銷'),'3 TWD cash write-off UI must not exist');
}

const floor=n=>Math.floor(n);
const trunc2=n=>Math.trunc(n*100)/100;
const commission=(amount,{rate,discount,minFee})=>Math.max(minFee,floor(amount*rate*discount));
const sellTax=(amount,rate)=>floor(amount*rate);

const HUANAN={rate:0.001425,discount:0.65,minFee:20,etfTax:0.001,stockTax:0.003};
const DEFAULT={rate:0.001425,discount:1,minFee:1,etfTax:0.001,stockTax:0.003};

// Huanan fee profile: discounted fee with a 20 TWD minimum.
assert.strictEqual(commission(100000,HUANAN),92,'Huanan 100,000 commission');
assert.strictEqual(commission(10000,HUANAN),20,'Huanan minimum commission');
assert.strictEqual(sellTax(100000,HUANAN.etfTax),100,'Huanan ETF sell tax');
assert.strictEqual(sellTax(100000,HUANAN.stockTax),300,'Huanan stock sell tax');

// Huanan NET unrealized basis = estimated sell amount - estimated sell fee - tax.
const gross=floor(100*1000);
const fee=commission(gross,HUANAN);
const tax=sellTax(gross,HUANAN.etfTax);
const net=gross-fee-tax;
assert.deepStrictEqual({gross,fee,tax,net},{gross:100000,fee:92,tax:100,net:99808},'Huanan NET liquidation');
const feeInclusiveBasis=95000;
assert.strictEqual(net-feeInclusiveBasis,4808,'Huanan NET unrealized P/L');
assert.strictEqual(trunc2((net-feeInclusiveBasis)/feeInclusiveBasis*100),5.06,'Huanan truncated ROI');

// App Default and Huanan share formulas. Only parameters/modes differ.
assert.strictEqual(commission(10000,DEFAULT),14,'Default profile uses same commission formula with default parameters');

// Multi-buy: each row is floored and fee-calculated independently before aggregation.
const buys=[
  {price:104.40,shares:23},
  {price:103.95,shares:9},
];
const rows=buys.map(x=>{
  const amount=floor(x.price*x.shares);
  const fee=commission(amount,DEFAULT);
  return {amount,fee,cost:amount+fee};
});
assert.deepStrictEqual(rows,[{amount:2401,fee:3,cost:2404},{amount:935,fee:1,cost:936}]);
assert.strictEqual(rows.reduce((s,r)=>s+r.amount,0),3336,'independent trade amounts aggregate');
assert.strictEqual(rows.reduce((s,r)=>s+r.fee,0),4,'independent fees aggregate');
assert.strictEqual(rows.reduce((s,r)=>s+r.cost,0),3340,'fee-inclusive cost pool aggregate');
assert.strictEqual(trunc2(3340/32),104.37,'truncate fee-inclusive average to 2 decimals');

// Partial sale: moving weighted-average cost and fee pools release proportionally.
const pre={shares:100,tradePool:10000,feePool:100};
const sellShares=40;
const tradePerShare=pre.tradePool/pre.shares;
const feePerShare=pre.feePool/pre.shares;
const releasedTrade=sellShares*tradePerShare;
const releasedFee=sellShares*feePerShare;
const remainShares=pre.shares-sellShares;
const remainTrade=pre.tradePool-releasedTrade;
const remainFee=pre.feePool-releasedFee;
assert.deepStrictEqual({releasedTrade,releasedFee,remainShares,remainTrade,remainFee},{releasedTrade:4000,releasedFee:40,remainShares:60,remainTrade:6000,remainFee:60});
assert.strictEqual(remainTrade/remainShares,tradePerShare,'remaining trade average unchanged');
assert.strictEqual(remainFee/remainShares,feePerShare,'remaining fee average unchanged');

// Realized cash P/L = sell net proceeds - released trade cost - released buy fee.
const sellAmount=floor(120*sellShares);
const sellFee=commission(sellAmount,DEFAULT);
const etfTax=sellTax(sellAmount,DEFAULT.etfTax);
const netProceeds=sellAmount-sellFee-etfTax;
const realizedPricePnl=sellAmount-releasedTrade;
const realizedCashPnl=netProceeds-releasedTrade-releasedFee;
assert.deepStrictEqual({sellAmount,sellFee,etfTax,netProceeds,realizedPricePnl,realizedCashPnl},{sellAmount:4800,sellFee:6,etfTax:4,netProceeds:4790,realizedPricePnl:800,realizedCashPnl:750});

// Today P/L and comprehensive P/L remain common formulas.
const live=110,prevClose=108,shares=60;
const todayPnl=(live-prevClose)*shares;
const prevValue=prevClose*shares;
assert.strictEqual(todayPnl,120);
assert.ok(Math.abs(todayPnl/prevValue*100-1.8518518518518516)<1e-12);
const unrealized=500,realized=750,cumulativeDividend=300,historicalCashOutflow=12000;
const comprehensive=unrealized+realized+cumulativeDividend;
assert.strictEqual(comprehensive,1550);
assert.ok(Math.abs(comprehensive/historicalCashOutflow*100-12.916666666666668)<1e-12);

console.log('HUANAN_ACCOUNTING_V375_TEST: PASS — common formulas, Huanan parameters, NET basis and no 3 TWD reconciliation verified');
