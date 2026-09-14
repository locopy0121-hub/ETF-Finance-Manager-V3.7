# ETF財務管家 V3.5.0 Validation

## Release identity
- App version: `3.5.0`
- Runtime version: `3.5.0`
- Android versionCode: `36`
- Android package: `com.etfpilot.twselive`
- V3 storage schema: `11`

## Integrated scope
- V3.4.2 Finance Engine 2.0 / Global Metrics / formula safety retained.
- Cross-App feature renamed to 「即時監控器」.
- Native Overlay supports drag, right-bottom resize, size persistence, grid snapping, double-tap favorite size, edge/peek docking and lock mode.
- List mode uses fluid width/height adaptation; puzzle mode renders adaptive information tiles.
- App board / floating monitor / Android Widget share one MonitorProfile language while keeping independent profiles.
- Settings center is grouped as large accordion categories.
- Each main page has an independent custom-mode ON/OFF lock.
- Alert thresholds/cooldown, multi-symbol selection, display fields, opacity, radius and refresh frequency are represented in the unified monitor settings.

## Automated checks executed in packaging environment
- `scripts/V350_NATIVE_MONITOR_AUDIT.cjs`: PASS 21 checks.
- `scripts/V350_REGRESSION_FROM_V342.cjs`: PASS 18/18.
- `scripts/FINANCE_ENGINE_V342_TEST.cjs`: PASS.
- `scripts/FORMULA_ENGINE_V342_TEST.cjs`: PASS.
- `scripts/V340_FIX1_REGRESSION_AUDIT.cjs`: PASS 5 checks.
- `scripts/DIVIDEND_CUTOFF_TEST.cjs`: PASS.

## Final build verification still required on Windows/EAS
The final ZIP intentionally excludes `node_modules`. The user's Windows build launcher performs dependency installation, TypeScript semantic validation, Expo Android export, then EAS preview APK compile. Native Kotlin/Gradle is therefore verified by the actual V3.5.0 EAS APK build.

Run:
```powershell
powershell -ExecutionPolicy Bypass -File .\BUILD_V3.5.0_APK.ps1
```

Because V3.5.0 changes Kotlin/native Overlay behavior, install the new APK first. Do not try to obtain this native upgrade from a V3.4.2 OTA.
