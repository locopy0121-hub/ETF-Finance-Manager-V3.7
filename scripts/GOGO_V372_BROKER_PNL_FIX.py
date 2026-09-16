from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def replace_once(rel,old,new,marker=None):
    p=ROOT/rel
    text=p.read_text(encoding='utf-8')
    if marker and marker in text:
        print(f'SKIP {rel}: {marker}')
        return
    if old not in text:
        raise SystemExit(f'PATCH TARGET MISSING: {rel}\n--- expected ---\n{old}')
    p.write_text(text.replace(old,new,1),encoding='utf-8')
    print(f'PATCH {rel}')

# Shared accounting engine: keep gross market value intact, but calculate the
# broker-style open PnL from estimated net liquidation value.
replace_once(
    'src/v3/engine.ts',
    "import { Holding } from '../data/portfolio';\nimport { DividendEvent } from '../screens/DividendCalendarScreen';\nimport { LedgerEntry, type MoneyPreferences } from './model';",
    "import { Holding } from '../data/portfolio';\nimport { DividendEvent } from '../screens/DividendCalendarScreen';\nimport { defaultFeeSettings, estimateSellFee, estimateSellTaxBySettings, type FeeSettings } from '../data/tradeSettings';\nimport { LedgerEntry, type MoneyPreferences } from './model';",
    "estimateSellTaxBySettings, type FeeSettings"
)
replace_once(
    'src/v3/engine.ts',
    "let DISPLAY_MONEY:MoneyPreferences|undefined;\nexport function configureDisplayPreferences(moneyPrefs?:MoneyPreferences){DISPLAY_MONEY=moneyPrefs;}",
    "let DISPLAY_MONEY:MoneyPreferences|undefined;\nexport function configureDisplayPreferences(moneyPrefs?:MoneyPreferences){DISPLAY_MONEY=moneyPrefs;}\n\nlet ACCOUNTING_FEES:FeeSettings=defaultFeeSettings;\nexport function configureAccountingFeeSettings(settings?:FeeSettings){ACCOUNTING_FEES=settings??defaultFeeSettings;}\nexport function estimatedExitCharges(marketValue:number,settings:FeeSettings=ACCOUNTING_FEES){\n const grossMarketValue=Math.max(0,Number(marketValue)||0);\n const estimatedSellFee=estimateSellFee(grossMarketValue,settings);\n const estimatedSellTax=estimateSellTaxBySettings(grossMarketValue,settings);\n const netLiquidationValue=Math.max(0,grossMarketValue-estimatedSellFee-estimatedSellTax);\n return {grossMarketValue,estimatedSellFee,estimatedSellTax,netLiquidationValue};\n}",
    "export function configureAccountingFeeSettings"
)
replace_once(
    'src/v3/engine.ts',
    " let currentTradeCost=0,currentAllocatedBuyFees=0,currentCashBasis=0,marketValue=0,todayPnl=0,previousValue=0;",
    " let currentTradeCost=0,currentAllocatedBuyFees=0,currentCashBasis=0,marketValue=0,estimatedExitFees=0,estimatedExitTaxes=0,netLiquidationValue=0,todayPnl=0,previousValue=0;",
    "marketValue=0,estimatedExitFees=0"
)
replace_once(
    'src/v3/engine.ts',
    "  const c=positionCostStats(h,ledger); const price=quotePrice(h,quotes); const value=price*h.shares; const prev=Number(quotes[h.symbol]?.previousClose??price);",
    "  const c=positionCostStats(h,ledger); const price=quotePrice(h,quotes); const value=price*h.shares; const exit=estimatedExitCharges(value); const prev=Number(quotes[h.symbol]?.previousClose??price);",
    "const exit=estimatedExitCharges(value)"
)
replace_once(
    'src/v3/engine.ts',
    "  marketValue+=value; previousValue+=prev*h.shares; todayPnl+=(price-prev)*h.shares;",
    "  marketValue+=value; estimatedExitFees+=exit.estimatedSellFee; estimatedExitTaxes+=exit.estimatedSellTax; netLiquidationValue+=exit.netLiquidationValue; previousValue+=prev*h.shares; todayPnl+=(price-prev)*h.shares;",
    "estimatedExitFees+=exit.estimatedSellFee"
)
replace_once(
    'src/v3/engine.ts',
    " const cashUnrealizedPnl=marketValue-currentCashBasis;",
    " const cashUnrealizedPnl=netLiquidationValue-currentCashBasis;",
    "const cashUnrealizedPnl=netLiquidationValue-currentCashBasis"
)
replace_once(
    'src/v3/engine.ts',
    "  marketValue,cashBalance,totalAssets,accountEquity,priceUnrealizedPnl,cashUnrealizedPnl,realizedPricePnl,realizedCashPnl,pricePnl,cumulativeDividends,totalPnl,totalRoi,priceRoi,todayPnl,todayPnlPct,pendingDividends,holdingCount:holdings.length,comprehensivePnl,",
    "  marketValue,estimatedExitFees,estimatedExitTaxes,netLiquidationValue,cashBalance,totalAssets,accountEquity,priceUnrealizedPnl,cashUnrealizedPnl,realizedPricePnl,realizedCashPnl,pricePnl,cumulativeDividends,totalPnl,totalRoi,priceRoi,todayPnl,todayPnlPct,pendingDividends,holdingCount:holdings.length,comprehensivePnl,",
    "marketValue,estimatedExitFees,estimatedExitTaxes,netLiquidationValue,cashBalance"
)
replace_once(
    'src/v3/engine.ts',
    " const q=quotes[h.symbol]??{}; const price=quotePrice(h,quotes), c=positionCostStats(h,ledger), marketValue=price*h.shares;\n const pricePnl=marketValue-c.currentTradeCost;\n const cashPnl=marketValue-c.currentCashBasis;",
    " const q=quotes[h.symbol]??{}; const price=quotePrice(h,quotes), c=positionCostStats(h,ledger), marketValue=price*h.shares; const exit=estimatedExitCharges(marketValue);\n const pricePnl=marketValue-c.currentTradeCost;\n const cashPnl=exit.netLiquidationValue-c.currentCashBasis;",
    "const cashPnl=exit.netLiquidationValue-c.currentCashBasis"
)
replace_once(
    'src/v3/engine.ts',
    "  marketValue,pnl,pricePnl,cashPnl,roi,priceRoi,cashRoi,comprehensivePnl,comprehensiveRoi,",
    "  marketValue,estimatedSellFee:exit.estimatedSellFee,estimatedSellTax:exit.estimatedSellTax,netLiquidationValue:exit.netLiquidationValue,pnl,pricePnl,cashPnl,roi,priceRoi,cashRoi,comprehensivePnl,comprehensiveRoi,",
    "estimatedSellFee:exit.estimatedSellFee"
)

