# ETF 財務管家 V3.4.1 — APK / OTA 更新規則

## 可使用 OTA 的常見修改
- TypeScript / JavaScript 邏輯
- UI 排版、文字、顏色、主題
- 圖表顯示與互動（未新增原生依賴時）
- 計算公式與資料格式
- TWSE / 公開資料 parsing 邏輯
- V3.4.1 runtime 內已存在原生能力的 JS 控制邏輯

## 必須重新建立 APK 的修改
- 新增或修改 Android 原生 module / Kotlin / Java
- 新增 Android 權限、foreground service、receiver、provider
- 新增或更換 native dependency / Expo config plugin
- Android package / versionCode / signing 相關變更
- Expo SDK / React Native 版本變更
- runtimeVersion 升級

## V3.4.1 特別規則
本版修改跨 APP 系統懸浮 BOT 原生模組，因此 **V3.4.1 首次發布必須先建 APK**：

```powershell
powershell -ExecutionPolicy Bypass -File .\BUILD_V3.4.1_APK.ps1
```

裝置安裝 runtime `3.4.1` 後，才可發布 V3.4.1 Preview OTA：

```powershell
powershell -ExecutionPolicy Bypass -File .\OTA_V3.4.1_PREVIEW.ps1
```

## 安全原則
若不確定變更是否牽涉原生層，優先視為「需要 APK」；不要用 OTA 跨 runtime 強行覆蓋。
