# 華南永昌金融核心重構設計

日期：2026-09-17  
目標版本：ETF財務管家 V3.7.x  
狀態：使用者已確認公式口徑；待實作計畫與程式變更

## 1. 目標

將交易、庫存、未實現損益、Portfolio Summary、Widget、Overlay 與股息全部收斂到單一金融核心（Single Source of Truth），禁止各頁面自行重算費用、成本、稅金、損益或股息淨額。

本次定版採華南永昌成交當筆直接折抵口徑：`discount = 0.65`。不建立月結折讓／退費的第二套帳目。

## 2. 核心常數與交易模式

- 手續費率：`0.001425`
- 折扣：`0.65`
- ETF 賣出證交稅：`0.001`
- 一般個股賣出證交稅：`0.003`
- 二代健保補充保費門檻：`20_000`
- 二代健保補充保費率：`0.0211`
- 股息預設匯費：`10`
- `ODD_LOT`（零股／定期定額）最低手續費：`1`
- `ROUND_LOT`（整股，1,000 股以上且為張數下單）最低手續費：`20`

交易模式不得只靠股數自行猜測；交易紀錄需保存 `TradeMode`。若 UI 提供「整股／零股／定期定額」選項，該值必須一路傳入金融核心。

## 3. 統一 Floor 規則

下列金額一律 `Math.floor` 至整數：

- 買進成交金額
- 賣出成交金額
- 買進手續費
- 賣出手續費
- ETF／個股證交稅
- 目前市值
- 單筆配息總額
- 二代健保補充保費

因此金融核心必須由同一個 rounding helper 處理，不允許畫面層另用 `round`、`ceil`、`toFixed` 或原始浮點值參與帳務。

## 4. 買進公式

```ts
buyAmount = Math.floor(price * shares)
minFee = tradeMode === 'ROUND_LOT' ? 20 : 1
buyFee = Math.max(
  minFee,
  Math.floor(buyAmount * 0.001425 * 0.65),
)
totalCost = buyAmount + buyFee
```

每一筆買進必須先獨立完成 `buyAmount`、`buyFee`、`totalCost`，再累積進持倉。禁止先算平均價再反推歷史成交金額。

## 5. 庫存成本與部分賣出

持倉成本採「含買進手續費移動平均成本」：

```ts
avgCostBeforeSell = totalCostBeforeSell / sharesBeforeSell
releasedCost = avgCostBeforeSell * sellShares
remainingCost = totalCostBeforeSell - releasedCost
```

部分賣出只釋放對應股數的含費成本；不得用賣出所得反向沖減剩餘庫存成本。清倉後持股與剩餘成本歸零，但歷史已實現損益不可歸零。

## 6. 賣出公式

```ts
sellAmount = Math.floor(price * shares)
minFee = tradeMode === 'ROUND_LOT' ? 20 : 1
sellFee = Math.max(
  minFee,
  Math.floor(sellAmount * 0.001425 * 0.65),
)

taxRate = instrumentType === 'ETF' ? 0.001 : 0.003
tax = Math.floor(sellAmount * taxRate)

netSellIncome = sellAmount - sellFee - tax
```

已實現淨損益：

```ts
realizedNetPnL = netSellIncome - releasedCost
```

交易表單若未手動輸入實際費稅，必須由核心自動計算；若提供「實際對帳單費用」覆蓋機制，覆蓋值不可再重複疊加估算費用。

## 7. 華南永昌淨清算價值與未實現損益

```ts
currentMarketValue = Math.floor(currentPrice * shares)
minFee = liquidationTradeMode === 'ROUND_LOT' ? 20 : 1

estSellFee = Math.max(
  minFee,
  Math.floor(currentMarketValue * 0.001425 * 0.65),
)

estTax = Math.floor(currentMarketValue * taxRate)
estNetMarketValue = currentMarketValue - estSellFee - estTax
unrealizedPnL = estNetMarketValue - totalCost
roi = totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0
```

