# Huanan Canonical Finance Core Implementation Plan

> **For agentic execution:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Apply superpowers:test-driven-development for every behavior change and superpowers:verification-before-completion before claiming completion.

**Goal:** Rebuild the Huanan Yongchang accounting path around one canonical finance core so Portfolio, Home, Widget, Overlay, snapshots, formulas, and custom metrics consume the same precomputed financial results without duplicate fee/tax/PnL constants or calculations.

**Architecture:** `src/utils/etfCalculators.ts` remains the only financial calculation module. `src/types/etf.ts` owns the canonical immutable Huanan constants and finance result contracts. `src/v3/engine.ts` is the adapter from application ledger/holdings/dividend records into the canonical core; it may format/aggregate non-financial display data but may not reimplement buy/sell/dividend/unrealized/realized/total-PnL formulas. Broker Profiles become metadata/resolvers that reference the canonical constants rather than a second financial-rule source.

**Tech Stack:** TypeScript 6, React Native / Expo 57, Node 22 contract-test scripts, GitHub Actions.

---

## Task 1: Add failing canonical finance contract tests

**Files:**
- Create: `scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs`
- Modify: `package.json`

**Step 1: Write failing tests for canonical constants and one-source rule**

Assert that `src/types/etf.ts` defines exactly these canonical values and that `src/data/brokerProfiles.ts` imports/reuses them instead of redeclaring numeric finance constants:

```js
assert.match(types, /COMMISSION_DISCOUNT:\s*0\.65/);
assert.match(types, /STOCK_SELL_TAX_RATE:\s*0\.003/);
assert.match(types, /DIVIDEND_REMITTANCE_FEE:\s*10/);
assert.ok(!/commissionDiscount:\s*1\b/.test(brokers));
```

**Step 2: Add behavior assertions for transaction-level floor rules**

Cover:
- `floor(price * shares)` for buy/sell/current market value.
- odd-lot minimum fee = 1.
- round-lot minimum fee = 20.
- discounted commission = `floor(amount * 0.001425 * 0.65)`.
- ETF tax = `floor(amount * 0.001)`.
- stock tax = `floor(amount * 0.003)`.

**Step 3: Add behavior assertions for dividend rules**

Cover:
- `grossDividend = floor(perShare * eligibleShares)`.
- gross `< 20,000`: NHI = 0.
- gross `>= 20,000`: NHI = `floor(gross * 0.0211)`.
- every effective dividend deducts 10 remittance fee.
- net dividend never falls below 0.

**Step 4: Add behavior assertions for moving-average sale and total PnL**

Cover:
- partial sale releases fee-inclusive moving-average cost.
- realized PnL = net sell proceeds − released fee-inclusive cost.
- unrealized PnL = net liquidation value − remaining fee-inclusive cost.
- total PnL = unrealized + realized + net dividends.

**Step 5: Register the contract test**

Add `test:huanan-core` and include it in the relevant V3.7 verification command.

**Step 6: Run RED verification**

Run:

```bash
node scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs
```

Expected: FAIL on at least the missing remittance fee, missing stock tax canonical constant, duplicate Broker Profile constants, current-value floor, and/or `totalPnl` binding.

**Step 7: Commit**

```bash
git add scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs package.json
git commit -m "test(finance): lock Huanan canonical core contract"
```

## Task 2: Make finance constants and result contracts canonical

**Files:**
- Modify: `src/types/etf.ts`
- Modify: `src/data/brokerProfiles.ts`

**Step 1: Extend `HUANAN_CONFIG`**

Canonical fields must include:

```ts
COMMISSION_RATE: 0.001425,
COMMISSION_DISCOUNT: 0.65,
MIN_COMMISSION_ROUND_LOT: 20,
MIN_COMMISSION_ODD_LOT: 1,
ETF_SELL_TAX_RATE: 0.001,
STOCK_SELL_TAX_RATE: 0.003,
HEALTH_PREMIUM_THRESHOLD: 20_000,
HEALTH_PREMIUM_RATE: 0.0211,
DIVIDEND_REMITTANCE_FEE: 10,
```

