/**
 * src/types/etf.ts
 *
 * ETF 財務管家唯一全局金融型別。
 *
 * BREAKING CHANGE:
 * - 不保留任何舊版 Broker Profile / FeeSettings / Legacy 型別。
 * - 全 App 金融運算唯一基準：華南永昌證券。
 */

import type { BrokerProfile } from '../data/brokerProfiles';

export type TransactionType = 'BUY' | 'SELL';

/**
 * ROUND_LOT
 * 整股交易，最低手續費 20 元。
 *
 * ODD_LOT
 * 盤後零股 / 定期定額，最低手續費 1 元。
 */
export type TradeMode = 'ROUND_LOT' | 'ODD_LOT';

/**
 * 每年配息次數。
 * 1  = 年配
 * 2  = 半年配
 * 4  = 季配
 * 6  = 雙月配
 * 12 = 月配
 */
export type DividendFrequency = 1 | 2 | 4 | 6 | 12;

/**
 * 單筆 ETF 交易。
 *
 * 所有交易皆固定採用華南永昌證券計費規則。
 * 不允許個別交易覆寫折扣、費率、最低手續費或稅率。
 */
export interface Transaction {
  id: string;
  etfCode: string;
  type: TransactionType;
  tradeMode: TradeMode;
  shares: number;
  price: number;
  date: string;
  /** Resolved runtime brokerage parameters; supplied by Broker Profile Resolver. */
  brokerProfile?: BrokerProfile;
}

/**
 * 單筆股息紀錄。
 */
export interface DividendRecord {
  id: string;
  etfCode: string;
  paymentDate: string;

  /** 每股配息金額。 */
  perShareAmount: number;

  /** 除息資格基準日實際符合配息的股數。 */
  sharesHeld: number;
}

/**
 * 單一 ETF 進入金融核心所需的完整資料。
 */
export interface ETFItem {
  etfCode: string;
  name: string;

  /** 即時 / 最新有效行情。 */
  currentPrice: number;

  /**
   * 若現在全部清算此 ETF，要採用的交易模式。
   * 因整股與零股最低手續費不同，不可由金融核心猜測。
   */
  liquidationTradeMode: TradeMode;

  /** 每年配息次數。 */
  dividendFrequency: DividendFrequency;

  /** 最新一期預估每股配息。 */
  latestDividendPerShare?: number;

  transactions: Transaction[];
  dividendRecords: DividendRecord[];
  /** Profile used for current-position liquidation estimates. */
  brokerProfile?: BrokerProfile;
}

/**
 * 單筆買進的完整華南永昌成本拆解。
 */
export interface PurchaseCostResult {
  tradeAmount: number;
  commission: number;
  settlementAmount: number;
}

/**
 * 單筆股息淨額拆解。
 */
export interface NetDividendResult {
  grossDividend: number;
  supplementaryHealthPremium: number;
  netDividend: number;
}

/**
 * 單一 ETF 的唯一全局金融摘要。
 */
export interface ETFSummary {
  etfCode: string;
  name: string;

  currentPrice: number;
  totalShares: number;

  /** 目前剩餘持倉所對應的含買進手續費成本。 */
  totalInvestmentCost: number;

  /** 目前剩餘持股每股平均含費成本。 */
  averageCostPerShare: number;

  /** 行情 × 持有股數。此欄位永遠只代表毛市值。 */
  currentMarketValue: number;

  /** 假設目前全部賣出時的預估賣出手續費。 */
  estimatedSellCommission: number;

  /** 假設目前全部賣出時的 ETF 證券交易稅。 */
  estimatedSellTax: number;

  /** 當前市值 - 預估賣出手續費 - ETF 證交稅。 */
  netLiquidationValue: number;

  /** 淨清算價值 - 目前剩餘持倉含費成本。 */
  unrealizedProfit: number;

  /** 未實現損益 / 目前剩餘持倉含費成本 × 100。 */
  unrealizedROI: number;

  /** 歷史股息扣除二代健保補充保費後的累積淨額。 */
  totalDividendsReceived: number;

  /** 依目前持股及最新每股預估配息計算，並套用單筆二代健保補充保費規則。 */
  nextEstimatedDividend: number;

  /** 最新單期每股配息 / 即時行情 × 100。 */
  singlePeriodYield: number;

  /** 單期配息年化殖利率。 */
  annualizedYield: number;

  /** 此 ETF 毛市值 / 全投資組合毛市值 × 100。 */
  portfolioWeight: number;
}

/**
 * 全投資組合唯一全局金融摘要。
 */
export interface PortfolioSummary {
  totalMarketValue: number;
  totalInvestmentCost: number;
  totalNetLiquidationValue: number;

  totalEstimatedSellCommission: number;
  totalEstimatedSellTax: number;

  totalUnrealizedProfit: number;
  totalUnrealizedROI: number;

  totalDividendsReceived: number;
  nextEstimatedDividendTotal: number;

  etfSummaries: ETFSummary[];
}

/**
 * 華南永昌證券唯一全局運算常數。
 *
 * 禁止由 UI、Settings、Holding、Transaction
 * 或任何其他模組覆寫以下參數。
 */
export const HUANAN_CONFIG = Object.freeze({
  COMMISSION_RATE: 0.001425,
  COMMISSION_DISCOUNT: 0.65,

  MIN_COMMISSION_ROUND_LOT: 20,
  MIN_COMMISSION_ODD_LOT: 1,

  ETF_SELL_TAX_RATE: 0.001,

  HEALTH_PREMIUM_THRESHOLD: 20_000,
  HEALTH_PREMIUM_RATE: 0.0211,
} as const);
