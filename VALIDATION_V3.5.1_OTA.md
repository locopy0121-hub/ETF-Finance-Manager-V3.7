# ETF財務管家 V3.5.1 OTA－最終驗證

驗證日期：2026-09-11

## Release identity
- App version：`3.5.1`
- Runtime version：`3.5.0`
- Android versionCode：`36`
- Android package：`com.etfpilot.twselive`
- 發布方式：Preview OTA
- 原生基線：V3.5.0 FIX1 APK

## 問題 1～5覆蓋
1. 即時監控器舊 `openApp` 設定會遷移為 `none`；原生單擊不開 App 由 V3.5.0 FIX1 APK 提供。
2. 頁面自訂模式移至標題列，移除內容頂部大型自訂 bar。
3. 設定中心改成上方橫向圖文大分類 + 下方文字小項目；選值控制保留在內容區。
4. 輸入型 ScrollView 啟用 keyboard insets / interactive dismiss，主要長表單加入 KeyboardAvoidingView。
5. 庫存頁新增整體總覽、含息損益、配息、現金、貢獻排行與最近交易/股息摘要。

## OTA 強化
- 首頁：TWSE 熱門 ETF 市場總覽、漲跌排行、成交量。
- 搜尋：ETF 代號 / 名稱搜尋、安全分類、自選整合。
- ETF 詳情：TWSE OHLC 1週/1月/3月/1年績效、年化波動率、最大回撤、Sharpe（RF=0）。
- 歷史行情：上限擴充至約 18 個月。
- 缺乏可信資料時不虛構 Beta、費用率、成分股、產業配置或 NAV 歷史。

## Fresh verification evidence
以下命令在最終程式碼上重新執行：

- `node scripts/V351_OTA_ENHANCEMENT_AUDIT.cjs` → **PASS 17/17**
- `node scripts/FINANCE_ENGINE_V342_TEST.cjs` → **PASS**
- `node scripts/FORMULA_ENGINE_V342_TEST.cjs` → **PASS**
- `node scripts/V340_FIX1_REGRESSION_AUDIT.cjs` → **PASS 5/5**
- `node scripts/DIVIDEND_CUTOFF_TEST.cjs` → **PASS**
- `node node_modules/typescript/bin/tsc --noEmit` → **PASS / 0 errors**
- `node node_modules/expo/bin/cli export --platform android --output-dir dist-v351-final-verify` → **PASS / 889 modules / Android Hermes bundle produced**
- Native module SHA-256 manifest diff vs V3.5.0 FIX1 baseline → **PASS / no changes**

最終 Expo Android bundle：
`_expo/static/js/android/index-7b171ec0cfb1342eb300537df5f5455c.hbc`

## Native boundary
本 OTA 沒有修改 `modules/` 內的 native files。AndroidManifest / Kotlin Overlay / Widget Provider / native dependency 均維持 V3.5.0 FIX1 原生基線。

## 使用方式
在已安裝 V3.5.0 FIX1 APK 的裝置上，於專案根目錄執行：

```powershell
powershell -ExecutionPolicy Bypass -File .\OTA_V3.5.1_PREVIEW.ps1
```

Preflight 通過後才會執行 EAS preview update。
