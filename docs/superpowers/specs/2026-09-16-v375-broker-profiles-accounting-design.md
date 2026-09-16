# V3.7.5 Broker Profiles & Accounting Design

## Scope

This design is the approved V3.7/V3.7.x accounting contract. V4 is out of scope.

## Core principle

There is exactly one public accounting engine. Default and broker-specific modes share the same formulas; a Broker Profile supplies parameters and presentation/accounting-mode switches. No broker gets a parallel accounting engine.

If a transaction/holding does not specify a broker, use the App Default Profile. If it specifies a broker, resolve that Broker Profile and run the same accounting engine with that profile.

## Public formulas

### Trade and fees

- Trade amount = `floor(price * shares)`.
- Commission = `max(minimumCommission, floor(tradeAmount * commissionRate * commissionDiscount))` for instant-discount mode.
- Buy cash cost = trade amount + buy commission.
- ETF sell tax = `floor(sellTradeAmount * etfSellTaxRate)`.
- Stock sell tax = `floor(sellTradeAmount * stockSellTaxRate)`.
- Sell net proceeds = sell trade amount - sell commission - sell tax.

### Multi-buy cost pools

Each buy row is calculated independently before aggregation. Preserve original transaction rows.

- Historical/current trade-cost pool = sum of per-row trade amounts remaining after sells.
- Historical/current buy-fee pool = sum of per-row buy fees remaining after sells.
- Fee-inclusive basis = trade-cost pool + buy-fee pool.
- Do not reconstruct historical cost from `average price * total shares`.

### Partial sells

Use moving weighted average allocation with high precision internally.

- Average trade cost/share = pre-sell trade-cost pool / pre-sell shares.
- Average buy fee/share = pre-sell buy-fee pool / pre-sell shares.
- Released trade cost = sold shares * average trade cost/share.
- Released buy fee = sold shares * average buy fee/share.
- Remaining pools = pre-sell pools - released amounts.

### Unrealized P/L

- Gross market value = live price * current shares.
- Estimated sell trade amount = `floor(live price * current shares)`.
- `GROSS` mode uses gross market value as the unrealized market-value basis.
- `NET` mode uses net liquidation value: estimated sell trade amount - estimated sell commission - estimated sell tax.
- Unrealized P/L = selected market-value basis - current fee-inclusive basis.
- ROI = unrealized P/L / current fee-inclusive basis * 100.

### Today P/L

- Previous value = previous close * current shares.
- Today P/L = (live price - previous close) * current shares.
- Today P/L % = today P/L / previous value * 100.

### Realized P/L

- Realized price P/L = sell trade amount - released trade cost.
- Realized cash P/L = sell net proceeds - released trade cost - released buy fee.

### Dividends and comprehensive P/L

- Cumulative dividends = sum of confirmed received dividends.
- Cost yield = cumulative dividends / current fee-inclusive basis * 100.
- Comprehensive P/L = unrealized P/L + realized cash P/L + cumulative dividends.
- Comprehensive ROI = comprehensive P/L / historical cash outflow * 100.

### Portfolio totals

Portfolio values are sums of holding-level canonical results. Total assets/account equity = portfolio market-value basis + cash balance.

## Rounding/display rules

Profiles parameterize transaction, fee and tax rounding. Current contract uses `floor` for trade amount, commission and tax. Display truncation is separate from internal high-precision cost pools.

## App Default Profile

The current App accounting parameters are the default profile. It remains the fallback and the template for newly created broker profiles. No broker selection means Default Profile.

## Huanan Yongchang Profile

```ts
{
  id: 'huanan-yongchang',
  name: '華南永昌證券',
  commissionRate: 0.001425,
  commissionDiscount: 0.65,
  minimumCommission: 20,
  etfSellTaxRate: 0.001,
  stockSellTaxRate: 0.003,
  tradeAmountRounding: 'floor',
  commissionRounding: 'floor',
  taxRounding: 'floor',
  costPoolMethod: 'movingWeightedAverage',
  avgCostDisplayMode: 'truncate',
  avgCostDigits: 2,
  roiDisplayMode: 'truncate',
  roiDigits: 2,
  unrealizedPLMode: 'NET',
  marketValueMode: 'netLiquidation',
  includeEstimatedSellFee: true,
  includeEstimatedSellTax: true,
  truncateRule: 'TRUNCATE_2_DECIMALS'
}
```

## Broker management

Settings must provide broker Profile CRUD. New profiles clone every Default Profile field first, then the user edits differences. Default Profile itself remains available as the fallback baseline.

Deleting a custom profile must not delete historical trades. If a stored profile id cannot be resolved, calculations fall back safely to Default Profile.

## Transaction binding

The bookkeeping page broker field is a dropdown sourced from broker management. Each transaction stores a stable `brokerProfileId` in addition to optional broker display text. Added/renamed/deleted profiles update the selector source.

## 3 TWD discrepancy exclusion

The broker-side 3 TWD discrepancy is explicitly excluded from App accounting. Remove all dedicated +3/-3, cash/cost write-off, tagged write-off ledger entries, and UI created only to reconcile that discrepancy. This exclusion does not remove Huanan Profile behavior, NET liquidation calculations, or Huanan parameters.

## Shared result requirement

Dashboard, bookkeeping, portfolio, ETF detail, today P/L, dividends, total assets, widget, overlay/monitor, and other finance cards must consume the common engine result rather than maintain independent accounting formulas.
