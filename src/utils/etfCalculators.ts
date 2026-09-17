import {
  DividendRecord,
  ETFItem,
  ETFSummary,
  HUANAN_CONFIG,
  InstrumentType,
  NetDividendResult,
  PortfolioSummary,
  PurchaseCostResult,
  SellResult,
  TradeMode,
  Transaction,
} from '../types/etf';
import { defaultBrokerProfile, type BrokerProfile } from '../data/brokerProfiles';

const safeNumber = (value: number): number => Number.isFinite(value) ? value : 0;
const nonNegative = (value: number): number => Math.max(0, safeNumber(value));
const safeShares = (value: number): number => Math.max(0, safeNumber(value));
const roundPercentage = (value: number): number => Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;

export const resolveTransactionBrokerProfile = (profile?: BrokerProfile) => profile ?? defaultBrokerProfile;

const minimumCommission = (tradeMode: TradeMode) => tradeMode === 'ROUND_LOT'
  ? HUANAN_CONFIG.MIN_COMMISSION_ROUND_LOT
  : HUANAN_CONFIG.MIN_COMMISSION_ODD_LOT;

export const calculateCommission = (tradeAmount: number, tradeMode: TradeMode): number => {
  const amount = nonNegative(tradeAmount);
  if (!(amount > 0)) return 0;
  return Math.max(
    minimumCommission(tradeMode),
    Math.floor(amount * HUANAN_CONFIG.COMMISSION_RATE * HUANAN_CONFIG.COMMISSION_DISCOUNT),
  );
};

export const calculateSellTax = (tradeAmount: number, instrumentType: InstrumentType = 'etf'): number => {
  const amount = nonNegative(tradeAmount);
  if (!(amount > 0)) return 0;
  const rate = instrumentType === 'stock'
    ? HUANAN_CONFIG.STOCK_SELL_TAX_RATE
    : HUANAN_CONFIG.ETF_SELL_TAX_RATE;
  return Math.floor(amount * rate);
};

const sortTransactions = (transactions: Transaction[]): Transaction[] => [...transactions].sort((a, b) => {
  const dateComparison = String(a.date).localeCompare(String(b.date));
  return dateComparison !== 0 ? dateComparison : String(a.id).localeCompare(String(b.id));
});

export const calculateDividendDetail = (
  sharesHeld: number,
  perShareAmount: number,
): NetDividendResult => {
  const shares = safeShares(sharesHeld);
  const dividendPerShare = nonNegative(perShareAmount);
  if (shares <= 0 || dividendPerShare <= 0) {
    return { grossDividend: 0, supplementaryHealthPremium: 0, remittanceFee: 0, netDividend: 0 };
  }

  const grossDividend = Math.floor(dividendPerShare * shares);
  if (grossDividend <= 0) {
    return { grossDividend: 0, supplementaryHealthPremium: 0, remittanceFee: 0, netDividend: 0 };
  }

  const supplementaryHealthPremium = grossDividend >= HUANAN_CONFIG.HEALTH_PREMIUM_THRESHOLD
    ? Math.floor(grossDividend * HUANAN_CONFIG.HEALTH_PREMIUM_RATE)
    : 0;
  const remittanceFee = HUANAN_CONFIG.DIVIDEND_REMITTANCE_FEE;
  const netDividend = Math.max(0, grossDividend - supplementaryHealthPremium - remittanceFee);
  return { grossDividend, supplementaryHealthPremium, remittanceFee, netDividend };
};

export const calculatePurchaseCost = (transaction: Transaction): PurchaseCostResult => {
  if (transaction.type !== 'BUY') return { tradeAmount: 0, commission: 0, settlementAmount: 0 };
  const shares = safeShares(transaction.shares);
  const price = nonNegative(transaction.price);
  if (shares <= 0 || price <= 0) return { tradeAmount: 0, commission: 0, settlementAmount: 0 };

  const tradeAmount = Math.floor(price * shares);
  const commission = calculateCommission(tradeAmount, transaction.tradeMode);
  return { tradeAmount, commission, settlementAmount: tradeAmount + commission };
};

