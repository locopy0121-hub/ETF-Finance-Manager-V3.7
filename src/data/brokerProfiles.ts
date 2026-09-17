export type BrokerProfileId = string;
export type RoundingMode = 'floor' | 'round' | 'ceil';
export type UnrealizedPLMode = 'NET' | 'GROSS';

export type BrokerProfile = {
  id: BrokerProfileId;
  name: string;
  commissionRate: number;
  commissionDiscount: number;
  minimumCommissionRoundLot: number;
  minimumCommissionOddLot: number;
  etfSellTaxRate: number;
  stockSellTaxRate: number;
  tradeAmountRounding: RoundingMode;
  commissionRounding: RoundingMode;
  taxRounding: RoundingMode;
  unrealizedPLMode: UnrealizedPLMode;
  includeEstimatedSellFee: boolean;
  includeEstimatedSellTax: boolean;
};

export const DEFAULT_BROKER_PROFILE_ID='default';
export const HUANAN_YONGCHANG_PROFILE_ID='huanan-yongchang';

export const defaultBrokerProfile:BrokerProfile={
  id:DEFAULT_BROKER_PROFILE_ID,name:'App 預設',commissionRate:0.001425,commissionDiscount:1,
  minimumCommissionRoundLot:20,minimumCommissionOddLot:1,etfSellTaxRate:0.001,stockSellTaxRate:0.003,
  tradeAmountRounding:'floor',commissionRounding:'floor',taxRounding:'floor',unrealizedPLMode:'GROSS',
  includeEstimatedSellFee:false,includeEstimatedSellTax:false,
};

// 華南永昌先恢復為正式 Profile；參數可從設定頁查看/調整，後續再用實際成交單校正。
export const huananYongchangBrokerProfile:BrokerProfile={
  ...defaultBrokerProfile,id:HUANAN_YONGCHANG_PROFILE_ID,name:'華南永昌證券',commissionDiscount:0.65,
  unrealizedPLMode:'NET',includeEstimatedSellFee:true,includeEstimatedSellTax:true,
};

export const builtInBrokerProfiles:BrokerProfile[]=[defaultBrokerProfile,huananYongchangBrokerProfile].map(x=>({...x}));
const n=(v:unknown,f:number)=>Number.isFinite(Number(v))?Number(v):f;
export function applyBrokerRounding(v:number,mode:RoundingMode){if(!Number.isFinite(v))return 0;return mode==='ceil'?Math.ceil(v):mode==='round'?Math.round(v):Math.floor(v)}
export function normalizeBrokerProfile(raw:Partial<BrokerProfile>|null|undefined,fallback:BrokerProfile=defaultBrokerProfile):BrokerProfile{const x=raw??{};return {...fallback,...x,id:String(x.id??fallback.id),name:String(x.name??fallback.name),commissionRate:Math.max(0,n(x.commissionRate,fallback.commissionRate)),commissionDiscount:Math.max(0,n(x.commissionDiscount,fallback.commissionDiscount)),minimumCommissionRoundLot:Math.max(0,n(x.minimumCommissionRoundLot,fallback.minimumCommissionRoundLot)),minimumCommissionOddLot:Math.max(0,n(x.minimumCommissionOddLot,fallback.minimumCommissionOddLot)),etfSellTaxRate:Math.max(0,n(x.etfSellTaxRate,fallback.etfSellTaxRate)),stockSellTaxRate:Math.max(0,n(x.stockSellTaxRate,fallback.stockSellTaxRate))}}
export function normalizeBrokerProfiles(raw:unknown):BrokerProfile[]{const src=Array.isArray(raw)?raw:builtInBrokerProfiles;const map=new Map<string,BrokerProfile>();map.set(DEFAULT_BROKER_PROFILE_ID,{...defaultBrokerProfile});for(const item of src){if(!item||typeof item!=='object')continue;const id=String((item as any).id??'').trim();if(!id)continue;const fb=id===HUANAN_YONGCHANG_PROFILE_ID?huananYongchangBrokerProfile:defaultBrokerProfile;map.set(id,normalizeBrokerProfile(item as Partial<BrokerProfile>,fb));}if(!Array.isArray(raw)&&!map.has(HUANAN_YONGCHANG_PROFILE_ID))map.set(HUANAN_YONGCHANG_PROFILE_ID,{...huananYongchangBrokerProfile});return [...map.values()]}
export function createBrokerProfile(name='新券商'):BrokerProfile{return {...defaultBrokerProfile,id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name}}
export function isHuananBroker(v?:string|null){const s=String(v??'').replace(/\s+/g,'').toLowerCase();return s===HUANAN_YONGCHANG_PROFILE_ID||s.includes('華南永昌')}
export function resolveBrokerProfile(id?:string|null,profiles:BrokerProfile[]=builtInBrokerProfiles,legacyName?:string|null):BrokerProfile{const rows=normalizeBrokerProfiles(profiles);const key=String(id??'').trim();if(key){const hit=rows.find(x=>x.id===key);if(hit)return {...hit};}if(isHuananBroker(legacyName)){const h=rows.find(x=>x.id===HUANAN_YONGCHANG_PROFILE_ID);if(h)return {...h};}return {...(rows.find(x=>x.id===DEFAULT_BROKER_PROFILE_ID)??defaultBrokerProfile)}}
export function calculateBrokerTradeAmount(price:number,shares:number,p:BrokerProfile){return applyBrokerRounding(Math.max(0,price)*Math.max(0,shares),p.tradeAmountRounding)}
export function calculateBrokerCommission(amount:number,tradeMode:'ROUND_LOT'|'ODD_LOT',p:BrokerProfile){if(!(amount>0))return 0;const min=tradeMode==='ROUND_LOT'?p.minimumCommissionRoundLot:p.minimumCommissionOddLot;return Math.max(min,applyBrokerRounding(amount*p.commissionRate*p.commissionDiscount,p.commissionRounding))}
export function calculateBrokerSellTax(amount:number,p:BrokerProfile,instrument:'etf'|'stock'='etf'){const rate=instrument==='stock'?p.stockSellTaxRate:p.etfSellTaxRate;return amount>0?applyBrokerRounding(amount*rate,p.taxRounding):0}
