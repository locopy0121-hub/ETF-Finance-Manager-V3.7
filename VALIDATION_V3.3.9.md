# ETF財務管家 V3.3.9 Validation

Validation performed on the integrated V3.3.9 source package before release.

## Source integration
- V3.3.8 used as the cumulative base.
- V3.3.7-only layout/model/storage additions remain present in V3.3.8 and therefore in V3.3.9.
- V3.3.6 card/layout/theme/finance controller work remains present through the cumulative chain.

## Fixed compile failures from the failed V3.3.7/V3.3.8 OTA attempt
- `ColorPalettePicker.tsx`: invalid `palette.gold` references fixed.
- `screens.tsx`: missing `SelectedMetrics` renderer restored.
- `widgetTaskHandler.tsx`: Widget `status` narrowed to the accepted union type.

## Validation results
- TypeScript 6.0.3 `tsc --noEmit`: PASS / 0 errors.
- `scripts/ACCOUNTING_CONTRACT_TEST.cjs`: PASS.
- `scripts/ENGINE_RUNTIME_TEST.cjs`: PASS.
- Expo dependency check: dependencies up to date using local SDK 57 dependency map (network unavailable in validation workspace).
- Expo public config parse: PASS.
  - name: ETF財務管家 V3.3
  - version: 3.3.9
  - runtimeVersion: 3.2.0
  - Android package: com.etfpilot.twselive
  - Android versionCode: 32

## Accounting contract alignment
V3.3.8 intentionally separated cash reconciliation from investment total assets. The stale tests still expected `totalAssets = marketValue + cashBalance`; the tests were updated to the V3.3.8+ contract: `totalAssets = marketValue`, while `cashBalance` remains separately tracked for reconciliation. No accounting check was disabled.

## OTA safeguards
`OTA_V3.3.9_PREVIEW.ps1` must pass dependency, TypeScript, and accounting checks before EAS Update is called. It sets `EAS_NO_VCS=1`, project root, `--environment preview`, and Android platform explicitly. `PUBLISH_V3.3.9_OTA.cmd` launches PowerShell with ExecutionPolicy Bypass.
