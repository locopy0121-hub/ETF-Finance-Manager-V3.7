import { Holding } from '../data/portfolio';
import { holdingMetrics } from './metrics';
import { TwseQuote } from '../services/twse';

export type MonthlyAllocation = {
  symbol: string;
  amount: number;
};

export type DividendReinvestmentMode = 'original' | 'single' | 'ratio';

export type DividendReinvestmentPlan = {
  enabled: boolean;
  mode: DividendReinvestmentMode;
  targetSymbol?: string;
  ratios?: Record<string, number>;
};

export type SimulationMonth = {
  year: number;
  month: number;
  monthlyContribution: number;
  cumulativeContribution: number;
  cumulativeInvested: number;
  estimatedValue: number;
  monthlyDividend: number;
  reinvestedDividend: number;
  cumulativeDividend: number;
  monthlyPnl: number;
  cumulativePnl: number;
  cumulativeReturn: number;
};

export type SimulationYear = {
  year: number;
  annualContribution: number;
  cumulativeContribution: number;
  endValue: number;
  annualDividend: number;
  cumulativeDividend: number;
  annualPnl: number;
  cumulativePnl: number;
  cumulativeReturn: number;
  months: SimulationMonth[];
};

export type SimulationResult = {
  initialValue: number;
  monthlyContribution: number;
  finalValue: number;
  cumulativeContribution: number;
  cumulativeDividend: number;
  cumulativePnl: number;
  cumulativeReturn: number;
  years: SimulationYear[];
};

export function simulateMonthlyPlan({
  holdings,
  quotes,
  allocations,
  years,
  annualReturn,
  reinvestDividends,
  dividendReinvestment,
}: {
  holdings: Holding[];
  quotes: Record<string, TwseQuote>;
  allocations: MonthlyAllocation[];
  years: number;
  annualReturn: number;
  reinvestDividends?: boolean;
  dividendReinvestment?: DividendReinvestmentPlan;
}): SimulationResult {
  const safeYears = Math.max(1, Math.min(60, Math.floor(years || 1)));
  const monthlyMarketRate = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const allocationMap = new Map(allocations.map(item => [item.symbol, Math.max(0, item.amount || 0)]));
  const reinvestment: DividendReinvestmentPlan = dividendReinvestment ?? {
    enabled: !!reinvestDividends,
    mode: 'original',
  };

  const positions = holdings.map(h => {
    const metrics = holdingMetrics(h, quotes);
    const annualDividendYield = metrics.price > 0 ? Math.max(0, h.annualDividendPerShare / metrics.price) : 0;
    return {
      symbol: h.symbol,
      value: metrics.marketValue,
      monthlyDividendYield: annualDividendYield / 12,
      monthlyContribution: allocationMap.get(h.symbol) ?? 0,
    };
  });

  const initialValue = positions.reduce((sum, item) => sum + item.value, 0);
  const monthlyContribution = positions.reduce((sum, item) => sum + item.monthlyContribution, 0);
  let cumulativeContribution = 0;
  let cumulativeDividend = 0;
  let externalDividendCash = 0;
  const yearRows: SimulationYear[] = [];

  const distributeDividend = (totalDividend: number, ownDividends: Map<string, number>) => {
    if (!reinvestment.enabled || totalDividend <= 0) return 0;

    if (reinvestment.mode === 'single') {
      const target = positions.find(position => position.symbol === reinvestment.targetSymbol);
      if (target) {
        target.value += totalDividend;
        return totalDividend;
      }
      return 0;
    }

    if (reinvestment.mode === 'ratio') {
      const rawRatios = positions.map(position => ({
        position,
        ratio: Math.max(0, reinvestment.ratios?.[position.symbol] ?? 0),
      }));
      const ratioTotal = rawRatios.reduce((sum, item) => sum + item.ratio, 0);
      if (ratioTotal > 0) {
        rawRatios.forEach(item => {
          item.position.value += totalDividend * item.ratio / ratioTotal;
        });
        return totalDividend;
      }
      return 0;
    }

    positions.forEach(position => {
      position.value += ownDividends.get(position.symbol) ?? 0;
    });
    return totalDividend;
  };

  for (let year = 1; year <= safeYears; year += 1) {
    const months: SimulationMonth[] = [];
    let annualContribution = 0;
    let annualDividend = 0;
    let annualPnl = 0;

    for (let month = 1; month <= 12; month += 1) {
      let monthDividend = 0;
      let monthPnl = 0;
      const ownDividends = new Map<string, number>();

      positions.forEach(position => {
        const openingValue = position.value;
        const contribution = position.monthlyContribution;
        const investedBase = openingValue + contribution;
        const marketGain = investedBase * monthlyMarketRate;
        const dividend = investedBase * position.monthlyDividendYield;

        position.value = investedBase + marketGain;
        ownDividends.set(position.symbol, dividend);
        monthDividend += dividend;
        monthPnl += marketGain + dividend;
      });

      const reinvestedDividend = distributeDividend(monthDividend, ownDividends);
      if (!reinvestment.enabled || reinvestedDividend <= 0) externalDividendCash += monthDividend;

      cumulativeContribution += monthlyContribution;
      annualContribution += monthlyContribution;
      cumulativeDividend += monthDividend;
      annualDividend += monthDividend;
      annualPnl += monthPnl;

      const estimatedValue = positions.reduce((sum, item) => sum + item.value, 0);
      const cumulativeInvested = initialValue + cumulativeContribution;
      const cumulativePnl = estimatedValue + externalDividendCash - cumulativeInvested;
      const cumulativeReturn = cumulativeInvested > 0 ? cumulativePnl / cumulativeInvested : 0;

      months.push({
        year,
        month,
        monthlyContribution,
        cumulativeContribution,
        cumulativeInvested,
        estimatedValue,
        monthlyDividend: monthDividend,
        reinvestedDividend,
        cumulativeDividend,
        monthlyPnl: monthPnl,
        cumulativePnl,
        cumulativeReturn,
      });
    }

    const lastMonth = months[months.length - 1];
    yearRows.push({
      year,
      annualContribution,
      cumulativeContribution,
      endValue: lastMonth.estimatedValue,
      annualDividend,
      cumulativeDividend,
      annualPnl,
      cumulativePnl: lastMonth.cumulativePnl,
      cumulativeReturn: lastMonth.cumulativeReturn,
      months,
    });
  }

  const finalYear = yearRows[yearRows.length - 1];
  return {
    initialValue,
    monthlyContribution,
    finalValue: finalYear?.endValue ?? initialValue,
    cumulativeContribution,
    cumulativeDividend,
    cumulativePnl: finalYear?.cumulativePnl ?? 0,
    cumulativeReturn: finalYear?.cumulativeReturn ?? 0,
    years: yearRows,
  };
}
