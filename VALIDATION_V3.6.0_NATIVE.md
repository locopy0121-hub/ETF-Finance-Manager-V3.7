# V3.6.0 NATIVE 驗證紀錄

## 本工作包已完成
- V3.6.0 / runtime 3.6.0 / versionCode 37。
- V360 Native audit：36/36 PASS。
- `plugins/withAlternateIcons.js` Node syntax check：PASS。
- 10 組 App Icon PNG 已建立並納入 assets。
- Native Overlay 已加入 fieldStyles、桌面鎖、排程/開機 Receiver。
- AI Cross-App BOT 舊 React 元件已移除。
- Source syntax 以 TypeScript compiler 進行解析掃描；此執行環境沒有專案 node_modules，因此無法在此完成正式 `tsc --noEmit`。

## 為何最終 TypeScript / Expo / EAS 要在 Windows 執行
本工作環境無法連線 npm registry（DNS `EAI_AGAIN`），因此不能安裝 Expo 57 專案依賴，也不能登入使用者 EAS 帳號提交簽署 APK。`CHECK_V3.6.0_BEFORE_BUILD.ps1` 會在實際 Windows 專案環境完成 `npm install`、V360 audit、`tsc --noEmit`、Expo dependency check，再允許 EAS Build。

## APK 必測
1. Global Editor 儲存後首頁/各頁卡片立即改變。
2. ETF 代號/行情/損益個別樣式真正出現在桌面 Overlay。
3. 表格與拼圖都測；🔒 後拖移/縮放無效。
4. 排程跨開始/結束時間、重新開機恢復。
5. 設定第二層分類不吃字。
6. 首頁圖表每次單擊都可見切換類型。
7. AI 問「00919 最近一次配息？」只回一筆。
8. 10 個 App Icon 逐一切換；長按桌面圖示顯示快捷入口。
9. 編輯器進入時 Android navigation bar 隱藏，離開恢復。
10. Widget 單擊刷新、雙擊開 App，資料不歸零。
