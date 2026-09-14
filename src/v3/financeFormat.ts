export type CurrencyStyle='symbol'|'code'|'plain';
export function roundHalfUp(value:number,digits=2){
 if(!Number.isFinite(value))return 0;
 const f=10**digits;
 return Math.round((value+Number.EPSILON)*f)/f;
}
/**
 * V3.4.2 pure trade-cost rule.
 * Every transaction is calculated independently and fractional currency is discarded.
 * Fees and taxes stay separate from pure trade cost.
 */
export function preciseTradeAmount(price:number,shares:number){
 if(!Number.isFinite(price)||!Number.isFinite(shares)||price<=0||shares<=0)return 0;
 return Math.floor(price*shares);
}
export function formatMoney(value:number,digits=2,style:CurrencyStyle='symbol'){
 const n=roundHalfUp(value,digits).toLocaleString('zh-TW',{minimumFractionDigits:digits,maximumFractionDigits:digits});
 return n;
}
export function truncateCurrency(value:number){return Number.isFinite(value)?Math.trunc(value):0;}
