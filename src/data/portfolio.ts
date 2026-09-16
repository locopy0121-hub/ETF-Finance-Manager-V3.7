export type PurchaseRecord = {
  id: string;
  date: string;
  shares: number;
  tradePrice: number;
  purchaseCost: number;
  fee: number;
  feeRebate?: number; // broker refund/rebate applied after the original commission charge
  totalCost: number;
};

export type Holding = {
  symbol: string;
  name: string;
  subtitle: string;
  shares: number;
  // Historical average trade price (pure 成交成本 / shares). Fees are tracked separately.
  avgCost: number;
  // Explicit pure trade average price before buy fee; V3.2 treats this as the canonical price cost basis.
  tradeAvgPrice?: number;
  buyFee?: number;
  feeRate?: number;
  feeDiscount?: number;
  fallbackPrice: number;
  targetWeight: number;
  annualDividendPerShare: number;
  tag: string;
  broker?: string;
  account?: string;
  purchaseRecords?: PurchaseRecord[];
};

// Seed data only. TWSE price always wins once a valid quote is available.
// Existing seed positions are treated as already-entered pure trade average costs; fees remain separate.
export const initialHoldings: Holding[] = [
  {
    symbol: '0050',
    name: '元大台灣50',
    subtitle: '台灣大型權值 ETF',
    shares: 1000,
    avgCost: 120.0,
    tradeAvgPrice: 120.0,
    buyFee: 0,
    fallbackPrice: 142.5,
    targetWeight: 0.40,
    annualDividendPerShare: 4.2,
    tag: '核心持有',
  },
  {
    symbol: '00878',
    name: '國泰永續高股息',
    subtitle: '高股息現金流配置',
    shares: 2000,
    avgCost: 18.0,
    tradeAvgPrice: 18.0,
    buyFee: 0,
    fallbackPrice: 19.6,
    targetWeight: 0.35,
    annualDividendPerShare: 1.85,
    tag: '長期持有',
  },
  {
    symbol: '00929',
    name: '復華台灣科技優息',
    subtitle: '科技與收益配置',
    shares: 1000,
    avgCost: 17.0,
    tradeAvgPrice: 17.0,
    buyFee: 0,
    fallbackPrice: 16.3,
    targetWeight: 0.25,
    annualDividendPerShare: 1.55,
    tag: '觀察中',
  },
];

export const appGoals = {
  monthlyPassiveIncomeTarget: 20000,
  monthlyContribution: 25000,
  assumedCashYield: 0.04,
  assumedAnnualReturn: 0.06,
};
