/**
 * src/utils/etfCalculators.ts
 *
 * ETF 財務管家 - 唯一全局金融計算核心
 *
 * BREAKING REFACTOR
 * --------------------------------------------------
 * 1. 全面廢除舊版金融計算邏輯。
 * 2. 不提供任何 Legacy Fallback / Compatibility Layer。
 * 3. 全 App 僅允許使用同一套 Canonical Finance Core 公式。
 * 4. UI / Settings / Holding / Transaction 不得覆寫：
 *    - 手續費率
 *    - 折扣
 *    - 最低手續費
 *    - ETF 證券交易稅
 *    - 二代健保補充保費
 * 5. 賣出持倉採移動平均含費成本釋放。
 * 6. 禁止使用賣出所得現金反向沖減剩餘持倉成本。
 */

import {
  DividendRecord,
  ETFItem,
  ETFSummary,
  FINANCE_CORE_POLICY,
  NetDividendResult,
  PortfolioSummary,
  PurchaseCostResult,
  TradeMode,
  Transaction,
} from '../types/etf';
import { calculateBrokerCommission, calculateBrokerSellTax, defaultBrokerProfile, type BrokerProfile } from '../data/brokerProfiles';

const safeNumber = (value: number): number => {
  return Number.isFinite(value) ? value : 0;
};

const nonNegative = (value: number): number => {
  return Math.max(0, safeNumber(value));
};

const safeShares = (value: number): number => {
  return Math.max(0, safeNumber(value));
};

const roundPercentage = (value: number): number => {
  const safeValue = safeNumber(value);
  return Math.round((safeValue + Number.EPSILON) * 100) / 100;
};

export const resolveTransactionBrokerProfile=(profile?:BrokerProfile)=>profile??defaultBrokerProfile;

const floorMoney = (value:number):number => Math.floor(nonNegative(value));

const calculateCommission = (tradeAmount:number,tradeMode:TradeMode,profile?:BrokerProfile):number => {
  const amount=floorMoney(tradeAmount);
  if(amount<=0)return 0;
  return calculateBrokerCommission(amount,tradeMode,resolveTransactionBrokerProfile(profile));
};

const calculateETFSellTax = (tradeAmount:number,profile?:BrokerProfile):number => {
  const amount=floorMoney(tradeAmount);
  if(amount<=0)return 0;
  return calculateBrokerSellTax(amount,resolveTransactionBrokerProfile(profile),'etf');
};

const sortTransactions = (
  transactions: Transaction[],
): Transaction[] => {
  return [...transactions].sort((a, b) => {
    const dateComparison = String(a.date).localeCompare(
      String(b.date),
    );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return String(a.id).localeCompare(String(b.id));
  });
};

const calculateDividendDetail = (
  sharesHeld: number,
  perShareAmount: number,
): NetDividendResult => {
  const shares = safeShares(sharesHeld);
  const dividendPerShare = nonNegative(perShareAmount);

  if (shares <= 0 || dividendPerShare <= 0) {
    return {
      grossDividend: 0,
      supplementaryHealthPremium: 0,
      transferFee: 0,
      netDividend: 0,
    };
  }

  const grossDividend = Math.floor(shares * dividendPerShare);

  const supplementaryHealthPremium =
    grossDividend >= FINANCE_CORE_POLICY.HEALTH_PREMIUM_THRESHOLD
      ? Math.floor(
          grossDividend * FINANCE_CORE_POLICY.HEALTH_PREMIUM_RATE,
        )
      : 0;

  const transferFee = grossDividend > 0 ? FINANCE_CORE_POLICY.DIVIDEND_TRANSFER_FEE : 0;

  return {
    grossDividend,
    supplementaryHealthPremium,
    transferFee,
    netDividend: Math.max(0, grossDividend - supplementaryHealthPremium - transferFee),
  };
};

