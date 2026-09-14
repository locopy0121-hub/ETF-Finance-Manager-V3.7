# ETF 財務管家 V3.4.1 安裝與實機測試

## 1. 環境
建議 Windows PowerShell、Node.js 22 LTS。解壓縮完整專案後，PowerShell 進入專案根目錄。

## 2. 建置前完整檢查
若已安裝依賴：

```powershell
powershell -ExecutionPolicy Bypass -File .\CHECK_BEFORE_BUILD.ps1
```

若尚未有 `node_modules`，可直接執行 APK launcher，會先跑 `npm install`。

## 3. 建立 V3.4.1 Preview APK

```powershell
powershell -ExecutionPolicy Bypass -File .\BUILD_V3.4.1_APK.ps1
```

或：

```powershell
powershell -ExecutionPolicy Bypass -File .\BUILD_APK.ps1
```

EAS profile `preview` 產生 Android APK，適合自用與實機測試。

## 4. 為什麼 V3.4.1 必須先重建 APK
V3.4.1 包含 `modules/floating-investment-bot` 的 Android 原生懸浮 BOT 行為，因此 runtime 已升為 `3.4.1`。舊 APK/runtime 無法只靠 OTA 獲得新的原生程式碼。

## 5. Expo Go
Expo Go 只適合快速檢查部分 JS/UI。以下項目請以實際 Preview APK 為準：
- 跨 APP 系統懸浮 AI BOT
- Android overlay permission / foreground service
- Android Widget
- 其他自訂原生 module 行為

## 6. 安裝舊版處理
若 Android 因簽章或版本衝突無法直接覆蓋，可先備份 App 內重要資料，再移除舊 APK 後安裝 V3.4.1。若可正常覆蓋安裝，則不必主動移除。

## 7. V3.4.1 OTA
成功安裝 V3.4.1 APK 後，同 runtime 的後續 UI/JS 修正可使用：

```powershell
powershell -ExecutionPolicy Bypass -File .\OTA_V3.4.1_PREVIEW.ps1
```
