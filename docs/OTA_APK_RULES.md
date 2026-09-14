# OTA / APK 規則

## 可 OTA（同 runtime）
- React / React Native JS/TS UI
- 卡片設定、樣式、排序邏輯
- AI 對話與查詢邏輯
- 圖表互動與一般資料處理
- 純 JS/TS bug 修正

## 必須重建 APK
- AndroidManifest
- Receiver / Service
- Kotlin / Java Native Module
- Widget 原生能力
- Launcher Icon alias / shortcuts
- 權限新增或修改
- 原生 Overlay Renderer
- 原生 Navigation Bar / Activity 行為
- 新增需 prebuild 的 Expo plugin/native dependency

## 發布原則
- OTA 不跨 runtime。
- Native baseline 升級後，舊 APK 不應接收依賴新 Native 能力的 OTA。
- 發布前先跑 TypeScript、專項 audit、財務 regression、Expo dependency check、Native manifest/prebuild check。
