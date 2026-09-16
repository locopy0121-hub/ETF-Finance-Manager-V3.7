const fs=require('fs');
const assert=require('assert');

const read=p=>fs.readFileSync(p,'utf8');
const trade=read('src/data/tradeSettings.ts');
const engine=read('src/v3/engine.ts');
const model=read('src/v3/model.ts');
const portfolio=read('src/data/portfolio.ts');
const screens=read('src/v3/screens.tsx')+'\n'+read('src/v3/screensBase.tsx');
const storage=read('src/v3/storage.ts');

// One public engine + parameterized broker profiles.
assert.match(trade,/BrokerProfile/,'BrokerProfile type missing');
assert.match(trade,/defaultBrokerProfile/,'Default Profile missing');
assert.match(trade,/huananYongchangBrokerProfile/,'Huanan Profile missing');
assert.match(trade,/createBrokerProfileFromDefault/,'new broker must clone Default Profile');
assert.match(trade,/resolveBrokerProfile/,'generic profile resolver missing');
assert.match(trade,/unrealizedPLMode/,'NET\/GROSS mode missing');
assert.match(trade,/marketValueMode/,'market value mode missing');
assert.match(trade,/stockSellTaxRate/,'stock sell tax parameter missing');
assert.match(trade,/tradeAmountRounding/,'trade rounding parameter missing');
assert.match(trade,/commissionRounding/,'commission rounding parameter missing');
assert.match(trade,/taxRounding/,'tax rounding parameter missing');
assert.match(trade,/costPoolMethod/,'cost pool method missing');
assert.match(trade,/truncateRule/,'truncate rule missing');

// Exact approved Huanan parameters.
assert.match(trade,/commissionRate:\s*0\.001425/,'Huanan commissionRate must be 0.001425');
assert.match(trade,/commissionDiscount:\s*0\.65/,'Huanan commissionDiscount must be 0.65');
assert.match(trade,/minimumCommission:\s*20/,'Huanan minimumCommission must be 20');
assert.match(trade,/etfSellTaxRate:\s*0\.001/,'Huanan ETF tax must be 0.001');
assert.match(trade,/stockSellTaxRate:\s*0\.003/,'Huanan stock tax must be 0.003');
assert.match(trade,/unrealizedPLMode:\s*'NET'/,'Huanan must use NET unrealized P\/L');
assert.match(trade,/marketValueMode:\s*'netLiquidation'/,'Huanan must use net liquidation value');
assert.match(trade,/includeEstimatedSellFee:\s*true/,'Huanan must include estimated sell fee');
assert.match(trade,/includeEstimatedSellTax:\s*true/,'Huanan must include estimated sell tax');

// Stable broker id must travel with holdings and ledger entries; state persists profile list.
assert.match(portfolio,/brokerProfileId\?:\s*string/,'Holding missing stable brokerProfileId');
assert.match(model,/brokerProfileId\?:\s*string/,'Ledger entry missing stable brokerProfileId');
assert.match(model,/brokerProfiles:\s*BrokerProfile\[\]/,'V3State missing brokerProfiles');
assert.match(storage,/brokerProfiles/,'storage migration missing brokerProfiles');

// Engine is profile-driven, not a separate Huanan accounting engine.
assert.match(engine,/resolveBrokerProfile/,'engine does not resolve a BrokerProfile');
assert.match(engine,/unrealizedPLMode|marketValueMode/,'engine does not select GROSS\/NET from profile');
assert.doesNotMatch(engine,/BROKER_COST_WRITEOFF_PREFIX/,'3 TWD write-off marker must be removed');
assert.doesNotMatch(engine,/brokerCostWriteOffAmount/,'3 TWD per-symbol adjustment must be removed');
assert.doesNotMatch(engine,/brokerCostWriteOffTotal/,'3 TWD portfolio adjustment must be removed');

// UI must remove 3 TWD flow and expose broker management/selection.
assert.doesNotMatch(screens,/券商成本沖銷/,'obsolete broker cost write-off UI remains');
assert.doesNotMatch(screens,/現金沖銷/,'obsolete cash write-off UI remains');
assert.match(screens,/BrokerProfile/,'broker profile UI binding missing');
assert.match(screens,/brokerProfiles/,'broker profile list UI missing');
assert.match(screens,/新增券商|addBrokerProfile/,'broker create UI missing');
assert.match(screens,/刪除券商|deleteBrokerProfile/,'broker delete UI missing');
assert.match(screens,/brokerProfileId/,'bookkeeping broker selector does not persist stable id');

// Approved formulas — arithmetic examples independent of UI.
const floor=n=>Math.floor(n);
const truncate2=n=>Math.trunc(n*100)/100;
const commission=(amount,rate,discount,minFee)=>Math.max(minFee,floor(amount*rate*discount));
const tax=(amount,rate)=>floor(amount*rate);
const bookValue=(price,shares,p)=>{
  const gross=floor(price*shares);
  const sellFee=commission(gross,p.commissionRate,p.commissionDiscount,p.minimumCommission);
  const sellTax=tax(gross,p.etfSellTaxRate);
  return {gross,sellFee,sellTax,net:gross-sellFee-sellTax};
};
const huanan={commissionRate:0.001425,commissionDiscount:0.65,minimumCommission:20,etfSellTaxRate:0.001};
assert.strictEqual(commission(100000,0.001425,0.65,20),92,'Huanan discounted fee');
assert.deepStrictEqual(bookValue(100,1000,huanan),{gross:100000,sellFee:92,sellTax:100,net:99808},'Huanan NET liquidation formula');
assert.strictEqual(truncate2(3340/32),104.37,'truncate average cost to 2 decimals');

// Multi-buy rows are independently floored before aggregation.
const buys=[{price:104.4,shares:23},{price:103.95,shares:9}];
const defaultFee={commissionRate:0.001425,commissionDiscount:1,minimumCommission:1};
const buyRows=buys.map(x=>{const amount=floor(x.price*x.shares);const fee=commission(amount,defaultFee.commissionRate,defaultFee.commissionDiscount,defaultFee.minimumCommission);return {amount,fee,cost:amount+fee};});
assert.strictEqual(buyRows.reduce((s,x)=>s+x.cost,0),3340,'per-row rounded cost aggregation');

// Partial sell: moving weighted-average release keeps remaining unit basis unchanged.
const preShares=100,tradePool=10000,feePool=100,sellShares=40;
const releasedTrade=sellShares*(tradePool/preShares);
const releasedFee=sellShares*(feePool/preShares);
assert.strictEqual(releasedTrade,4000);
assert.strictEqual(releasedFee,40);
assert.strictEqual((tradePool-releasedTrade)/(preShares-sellShares),100,'remaining trade unit cost unchanged');
assert.strictEqual((feePool-releasedFee)/(preShares-sellShares),1,'remaining fee unit cost unchanged');

console.log('BROKER_PROFILE_V375_TEST: PASS');