export const calculateSell = (
  transaction: Transaction,
  releasedCost: number,
  sellShares = transaction.shares,
): SellResult => {
  if (transaction.type !== 'SELL') {
    return { tradeAmount: 0, commission: 0, tax: 0, netProceeds: 0, releasedCost: 0, realizedProfit: 0 };
  }
  const shares = safeShares(sellShares);
  const price = nonNegative(transaction.price);
  if (shares <= 0 || price <= 0) {
    return { tradeAmount: 0, commission: 0, tax: 0, netProceeds: 0, releasedCost: 0, realizedProfit: 0 };
  }

  const tradeAmount = Math.floor(price * shares);
  const commission = calculateCommission(tradeAmount, transaction.tradeMode);
  const tax = calculateSellTax(tradeAmount, transaction.instrumentType ?? 'etf');
  const netProceeds = tradeAmount - commission - tax;
  const safeReleasedCost = nonNegative(releasedCost);
  return {
    tradeAmount,
    commission,
    tax,
    netProceeds,
    releasedCost: safeReleasedCost,
    realizedProfit: netProceeds - safeReleasedCost,
  };
};

export const calculateNetDividend = (record: DividendRecord): number => (
  calculateDividendDetail(record.sharesHeld, record.perShareAmount).netDividend
);

type PositionState = {
  totalShares: number;
  historicalTradeCost: number;
  historicalBuyFees: number;
  currentTradeCost: number;
  currentAllocatedBuyFees: number;
  totalInvestmentCost: number;
  realizedProfit: number;
};

const calculatePositionState = (transactions: Transaction[]): PositionState => {
  let totalShares = 0;
  let historicalTradeCost = 0;
  let historicalBuyFees = 0;
  let currentTradeCost = 0;
  let currentAllocatedBuyFees = 0;
  let realizedProfit = 0;

  for (const transaction of sortTransactions(transactions)) {
    const shares = safeShares(transaction.shares);
    const price = nonNegative(transaction.price);
    if (shares <= 0 || price <= 0) continue;

    if (transaction.type === 'BUY') {
      const purchase = calculatePurchaseCost(transaction);
      historicalTradeCost += purchase.tradeAmount;
      historicalBuyFees += purchase.commission;
      currentTradeCost += purchase.tradeAmount;
      currentAllocatedBuyFees += purchase.commission;
      totalShares += shares;
      continue;
    }

    const totalInvestmentCost = currentTradeCost + currentAllocatedBuyFees;
    if (totalShares <= 0 || totalInvestmentCost <= 0) continue;

    const sellShares = Math.min(shares, totalShares);
    const shareRatio = sellShares / totalShares;
    const releasedTradeCost = currentTradeCost * shareRatio;
    const releasedBuyFees = currentAllocatedBuyFees * shareRatio;
    const releasedCost = releasedTradeCost + releasedBuyFees;
    const sale = calculateSell(transaction, releasedCost, sellShares);

    realizedProfit += sale.realizedProfit;
    totalShares -= sellShares;
    currentTradeCost -= releasedTradeCost;
    currentAllocatedBuyFees -= releasedBuyFees;

    if (totalShares <= 1e-9) {
      totalShares = 0;
      currentTradeCost = 0;
      currentAllocatedBuyFees = 0;
    } else {
      currentTradeCost = Math.max(0, currentTradeCost);
      currentAllocatedBuyFees = Math.max(0, currentAllocatedBuyFees);
    }
  }

  return {
    totalShares,
    historicalTradeCost,
    historicalBuyFees,
    currentTradeCost,
    currentAllocatedBuyFees,
    totalInvestmentCost: currentTradeCost + currentAllocatedBuyFees,
    realizedProfit,
  };
};

