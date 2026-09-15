export type FeeDiscountMode = 'instant' | 'monthlyRebate';
export type OrderChannel = 'electronic' | 'manual' | 'sip';
export type TradeLotType = 'board' | 'odd' | 'sip';

export type FeeSettings = {
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
 * For brokers that rebate discounts monthly, this is the pre-rebate charge;
 * the economic net fee is available from estimateCommissionQuote().netFee.
 */
export function estimateBuyFee(tradeAmount:number,settings:FeeSettings){
  return estimateCommissionQuote(tradeAmount,settings).chargedFee;
}

export function estimateSellFee(tradeAmount:number,settings:FeeSettings){return estimateCommissionQuote(tradeAmount,settings).chargedFee;}
export function estimateEtfSellTax(tradeAmount:number,taxRate=0.001){if(!Number.isFinite(tradeAmount)||tradeAmount<=0)return 0;return Math.floor(tradeAmount*Math.max(0,Number(taxRate)||0));}
export function estimateSellTaxBySettings(tradeAmount:number,settings:FeeSettings){return estimateEtfSellTax(tradeAmount,settings.etfSellTaxRate??0.001);}

/**
 * Convenience builder for Huanan/SinoPac-like brokerage profiles where the
 * electronic discount may be rebated after month-end instead of reducing the
 * transaction-day charge. The actual minimum fee and discount remain user/profile data.
 */
export function makeHuananFeeSettings(args:{discount:number;minimumFee:number;discountMode?:FeeDiscountMode;orderChannel?:OrderChannel;lotType?:TradeLotType}):FeeSettings{
  return {
    brokerName:'華南永昌證券',
    feeRate:0.001425,
    discount:args.discount,
    minimumFee:args.minimumFee,
    discountMode:args.discountMode??'monthlyRebate',
    orderChannel:args.orderChannel??'electronic',
    lotType:args.lotType??'board',
    etfSellTaxRate:0.001,
  };
}
