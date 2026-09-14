# ETF Pilot V1.1.6 APK 建置檢查表

## 目標
使用 EAS `preview` profile 生成可直接安裝於 Android 實機的 APK。

## 固定版本
- Expo SDK: 57
- React Native: 0.86.3
- React: 19.2.3
- Node.js: >= 22.13
- EAS CLI: 23.2.0（建置腳本固定使用 npx 版本）
- App version: 1.1.6
- Android versionCode: 16
- Android package: `com.etfpilot.twselive`

## 第一次建置
PowerShell：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\PREPARE_EAS.ps1
.\CHECK_BEFORE_BUILD.ps1
.\BUILD_APK.ps1
```

## 後續 APK 建置
已完成 EAS 初始化與登入後：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\CHECK_BEFORE_BUILD.ps1
.\BUILD_APK.ps1
```

## EAS profile
`eas.json` 的 `preview` 使用：
- `distribution: internal`
- `android.buildType: apk`
- `channel: preview`

因此輸出為可直接安裝的 `.apk`，不是 Google Play 用的 `.aab`。

## 若 expo install --check 失敗
先執行：

```powershell
npx expo install --fix
```

再重新執行 `CHECK_BEFORE_BUILD.ps1`。

## 注意
- `Documentation/Previews` 已透過 `.easignore` 排除，不會把大型預覽圖上傳進 EAS Build context。
- TWSE 網路行情不需要額外 Android runtime 權限；正式行情仍以 TWSE 為最終來源。
- 第一次 EAS Build 若尚無 Android keystore，EAS 可協助建立並保存簽章憑證。
