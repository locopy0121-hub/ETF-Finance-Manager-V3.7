ETF財務管家 V3.3.9 OTA
======================

推薦方式：
1. 解壓縮本資料夾。
2. 直接雙擊 PUBLISH_V3.3.9_OTA.cmd
3. 腳本會自動：
   - 用 PowerShell ExecutionPolicy Bypass 啟動
   - 設定 EAS_NO_VCS=1
   - 固定 EAS environment=preview
   - npm install
   - expo install --check
   - TypeScript 完整檢查
   - Accounting Contract Test
   - 全部成功後才發布 Android preview OTA

成功標誌：最後看到 EAS 的 Published! 與 V3.3.9 OTA published successfully.

注意：runtimeVersion 維持 3.2.0，供目前既有 V3.2 原生 APK 接收 OTA。
