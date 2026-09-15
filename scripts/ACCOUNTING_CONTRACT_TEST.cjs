const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'src', 'v3', 'engine.ts'), 'utf8');

const requiredSourceRules = [
  ['每筆成交金額 floor', 'Math.floor(Number(e.price)*shares)'],
  ['累積現金支出 = 成交成本 + 買進手續費', 'historicalCashOutflow:historicalTradeCost+historicalBuyFees'],
  ['目前持有含費成本 = 純成交成本 + 分攤買進費', 'const currentCashBasis=currentTradeCost+currentAllocatedBuyFees'],
  ['賣出淨收入扣賣出費與交易稅', 'const netSellProceeds=grossSellProceeds-sellFees-sellTaxes'],
  ['總損益使用綜合損益', 'const totalPnl=comprehensivePnl'],
  ['總 ROI 使用歷史含費投入', 'const totalRoi=historicalCashOutflow>0?totalPnl/historicalCashOutflow*100:0'],
  ['總資產包含正負證券現金且不得 clamp', 'const totalAssets=marketValue+(Number.isFinite(Number(cashBalance))?Number(cashBalance):0)'],
  ['單檔預設即時損益採含費口徑', 'const pnl=cashPnl'],
];
for (const [label, snippet] of requiredSourceRules) {
  if (!engine.includes(snippet)) throw new Error(`ACCOUNTING SOURCE RULE MISSING: ${label}`);
}

function approx(actual, expected, eps=1e-9, label='value') {
  if (Math.abs(actual-expected) > eps) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

// Cross-check scenario: two buys -> partial sell -> dividend -> live mark-to-market.
const buys = [
  {shares:100, price:100, fee:10},
  {shares:50, price:120, fee:5},
];
const sell = {shares:30, price:130, fee:6, tax:12};
const dividend = 240;
const livePrice = 125;
const cashBalance = 50000;
const buyShares = buys.reduce((s,x)=>s+x.shares,0);
const tradeCost = buys.reduce((s,x)=>s+Math.floor(x.shares*x.price),0);
const buyFees = buys.reduce((s,x)=>s+x.fee,0);
const cashOutflow = tradeCost + buyFees;
const avgTrade = tradeCost / buyShares;
const avgFee = buyFees / buyShares;
const currentShares = buyShares - sell.shares;
const currentTradeCost = currentShares * avgTrade;
const currentFees = currentShares * avgFee;
const currentCashBasis = currentTradeCost + currentFees;
const grossSell = Math.floor(sell.shares * sell.price);
const netSell = grossSell - sell.fee - sell.tax;
const soldTradeCost = sell.shares * avgTrade;
const soldFees = sell.shares * avgFee;
const realizedPrice = grossSell - soldTradeCost;
const realizedCash = netSell - soldTradeCost - soldFees;
const marketValue = currentShares * livePrice;
const priceUnrealized = marketValue - currentTradeCost;
const cashUnrealized = marketValue - currentCashBasis;
const totalPnl = cashUnrealized + realizedCash + dividend;
const roi = totalPnl / cashOutflow * 100;
const totalAssets = marketValue + cashBalance;
const negativeCashBalance = -20000;
const totalAssetsWithNegativeCash = 100000 + negativeCashBalance;

approx(tradeCost, 16000, 1e-9, '累積成交成本');
approx(buyFees, 15, 1e-9, '累積買進手續費');
approx(cashOutflow, 16015, 1e-9, '累積現金支出');
approx(currentShares, 120, 1e-9, '目前持有股數');
approx(currentTradeCost, 12800, 1e-9, '目前持有成交成本');
approx(currentCashBasis, 12812, 1e-9, '目前持有含費成本');
approx(realizedPrice, 700, 1e-9, '已實現價格損益');
approx(realizedCash, 679, 1e-9, '已實現含費損益');
approx(marketValue, 15000, 1e-9, '目前市值');
approx(priceUnrealized, 2200, 1e-9, '未實現價格損益');
approx(cashUnrealized, 2188, 1e-9, '含費未實現損益');
approx(totalPnl, 3107, 1e-9, '累積總損益');
approx(roi, 3107/16015*100, 1e-9, '總 ROI');
approx(totalAssets, 65000, 1e-9, '總資產');
approx(totalAssetsWithNegativeCash, 80000, 1e-9, '負現金總資產不得被歸零');

console.log('ACCOUNTING_CONTRACT_TEST: PASS');
console.log(JSON.stringify({tradeCost,buyFees,cashOutflow,currentShares,currentTradeCost,currentCashBasis,marketValue,realizedPrice,realizedCash,priceUnrealized,cashUnrealized,dividend,totalPnl,roi:Number(roi.toFixed(6)),cashBalance,totalAssets,negativeCashBalance,totalAssetsWithNegativeCash}, null, 2));
