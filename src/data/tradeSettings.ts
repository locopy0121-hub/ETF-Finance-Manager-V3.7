export type BrokerProfileId = 'custom' | 'huanan-yongchang';
export type FeeDiscountMode = 'instant' | 'monthlyRebate';
export type OrderChannel = 'electronic' | 'manual' | 'sip';
export type TradeLotType = 'board' | 'odd' | 'sip';

export type FeeSettings = {
  brokerProfileId?: BrokerProfileId;
  brokerName: string;
  feeRate: number;      // e.g. 0.001425 = 0.1425%
  discount: number;     // economic discount target, e.g. 0.6 = 6 折
  minimumFee: number;   // broker/order-channel specific minimum fee; never treat as a statutory constant
  discountMode?: FeeDiscountMode;
  orderChannel?: OrderChannel;
  lotType?: TradeLotType;
  etfSellTaxRate?: number;
};

export type CommissionQuote = {
  grossFee: number;
  chargedFee: number;
  expectedRebate: number;
  netFee: number;
  mode: FeeDiscountMode;
};

export const defaultFeeSettings: FeeSettings = {
  brokerProfileId: 'custom',
  brokerName: '自訂券商',
  feeRate: 0.001425,
  discount: 1,
  minimumFee: 1,
  discountMode: 'instant',
  orderChannel: 'electronic',
  lotType: 'board',
  etfSellTaxRate: 0.001,
};

export function estimateCommissionQuote(tradeAmount:number,settings:FeeSettings):CommissionQuote{
  if(!Number.isFinite(tradeAmount)||tradeAmount<=0)return {grossFee:0,chargedFee:0,expectedRebate:0,netFee:0,mode:settings.discountMode??'instant'};
  const rate=Math.max(0,Number(settings.feeRate)||0);
  const discount=Math.max(0,Number(settings.discount)||0);
  const minimum=Math.max(0,Math.floor(Number(settings.minimumFee)||0));
  const grossFee=Math.max(minimum,Math.floor(tradeAmount*rate));
  const discounted=Math.max(minimum,Math.floor(tradeAmount*rate*discount));
  const mode=settings.discountMode??'instant';
  if(mode==='monthlyRebate'){
    const chargedFee=grossFee;
    const expectedRebate=Math.max(0,chargedFee-discounted);
    return {grossFee,chargedFee,expectedRebate,netFee:chargedFee-expectedRebate,mode};
  }
  return {grossFee,chargedFee:discounted,expectedRebate:0,netFee:discounted,mode};
}

/**
 * Returns the fee expected to be charged at transaction/settlement time.
 * Historical broker corrections are never injected here; they are separate ledger adjustments.
 */
export function estimateBuyFee(tradeAmount:number,settings:FeeSettings){
  return estimateCommissionQuote(tradeAmount,settings).chargedFee;
}

export function estimateSellFee(tradeAmount:number,settings:FeeSettings){return estimateCommissionQuote(tradeAmount,settings).chargedFee;}
export function estimateEtfSellTax(tradeAmount:number,taxRate=0.001){if(!Number.isFinite(tradeAmount)||tradeAmount<=0)return 0;return Math.floor(tradeAmount*Math.max(0,Number(taxRate)||0));}
export function estimateSellTaxBySettings(tradeAmount:number,settings:FeeSettings){return estimateEtfSellTax(tradeAmount,settings.etfSellTaxRate??0.001);}

/**
 * Huanan Yongchang profile derived from the supplied broker transaction/holding screenshots.
 * Every transaction is handled independently: floor(price*shares) first, then fee calculation.
 * Historical one-off broker corrections are recorded by the cash/cost write-off flow, not here.
 */
export function makeHuananFeeSettings(args:{discount?:number;minimumFee?:number;discountMode?:FeeDiscountMode;orderChannel?:OrderChannel;lotType?:TradeLotType}={}):FeeSettings{
  return {
    brokerProfileId:'huanan-yongchang',
    brokerName:'華南永昌證券',
    feeRate:0.001425,
    discount:args.discount??1,
    minimumFee:args.minimumFee??1,
    discountMode:args.discountMode??'instant',
    orderChannel:args.orderChannel??'electronic',
    lotType:args.lotType??'board',
    etfSellTaxRate:0.001,
  };
}

export const huananYongchangFeeSettings:FeeSettings=makeHuananFeeSettings();

export function isHuananBroker(value?:string){
  return String(value??'').replace(/\s+/g,'').includes('華南永昌');
}

/**
 * Resolve a fee strategy for one holding. An explicitly named holding broker wins over
 * the global default so selecting Huanan as the default never changes another broker's
 * existing holdings. Holdings without a broker inherit the current global profile.
 */
export function resolveBrokerFeeSettings(broker:string|undefined,settings:FeeSettings=defaultFeeSettings):FeeSettings{
  const brokerName=String(broker??'').trim();
  const hasBroker=brokerName.length>0;
  const globalHuanan=settings.brokerProfileId==='huanan-yongchang'||isHuananBroker(settings.brokerName);
  if(isHuananBroker(brokerName)){
    return globalHuanan?{...settings,brokerProfileId:'huanan-yongchang',brokerName:'華南永昌證券'}:huananYongchangFeeSettings;
  }
  if(!hasBroker&&globalHuanan){
    return {...settings,brokerProfileId:'huanan-yongchang',brokerName:'華南永昌證券'};
  }
  if(hasBroker&&globalHuanan){
    return {...defaultFeeSettings,brokerName};
  }
  return settings;
}

export function truncateTowardZero(value:number,digits=2){
  if(!Number.isFinite(value))return 0;
  const f=10**Math.max(0,Math.trunc(digits));
  return Math.trunc(value*f)/f;
}

export type BrokerBookValueEstimate={
  grossAmount:number;
  sellFee:number;
  sellTax:number;
  bookValue:number;
};

export function estimateBrokerBookValue(tradeAmount:number,settings:FeeSettings):BrokerBookValueEstimate{
  const grossAmount=Math.floor(Math.max(0,Number(tradeAmount)||0));
  if(grossAmount<=0)return {grossAmount:0,sellFee:0,sellTax:0,bookValue:0};
  const sellFee=estimateSellFee(grossAmount,settings);
  const sellTax=estimateSellTaxBySettings(grossAmount,settings);
  return {grossAmount,sellFee,sellTax,bookValue:grossAmount-sellFee-sellTax};
}
