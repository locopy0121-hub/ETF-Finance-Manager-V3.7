# PROJECT INDEX

## 專案
ETF財務管家 / ETF Finance Manager

## 目前基準
- 版本目標：V3.6.0 NATIVE
- Runtime：3.6.0
- Expo SDK：57
- 平台：Android / iOS
- Android 主要交付：preview APK

## 主要模組
- `src/v3/screens.tsx`：V3 主畫面、設定頁、編輯器入口
- `src/v3/GlobalCardDesigner.tsx`：全局卡片編輯
- `src/v3/MonitorFieldEditor.tsx`：浮動監視器欄位編輯
- `src/v3/ChartEngine2.tsx`：圖表引擎
- `src/v3/AiAssistantModal.tsx`：AI 助理
- `src/v3/monitoring.ts`：監視器設定 schema
- `src/services/floatingOverlay.ts`：JS 與 Native Overlay 溝通
- `modules/floating-investment-bot/`：Android Native Overlay / 排程 / Service
- `src/widgets/`：Android Widget
- `src/v3/engine.ts`、`formulaEngine.ts`：財務與公式核心

## 原則
1. UI 編輯層與財務真相層分離。
2. Global Editor 設定必須真正由 Renderer 套用。
3. Native Overlay 不能只在 App Preview 生效。
4. 真實帳務以可追溯 Accounting Engine 為準，AI 不自行定義正式公式。
5. 同 runtime 的 JS/TS 可 OTA；Android Native、Manifest、Receiver、Service、Icon alias 必須重建 APK。

## 分支
- `main`：穩定基準
- `develop`：整合
- `fix/global-editor`
- `fix/native-monitor`
- `fix/settings-layout`
- `feature/ai-assistant-3`
- `feature/accounting-engine-2`
