# ETF財務管家 V3.7.3 Master Integration Design

## Goal
一次收斂 V3.7.2 已確認的金融一致性、每日損益/股息空白卡、即時監控器單項目與共用模板、Universal Editor 色盤、Native Overlay 與驗收機制問題，保留已正確的帳務核心並以實際操作路徑驗收。

## Non-negotiable rules
- 金融真相只能來自 canonical finance snapshot；App/Widget/Overlay/AI/圖表/通知不得各自重算相衝突的 totalAssets/totalPnl/cashBalance。
- 已完成的買進、賣出費稅、移動平均成本、股息入帳、現金重建不重寫，只增加 regression protection。
- Settings/Universal Editor 是控制面；真正 target 可能是 App node、monitor template surface、monitor template item、monitor field 或 Native Overlay，不得再用設定頁 Choice button 充當 monitor target。
- 共用模板點入後必須可見模板預覽與組合項目；模板負責組合與外皮，單項目負責自身樣式；切模板不得無條件洗掉使用者單項目設定。
- Universal Editor 所有顏色設定使用共同 Color Palette 模組：選色→預覽→確定→套用；取消不得改值。透明度獨立。
- App / Overlay / Widget 共用 schema，但 renderer 依平台能力 fallback；不得出現設定可選、renderer 完全忽略而仍標 PASS。
- Native 變更必須 APK；最終交付需 APK artifact/link、版本資訊、SHA-256、commit、workflow run 與逐項問題清單狀態。

## Architecture
### 1. Canonical finance snapshot
JS finance engine 保留唯一 portfolio/holding 計算。floatingOverlay payload 帶入 canonical totals 與 position basis；Native quote refresh 僅更新 quote-derived price/change/marketValue/todayPnl，不得覆寫 cash-aware totalAssets，除非同時計入 canonical cashBalance。

### 2. Monitor editor target router
建立明確 target：`monitor.template:<id>`、`monitor.field:<field>`、`monitor.surface`。設定頁的 Choice 不再因 global edit mode 自動成為 monitor 編輯 target。模板入口開啟 Template Editor，單項目入口開啟 Monitor Field Editor/Universal Editor adapter。

### 3. Template schema and renderer
12 個 MonitorTemplate 保留各自 fields/columns/compact，新增 native mode/surface metadata。切模板時若使用者未自訂 fields，採 template fields；模板 editor 可檢視/套用 template composition。Native table/puzzle renderer 按 payload fields 與 style contract 渲染，不再硬寫固定 puzzle fields 作為唯一內容來源。

### 4. Universal color palette
共用 `ColorPalettePicker` 採 staged draft：拖曳與 quick swatch 只更新 modal preview；按「確定/選取此顏色」才呼叫 onChange，取消完全回復。UniversalEditor、MonitorFieldEditor、Effects 皆使用同一模組。

### 5. Mini renderer recovery
Daily PnL 與 Dividend Event 的 Mini 必須對舊 editorNodes 做安全 defaults：若舊 node 缺 text/effects/visible，renderer 仍顯示 systemName/value。設定頁 Choice 的 Universal Editor 入口限制在真正可編輯的 UI，不污染資料卡 node。

### 6. Acceptance gate
新增 V3.7.3 acceptance 腳本，檢查：canonical totalAssets 不被 Native 覆寫、12 template schema、template editor entry、monitor field target、palette commit semantics、Daily/Dividend Mini visibility defaults、版本鏈；CI 再跑 TypeScript/accounting/golden tests/native source audit/build。

## Acceptance flows
1. Settings→監視器→持股清單：點模板可開內容，看到組合欄位；套用後桌面 Overlay 使用該 composition。
2. 點 ETF代號單項目→修改字色/底色/發光→儲存→桌面 Overlay 對應欄位立即使用；不改設定頁按鈕。
3. 任一顏色設定→色盤挑色→取消：原值不變；重新開啟→挑色→確定：新值套用。
4. Daily PnL 四個 Mini 與 Dividend Event 七個 Mini 在舊 prefs/new prefs 下皆顯示 label/value。
5. canonical `totalAssets = marketValue + cashBalance`，包含負 cashBalance；Overlay refresh 後仍一致。
6. 00878 Golden Case 與既有 accounting/cash contracts 全 PASS。
7. APK metadata 為 V3.7.3，新 artifact 可下載並可核對 SHA-256。
