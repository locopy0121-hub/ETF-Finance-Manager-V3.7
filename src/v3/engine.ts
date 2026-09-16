import type { Holding } from '../data/portfolio';
import type { DividendEvent } from '../screens/DividendCalendarScreen';
import type { LedgerEntry } from './model';
import {
  builtInBrokerProfiles,
  defaultBrokerProfile,
  defaultFeeSettings,
  estimateBrokerBookValue,
  resolveBrokerProfile,
  normalizeBrokerProfiles,
  roundForDisplay,
  type BrokerProfile,
  type FeeSettings,
} from '../data/tradeSettings';
import * as Base from './engineBase';

export * from './engineBase';

let runtimeBrokerProfiles:BrokerProfile[]=normalizeBrokerProfiles(undefined);
export function configureBrokerProfiles(profiles:BrokerProfile[]|undefined){ runtimeBrokerProfiles=normalizeBrokerProfiles(profiles); }
export function configuredBrokerProfiles(){ return runtimeBrokerProfiles.map(p=>({...p})); }

/**
 * The cost-pool formulas are public/common. No broker-specific write-off layer is allowed here.
 */
export const positionCostStats = Base.positionCostStats;

type QuoteLike={price?:number;change?:number;changePercent?:number;previousClose?:number;open?:number;high?:number;low?:number;volume?:number;nav?:number;quoteDate?:string;quoteTime?:string};

function legacySettingsProfile(settings:FeeSettings):BrokerProfile{
  const resolved=resolveBrokerProfile(settings.brokerProfileId,builtInBrokerProfiles,settings.brokerName);
  return {
    ...resolved,
    commissionRate:Number(settings.feeRate??resolved.commissionRate),
    commissionDiscount:Number(settings.discount??resolved.commissionDiscount),
    minimumCommission:Number(settings.minimumFee??resolved.minimumCommission),
    discountMode:settings.discountMode??resolved.discountMode,
    orderChannel:settings.orderChannel??resolved.orderChannel,
    lotType:settings.lotType??resolved.lotType,
    etfSellTaxRate:Number(settings.etfSellTaxRate??resolved.etfSellTaxRate),
    stockSellTaxRate:Number(settings.stockSellTaxRate??resolved.stockSellTaxRate),
    unrealizedPLMode:settings.unrealizedPLMode??resolved.unrealizedPLMode,
    marketValueMode:settings.marketValueMode??resolved.marketValueMode,
    includeEstimatedSellFee:settings.includeEstimatedSellFee??resolved.includeEstimatedSellFee,
    includeEstimatedSellTax:settings.includeEstimatedSellTax??resolved.includeEstimatedSellTax,
  };
}

export function holdingBrokerProfile(
  h:Holding,
  feeSettings:FeeSettings=defaultFeeSettings,
  brokerProfiles:BrokerProfile[]=runtimeBrokerProfiles,
):BrokerProfile{
  const globalProfile=legacySettingsProfile(feeSettings);
  const explicitId=String(h.brokerProfileId??'').trim();
  const explicitBroker=String(h.broker??'').trim();
  const hasExplicit=Boolean(explicitId||explicitBroker);
  const resolved=hasExplicit
    ? resolveBrokerProfile(explicitId||undefined,brokerProfiles,explicitBroker||undefined)
    : resolveBrokerProfile(globalProfile.id,brokerProfiles,globalProfile.name);
  return {
    ...resolved,
    commissionRate:Number(h.feeRate??resolved.commissionRate),
    commissionDiscount:Number(h.feeDiscount??resolved.commissionDiscount),
  };
}