**Step 2: Expand finance result contracts**

Add canonical sell/realized fields needed by the app adapter, including realized PnL and portfolio comprehensive totals, without forcing consumers to recompute them.

**Step 3: Remove Broker Profile as a numeric rule source**

`brokerProfiles.ts` may preserve IDs/names/resolution for persisted settings, but built-in Huanan/default profiles must derive financial values from `HUANAN_CONFIG`; no independent 1.0 discount, alternate tax/minimum fee, or GROSS unrealized mode may remain in the canonical Huanan execution path.

**Step 4: Run contract test**

```bash
node scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs
```

Expected: constants section advances; behavioral sections may still fail until Task 3.

**Step 5: Commit**

```bash
git add src/types/etf.ts src/data/brokerProfiles.ts
git commit -m "refactor(finance): centralize Huanan constants"
```

## Task 3: Implement all financial formulas in the canonical core

**Files:**
- Modify: `src/utils/etfCalculators.ts`

**Step 1: Canonicalize buy calculation**

Implement:

```ts
tradeAmount = Math.floor(price * shares);
commission = Math.max(minFee, Math.floor(tradeAmount * 0.001425 * 0.65));
settlementAmount = tradeAmount + commission;
```

`TradeMode` is mandatory and never inferred from share count.

**Step 2: Add canonical sell calculation**

Return gross sell amount, commission, tax, net proceeds, released fee-inclusive cost, and realized PnL. Instrument tax rate must be selected from canonical ETF/stock rates.

**Step 3: Canonicalize moving-average inventory**

Process transactions in date/id order. Buys add fee-inclusive settlement cost. Partial sells release:

```ts
avgCostBeforeSell = totalCostBeforeSell / sharesBeforeSell;
releasedCost = avgCostBeforeSell * sellShares;
remainingCost = totalCostBeforeSell - releasedCost;
```

Do not reduce inventory cost by sell cash proceeds.

**Step 4: Canonicalize current valuation**

Implement:

```ts
currentMarketValue = Math.floor(currentPrice * shares);
estimatedSellFee = canonicalCommission(currentMarketValue, liquidationTradeMode);
estimatedSellTax = canonicalTax(currentMarketValue, instrumentType);
netLiquidationValue = currentMarketValue - estimatedSellFee - estimatedSellTax;
unrealizedProfit = netLiquidationValue - remainingFeeInclusiveCost;
```

**Step 5: Canonicalize dividends**

Implement gross floor, NHI threshold/floor, 10 TWD remittance fee for every positive dividend, and `Math.max(0, ...)` net.

**Step 6: Canonicalize ETF and portfolio comprehensive totals**

Each ETF summary exports realized PnL, net dividends, unrealized PnL, and comprehensive/total PnL. Portfolio summary aggregates those exact summary fields rather than rebuilding formulas in UI adapters.

**Step 7: Run GREEN verification**

```bash
node scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs
```

Expected: PASS for core formulas.

**Step 8: Commit**

```bash
git add src/utils/etfCalculators.ts
git commit -m "refactor(finance): implement canonical Huanan calculations"
```

## Task 4: Reduce the V3 engine to an application adapter

**Files:**
- Modify: `src/v3/engine.ts`
- Modify: `src/v3/model.ts` only if additional canonical persisted fields are required

**Step 1: Preserve `TradeMode` end-to-end**

Ledger → canonical transaction conversion must require persisted `tradeMode`; no share-count inference or fallback.

**Step 2: Delete duplicated finance calculation paths**

Remove/rewrite engine helpers that independently calculate:
- commission/tax/net sale proceeds,
- released cost,
- realized PnL,
- cumulative dividend deductions,
- comprehensive PnL.

Replace them with canonical finance-core outputs.

**Step 3: Fix public view bindings**

Ensure:

```ts
unrealizedPnl = canonical.totalUnrealizedProfit;
realizedPnl = canonical.totalRealizedProfit;
cumulativeDividends = canonical.totalNetDividends;
totalPnl = canonical.totalPnl;
```

