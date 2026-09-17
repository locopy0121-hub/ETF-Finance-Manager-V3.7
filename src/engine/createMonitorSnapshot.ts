import type { Holding } from '../data/portfolio';
import type { DividendEvent } from '../screens/DividendCalendarScreen';
import type { LedgerEntry } from '../v3/model';
import { calculateHoldingView, calculatePortfolioView } from '../v3/engine';
import type { MarketStatus, MonitorSnapshot } from '../types/monitor';

export interface CreateMonitorSnapshotInput {
  holdings: Holding[];
  quotes: Record<string, any>;
  ledger: LedgerEntry[];
  dividends: DividendEvent[];
  cashBalance: number;
  timestamp?: number;
  marketStatus: MarketStatus;
}

/**
 * Single monitor projection point. All monitor consumers receive the same
 * portfolio/holding calculations rather than recalculating independently.
 */
export function createMonitorSnapshot({
  holdings,
  quotes,
  ledger,
  dividends,
  cashBalance,
  timestamp = Date.now(),
  marketStatus,
}: CreateMonitorSnapshotInput): MonitorSnapshot {
  const portfolioSummary = calculatePortfolioView(holdings, quotes, cashBalance, ledger, dividends) as unknown as Record<string, unknown>;
  const etfSummaries: Record<string, Record<string, unknown>> = {};

  for (const holding of holdings) {
    etfSummaries[holding.symbol] = calculateHoldingView(holding, quotes, ledger, dividends) as unknown as Record<string, unknown>;
  }

  for (const [symbol, quote] of Object.entries(quotes)) {
    if (!etfSummaries[symbol]) {
      etfSummaries[symbol] = {
        symbol,
        name: String(quote?.name ?? symbol),
        price: Number(quote?.price ?? 0),
        previousClose: Number(quote?.previousClose ?? quote?.price ?? 0),
        change: Number(quote?.change ?? Number(quote?.price ?? 0) - Number(quote?.previousClose ?? quote?.price ?? 0)),
        changePct: Number(quote?.changePercent ?? 0),
      };
    }
  }

  return {
    timestamp,
    marketStatus,
    portfolioSummary,
    etfSummaries,
    rawQuotes: { ...quotes },
  };
}
