# ETF 財務管家 V3.3.13 Validation

## 已完成
- `scripts/V3313_RECORD_INPUT_AUDIT.cjs`: PASS
- `scripts/ACCOUNTING_CONTRACT_TEST.cjs`: PASS
- `scripts/ENGINE_RUNTIME_TEST.cjs`: PASS
- Babel TypeScript/TSX syntax parse: PASS（47 files）
- App version: 3.3.13
- Runtime version: 3.2.0
- Android package: com.etfpilot.twselive

## V3.3.13 專項驗證
- 智慧記帳不再 import / 呼叫 `fetchTwseQuotes`：PASS
- 新增交易不再存在 marketReference / quote auto-fill：PASS
- ETF 代號只帶入名稱：PASS
- 交易日期使用獨立受控月曆：PASS
- 成交價格為純手動輸入：PASS
- 庫存修改新增購入紀錄不再帶入目前行情：PASS
- V3.3.12 全局卡片主題修正仍存在：PASS

## TypeScript / Expo bundle 說明
此工作環境的 npm registry 安裝逾時，無法建立一套乾淨、與 lockfile 一致的 node_modules。既有備援 node_modules 本身也會讓未修改的 V3.3.12 基底產生相同 React Native JSX 型別錯誤，因此不把該結果誤判為 V3.3.13 原始碼錯誤，也不宣稱本環境已完成正式 `tsc --noEmit` / Expo bundle PASS。

發布前請在 Windows 專案目錄執行 `npm install` 後再發 OTA；若要做完整型別驗證，可先執行 `npx tsc --noEmit`。
