# Global Huanan Finance Core Design

## Goal

Replace every legacy finance calculation path in ETF Finance Manager with one global Huanan Yongchang accounting standard. Legacy gross/default/profile-specific calculation branches must not remain as runtime fallbacks.

## Approved accounting semantics

The finance core has fixed meanings. A field name must never change meaning because of broker selection.

- Trade amount: `floor(price * shares)` per transaction row, then aggregate rows.
- Buy cash cost: `tradeAmount + buyFee`.
- Current trade cost: remaining moving-weighted trade-cost pool.
- Current allocated buy fee: remaining moving-weighted buy-fee pool.
- Current fee-inclusive cost: `currentTradeCost + currentAllocatedBuyFees`.
- Gross market value: `livePrice * currentShares`. This is the only meaning of `marketValue`.
- Estimated book income: gross market value minus Huanan estimated sell commission and ETF/stock transaction tax.
- Unrealized P/L: estimated book income minus current fee-inclusive cost.
- Unrealized ROI: unrealized P/L divided by current fee-inclusive cost.
- Realized P/L: actual sell net proceeds minus the released fee-inclusive moving-average cost.
- Today P/L: `(livePrice - previousClose) * currentShares`.
- Comprehensive P/L: unrealized P/L + realized P/L + cumulative dividends.
- Total assets: gross market value + cash balance. Book income must never replace market value in total assets.

## Huanan fee/tax standard

The application has one finance standard, not broker-dependent formulas. The Huanan Yongchang parameters already verified in V3.7.5 are the global constants used by finance calculations:

- Commission rate: `0.001425`.
- Commission discount: `0.65`.
- Minimum commission: `20` where the Huanan commission rule is applicable.
- ETF sell tax rate: `0.001`.
- Stock sell tax rate: `0.003`.
- Commission/tax currency rounding follows the existing Huanan helper behavior.

Broker/account names remain metadata only. They must not select a different finance algorithm.

## Runtime architecture

`src/v3/engineBase.ts` remains the cost-pool implementation for transaction history. `src/v3/engine.ts` becomes the single public finance engine and must always use the Huanan finance standard. `src/data/tradeSettings.ts` may preserve compatibility types and broker metadata, but no runtime calculation path may switch formulas by BrokerProfile.

`marketValue` is always gross market value. A separate explicit value such as `bookIncome`/`netLiquidationValue` carries estimated sell-net value. UI, widgets, overlays, notifications, snapshots, and portfolio aggregation consume the same engine outputs.

## Legacy removal rules

Remove or make unreachable as algorithm selectors all legacy `GROSS`/`gross`/per-profile finance branches. Remove default-profile fallback as a finance-calculation fallback. Old persisted broker profile IDs must not change arithmetic. Data migration may preserve broker/account labels, but must not preserve old calculation behavior.

No special 3 TWD reconciliation, broker write-off, or hidden balancing adjustment is introduced.

## Acceptance examples

For any holding:

`marketValue = livePrice * shares`

`bookIncome = marketValue - estimatedSellFee - estimatedSellTax`

`unrealizedPnl = bookIncome - currentCashBasis`

`unrealizedRoi = unrealizedPnl / currentCashBasis * 100`

The 00878 real-device regression fixture must use the verified 64-share case and assert that market value and book income remain distinct fields. The test must also prove that broker profile ID/name changes do not alter the arithmetic.

## Global acceptance

The same numbers must be returned for Dashboard, Portfolio, ETF Detail, Daily P/L, Widget, Overlay, notification payloads, and snapshots when they refer to the same account state. No component may reimplement a different market-value or P/L formula.