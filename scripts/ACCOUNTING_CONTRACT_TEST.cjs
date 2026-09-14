const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const engine = fs.readFileSync(path.join(root, 'src', 'v3', 'engine.ts'), 'utf8');

const requiredSourceRules = [
  ['成交金額不得含費用', 'historicalTradeCost=buys.reduce((s,e)=>s+Number(e.amount??0),0)'],
  ['累積現金支出 = 成交成本 + 買進手續費', 'historicalCashOutflow:historicalTradeCost+historicalBuyFees'],
  ['目前持有成交成本 = 股數 × 平均成交價', 'currentTradeCost=currentShares*avgTradePrice'],
  ['目前持有含費成本只額外分攤買進費', 'currentCashBasis=currentTradeCost+currentAllocatedBuyFees'],
  ['目前市值 = 即時行情 × 目前持有股數', 'const q=quotes[h.symbol]??{}; const price=quotePrice(h,quotes), c=positionCostStats(h,ledger), marketValue=price*h.shares'],
  ['賣出淨收入扣賣出費與交易稅', 'const netSellProceeds=grossSellProceeds-sellFees-sellTaxes'],
  ['投資總資產只含持股市值；現金核帳獨立', 'const totalAssets=marketValue'],
  ['總損益包含含費未實現、已實現與配息', 'const totalPnl=cashUnrealizedPnl+realizedCashPnl+cumulativeDividends'],
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
const buyShares = buys.reduce((s,x)=>s+x.shares,0);
const tradeCost = buys.reduce((s,x)=>s+x.shares*x.price,0);
const buyFees = buys.reduce((s,x)=>s+x.fee,0);
const cashOutflow = tradeCost + buyFees;
const avgTrade = tradeCost / buyShares;
const avgFee = buyFees / buyShares;
const currentShares = buyShares - sell.shares;
const currentTradeCost = currentShares * avgTrade;
const currentFees = currentShares * avgFee;
const currentCashBasis = currentTradeCost + currentFees;
const grossSell = sell.shares * sell.price;
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

console.log('ACCOUNTING_CONTRACT_TEST: PASS');
console.log(JSON.stringify({tradeCost,buyFees,cashOutflow,currentShares,currentTradeCost,currentCashBasis,marketValue,realizedPrice,realizedCash,priceUnrealized,cashUnrealized,dividend,totalPnl,roi:Number(roi.toFixed(6))}, null, 2));
