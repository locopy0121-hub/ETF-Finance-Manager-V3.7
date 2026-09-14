# V3.3.10 Validation Report

Date: 2026-09-09
Target: Android preview OTA
Runtime: 3.2.0

## Automated validation

- TypeScript (`npx tsc --noEmit`): **PASS — 0 errors**
- Accounting contract (`node scripts/ACCOUNTING_CONTRACT_TEST.cjs`): **PASS**
- Engine runtime (`node scripts/ENGINE_RUNTIME_TEST.cjs`): **PASS**
- Expo dependency check (`npx expo install --check`): **PASS — dependencies up to date**
  - Validation environment had networking disabled, so Expo used its local bundled native-module map.
- Expo public config parse: **PASS**
  - version: `3.3.10`
  - runtimeVersion: `3.2.0`
  - android package: `com.etfpilot.twselive`
  - versionCode: `32`
- Android Metro / Hermes export (`npx expo export --platform android`): **PASS**
  - 872 modules bundled
  - Android Hermes bundle generated successfully

## V3.3.10 static contracts

- Runtime UI has no hardcoded V3.3.8 / V3.3.9 display string: **PASS**
- Dividend month calendar is rendered before movable dividend metric cards: **PASS**
- Single system/custom cards can enable an embedded trend chart: **PASS**
- Chart layout supports left/right and top/bottom data-chart arrangements: **PASS**
- Homepage hero migration enables an intraday total-assets area chart: **PASS**
- Widget uses `SvgWidget` for an inline sparkline: **PASS**
- Widget settings include trend metric/source/range controls: **PASS**
- App / Widget manual refresh / Widget background task all preserve trend payloads: **PASS**
- V3 schema 5 migrates legacy `totalInvestedCost` to the user-facing `historicalCashOutflow` field: **PASS**
- Accounting contract remains unchanged from V3.3.8+: investment `totalAssets` is holdings market value; cash remains an independent reconciliation ledger: **PASS**

## Not performed in this container

- Android physical-device visual inspection.
- Home-screen launcher Widget resize testing on a real Android launcher.

Those two items should be verified after the preview OTA is published and loaded on the user's device.
