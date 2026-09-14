# ETF財務管家 V3.3.11 Validation

Validation performed after the V3.3.11 ALL-IN integration and after the final theme-draft / AI-source changes.

## Release identity
- App version: `3.3.11`
- Display version: `V3.3.11`
- runtimeVersion: `3.2.0`
- Expo slug: `etf-pilot-twse-live`
- Android package: `com.etfpilot.twselive`
- Android versionCode: `32`
- EAS projectId: `79d32e8c-6d52-4969-86dd-17f12531558e`
- V3 storage schema: `7`

## Automated validation results
- TypeScript 6.0.3: `tsc --noEmit` → **PASS / 0 errors**.
- `scripts/ACCOUNTING_CONTRACT_TEST.cjs` → **PASS**.
- `scripts/ENGINE_RUNTIME_TEST.cjs` → **PASS**.
- `scripts/V3311_FEATURE_AUDIT.cjs` → **PASS**.
- Expo dependency check → **PASS: dependencies are up to date** using the local SDK 57 dependency map.
- Expo public config parse → **PASS**.
- Android Metro export → **PASS**.
- Android Hermes bundle generation → **PASS**.
  - final validation bundle: `_expo/static/js/android/index-22bf7e802f511b0ec16cec5d8d7e73b4.hbc`
  - size: about 2.4 MB.
- OTA launcher static audit → **PASS**.
  - `EAS_NO_VCS=1`
  - PowerShell `ExecutionPolicy Bypass`
  - branch `preview`
  - environment `preview`
  - platform `android`
  - feature audit + Android export preflight are executed before EAS Update.

## V3.3.11 feature audit
The source-level release audit verified:
- 10 official global themes.
- 5 custom theme slots.
- Theme `draft → preview → confirm` behavior.
- Global / section / nav / AI / Widget icon visibility controls.
- Bottom nav `圖＋文 / 純文字 / 純圖` modes.
- Active nav labels `首頁` and `股息`.
- Line / area / bar chart types.
- Embedded card chart layouts.
- Dashboard data + chart hero configuration.
- Widget trend chart controls.
- Historical ETF purchase dates without a today-only max/min restriction.
- Recent ledger edit + delete flow.
- Dividend calendar rendered as the fixed page core before reorderable/custom metrics.
- Google News + Bing News research providers.
- Expanded official / finance-site search terms.
- Required AI research sections and evidence-only gateway prompt.
- Batch `更新所有持有 ETF 股息日` confirmation flow.
- TWSE ETF e添富 dividend source.
- AI financial writes remain confirmation-gated.
- Storage migration schema 7 and custom theme migration.

## Accounting contract
No accounting test was disabled. V3.3.11 keeps the V3.3.8+ contract already validated in V3.3.9/V3.3.10:
- `totalAssets = marketValue` for the investment-asset metric.
- `cashBalance` remains a separate reconciliation balance.
- Trade amount and fees remain separately represented.

## OTA / native compatibility
V3.3.11 does not add a new native dependency or change Android package / versionCode / Widget plugin registration. `runtimeVersion` remains `3.2.0`, so this release is prepared as an OTA for the existing V3.2 runtime baseline.

## External-network validation limitation
The build workspace had outbound version/network validation disabled. Expo therefore used its local SDK 57 dependency map, and the actual Google News / Bing News / TWSE / optional AI Gateway requests could not be live-executed from this workspace. Their source code, request paths, parsing, failure handling and UI confirmation flows passed TypeScript, source audit and Android Hermes bundling; final live-source behavior must be verified on the Android device after the preview OTA is installed.

This limitation does **not** affect the successful local TypeScript, accounting, engine, source-audit or Android bundle checks above.
