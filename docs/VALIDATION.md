# V3.6.0 驗收規則

## 不算完成的情況
- 設定選項存在但 Renderer 沒套用。
- Preview 正常但實機畫面不變。
- TypeScript PASS 但 Android Native 行為未驗證。
- OTA 畫面正常但 Native APK 能力缺失。

## 必驗
1. App 冷啟動 / 回前景 / 重啟。
2. Global Editor 儲存後立即套用並持久化。
3. 浮動監視器表格與拼圖都吃到 fieldStyles。
4. 自訂排序、桌面鎖、排程。
5. 設定頁第二層文字不可裁切。
6. 首頁圖表單擊實際切換。
7. AI「最近一次配息」只回最新 1 筆。
8. 舊跨 APP BOT 無入口、無殘留影響。
9. Android Navigation Bar 不遮住儲存/取消。
10. Widget 更新與監視器資料一致。
11. App Icon 切換後 Launcher 實際更新。
12. 財務 regression tests 全部 PASS。

## 驗收證據
每一項需至少有：實機截圖 / 日誌 / 自動測試結果其一；Native 行為優先實機驗證。
