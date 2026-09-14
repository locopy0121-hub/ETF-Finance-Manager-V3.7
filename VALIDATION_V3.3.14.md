# ETF 財務管家 V3.3.14 Validation

## 已完成
- `scripts/V3314_MONEY_DECIMAL_AUDIT.cjs`: PASS
- `scripts/ACCOUNTING_CONTRACT_TEST.cjs`: PASS
- `scripts/ENGINE_RUNTIME_TEST.cjs`: PASS
- App version: 3.3.14
- Runtime version: 3.2.0
- Android package: com.etfpilot.twselive

## V3.3.14 專項驗證
- `preciseTradeAmount()` 不再捨去小數元：PASS
- V3 金額 formatter 固定顯示 2 位小數：PASS
- Legacy 金額 formatter 預設 2 位小數：PASS
- 新增購入紀錄不再使用 `Math.trunc()` 處理成交金額：PASS
- 庫存修改購入紀錄不再使用 `Math.trunc()` 處理成交金額：PASS
- V3 購入紀錄 totalCost 儲存到 2 位小數：PASS
- 驗收案例 `15.68 × 101 = 1,583.68`：PASS

## TypeScript / Expo bundle 說明
此執行環境嘗試重新安裝 npm dependencies 時逾時，未建立完整 node_modules，因此本報告不宣稱本環境已完成正式 `tsc --noEmit` / Expo export PASS。
Windows 發布前執行 `npm install` 後，可再執行 `npx tsc --noEmit`；若直接 OTA，EAS 仍會在匯出 bundle 階段攔截無法編譯的程式碼。
