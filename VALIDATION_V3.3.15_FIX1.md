# V3.3.15 ALL-12-INTEGRATED FIX1

修正使用者 Windows TypeScript 驗證回報的 8 個編譯錯誤：

- App.tsx：補入 Modal / ScrollView React Native imports。
- screens.tsx：Settings section union 加入 focus / special。
- screens.tsx：補入 localDateKey() 本地日期 helper。
- 發布腳本改為 ASCII 訊息 + UTF-8 BOM，避免 Windows PowerShell 5.1 中文編碼破壞引號。
- 新增 OTA_V3.3.15_PREVIEW.ps1 短入口。

發布規則：
1. npx tsc --noEmit 必須 0 errors。
2. npx expo export --platform android 必須 PASS。
3. 前兩步成功後才執行 EAS preview OTA。
