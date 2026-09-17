# 華南永昌 Canonical Finance Core 實作任務計畫

日期：2026-09-18
依據：docs/superpowers/specs/2026-09-17-huanan-finance-core-design.md

## Task 1 — 鎖定 Canonical 金融常數與 rounding
- 成交金額、目前市值、手續費、證交稅、股息總額、二代健保補充費統一 Math.floor。
- 華南永昌手續費率 0.001425、折扣 0.65。
- 零股／定期定額最低 1 元；整股最低 20 元。
- ETF 稅率 0.001；一般個股 0.003。

## Task 2 — 買進／賣出／持倉成本
- 每筆買進先獨立計算 floor 成交金額、手續費與含費成本。
- 部分賣出採含買進手續費移動平均成本釋放。
- realizedNetPnL 使用淨賣出收入減 releasedCost。
- 清倉只歸零剩餘持股與剩餘成本，不清除歷史已實現損益。

## Task 3 — 淨清算價值與未實現損益
- currentMarketValue 先 floor。
- estNetMarketValue = currentMarketValue - estSellFee - estTax。
- unrealizedPnL = estNetMarketValue - totalCost。
- Portfolio / Widget / Overlay 僅讀 canonical summary。

## Task 4 — 股息
- grossDividend = floor(perShare × eligibleShares)。
- gross >= 20,000 時 NHI = floor(gross × 0.0211)。
- 有效股息事件固定扣 10 元匯費。
- netDividend 作為累積股息、現金入帳與總損益唯一來源。

## Task 5 — Portfolio 總損益
- totalUnrealizedPnL 由 canonical ETF summaries 聚合。
- realizedNetPnL 聚合歷史賣出。
- cumulativeNetDividends 聚合 canonical netDividend。
- comprehensivePnL = unrealized + realized + dividends。
- UI 的 totalPnl 必須指向 comprehensivePnL。

## Task 6 — 驗收
至少覆蓋定版規格第 12 節全部案例，並檢查 App / Widget / Overlay 同一 snapshot 結果一致。

## 執行原則
- 0 Legacy。
- 不改行情來源、刷新頻率、UI 視覺。
- 不建立月結折讓／返佣帳目。
- 不在消費端重複金融公式。