`currentMarketValue` 僅代表毛市值；`estNetMarketValue` 代表若現在清算的預估淨收市值。所有畫面上的「未實現損益」與 ROI 必須讀取淨清算價值口徑。

## 8. 股息與二代健保

單筆股息事件以事件符合股數計算：

```ts
grossDividend = Math.floor(dividendPerShare * shares)
nhiFee = grossDividend >= 20_000
  ? Math.floor(grossDividend * 0.0211)
  : 0
postalFee = grossDividend > 0 ? 10 : 0
netDividend = Math.max(0, grossDividend - nhiFee - postalFee)
```

預設每筆有效股息事件扣 10 元匯費。若事件總額為 0，不扣匯費。累積股息、現金入帳、總損益與 Widget 顯示都必須引用同一個 `netDividend`。

## 9. Portfolio 與總損益

Portfolio Summary 必須由各 ETF canonical summary 聚合，不得重新套另一套公式：

```ts
totalMarketValue = sum(currentMarketValue)
totalNetLiquidationValue = sum(estNetMarketValue)
totalInvestmentCost = sum(totalCost)
totalUnrealizedPnL = totalNetLiquidationValue - totalInvestmentCost
realizedNetPnL = sum(realizedNetPnL)
cumulativeNetDividends = sum(netDividend)
comprehensivePnL = totalUnrealizedPnL + realizedNetPnL + cumulativeNetDividends
```

`totalPnl` 若作為 UI 的「總損益」，必須指向 `comprehensivePnL`；不得再等同單純 `totalUnrealizedPnL`。若要顯示未實現損益，使用明確命名欄位 `totalUnrealizedPnL`。

## 10. 單一真理源邊界

金融公式只能存在於 canonical finance core。下列消費端只能讀結果，不得重算：

- 新增／編輯交易
- 庫存列表與 ETF 詳情
- 首頁資產總覽
- Portfolio Summary
- Widget
- Overlay／即時監控器
- 每日快照與圖表
- AI／自訂欄位引擎

Broker Profile 只負責提供常數與模式，不應再出現與 `HUANAN_CONFIG` 互相矛盾的第二套華南常數。

## 11. 現有 V3.7.8 已確認差異

1. `calculatePurchaseCost()` 現在直接使用 `shares * price`，未對成交金額做 `floor`。
2. `calculateETFSummary()` 現在直接使用 `totalShares * currentPrice`，未對目前市值做 `floor`。
3. 現行手續費核心已採 `0.001425 × 0.65` 與整股／零股最低費，但需確保所有入口都走同一函數。
4. 現行股息 `grossDividend` 未 floor，且未扣預設 10 元匯費。
5. 現行 `totalPnl` 仍可能綁 `totalUnrealizedProfit`，而非完整 `comprehensivePnL`。
6. Broker Profile 與 `HUANAN_CONFIG` 同時保存華南參數，需消除互相漂移的可能。

## 12. 驗收測試

至少覆蓋：

- 零股買進：最低費 1 元。
- 整股買進：最低費 20 元。
- 折扣後手續費大於最低費時正確 floor。
- 買進成交金額有小數時先 floor 再算 fee。
- ETF 賣出稅 0.1%；個股 0.3%。
- 目前市值 floor 後才估賣出費稅。
- 未實現損益 = 淨清算價值 - 含費成本。
- 多筆不同價格買進後移動平均成本正確。
- 部分賣出後剩餘成本與 realizedNetPnL 連續。
- 清倉後 realized/comprehensive PnL 不得歸零。
- 股息未滿 20,000：NHI=0、扣 10 元匯費。
- 股息達 20,000：先 floor gross、再扣 floor(2.11%)、再扣 10 元匯費。
- Portfolio Summary 與各 ETF summary 加總完全一致。
- App／Widget／Overlay 對同一 snapshot 顯示完全一致。

## 13. 非本次範圍

- 不建立華南月結折讓／返佣帳目。
- 不改行情來源或更新頻率。
- 不更動 UI 視覺設計。
- 不產 APK／OTA，除非收到明確 `GOGO` 指令。
