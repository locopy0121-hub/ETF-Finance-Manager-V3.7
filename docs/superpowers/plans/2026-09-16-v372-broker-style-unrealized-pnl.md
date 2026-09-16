# V3.7.2 Broker-Style Unrealized PnL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Put the broker-style open-position PnL formula into the shared V3 accounting engine so App screens, Widget, monitor, snapshots, and notifications consume one result.

**Architecture:** Keep gross market value separate from broker-style net liquidation value. Current open-position PnL uses net liquidation value after estimated sell commission and ETF transaction tax, while historical buy cost continues to use stored per-trade purchase amount and buy fee. The active broker fee settings are configured once per runtime from V3 state and reused by the shared engine.

**Tech Stack:** React Native / Expo SDK 57, TypeScript, Node contract scripts, GitHub Actions, EAS local Android build.

**Spec:** Conversation decision 2026-09-16: ignore broker split-order rounding discussion; focus only on placing the formula into the App.

## Global Constraints

- Preserve V3.7.2 / versionCode 40.
- Do not change historical Ledger fee/tax values.
- Do not change gross `marketValue`; add/use net liquidation only for broker-style unrealized PnL.
- Three confirmed sample fixtures: 0050 (106.90 × 32, cost 3340), 元大高股息 (55.55 × 40, cost 2150), 元大台灣高息低波 (64.40 × 31, cost 1913).
- Keep all consumers on the shared `holdingMetrics` / `portfolioMetrics` engine.

---

### Task 1: RED accounting contract

**Files:**
- Modify: `scripts/ACCOUNTING_CONTRACT_TEST.cjs`

- [x] Add source-contract assertions requiring broker fee configuration, estimated exit charges, net liquidation value, and PnL based on net liquidation.
- [x] Add the three confirmed sample fixtures.
- [ ] Run GitHub Actions and verify failure is caused by the missing new source contract.

### Task 2: Shared accounting engine

**Files:**
- Modify: `src/v3/engine.ts`
- Modify: `App.tsx`
- Modify: `src/widgets/widgetTaskHandler.tsx`
- Modify: `src/services/backgroundCloseTask.ts`

- [ ] Add `configureAccountingFeeSettings` and `estimatedExitCharges`.
- [ ] In `holdingMetrics`, calculate `cashPnl` and default `pnl` from net liquidation value minus current cash basis.
- [ ] In `portfolioMetrics`, sum estimated exit fees/taxes/net liquidation and calculate `cashUnrealizedPnl` from net liquidation minus current cash basis.
- [ ] Configure active `feeSettings` in App, widget background runtime, and close-snapshot background runtime.

### Task 3: GREEN verification and APK

**Files:**
- Verify existing regression scripts and Android workflow.

- [ ] Run accounting contracts, finance regression, TypeScript, and source diff integrity.
- [ ] Build signed ARM64 V3.7.2 APK through the existing GitHub Actions/EAS pipeline.
- [ ] Verify package, versionName 3.7.2, versionCode 40, signature, bundle, SHA256, and artifact upload.
