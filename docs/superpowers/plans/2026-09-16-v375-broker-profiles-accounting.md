# V3.7.5 Broker Profiles & Accounting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one public accounting engine with Default/Huanan broker profiles, broker CRUD and bookkeeping broker selection, while deleting only the obsolete 3 TWD reconciliation path.

**Architecture:** `tradeSettings.ts` owns profile types/defaults/resolution and generic fee/tax/net-liquidation helpers. `engine.ts` consumes resolved profiles and contains no Huanan-only accounting branch or write-off adjustment. State/storage own persisted profile lists and stable `brokerProfileId`; UI exposes profile management and transaction selection.

**Tech Stack:** TypeScript, React Native/Expo, Node contract tests, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-v375-broker-profiles-accounting-design.md`

## Global Constraints

- Work only on V3.7/V3.7.x.
- Keep one public accounting formula set; broker differences are parameters/modes only.
- Default Profile preserves current App defaults and is fallback/template.
- Huanan parameters are exactly those in the spec.
- Preserve per-row trade/fee calculations and moving weighted-average cost pools.
- Delete only 3 TWD-specific write-off behavior; preserve Huanan NET accounting.
- Transactions persist stable `brokerProfileId`.
- Shared finance surfaces consume canonical engine results.

---

### Task 1: Contract tests for Broker Profiles and removal of write-off behavior

**Files:**
- Create: `scripts/BROKER_PROFILE_V375_TEST.cjs`
- Modify: `scripts/HUANAN_ACCOUNTING_V375_TEST.cjs`

**Interfaces:**
- Consumes existing source files as text plus runtime arithmetic helpers.
- Produces a red contract that requires Default/Huanan profiles, stable profile ids, generic NET/GROSS mode, CRUD state fields and absence of 3 TWD write-off identifiers/UI.

- [ ] **Step 1: Write failing contract tests** asserting exact Huanan values (`0.001425`, `0.65`, `20`, `0.001`, `0.003`), complete default profile fields, generic mode fields, `brokerProfileId` on transactions/holdings, profile list in V3 state, broker-management/selector source, and absence of `BROKER_COST_WRITEOFF_PREFIX`, `券商成本沖銷`, `現金沖銷`.
- [ ] **Step 2: Run the new test through GitHub Actions and confirm RED** because the current source still has write-off code and lacks full profile state/UI.
- [ ] **Step 3: Keep existing Huanan arithmetic checks for per-row floor, cost pools, NET book value and partial sells; remove assertions that treat a 3 TWD write-off as correct behavior.**
- [ ] **Step 4: Commit tests.**

### Task 2: Broker Profile domain and generic accounting helpers

**Files:**
- Modify: `src/data/tradeSettings.ts`

**Interfaces:**
- Produces `BrokerProfile`, `BrokerProfileId`, `defaultBrokerProfile`, `huananYongchangBrokerProfile`, `createBrokerProfileFromDefault`, `resolveBrokerProfile`, `applyRounding`, `estimateCommissionQuote`, `estimateSellTaxByProfile`, `estimateBrokerBookValue`.
- Keeps compatibility exports for existing `FeeSettings` call sites while migration is in progress.

- [ ] **Step 1: Run contract and confirm it is still RED.**
- [ ] **Step 2: Add full profile type and Default/Huanan constants from spec.**
- [ ] **Step 3: Add clone/normalize/resolve helpers and generic rounding/tax/net-liquidation helpers.**
- [ ] **Step 4: Preserve old function names as compatibility adapters where necessary.**
- [ ] **Step 5: Run profile contract; expect profile-domain assertions GREEN while UI/state assertions remain RED.**
- [ ] **Step 6: Commit domain changes.**

### Task 3: Remove 3 TWD reconciliation and make engine profile-driven

**Files:**
- Modify: `src/v3/engine.ts`
- Verify: `src/v3/engineBase.ts`

**Interfaces:**
- Consumes `resolveBrokerProfile` and profile modes.
- Produces canonical holding/portfolio metrics with GROSS/NET selected by profile, no broker-name special accounting and no cost-write-off adjustment.

- [ ] **Step 1: Add/adjust test assertions for GROSS versus NET market-value basis and no write-off identifiers.**
- [ ] **Step 2: Confirm RED on current engine.**
- [ ] **Step 3: Delete write-off prefix/functions and adjustment wrapper; use `Base.positionCostStats` directly.**
- [ ] **Step 4: Replace `isHuanan` accounting branch with profile fields (`unrealizedPLMode`, rounding/display settings, estimated fee/tax flags).**
- [ ] **Step 5: Aggregate portfolio from canonical holding metrics without write-off adjustments.**
- [ ] **Step 6: Run accounting/profile contracts.**
- [ ] **Step 7: Commit engine changes.**

### Task 4: Persist broker profiles and stable transaction binding

**Files:**
- Modify: `src/data/portfolio.ts`
- Modify: `src/v3/model.ts`
- Modify: `src/v3/storage.ts`

**Interfaces:**
- `Holding.brokerProfileId?: string`.
- `LedgerEntry.brokerProfileId?: string`.
- `V3State.brokerProfiles: BrokerProfile[]` with migration/default normalization.

- [ ] **Step 1: Add state/storage contract assertions and confirm RED.**
- [ ] **Step 2: Add optional stable profile id to holding and ledger types.**
- [ ] **Step 3: Add broker profile array to state default/migration, ensuring Default and Huanan profiles are normalized and legacy states continue loading.**
- [ ] **Step 4: Ensure missing/deleted ids resolve to Default Profile rather than NaN/empty parameters.**
- [ ] **Step 5: Run contract and TypeScript check workflow.**
- [ ] **Step 6: Commit state/storage migration.**

### Task 5: Broker management CRUD and bookkeeping selector

**Files:**
- Modify: `src/v3/screens.tsx`
- Modify only targeted ranges if required: `src/v3/screensBase.tsx`

**Interfaces:**
- Settings exposes broker profiles sourced from state and callbacks to create/update/delete.
- New broker clones `defaultBrokerProfile` before edits.
- Bookkeeping selector writes `brokerProfileId` and display broker name into new transactions.

- [ ] **Step 1: Add UI contract assertions and confirm RED.**
- [ ] **Step 2: Remove Huanan write-off modal/button entirely.**
- [ ] **Step 3: Add broker management UI supporting add/edit/delete with all profile fields prefilled from Default.**
- [ ] **Step 4: Add broker dropdown to bookkeeping input and persist stable id on ledger entries.**
- [ ] **Step 5: Ensure profile add/rename/delete immediately changes selector options; Default remains available.**
- [ ] **Step 6: Run UI contract and TypeScript check.**
- [ ] **Step 7: Commit UI changes.**

### Task 6: Rewrite Huanan/accounting regression suite

**Files:**
- Modify: `scripts/HUANAN_ACCOUNTING_V375_TEST.cjs`
- Modify/Create workflow if needed: `.github/workflows/huanan-v375-tdd.yml`

**Interfaces:**
- Produces repeatable CI checks for the approved public formulas and profile behavior.

- [ ] **Step 1: Remove 3 TWD write-off expectations.**
- [ ] **Step 2: Verify per-buy floor/fee aggregation, moving-average partial sell, sell net proceeds, realized cash P/L, today P/L, dividends/comprehensive P/L, profile NET/GROSS behavior, and portfolio totals.**
- [ ] **Step 3: Run all accounting/profile tests plus `tsc --noEmit`.**
- [ ] **Step 4: Commit regression suite.**

### Task 7: Full V3.7 verification and Android build

**Files:**
- Verify existing `package.json`, workflow and Android build configuration.
- No unrelated feature edits.

**Interfaces:**
- Produces CI evidence and an APK artifact from the feature branch.

- [ ] **Step 1: Run broker/accounting tests, existing finance regressions and TypeScript verification.**
- [ ] **Step 2: Fix only failures caused by this change and rerun until green.**
- [ ] **Step 3: Dispatch the existing Android APK build workflow against `v3.7.5-broker-profiles-20260916`.**
- [ ] **Step 4: Verify build conclusion and artifact metadata.**
- [ ] **Step 5: Record final commit SHA and build run/artifact result.**
