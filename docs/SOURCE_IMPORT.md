# V3.6.0 Source Import

目前 Repo 已建立文件、分支與 Issue 追蹤架構。

完整 V3.6.0 NATIVE 專案建議由 Windows 本機透過 GitHub Desktop / git push 匯入，原因：專案包含大量 PNG / Launcher Icon / Preview / Native assets；使用 GitHub 內容 API 逐檔上傳不適合做 50MB 級完整專案搬移。

## 建議來源
目前本機完成建置中的 V3.6.0 專案資料夾，例如：
`E:\ETF\20260912\3.6.0_APK\app`

應以目前已套用 FIX1/FIX2/FIX3 與 Expo dependency patch 的實際建置目錄為準，不要改用較舊 ZIP 覆蓋。

## 不要提交
- node_modules/
- android/.gradle/
- android/app/build/
- .expo/
- dist/
- EAS 暫存與本機 secrets

## 建議提交
- App.tsx
- app.json / eas.json / package.json / package-lock.json
- src/
- modules/
- plugins/
- scripts/
- assets/
- Documentation/
- BUILD / CHECK / OTA PowerShell scripts

完整 source import 後，在 GitHub 建立一個 baseline commit：
`baseline: V3.6.0 native preflight/eas build`
