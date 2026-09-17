/**
 * ETF 財務管家唯一全局金融型別與華南永昌運算常數。
 */

import type { BrokerProfile } from '../data/brokerProfiles';

export type TransactionType = 'BUY' | 'SELL';
export type TradeMode = 'ROUND_LOT' | 'ODD_LOT';
export type InstrumentType = 'etf' | 'stock';
export type DividendFrequency = 1 | 2 | 4 | 6 | 12;

export interface Transaction {
  id: string;
  etfCode: string;
  type: TransactionType;
  tradeMode: TradeMode;
  shares: number;
  price: number;
  date: string;
  instrumentType?: InstrumentType;
  /** Metadata only. Financial rules always come from HUANAN_CONFIG. */
  brokerProfile?: BrokerProfile;
}

export interface DividendRecord {
  id: string;
  etfCode: string;
  paymentDate: string;
  perShareAmount: number;
  sharesHeld: number;
}

export interface ETFItem {
  etfCode: string;
  name: string;
  currentPrice: number;
  liquidationTradeMode: TradeMode;
  instrumentType?: InstrumentType;
  dividendFrequency: DividendFrequency;
  latestDividendPerShare?: number;
  transactions: Transaction[];
  dividendRecords: DividendRecord[];
  /** Metadata only. Financial rules always come from HUANAN_CONFIG. */
  brokerProfile?: BrokerProfile;
}

export interface PurchaseCostResult {
  tradeAmount: number;
  commission: number;
  settlementAmount: number;
}

export interface SellResult {
  tradeAmount: number;
  commission: number;
  tax: number;
  netProceeds: number;
  releasedCost: number;
  realizedProfit: number;
}

export interface NetDividendResult {
  grossDividend: number;
  supplementaryHealthPremium: number;
  remittanceFee: number;
  netDividend: number;
}

export interface ETFSummary {
  etfCode: string;
  name: string;
  currentPrice: number;
  totalShares: number;
  totalInvestmentCost: number;
  averageCostPerShare: number;
  currentMarketValue: number;
  estimatedSellCommission: number;
  estimatedSellTax: number;
  netLiquidationValue: number;
  unrealizedProfit: number;
  unrealizedROI: number;
  realizedProfit: number;
  totalNetDividends: number;
  /** Compatibility alias for totalNetDividends. */
  totalDividendsReceived: number;
  totalPnl: number;
  nextEstimatedDividend: number;
  singlePeriodYield: number;
  annualizedYield: number;
  portfolioWeight: number;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalInvestmentCost: number;
  totalNetLiquidationValue: number;
  totalEstimatedSellCommission: number;
  totalEstimatedSellTax: number;
  totalUnrealizedProfit: number;
  totalUnrealizedROI: number;
  totalRealizedProfit: number;
  totalNetDividends: number;
  /** Compatibility alias for totalNetDividends. */
  totalDividendsReceived: number;
  totalPnl: number;
  nextEstimatedDividendTotal: number;
  etfSummaries: ETFSummary[];
}

/**
 * 華南永昌證券唯一全局運算常數。
 * UI、Settings、Broker Profile、Holding、Transaction 均不得覆寫。
 */
export const HUANAN_CONFIG = Object.freeze({
  COMMISSION_RATE: 0.001425,
  COMMISSION_DISCOUNT: 0.65,
  MIN_COMMISSION_ROUND_LOT: 20,
  MIN_COMMISSION_ODD_LOT: 1,
  ETF_SELL_TAX_RATE: 0.001,
  STOCK_SELL_TAX_RATE: 0.003,
  HEALTH_PREMIUM_THRESHOLD: 20_000,
  HEALTH_PREMIUM_RATE: 0.0211,
  DIVIDEND_REMITTANCE_FEE: 10,
} as const);