export const calculateETFSummary = (etf: ETFItem): ETFSummary => {
  const currentPrice = nonNegative(etf.currentPrice);
  const state = calculatePositionState(etf.transactions);
  const {
    totalShares,
    historicalTradeCost,
    historicalBuyFees,
    currentTradeCost,
    currentAllocatedBuyFees,
    totalInvestmentCost,
    realizedProfit,
  } = state;
  const historicalCashOutflow = historicalTradeCost + historicalBuyFees;
  const hasValidPosition = totalShares > 0 && currentPrice > 0;
  const averageCostPerShare = hasValidPosition && totalInvestmentCost > 0
    ? totalInvestmentCost / totalShares
    : 0;

  const currentMarketValue = hasValidPosition
    ? Math.floor(currentPrice * totalShares)
    : 0;
  const estimatedSellCommission = currentMarketValue > 0
    ? calculateCommission(currentMarketValue, etf.liquidationTradeMode)
    : 0;
  const estimatedSellTax = currentMarketValue > 0
    ? calculateSellTax(currentMarketValue, etf.instrumentType ?? 'etf')
    : 0;
  const netLiquidationValue = currentMarketValue - estimatedSellCommission - estimatedSellTax;
  const unrealizedProfit = hasValidPosition && totalInvestmentCost > 0
    ? netLiquidationValue - totalInvestmentCost
    : 0;
  const unrealizedROI = hasValidPosition && totalInvestmentCost > 0
    ? roundPercentage((unrealizedProfit / totalInvestmentCost) * 100)
    : 0;

  const totalNetDividends = etf.dividendRecords.reduce(
    (total, record) => total + calculateNetDividend(record),
    0,
  );
  const totalPnl = unrealizedProfit + realizedProfit + totalNetDividends;

  const latestDividendPerShare = nonNegative(etf.latestDividendPerShare ?? 0);
  const nextEstimatedDividend = hasValidPosition && latestDividendPerShare > 0
    ? calculateDividendDetail(totalShares, latestDividendPerShare).netDividend
    : 0;
  const singlePeriodYield = hasValidPosition && latestDividendPerShare > 0
    ? roundPercentage((latestDividendPerShare / currentPrice) * 100)
    : 0;
  const annualizedYield = hasValidPosition && latestDividendPerShare > 0 && etf.dividendFrequency > 0
    ? roundPercentage(((latestDividendPerShare * etf.dividendFrequency) / currentPrice) * 100)
    : 0;

  return {
    etfCode: etf.etfCode,
    name: etf.name,
    currentPrice,
    totalShares,
    historicalTradeCost,
    historicalBuyFees,
    historicalCashOutflow,
    currentTradeCost,
    currentAllocatedBuyFees,
    totalInvestmentCost,
    averageCostPerShare,
    currentMarketValue,
    estimatedSellCommission,
    estimatedSellTax,
    netLiquidationValue,
    unrealizedProfit,
    unrealizedROI,
    realizedProfit,
    totalNetDividends,
    totalDividendsReceived: totalNetDividends,
    totalPnl,
    nextEstimatedDividend,
    singlePeriodYield,
    annualizedYield,
    portfolioWeight: 0,
  };
};

export const calculatePortfolioSummary = (etfs: ETFItem[]): PortfolioSummary => {
  const rawSummaries = etfs.map(calculateETFSummary);
  const sum = (selector: (summary: ETFSummary) => number) => rawSummaries.reduce(
    (total, summary) => total + selector(summary),
    0,
  );

  const totalMarketValue = sum((summary) => summary.currentMarketValue);
  const totalInvestmentCost = sum((summary) => summary.totalInvestmentCost);
  const totalNetLiquidationValue = sum((summary) => summary.netLiquidationValue);
  const totalEstimatedSellCommission = sum((summary) => summary.estimatedSellCommission);
  const totalEstimatedSellTax = sum((summary) => summary.estimatedSellTax);
  const totalUnrealizedProfit = sum((summary) => summary.unrealizedProfit);
  const totalRealizedProfit = sum((summary) => summary.realizedProfit);
  const totalNetDividends = sum((summary) => summary.totalNetDividends);
  const totalPnl = totalUnrealizedProfit + totalRealizedProfit + totalNetDividends;
  const nextEstimatedDividendTotal = sum((summary) => summary.nextEstimatedDividend);
  const totalUnrealizedROI = totalInvestmentCost > 0
    ? roundPercentage((totalUnrealizedProfit / totalInvestmentCost) * 100)
    : 0;

  const etfSummaries = rawSummaries.map((summary): ETFSummary => ({
    ...summary,
    portfolioWeight: totalMarketValue > 0
      ? roundPercentage((summary.currentMarketValue / totalMarketValue) * 100)
      : 0,
  }));

  return {
    totalMarketValue,
    totalInvestmentCost,
    totalNetLiquidationValue,
    totalEstimatedSellCommission,
    totalEstimatedSellTax,
    totalUnrealizedProfit,
    totalUnrealizedROI,
    totalRealizedProfit,
    totalNetDividends,
    totalDividendsReceived: totalNetDividends,
    totalPnl,
    nextEstimatedDividendTotal,
    etfSummaries,
  };
};