export function holdingMetrics(
  h:Holding,
  quotes:Record<string,QuoteLike>,
  ledger:LedgerEntry[]=[],
  dividends:DividendEvent[]=[],
  feeSettings:FeeSettings=defaultFeeSettings,
  brokerProfiles:BrokerProfile[]=runtimeBrokerProfiles,
){
  const q=quotes[h.symbol]??{};
  const price=Base.quotePrice(h,quotes);
  const c=Base.positionCostStats(h,ledger);
  const grossMarketValue=price*h.shares;
  const profile=holdingBrokerProfile(h,feeSettings,brokerProfiles);
  const book=estimateBrokerBookValue(grossMarketValue,profile);
  const estimatedSellFee=profile.includeEstimatedSellFee?book.sellFee:0;
  const estimatedSellTax=profile.includeEstimatedSellTax?book.sellTax:0;
  const netLiquidationValue=book.grossAmount-estimatedSellFee-estimatedSellTax;
  const useNet=profile.unrealizedPLMode==='NET'||profile.marketValueMode==='netLiquidation';
  const marketValue=useNet?netLiquidationValue:grossMarketValue;

  const pricePnl=grossMarketValue-c.currentTradeCost;
  const cashPnl=grossMarketValue-c.currentCashBasis;
  const netPnl=netLiquidationValue-c.currentCashBasis;
  const pnl=marketValue-c.currentCashBasis;
  const priceRoi=c.currentTradeCost>0?pricePnl/c.currentTradeCost*100:0;
  const cashRoi=c.currentCashBasis>0?cashPnl/c.currentCashBasis*100:0;
  const netRoi=c.currentCashBasis>0?netPnl/c.currentCashBasis*100:0;
  const rawRoi=c.currentCashBasis>0?pnl/c.currentCashBasis*100:0;
  const roi=roundForDisplay(rawRoi,profile.roiDisplayMode,profile.roiDigits);

  const prev=Number(q.previousClose??price);
  const todayPnl=(price-prev)*h.shares;
  const prevValue=prev*h.shares;
  const todayPnlPct=prevValue>0?todayPnl/prevValue*100:0;
  const cumulativeDividend=Base.dividendTotals(ledger,dividends,h.symbol);
  const comprehensivePnl=pnl+c.realizedCashPnl+cumulativeDividend;
  const comprehensiveRoi=c.historicalCashOutflow>0?comprehensivePnl/c.historicalCashOutflow*100:0;
  const costYield=c.currentCashBasis>0?cumulativeDividend/c.currentCashBasis*100:0;
  const effectiveAvg=h.shares>0?c.currentCashBasis/h.shares:0;
  const displayedCashAvg=roundForDisplay(effectiveAvg,profile.avgCostDisplayMode,profile.avgCostDigits);
  const displayedAvg=profile.avgCostDisplayMode==='raw'?c.avgTradePrice:displayedCashAvg;

  return {
    price,
    brokerProfileId:profile.id,
    brokerProfileName:profile.name,
    unrealizedPLMode:profile.unrealizedPLMode,
    pureCost:c.currentTradeCost,
    totalFees:c.currentAllocatedBuyFees,
    totalCost:c.currentCashBasis,
    historicalTradeCost:c.historicalTradeCost,
    historicalBuyFees:c.historicalBuyFees,
    historicalCashOutflow:c.historicalCashOutflow,
    grossMarketValue,
    marketValue,
    brokerBookValue:netLiquidationValue,
    netLiquidationValue,
    brokerSellFee:estimatedSellFee,
    brokerSellTax:estimatedSellTax,
    brokerPnl:netPnl,
    pnl,
    pricePnl,
    cashPnl,
    roi,
    priceRoi,
    cashRoi,
    brokerRoi:netRoi,
    comprehensivePnl,
    comprehensiveRoi,
    avgCost:displayedAvg,
    cashAvgCost:displayedCashAvg,
    realizedPricePnl:c.realizedPricePnl,
    realizedCashPnl:c.realizedCashPnl,
    todayPnl,
    todayPnlPct,
    cumulativeDividend,
    costYield,
    previousClose:q.previousClose,
    open:q.open,
    high:q.high,
    low:q.low,
    volume:q.volume,
    nav:q.nav,
    quoteDate:q.quoteDate,
    quoteTime:q.quoteTime,
  };
}

export function portfolioMetrics(
  holdings:Holding[],
  quotes:Record<string,QuoteLike>,
  cashBalance:number,
  ledger:LedgerEntry[],
  dividends:DividendEvent[],
  feeSettings:FeeSettings=defaultFeeSettings,
  brokerProfiles:BrokerProfile[]=runtimeBrokerProfiles,
){
  const base=Base.portfolioMetrics(holdings,quotes,cashBalance,ledger,dividends);
  const metrics=holdings.map(h=>holdingMetrics(h,quotes,ledger,dividends,feeSettings,brokerProfiles));
  const currentTradeCost=metrics.reduce((s,m)=>s+m.pureCost,0);
  const currentAllocatedBuyFees=metrics.reduce((s,m)=>s+m.totalFees,0);
  const currentCashBasis=metrics.reduce((s,m)=>s+m.totalCost,0);
  const grossMarketValue=metrics.reduce((s,m)=>s+m.grossMarketValue,0);
  const marketValue=metrics.reduce((s,m)=>s+m.marketValue,0);
  const brokerBookValue=metrics.reduce((s,m)=>s+m.brokerBookValue,0);
  const unrealizedPnl=metrics.reduce((s,m)=>s+m.pnl,0);
  const realizedCashPnl=metrics.reduce((s,m)=>s+m.realizedCashPnl,0);
  const historicalTradeCost=metrics.reduce((s,m)=>s+m.historicalTradeCost,0);
  const historicalBuyFees=metrics.reduce((s,m)=>s+m.historicalBuyFees,0);
  const historicalCashOutflow=historicalTradeCost+historicalBuyFees;
  const comprehensivePnl=unrealizedPnl+realizedCashPnl+base.cumulativeDividends;
  const totalPnl=comprehensivePnl;
  const rawTotalRoi=historicalCashOutflow>0?totalPnl/historicalCashOutflow*100:0;
  const profileModes=holdings.map(h=>holdingBrokerProfile(h,feeSettings,brokerProfiles));
  const firstProfile=profileModes[0]??defaultBrokerProfile;
  const sameDisplayRule=profileModes.length>0&&profileModes.every(p=>p.roiDisplayMode===firstProfile.roiDisplayMode&&p.roiDigits===firstProfile.roiDigits);
  const totalRoi=sameDisplayRule?roundForDisplay(rawTotalRoi,firstProfile.roiDisplayMode,firstProfile.roiDigits):rawTotalRoi;
  const safeCash=Number.isFinite(Number(cashBalance))?Number(cashBalance):0;
  const totalAssets=marketValue+safeCash;
  const accountEquity=totalAssets;

  return {
    ...base,
    historicalTradeCost,
    historicalBuyFees,
    historicalCashOutflow,
    currentTradeCost,
    currentAllocatedBuyFees,
    currentCashBasis,
    grossMarketValue,
    marketValue,
    brokerBookValue,
    brokerUnrealizedPnl:unrealizedPnl,
    realizedCashPnl,
    comprehensivePnl,
    totalPnl,
    totalRoi,
    totalAssets,
    accountEquity,
    totalInvestedCost:historicalCashOutflow,
    currentCost:currentCashBasis,
    totalFees:historicalBuyFees,
    unrealizedPnl,
    realizedPnl:realizedCashPnl,
  };
}