export const calculatePurchaseCost = (
  transaction: Transaction,
): PurchaseCostResult => {
  if (transaction.type !== 'BUY') {
    return {
      tradeAmount: 0,
      commission: 0,
      settlementAmount: 0,
    };
  }

  const shares = safeShares(transaction.shares);
  const price = nonNegative(transaction.price);

  if (shares <= 0 || price <= 0) {
    return {
      tradeAmount: 0,
      commission: 0,
      settlementAmount: 0,
    };
  }

  const tradeAmount = Math.floor(shares * price);
  const commission = calculateCommission(
    tradeAmount,
    transaction.tradeMode,
    transaction.brokerProfile,
  );

  return {
    tradeAmount,
    commission,
    settlementAmount: tradeAmount + commission,
  };
};

export const calculateNetDividend = (
  record: DividendRecord,
): number => {
  return calculateDividendDetail(
    record.sharesHeld,
    record.perShareAmount,
  ).netDividend;
};

const calculateCurrentPositionCost = (
  transactions: Transaction[],
): {
  totalShares: number;
  totalInvestmentCost: number;
  realizedNetPnL: number;
} => {
  let totalShares = 0;
  let totalInvestmentCost = 0;
  let realizedNetPnL = 0;

  const orderedTransactions = sortTransactions(transactions);

  for (const transaction of orderedTransactions) {
    const shares = safeShares(transaction.shares);
    const price = nonNegative(transaction.price);

    if (shares <= 0 || price <= 0) {
      continue;
    }

    if (transaction.type === 'BUY') {
      const purchase = calculatePurchaseCost(transaction);

      totalShares += shares;
      totalInvestmentCost += purchase.settlementAmount;
      continue;
    }

    if (
      transaction.type === 'SELL' &&
      totalShares > 0 &&
      totalInvestmentCost > 0
    ) {
      const sellShares = Math.min(shares, totalShares);
      const averageCostBeforeSell = totalInvestmentCost / totalShares;
      const releasedCost = averageCostBeforeSell * sellShares;
      const sellAmount = Math.floor(price * sellShares);
      const sellCommission = calculateCommission(sellAmount, transaction.tradeMode, transaction.brokerProfile);
      const sellTax = calculateETFSellTax(sellAmount, transaction.brokerProfile);
      const netSellIncome = sellAmount - sellCommission - sellTax;
      realizedNetPnL += netSellIncome - releasedCost;

      totalShares -= sellShares;
      totalInvestmentCost -= releasedCost;

      if (totalShares <= 0) {
        totalShares = 0;
        totalInvestmentCost = 0;
        continue;
      }

      totalInvestmentCost = Math.max(0, totalInvestmentCost);
    }
  }

  return {
    totalShares,
    totalInvestmentCost,
    realizedNetPnL,
  };
};

export const calculateETFSummary = (
  etf: ETFItem,
): ETFSummary => {
  const currentPrice = nonNegative(etf.currentPrice);

  const {
    totalShares,
    totalInvestmentCost,
    realizedNetPnL,
  } = calculateCurrentPositionCost(etf.transactions);

  const hasValidPosition =
    totalShares > 0 && currentPrice > 0;

  const averageCostPerShare =
    hasValidPosition && totalInvestmentCost > 0
      ? totalInvestmentCost / totalShares
      : 0;

  const currentMarketValue =
    hasValidPosition
      ? Math.floor(totalShares * currentPrice)
      : 0;

  const estimatedSellCommission =
    currentMarketValue > 0
      ? calculateCommission(
          currentMarketValue,
          etf.liquidationTradeMode,
          etf.brokerProfile,
        )
      : 0;

  const estimatedSellTax =
    currentMarketValue > 0
      ? calculateETFSellTax(currentMarketValue, etf.brokerProfile)
      : 0;

  const netLiquidationValue =
    currentMarketValue > 0
      ? currentMarketValue -
        estimatedSellCommission -
        estimatedSellTax
      : 0;

  const unrealizedProfit =
    hasValidPosition && totalInvestmentCost > 0
      ? netLiquidationValue - totalInvestmentCost
      : 0;

  const unrealizedROI =
    hasValidPosition && totalInvestmentCost > 0
      ? roundPercentage(
          (unrealizedProfit / totalInvestmentCost) * 100,
        )
      : 0;

  const totalDividendsReceived =
    etf.dividendRecords.reduce(
      (total, record) => {
        return total + calculateNetDividend(record);
      },
      0,
    );

  const latestDividendPerShare = nonNegative(
    etf.latestDividendPerShare ?? 0,
  );

  const comprehensivePnL = unrealizedProfit + realizedNetPnL + totalDividendsReceived;

  const nextEstimatedDividend =
    hasValidPosition && latestDividendPerShare > 0
      ? calculateDividendDetail(
          totalShares,
          latestDividendPerShare,
        ).netDividend
      : 0;

  const singlePeriodYield =
    hasValidPosition && latestDividendPerShare > 0
      ? roundPercentage(
          (latestDividendPerShare / currentPrice) * 100,
        )
      : 0;

  const annualizedYield =
    hasValidPosition &&
    latestDividendPerShare > 0 &&
    etf.dividendFrequency > 0
      ? roundPercentage(
          ((latestDividendPerShare * etf.dividendFrequency) /
            currentPrice) *
            100,
        )
      : 0;

  return {
    etfCode: etf.etfCode,
    name: etf.name,
    currentPrice,
    totalShares,
    totalInvestmentCost,
    averageCostPerShare,
    currentMarketValue,
    estimatedSellCommission,
    estimatedSellTax,
    netLiquidationValue,
    unrealizedProfit,
    unrealizedROI,
    realizedNetPnL,
    comprehensivePnL,
    totalDividendsReceived,
    nextEstimatedDividend,
    singlePeriodYield,
    annualizedYield,
    portfolioWeight: 0,
  };
};

