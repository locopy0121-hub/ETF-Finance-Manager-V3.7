function approx(actual, expected, eps=1e-6, label='value') {
  if (Math.abs(actual-expected) > eps) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}
const floor = Math.floor;
const fee = (amount) => Math.max(1, floor(amount * 0.001425 * 0.6));
const tax = (amount) => floor(amount * 0.001);

const buy1 = {price:22.50, shares:1500};
buy1.amount = floor(buy1.price * buy1.shares);
buy1.fee = fee(buy1.amount);
const buy2 = {price:22.10, shares:800};
buy2.amount = floor(buy2.price * buy2.shares);
buy2.fee = fee(buy2.amount);

const sharesBefore = buy1.shares + buy2.shares;
const tradePoolBefore = buy1.amount + buy2.amount;
const feePoolBefore = buy1.fee + buy2.fee;
const avgTrade = tradePoolBefore / sharesBefore;
const avgCash = (tradePoolBefore + feePoolBefore) / sharesBefore;

const sell = {price:23, shares:500};
sell.amount = floor(sell.price * sell.shares);
sell.fee = fee(sell.amount);
sell.tax = tax(sell.amount);
sell.net = sell.amount - sell.fee - sell.tax;
const allocatedTrade = sell.shares * avgTrade;
const allocatedBuyFee = sell.shares * (feePoolBefore / sharesBefore);
const allocatedCashBasis = allocatedTrade + allocatedBuyFee;
const realizedNetPnl = sell.net - allocatedCashBasis;

const sharesAfter = sharesBefore - sell.shares;
const tradePoolAfter = tradePoolBefore - allocatedTrade;
const feePoolAfter = feePoolBefore - allocatedBuyFee;
const cashPoolAfter = tradePoolAfter + feePoolAfter;

approx(buy1.amount,33750,1e-9,'第1筆成交金額');
approx(buy1.fee,28,1e-9,'第1筆買進手續費');
approx(buy2.amount,17680,1e-9,'第2筆成交金額');
approx(buy2.fee,15,1e-9,'第2筆買進手續費');
approx(sharesBefore,2300,1e-9,'買進後持股');
approx(tradePoolBefore,51430,1e-9,'純成本池');
approx(feePoolBefore,43,1e-9,'買進費池');
approx(avgTrade,22.36086956521739,1e-9,'純平均成本');
approx(avgCash,22.379565217391305,1e-9,'含費平均成本');
approx(sell.amount,11500,1e-9,'賣出成交額');
approx(sell.fee,9,1e-9,'賣出手續費');
approx(sell.tax,11,1e-9,'ETF 證交稅');
approx(sell.net,11480,1e-9,'賣出淨收入');
approx(allocatedTrade,11180.434782608696,1e-6,'賣出分攤純成本');
approx(allocatedBuyFee,9.347826086956522,1e-6,'賣出分攤買進費');
approx(realizedNetPnl,290.21739130434776,1e-6,'已實現含費稅損益');
approx(sharesAfter,1800,1e-9,'賣出後持股');
approx(tradePoolAfter,40249.565217391304,1e-6,'剩餘純成本池');
approx(feePoolAfter,33.65217391304348,1e-6,'剩餘買進費池');
approx(cashPoolAfter,40283.217391304344,1e-6,'剩餘含費成本池');
approx(tradePoolAfter/sharesAfter,avgTrade,1e-9,'賣出後純均價保持不變');
approx(cashPoolAfter/sharesAfter,avgCash,1e-9,'賣出後含費均價保持不變');

console.log('ACCOUNTING_GOLDEN_00878: PASS');
console.log(JSON.stringify({buy1,buy2,sharesBefore,tradePoolBefore,feePoolBefore,avgTrade,avgCash,sell,allocatedTrade,allocatedBuyFee,realizedNetPnl,sharesAfter,tradePoolAfter,feePoolAfter,cashPoolAfter},null,2));
