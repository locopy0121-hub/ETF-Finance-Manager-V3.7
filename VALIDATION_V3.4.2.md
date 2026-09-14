# ETF 財務管家 V3.4.2 — Issue 1+2 Final Validation

## Release identity
- App version: `3.4.2`
- Runtime version: `3.4.2`
- Android versionCode: `35`
- Android package: `com.etfpilot.twselive`
- Storage schema: `10`

## 本次整合
### 問題 1 — Finance Engine 2.0 / Global Metrics / Formula Engine
- 單筆純成本：`floor(成交行情 × 股數)`，每筆先捨去小數後再加總。
- 手續費、稅費與純成交成本分離。
- 單檔庫存即時損益：`即時市值 - 單檔純成本`。
- 全局損益試算：`總市值 - 總成本`。
- 今日損益維持獨立：`(即時行情 - 昨收) × 持有股數`。
- 買賣歷史使用依時間順序的移動平均成本池。
- 新增 `Global Metrics 2.0` 資料封裝：value / source / formula / asOf / isStale。
- 新增 Safe Formula Engine，不使用 `eval` / `new Function`。

### 問題 2 — Cross-App AI BOT 2.0
- Android 原生 Overlay 加入 table mode。
- 可選 ETF、可選即時欄位、1～30 列、最多 8 欄。
- 預設欄位：ETF 代號 / 即時行情 / 庫存即時損益。
- 可顯示：漲跌、漲跌幅、股數、市值、純成本、庫存即時損益/率、今日損益/率、昨收、開高低、成交量、更新時間。
- Native TWSE 背景刷新保留 Finance Engine 純成本，不另外重算成本來源。
- 台股損益色：正值紅、負值綠、0/無資料中性色。
- App foreground 強制停止 Native Overlay；background/inactive 延遲重新確認 AppState 後才啟動。
- 0 秒模式映射為約 1000ms 安全即時刷新；非零最低 250ms。

## 本環境實際執行並通過
- `scripts/V342_ISSUE1_2_AUDIT.cjs`: **PASS 18/18**。
- `scripts/FINANCE_ENGINE_V342_TEST.cjs`: **PASS**。
- `scripts/FORMULA_ENGINE_V342_TEST.cjs`: **PASS**。
- `scripts/V340_FIX1_REGRESSION_AUDIT.cjs`: **PASS 5/5**。
- `scripts/DIVIDEND_CUTOFF_TEST.cjs`: **PASS**。
- TypeScript syntax transpile scan: **PASS — 56 TS/TSX files, 0 syntax errors**。
- Finance cases verified: `1.99 → 1`, `4.04 → 4`, row-by-row total `5`, `20,659 - 20,505 = +154`。

## 尚需在使用者 Windows / EAS 完成的最終驗證
本封裝不包含 `node_modules`。因此此環境沒有對這一份最終 ZIP 重新完成：
- 完整 `tsc --noEmit` semantic type check。
- Expo Android Metro/Hermes export。
- Android Gradle/Kotlin APK native compile。

`CHECK_BEFORE_BUILD.ps1` 會在使用者執行 APK 建置前強制跑上述 npm/TypeScript/Expo preflight；只有通過後才會送 EAS Build。

因 V3.4.2 修改了 Kotlin Overlay Service，**首次必須重新建置並安裝 V3.4.2 APK**。不可用 V3.4.1 runtime 的 OTA 取代 native APK 更新。
