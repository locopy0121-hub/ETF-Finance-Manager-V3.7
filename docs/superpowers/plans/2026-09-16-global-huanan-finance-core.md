# Global Huanan Finance Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all legacy finance calculation branches with one global Huanan Yongchang accounting core and make every consumer use the same fixed financial semantics.

**Architecture:** `src/v3/engineBase.ts` remains the transaction/cost-pool primitive layer. `src/data/tradeSettings.ts` becomes compatibility metadata plus one immutable Huanan calculation standard; broker profile identity no longer selects arithmetic. `src/v3/engine.ts` becomes the sole finance calculation surface: `marketValue` is always gross market value, `bookIncome` is sell-net estimated income, and unrealized P/L always uses `bookIncome - currentCashBasis`. Global consumers must consume engine outputs instead of locally recomputing a conflicting formula.

**Tech Stack:** TypeScript, React Native/Expo, Node contract tests, GitHub Actions Android build.

**Spec:** `docs/superpowers/specs/2026-09-16-global-huanan-finance-core-design.md`

## Global Constraints

- Huanan Yongchang is the only runtime finance standard.
- Legacy GROSS/gross/default-profile arithmetic must not remain as a runtime fallback.
- `marketValue = livePrice * currentShares` everywhere.
- `bookIncome = marketValue - estimatedSellFee - estimatedSellTax`.
- `unrealizedPnl = bookIncome - currentCashBasis`.
- Broker/account fields are metadata only and must not alter arithmetic.
- Existing data can be migrated for compatibility, but legacy calculation behavior must not survive.
- No 3 TWD reconciliation or hidden balancing adjustment.

---

### Task 1: Lock one global Huanan calculation standard

**Files:**
- Modify: `src/data/tradeSettings.ts`
- Test: `scripts/GLOBAL_HUANAN_FINANCE_CORE_TEST.cjs`

**Interfaces:**
- Consumes: persisted `BrokerProfile`/`FeeSettings` values for compatibility.
- Produces: `HUANAN_FINANCE_STANDARD`, Huanan-only fee/tax estimators, compatibility resolvers that preserve labels/IDs but always return Huanan arithmetic parameters.

- [ ] Write a failing contract test proving arbitrary broker/profile inputs cannot change commission rate, discount, minimum commission, ETF tax, stock tax, NET behavior, or display truncation.
- [ ] Run the contract test and verify the existing profile-dependent code fails it.
- [ ] Replace default/gross runtime arithmetic with the Huanan standard while retaining compatibility shapes required by existing state/UI.
- [ ] Re-run the contract test and verify it passes.
- [ ] Commit the finance-standard change.

### Task 2: Give every finance field one fixed meaning

**Files:**
- Modify: `src/v3/engine.ts`
- Test: `scripts/GLOBAL_HUANAN_FINANCE_CORE_TEST.cjs`

**Interfaces:**
- `holdingMetrics(...).marketValue`: gross market value only.
- `holdingMetrics(...).bookIncome`: estimated sell-net amount.
- `holdingMetrics(...).pnl`: `bookIncome - currentCashBasis`.
- `holdingMetrics(...).roi`: Huanan display-truncated ROI.
- `portfolioMetrics(...).marketValue`: sum of gross market values.
- `portfolioMetrics(...).bookIncome`: sum of book income.
- `portfolioMetrics(...).totalAssets`: gross market value + cash.

- [ ] Add failing source/runtime contract assertions for fixed field semantics and removal of `useNet`/GROSS switching.
- [ ] Remove `legacySettingsProfile`, profile-selected market-value mode, and broker-selected P/L mode from runtime arithmetic.
- [ ] Keep broker metadata outputs only for display/data compatibility.
- [ ] Verify portfolio aggregation uses gross market value for total assets and Huanan book income for unrealized P/L.
- [ ] Run tests and commit.

### Task 3: Remove local conflicting P/L calculations from global consumers

**Files:**
- Modify: `src/services/floatingOverlay.ts`
- Modify: `src/widgets/ProfitWidget.tsx`
- Modify: `App.tsx` only if needed to pass canonical engine snapshots to widget consumers.
- Test: `scripts/GLOBAL_HUANAN_FINANCE_CORE_TEST.cjs`

**Interfaces:**
- Overlay fields `marketValue`, `instantPnl`, `instantRoi`, and portfolio totals come from the canonical engine.
- Widget totals and single-ETF P/L must use canonical engine-provided values rather than `marketValue - currentCashBasis` recomputation.

- [ ] Add failing assertions detecting local gross unrealized formulas in overlay/widget code.
- [ ] Replace overlay use of `priceUnrealizedPnl` and locally derived ROI with canonical `totalPnl`/`totalRoi` and per-holding engine metrics.
- [ ] Extend widget snapshot/extras only as much as necessary so single-symbol and portfolio modes use canonical Huanan P/L.
- [ ] Run tests and commit.

### Task 4: Add the real 00878 regression fixture and remove obsolete profile tests

**Files:**
- Create/Modify: `scripts/GLOBAL_HUANAN_FINANCE_CORE_TEST.cjs`
- Modify or remove assumptions in: `scripts/HUANAN_ACCOUNTING_V375_TEST.cjs`
- Modify or replace assumptions in: `scripts/BROKER_PROFILE_V375_TEST.cjs`
- Modify: `package.json` scripts if needed.

**Interfaces:**
- Fixture: 00878, 64 shares, live price 34.47, fee-inclusive cost 2100.
- Must assert gross market value remains distinct from book income.
- Must assert changing broker profile ID/name does not change arithmetic.

- [ ] Add the real-device 00878 regression case.
- [ ] Replace tests that require App Default/GROSS behavior with assertions that legacy arithmetic no longer exists.
- [ ] Run all finance/accounting contract tests.
- [ ] Run TypeScript validation.
- [ ] Commit.

### Task 5: Build and verify the Android artifact

**Files:**
- Existing workflow: `.github/workflows/build-android-apk.yml`

**Interfaces:**
- Input branch: `v3.7.6-global-huanan-core-20260916`.
- Output: signed ARM64 Android APK artifact.

- [ ] Trigger the existing Android APK workflow on the implementation branch.
- [ ] Wait for completion and verify the workflow result is success.
- [ ] Verify an APK artifact exists and record its artifact ID/name.
- [ ] Report only verified commit/build/artifact facts.