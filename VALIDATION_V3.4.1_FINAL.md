# ETF 財務管家 V3.4.1 FINAL Validation

Validation target: `E-MANAGER-V3.4.1-COMPLETE-1-10-FINAL`

## Release identity
- App version: `3.4.1`
- Runtime version: `3.4.1`
- Android package: `com.etfpilot.twselive`
- Android versionCode: `34`
- Expo SDK: `57`
- React Native: `0.86.3`
- TypeScript: `6.0.3`

## Native Floating Investment BOT
- Local Expo Module: `modules/floating-investment-bot`
- Android `defaultConfig.versionCode = 1`
- Android `defaultConfig.versionName = "1.0.0"`
- This closes the Gradle failure: `android.defaultConfig.versionName is not defined`.
- Because V3.4.1 contains native overlay behavior changes, install a newly built V3.4.1 APK before using V3.4.1 OTA updates.

## Automated validation actually executed
- `scripts/V341_FINAL_AUDIT.cjs`: **PASS — 45/45 checks** covering issues 1–10.
- `scripts/V340_FIX1_REGRESSION_AUDIT.cjs`: **PASS — 5/5 checks**.
- `scripts/ACCOUNTING_CONTRACT_TEST.cjs`: **PASS**.
- `scripts/ENGINE_RUNTIME_TEST.cjs`: **PASS**.
- `scripts/DIVIDEND_CUTOFF_TEST.cjs`: **PASS**.
- TypeScript `tsc --noEmit`: **PASS — 0 errors**.
- Expo public config parse: **PASS**.
- Android package/version identity: **PASS** (`3.4.1`, runtime `3.4.1`, versionCode `34`).
- Android Metro/Hermes export: **PASS — 887 modules**.
- Final Android Hermes bundle: `_expo/static/js/android/index-7cb0d6b7c1c8cd082d6ff134fdb1688d.hbc` (~2.6 MB).

## Issue 1–10 coverage
1. APP AI BOT robot switch, independent width/height, auto-height and bounded scroll.
2. Cross-app BOT foreground/background mutual exclusion, zero/custom refresh and adaptive sizing/font.
3. App charts: single tap style cycle, double tap enlarge, enlarged detail/range/zoom interaction.
4. Android Widget compact chart types and display controls.
5. Smart/fixed/custom decimal formatting, custom digits, fixed two-decimal prices, no currency prefix on data values.
6. Calendar theme/custom settings and lifestyle salary-progress settings using dividend data.
7. Safety backup before clear/recalc/restore, plus legacy holding preservation during rebuild.
8. Existing-ETF custom simulation portfolio with ratio/amount configuration and interactive future-assets chart.
9. System ticker settings and 10 animation modes.
10. Daily P&L ETF badge/color semantics driven by actual P&L; price fixed to two decimals.

## Data-safety regression
`rebuildHoldingsFromLedger` preserves an existing holding when no corresponding historical buy ledger exists. This prevents old holdings from disappearing solely because legacy transaction history is incomplete.

## Build readiness
`CHECK_BEFORE_BUILD.ps1` now targets V3.4.1 and runs the release audit, regression audit, accounting/engine/dividend tests, TypeScript, and Android export before allowing the build launcher to continue.

Recommended Windows command:

```powershell
powershell -ExecutionPolicy Bypass -File .\BUILD_V3.4.1_APK.ps1
```

## Validation boundary
The source package has passed JS/TS/Metro/Hermes and project-level release audits in the validation environment. A real EAS Android Gradle APK build is still the final native-cloud build step and must be submitted from the user's Expo/EAS environment; this report does not claim that an APK binary was built by this validation environment.
