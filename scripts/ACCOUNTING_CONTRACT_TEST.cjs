const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read=(...parts)=>fs.readFileSync(path.join(root,...parts),'utf8');
const engine = read('src','v3','engine.ts');
const app = read('App.tsx');
const widget = read('src','widgets','ProfitWidget.tsx');
const widgetTask = read('src','widgets','widgetTaskHandler.tsx');
const backgroundQuote = read('src','services','backgroundQuoteTask.tsx');
const backgroundClose = read('src','services','backgroundCloseTask.ts');

const requiredSourceRules = [
  ['每筆成交金額 floor', 'Math.floor(Number(e.price)*shares)'],
  ['累積現金支出 = 成交成本 + 買進手續費', 'historicalCashOutflow:historicalTradeCost+historicalBuyFees'],
  ['目前持有含費成本 = 純成交成本 + 分攤買進費', 'const currentCashBasis=currentTradeCost+currentAllocatedBuyFees'],
  ['賣出淨收入扣賣出費與交易稅', 'const netSellProceeds=grossSellProceeds-sellFees-sellTaxes'],
  ['全局券商費率注入', 'export function configureAccountingFeeSettings'],
  ['未賣持倉預估賣出費稅', 'export function estimatedExitCharges'],
  ['投資組合含費未實現損益採淨變現價值', 'const cashUnrealizedPnl=netLiquidationValue-currentCashBasis'],
  ['單檔含費即時損益採淨變現價值', 'const cashPnl=exit.netLiquidationValue-c.currentCashBasis'],
  ['總損益使用綜合損益', 'const totalPnl=comprehensivePnl'],
  ['總 ROI 使用歷史含費投入', 'const totalRoi=historicalCashOutflow>0?totalPnl/historicalCashOutflow*100:0'],
  ['總資產仍採毛市值 + 現金', 'const totalAssets=marketValue+Math.max(0,Number(cashBalance)||0)'],
  ['單檔預設即時損益採含費口徑', 'const pnl=cashPnl'],
];
for (const [label, snippet] of requiredSourceRules) {
  if (!engine.includes(snippet)) throw new Error(`ACCOUNTING SOURCE RULE MISSING: ${label}`);
}
const consumerRules=[
 ['App 注入當前券商費率',app,'configureAccountingFeeSettings(state.feeSettings)'],
 ['Widget 單檔模式採預估淨變現價值',widget,'estimatedExitCharges(h.shares*h.price).netLiquidationValue'],
 ['Widget task 注入當前券商費率',widgetTask,'configureAccountingFeeSettings(state?.feeSettings)'],
 ['Widget 背景更新注入當前券商費率',backgroundQuote,'configureAccountingFeeSettings((state as any).feeSettings)'],
 ['盤後快照注入當前券商費率',backgroundClose,'configureAccountingFeeSettings(state.feeSettings)'],
];
for(const [label,source,snippet] of consumerRules){if(!source.includes(snippet))throw new Error(`ACCOUNTING CONSUMER RULE MISSING: ${label}`);}

function approx(actual, expected, eps=1e-9, label='value') {
  if (Math.abs(actual-expected) > eps) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const feeSettings={feeRate:0.001425,discount:1,minimumFee:1,etfSellTaxRate:0.001};
const sellFee=(amount)=>Math.max(feeSettings.minimumFee,Math.floor(amount*feeSettings.feeRate*feeSettings.discount));
const sellTax=(amount)=>Math.floor(amount*feeSettings.etfSellTaxRate);
const brokerStyleOpenPnl=({price,shares,cost})=>{
  const marketValue=price*shares;
  const fee=sellFee(marketValue);
  const tax=sellTax(marketValue);
  const netLiquidationValue=marketValue-fee-tax;
  return {marketValue,fee,tax,netLiquidationValue,pnl:netLiquidationValue-cost};
};

// Three confirmed rows extracted from the user's brokerage screenshot.
const samples=[
  {symbol:'0050',price:106.90,shares:32,cost:3340,expected:{fee:4,tax:3,net:3413.8,pnl:73.8}},
  {symbol:'元大高股息',price:55.55,shares:40,cost:2150,expected:{fee:3,tax:2,net:2217,pnl:67}},
  {symbol:'元大台灣高息低波',price:64.40,shares:31,cost:1913,expected:{fee:2,tax:1,net:1993.4,pnl:80.4}},
];
for(const s of samples){
  const r=brokerStyleOpenPnl(s);
  approx(r.fee,s.expected.fee,1e-9,`${s.symbol} estimated sell fee`);
  approx(r.tax,s.expected.tax,1e-9,`${s.symbol} estimated sell tax`);
  approx(r.netLiquidationValue,s.expected.net,1e-9,`${s.symbol} net liquidation`);
  approx(r.pnl,s.expected.pnl,1e-9,`${s.symbol} broker-style open PnL`);
  if(!(r.pnl < r.marketValue-s.cost))throw new Error(`${s.symbol}: exit charges must reduce open PnL`);
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
const estimatedExitFee=sellFee(marketValue);
const estimatedExitTax=sellTax(marketValue);
const netLiquidationValue=marketValue-estimatedExitFee-estimatedExitTax;
const priceUnrealized = marketValue - currentTradeCost;
const cashUnrealized = netLiquidationValue - currentCashBasis;
const totalPnl = cashUnrealized + realizedCash + dividend;
const roi = totalPnl / cashOutflow * 100;
const totalAssets = marketValue + cashBalance;

approx(tradeCost, 16000, 1e-9, '累積成交成本');
approx(buyFees, 15, 1e-9, '累積買進手續費');
approx(cashOutflow, 16015, 1e-9, '累積現金支出');
approx(currentShares, 120, 1e-9, '目前持有股數');
approx(currentTradeCost, 12800, 1e-9, '目前持有成交成本');
approx(currentCashBasis, 12812, 1e-9, '目前持有含費成本');
approx(realizedPrice, 700, 1e-9, '已實現價格損益');
approx(realizedCash, 679, 1e-9, '已實現含費損益');
approx(marketValue, 15000, 1e-9, '目前市值');
approx(estimatedExitFee,21,1e-9,'預估賣出手續費');
approx(estimatedExitTax,15,1e-9,'預估 ETF 交易稅');
approx(netLiquidationValue,14964,1e-9,'預估淨變現價值');
approx(priceUnrealized, 2200, 1e-9, '未實現價格損益');
approx(cashUnrealized, 2152, 1e-9, '含費未實現損益');
approx(totalPnl, 3071, 1e-9, '累積總損益');
approx(roi, 3071/16015*100, 1e-9, '總 ROI');
approx(totalAssets, 65000, 1e-9, '總資產');

console.log('ACCOUNTING_CONTRACT_TEST: PASS');
console.log(JSON.stringify({samples,tradeCost,buyFees,cashOutflow,currentShares,currentTradeCost,currentCashBasis,marketValue,estimatedExitFee,estimatedExitTax,netLiquidationValue,realizedPrice,realizedCash,priceUnrealized,cashUnrealized,dividend,totalPnl,roi:Number(roi.toFixed(6)),cashBalance,totalAssets}, null, 2));
