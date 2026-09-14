export type FeeSettings = {
  brokerName: string;
  feeRate: number;      // e.g. 0.001425 = 0.1425%
  discount: number;     // e.g. 0.28 = 2.8 折
  minimumFee: number;   // broker-specific minimum fee
};

export const defaultFeeSettings: FeeSettings = {
  brokerName: '自訂券商',
  feeRate: 0.001425,
  discount: 1,
  minimumFee: 1,
};

export function estimateBuyFee(tradeAmount: number, settings: FeeSettings) {
  if (!Number.isFinite(tradeAmount) || tradeAmount <= 0) return 0;
  const raw = tradeAmount * settings.feeRate * settings.discount;
  // Broker implementations may round differently; actual-fee override is supported on entry.
  return Math.max(settings.minimumFee, Math.floor(raw));
}

export function estimateSellFee(tradeAmount:number,settings:FeeSettings){return estimateBuyFee(tradeAmount,settings);}
export function estimateEtfSellTax(tradeAmount:number,taxRate=0.001){if(!Number.isFinite(tradeAmount)||tradeAmount<=0)return 0;return Math.floor(tradeAmount*taxRate);}
