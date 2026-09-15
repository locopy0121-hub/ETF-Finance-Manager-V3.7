# ETF財務管家 V3.7.3 Master Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 V3.7.3 全局整合，收斂金融一致性、監視器模板/單項目 target、色盤 commit 流程、Daily/Dividend 空白卡與 APK 驗收。

**Architecture:** 保留現有 Ledger/Finance Engine，新增 canonical snapshot contract；監視器以 template schema + field style contract 驅動 Native renderer；Universal Editor/Monitor editor 共用 staged color palette；加入 deterministic acceptance audit。原生與 JS 變更一起進 V3.7.3 APK。

**Tech Stack:** React Native / Expo SDK 57 / TypeScript / Kotlin Android Overlay / Node.js audits / GitHub Actions / EAS Android APK.

**Spec:** `docs/superpowers/specs/2026-09-16-v373-master-integration-design.md`

## Global Constraints
- Production package 維持 `com.etfpilot.twselive`。
- 版本升級為 3.7.3；Android versionCode 41。
- 買進/賣出/移動平均/股息/現金帳務既有正確行為不得回歸。
- 同一問題最多兩次修復嘗試；第二次仍失敗即停止該策略並改走 root-cause 路線。
- 不以 regex/字串存在當作唯一 PASS；至少新增具體資料流與 target contract 驗收。

---

### Task 1: Acceptance tests first
**Files:**
- Create: `scripts/V373_MASTER_ACCEPTANCE.cjs`
- Create: `scripts/MONITOR_TEMPLATE_CONTRACT_TEST.cjs`
- Create: `scripts/COLOR_PALETTE_CONTRACT_TEST.cjs`
- Modify: `.github/workflows/build-android-apk.yml`

**Interfaces:**
- Consumes: source files and app/android metadata.
- Produces: deterministic release gate commands.

- [ ] Write failing source-contract tests for template target routing, template composition, palette staged commit, Mini safe visibility, Native canonical totalAssets, version 3.7.3/41.
- [ ] Run tests in CI before implementation and confirm expected failures.
- [ ] Keep accounting golden/cash contracts in the gate.

### Task 2: Canonical finance snapshot and Overlay totals
**Files:**
- Modify: `src/v3/engine.ts`
- Modify: `src/services/floatingOverlay.ts`
- Modify: `modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt`
- Test: existing accounting tests + `V373_MASTER_ACCEPTANCE.cjs`

**Interfaces:**
- Produces payload keys `cashBalance`, `marketValue`, `totalAssets`, `instantPnl`, `todayPnl` from JS canonical snapshot.
- Native quote refresh may update quote-derived position values but recomputes totalAssets as refreshed marketValue + canonical cashBalance, never marketValue alone.

- [ ] Add failing negative-cash totalAssets regression.
- [ ] Remove cash clamp in JS portfolio totalAssets.
- [ ] Pass canonical cashBalance through overlay payload.
- [ ] Fix Native refresh aggregation.
- [ ] Run accounting + canonical tests.

### Task 3: Monitor template model and target router
**Files:**
- Modify: `src/v3/monitorTemplates.ts`
- Modify: `src/v3/monitoring.ts`
- Modify: `src/v3/screens.tsx`
- Test: `MONITOR_TEMPLATE_CONTRACT_TEST.cjs`

**Interfaces:**
- `MonitorTemplate` exposes id/name/fields/columns/compact/nativeMode.
- Settings template buttons open/select template without becoming Universal Editor button nodes.
- Template editor surface displays actual template composition and allows applying/resetting composition.

- [ ] Add failing test for 12 templates with non-empty distinct fields and nativeMode.
- [ ] Add monitor-only non-editable Choice variant for control surface.
- [ ] Add template editor modal with preview + composition list.
- [ ] Ensure field picker edits `prefs.monitoring.floating.fields` only.
- [ ] Ensure single field edit targets monitor field, not setting button.

### Task 4: Native template/field renderer parity
**Files:**
- Modify: `src/services/floatingOverlay.ts`
- Modify: `modules/floating-investment-bot/android/src/main/java/com/etfpilot/floatingbot/FloatingInvestmentBotService.kt`

**Interfaces:**
- Payload contains template id/nativeMode/fields/fieldStyles/uiNodes.
- Table/puzzle renderers consume payload fields in order; template defaults apply when custom fields absent.

- [ ] Add failing contract for payload template composition.
- [ ] Remove hard-coded puzzle-only composition as authoritative source.
- [ ] Render visible fields/order/styles consistently.
- [ ] Keep lock/resize/schedule behavior unchanged.

### Task 5: Global Color Palette module
**Files:**
- Modify: `src/components/ColorPalettePicker.tsx`
- Modify: `src/ui/UniversalEditor.tsx`
- Modify: `src/v3/MonitorFieldEditor.tsx`
- Test: `COLOR_PALETTE_CONTRACT_TEST.cjs`

**Interfaces:**
- Palette modal owns draft color; `onChange` fires only on confirm/theme-confirm.
- Cancel never changes caller value.

- [ ] Add failing test that quick swatch does not directly call caller onChange.
- [ ] Implement staged `draftHue/draftSat/draftVal` and confirm action.
- [ ] Ensure all Universal Editor color controls use shared picker.
- [ ] Ensure MonitorFieldEditor uses the same picker and keeps opacity separate.

### Task 6: Daily PnL / Dividend Mini renderer recovery
**Files:**
- Modify: `src/v3/screens.tsx`
- Modify: `src/ui/editorSchema.ts` if defaults require normalization.
- Test: `V373_MASTER_ACCEPTANCE.cjs`

**Interfaces:**
- `Mini` always renders label/value when persisted node is missing/legacy/partial unless explicit visible=false was saved for that exact node.

- [ ] Add failing contract for Daily PnL four fields and Dividend Event seven fields.
- [ ] Normalize legacy editor nodes before rendering.
- [ ] Isolate scope IDs so global button edits cannot collide with metric nodes.
- [ ] Preserve explicit user-hidden nodes.

### Task 7: Version, migration, release audit
**Files:**
- Modify: `app.json`
- Modify: `android/app/build.gradle`
- Modify: Android strings/runtime metadata as applicable.
- Modify: `src/v3/version.ts`
- Modify: `scripts/V370_UPGRADE_AUDIT.cjs` or add V3.7.3 audit.

- [ ] Set 3.7.3 / versionCode 41 consistently.
- [ ] Add migration-safe defaults for any new monitoring/template preference fields.
- [ ] Run TypeScript, accounting contracts, Golden 00878, cash contract, V3.7.3 master acceptance.

### Task 8: Build signed APK and final evidence
**Files:**
- Modify workflow artifact name only if required for V3.7.3.

- [ ] Trigger signed preview APK build on final commit.
- [ ] Verify workflow steps and APK package/version metadata.
- [ ] Download artifact and calculate SHA-256.
- [ ] Produce final problem-list comparison: ✅ PASS / 🟡 limitation / ❌ fail.
- [ ] Publish artifact download link plus commit/run/version/SHA-256.