export const calculatePortfolioSummary = (
  etfs: ETFItem[],
): PortfolioSummary => {
  const rawSummaries = etfs.map((etf) =>
    calculateETFSummary(etf),
  );

  const totalMarketValue = rawSummaries.reduce(
    (total, summary) => total + summary.currentMarketValue,
    0,
  );

  const totalInvestmentCost = rawSummaries.reduce(
    (total, summary) => total + summary.totalInvestmentCost,
    0,
  );

  const totalNetLiquidationValue = rawSummaries.reduce(
    (total, summary) => total + summary.netLiquidationValue,
    0,
  );

  const totalEstimatedSellCommission = rawSummaries.reduce(
    (total, summary) =>
      total + summary.estimatedSellCommission,
    0,
  );

  const totalEstimatedSellTax = rawSummaries.reduce(
    (total, summary) => total + summary.estimatedSellTax,
    0,
  );

  const totalUnrealizedProfit =
    totalNetLiquidationValue - totalInvestmentCost;

  const totalUnrealizedROI =
    totalMarketValue > 0 && totalInvestmentCost > 0
      ? roundPercentage(
          (totalUnrealizedProfit / totalInvestmentCost) * 100,
        )
      : 0;

  const realizedNetPnL = rawSummaries.reduce(
    (total, summary) => total + summary.realizedNetPnL,
    0,
  );

  const totalDividendsReceived = rawSummaries.reduce(
    (total, summary) => total + summary.totalDividendsReceived,
    0,
  );

  const comprehensivePnL = totalUnrealizedProfit + realizedNetPnL + totalDividendsReceived;

  const nextEstimatedDividendTotal = rawSummaries.reduce(
    (total, summary) =>
      total + summary.nextEstimatedDividend,
    0,
  );

  const etfSummaries = rawSummaries.map(
    (summary): ETFSummary => {
      const portfolioWeight =
        totalMarketValue > 0 &&
        summary.totalShares > 0 &&
        summary.currentPrice > 0
          ? roundPercentage(
              (summary.currentMarketValue / totalMarketValue) *
                100,
            )
          : 0;

      return {
        ...summary,
        portfolioWeight,
      };
    },
  );

  return {
    totalMarketValue,
    totalInvestmentCost,
    totalNetLiquidationValue,
    totalEstimatedSellCommission,
    totalEstimatedSellTax,
    totalUnrealizedProfit,
    totalUnrealizedROI,
    realizedNetPnL,
    comprehensivePnL,
    totalPnl: comprehensivePnL,
    totalDividendsReceived,
    nextEstimatedDividendTotal,
    etfSummaries,
  };
};