`totalPnl` must never point to `totalUnrealizedProfit`.

**Step 4: Keep non-financial display calculations separate**

Intraday/today PnL and formatting may remain in the adapter when they do not duplicate canonical accounting rules.

**Step 5: Run tests and typecheck**

```bash
node scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs
npm run typecheck
```

**Step 6: Commit**

```bash
git add src/v3/engine.ts src/v3/model.ts
git commit -m "refactor(finance): consume canonical core from V3 engine"
```

## Task 5: Rebind global consumers to canonical output

**Files:**
- Modify: `src/v3/globalMetrics.ts`
- Inspect/modify only where necessary: `src/v3/formulaEngine.ts`
- Inspect/modify only where necessary: `src/services/dailySnapshots.ts`
- Inspect/modify only where necessary: `src/services/floatingOverlay.ts`
- Inspect/modify only where necessary: `src/widgets/ProfitWidget.tsx`
- Inspect/modify only where necessary: `src/widgets/syncWidget.tsx`
- Inspect/modify only where necessary: `src/widgets/widgetTaskHandler.tsx`
- Inspect/modify only where necessary: `src/v3/screensBase.tsx`

**Step 1: Global metric envelopes**

Expose distinct `unrealizedPnl`, `realizedPnl`, `netDividends`, and `totalPnl/comprehensivePnl` from the engine's canonical result. Update formula labels to state net-liquidation basis.

**Step 2: Formula/custom-field engine**

Ensure finance variables are only sourced from `buildGlobalMetrics` / canonical view output. Remove direct accounting arithmetic if present.

**Step 3: Snapshot/chart consumers**

Persist/read canonical totals; do not recalculate fees, taxes, dividend deductions, unrealized PnL, or total PnL.

**Step 4: Widget/Overlay consumers**

Bind displayed market value, unrealized PnL, realized PnL, dividends, and total PnL to shared metrics/canonical results. No independent constants/formulas.

**Step 5: Portfolio/Home consumers**

Use canonical view fields; remove any independent financial arithmetic found during audit.

**Step 6: Run static zero-duplicate audit**

Extend the contract test to reject duplicate literals/formulas outside the canonical constants/core where they would create a second accounting rule source.

**Step 7: Commit**

```bash
git add src/v3/globalMetrics.ts src/v3/formulaEngine.ts src/services/dailySnapshots.ts src/services/floatingOverlay.ts src/widgets src/v3/screensBase.tsx scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs
git commit -m "refactor(finance): bind global consumers to canonical results"
```

## Task 6: Regression and acceptance verification

**Files:**
- Modify as needed: `scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs`
- Modify as needed: existing Huanan/zero-legacy regression scripts that encode superseded profile assumptions

**Step 1: Run canonical contract**

```bash
node scripts/HUANAN_CANONICAL_FINANCE_CORE_TEST.cjs
```

**Step 2: Run existing Huanan zero-legacy contracts**

```bash
node scripts/BREAKING_HUANAN_CORE_TEST.cjs
node scripts/FINAL_ZERO_LEGACY_TEST.cjs
```

Update obsolete assertions only where the approved 2026-09-17 design explicitly supersedes them.

**Step 3: Run TypeScript**

```bash
npm run typecheck
```

**Step 4: Run applicable V3.7 verification suite**

```bash
npm run check:v370
```

Record any pre-existing failures separately from regressions introduced by this branch.

**Step 5: Diff integrity and source audit**

```bash
git diff --check
grep -R "0\.001425\|0\.0211\|0\.003\|0\.001\|commissionDiscount" src --exclude=etf.ts --exclude=etfCalculators.ts
```

Any remaining hit must be presentation/documentation-only or derive from `HUANAN_CONFIG`; no independent finance rule may remain.

**Step 6: Verify no build/release action was performed**

APK/OTA is outside this task unless the user separately issues `GOGO`.

**Step 7: Final commit**

```bash
git add -A
git commit -m "test(finance): verify canonical Huanan finance core"
```