# App runtime config: all screen/overlay calculations use the active broker profile.
replace_once(
    'App.tsx',
    "import { configureDisplayPreferences, dividendTotals, holdingMetrics, portfolioMetrics, sharesOnDate, money, pct } from './src/v3/engine';",
    "import { configureAccountingFeeSettings, configureDisplayPreferences, dividendTotals, holdingMetrics, portfolioMetrics, sharesOnDate, money, pct } from './src/v3/engine';",
    "configureAccountingFeeSettings, configureDisplayPreferences"
)
replace_once(
    'App.tsx',
    " const p=state.preferences; configureDisplayPreferences(p.money); const navIcons=currentIcons(p);",
    " const p=state.preferences; configureDisplayPreferences(p.money); configureAccountingFeeSettings(state.feeSettings); const navIcons=currentIcons(p);",
    "configureAccountingFeeSettings(state.feeSettings)"
)

# Widget task runtime is a separate JS execution context; configure it explicitly.
replace_once(
    'src/widgets/widgetTaskHandler.tsx',
    "import { portfolioMetrics } from '../v3/engine';",
    "import { configureAccountingFeeSettings, portfolioMetrics } from '../v3/engine';",
    "configureAccountingFeeSettings, portfolioMetrics"
)
replace_once(
    'src/widgets/widgetTaskHandler.tsx',
    "  const cashBalance=isV3?Number(state?.cashBalance??0):0;\n  let extras:any=payload?.extras??{};",
    "  const cashBalance=isV3?Number(state?.cashBalance??0):0;\n  if(isV3)configureAccountingFeeSettings(state?.feeSettings);\n  let extras:any=payload?.extras??{};",
    "configureAccountingFeeSettings(state?.feeSettings)"
)

