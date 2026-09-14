import { Holding } from '../data/portfolio';
import { TwseQuote } from '../services/twse';

export const money = (value: number, decimals = 2) =>
  `${new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}`;

export const signedMoney = (value: number, decimals = 2) =>
  `${value >= 0 ? '+' : '-'} ${money(Math.abs(value), decimals)}`;

export const percent = (value: number, digits = 2) => `${(value * 100).toFixed(digits)}%`;
export const signedPercent = (value: number, digits = 2) => `${value >= 0 ? '+' : ''}${percent(value, digits)}`;
export const quote = (value:number) => new Intl.NumberFormat('zh-TW',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
export const integer = (value:number) => new Intl.NumberFormat('zh-TW',{maximumFractionDigits:0}).format(Math.round(value));

export function priceFor(h: Holding, quotes: Record<string, TwseQuote>) {
  return quotes[h.symbol]?.price ?? h.fallbackPrice;
}

export function holdingMetrics(h: Holding, quotes: Record<string, TwseQuote>) {
  const price = priceFor(h, quotes);
  const pureCost = (h.purchaseRecords?.length ? h.purchaseRecords.reduce((s,r)=>s+Number(r.purchaseCost||0),0) : h.shares * (h.tradeAvgPrice ?? h.avgCost));
  const totalCost = pureCost + Number(h.buyFee ?? h.purchaseRecords?.reduce((s,r)=>s+Number(r.fee||0),0) ?? 0);
  const cost = pureCost;
  const marketValue = h.shares * price;
  const pnl = marketValue - pureCost;
  const pnlPct = cost > 0 ? pnl / cost : 0;
  const perShare = price - h.avgCost;
  const breakEvenPct = price > 0 && price < h.avgCost ? h.avgCost / price - 1 : 0;
  return { price, cost:pureCost, pureCost, totalCost, marketValue, pnl, pnlPct, perShare, breakEvenPct };
}

export function portfolioMetrics(holdings: Holding[], quotes: Record<string, TwseQuote>) {
  const rows = holdings.map(h => ({ h, m: holdingMetrics(h, quotes) }));
  const cost = rows.reduce((s, r) => s + r.m.pureCost, 0);
  const totalCost = rows.reduce((s,r)=>s+r.m.totalCost,0);
  const marketValue = rows.reduce((s, r) => s + r.m.marketValue, 0);
  const pnl = marketValue - cost;
  const pnlPct = cost > 0 ? pnl / cost : 0;
  const annualDividend = holdings.reduce((s, h) => s + h.shares * h.annualDividendPerShare, 0);
  const monthlyCashflow = annualDividend / 12;
  const cashYield = marketValue > 0 ? annualDividend / marketValue : 0;
  const weights = rows.map(r => ({
    symbol: r.h.symbol,
    weight: marketValue > 0 ? r.m.marketValue / marketValue : 0,
  }));
  const topWeight = Math.max(0, ...weights.map(w => w.weight));
  let health = 100;
  if (topWeight > 0.50) health -= 18;
  else if (topWeight > 0.40) health -= 10;
  if (holdings.length < 3) health -= 12;
  if (pnlPct < -0.15) health -= 8;
  if (cashYield > 0.09) health -= 6;
  return {
    cost,
    totalCost,
    marketValue,
    pnl,
    pnlPct,
    annualDividend,
    monthlyCashflow,
    cashYield,
    weights,
    health: Math.max(0, Math.min(100, health)),
  };
}

export function contributionPlan(
  holdings: Holding[],
  quotes: Record<string, TwseQuote>,
  amount: number,
) {
  const portfolio = portfolioMetrics(holdings, quotes);
  const futureTotal = portfolio.marketValue + amount;
  const gaps = holdings.map(h => {
    const current = holdingMetrics(h, quotes).marketValue;
    return {
      symbol: h.symbol,
      name: h.name,
      targetWeight: h.targetWeight,
      gap: Math.max(0, futureTotal * h.targetWeight - current),
    };
  });
  const totalGap = gaps.reduce((s, g) => s + g.gap, 0);
  return gaps.map(g => ({
    ...g,
    amount: totalGap > 0 ? amount * g.gap / totalGap : amount / gaps.length,
  }));
}

export function projectFutureValue(
  principal: number,
  monthlyContribution: number,
  annualRate: number,
  years: number,
) {
  const months = years * 12;
  const r = annualRate / 12;
  if (r === 0) return principal + monthlyContribution * months;
  return principal * Math.pow(1 + r, months) + monthlyContribution * ((Math.pow(1 + r, months) - 1) / r);
}

export function estimateMonthsToGoal(
  principal: number,
  target: number,
  monthlyContribution: number,
  annualRate: number,
) {
  if (principal >= target) return 0;
  let value = principal;
  const r = annualRate / 12;
  for (let month = 1; month <= 1200; month += 1) {
    value = value * (1 + r) + monthlyContribution;
    if (value >= target) return month;
  }
  return 1200;
}