# Widget renderer has a local single-ETF fallback. Make it use the same exit-cost formula.
replace_once(
    'src/widgets/ProfitWidget.tsx',
    "import type {UniversalEditorNode} from '../ui/editorSchema';",
    "import type {UniversalEditorNode} from '../ui/editorSchema';\nimport { estimatedExitCharges } from '../v3/engine';",
    "import { estimatedExitCharges } from '../v3/engine';"
)
replace_once(
    'src/widgets/ProfitWidget.tsx',
    " const marketValue=metricHoldings.reduce((sum,h)=>sum+h.shares*h.price,0); const pricePnl=marketValue-currentTradeCost; const cashUnrealized=marketValue-currentCashBasis;",
    " const marketValue=metricHoldings.reduce((sum,h)=>sum+h.shares*h.price,0); const netLiquidationValue=metricHoldings.reduce((sum,h)=>sum+estimatedExitCharges(h.shares*h.price).netLiquidationValue,0); const pricePnl=marketValue-currentTradeCost; const cashUnrealized=netLiquidationValue-currentCashBasis;",
    "const netLiquidationValue=metricHoldings.reduce"
)

# Periodic widget background task also runs separately and previously discarded feeSettings.
replace_once(
    'src/services/backgroundQuoteTask.tsx',
    "import { portfolioMetrics } from '../v3/engine';",
    "import { configureAccountingFeeSettings, portfolioMetrics } from '../v3/engine';",
    "configureAccountingFeeSettings, portfolioMetrics"
)
replace_once(
    'src/services/backgroundQuoteTask.tsx',
    "  if(v3){const s=JSON.parse(v3);return {isV3:true,holdings:s?.holdings??[],settings:s?.appSettings??{},preferences:s?.preferences??{},market:s?.preferences?.market??{},ledger:s?.ledger??[],dividends:s?.dividends??[],cashBalance:Number(s?.cashBalance??0),intradayPnlPoints:s?.intradayPnlPoints??[],dailySnapshots:s?.dailySnapshots??[]};}",
    "  if(v3){const s=JSON.parse(v3);return {isV3:true,holdings:s?.holdings??[],settings:s?.appSettings??{},preferences:s?.preferences??{},market:s?.preferences?.market??{},feeSettings:s?.feeSettings,ledger:s?.ledger??[],dividends:s?.dividends??[],cashBalance:Number(s?.cashBalance??0),intradayPnlPoints:s?.intradayPnlPoints??[],dailySnapshots:s?.dailySnapshots??[]};}",
    "feeSettings:s?.feeSettings"
)
replace_once(
    'src/services/backgroundQuoteTask.tsx',
    "   const state=await readState();if(!state)return BackgroundTask.BackgroundTaskResult.Success;\n   const ws=state.settings?.widget??{};const mode=controllerMode(state.market,ws);",
    "   const state=await readState();if(!state)return BackgroundTask.BackgroundTaskResult.Success;\n   if(state.isV3)configureAccountingFeeSettings((state as any).feeSettings);\n   const ws=state.settings?.widget??{};const mode=controllerMode(state.market,ws);",
    "configureAccountingFeeSettings((state as any).feeSettings)"
)

# Close snapshot/notification runtime must use the same accounting configuration.
replace_once(
    'src/services/backgroundCloseTask.ts',
    "import { sendCloseProfitNotification } from './notifications';",
    "import { sendCloseProfitNotification } from './notifications';\nimport { configureAccountingFeeSettings } from '../v3/engine';",
    "import { configureAccountingFeeSettings } from '../v3/engine';"
)
replace_once(
    'src/services/backgroundCloseTask.ts',
    "      const ledger=isV3&&Array.isArray(state.ledger)?state.ledger:[]; const dividends=isV3&&Array.isArray(state.dividends)?state.dividends:[]; const cashBalance=isV3?Number(state.cashBalance??0):0; const snap=buildDailySnapshot(holdings,quotes,ledger,dividends,d,cashBalance);",
    "      const ledger=isV3&&Array.isArray(state.ledger)?state.ledger:[]; const dividends=isV3&&Array.isArray(state.dividends)?state.dividends:[]; const cashBalance=isV3?Number(state.cashBalance??0):0; if(isV3)configureAccountingFeeSettings(state.feeSettings); const snap=buildDailySnapshot(holdings,quotes,ledger,dividends,d,cashBalance);",
    "configureAccountingFeeSettings(state.feeSettings)"
)

print('GOGO_V372_BROKER_PNL_FIX: APPLIED')
