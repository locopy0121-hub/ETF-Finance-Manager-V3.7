export type BrokerProfileId = string;
export type FeeDiscountMode = 'instant' | 'monthlyRebate';
export type OrderChannel = 'electronic' | 'manual' | 'sip';
export type TradeLotType = 'board' | 'odd' | 'sip';
export type RoundingMode = 'floor' | 'round' | 'ceil';
export type DisplayRoundingMode = 'raw' | 'truncate' | 'round';
export type CostPoolMethod = 'movingWeightedAverage';
export type UnrealizedPLMode = 'NET' | 'GROSS';
export type MarketValueMode = 'netLiquidation' | 'gross';
export type TruncateRule = 'NONE' | 'TRUNCATE_2_DECIMALS' | 'ROUND_2_DECIMALS';

/**
 * Canonical broker configuration consumed by the single public finance engine.
 * Broker differences belong here; formulas stay shared.
 */
export type BrokerProfile = {
  id: BrokerProfileId;
  name: string;

  commissionRate: number;
  commissionDiscount: number;
  minimumCommission: number;
  discountMode: FeeDiscountMode;
  orderChannel: OrderChannel;
  lotType: TradeLotType;

  etfSellTaxRate: number;
  stockSellTaxRate: number;

  tradeAmountRounding: RoundingMode;
  commissionRounding: RoundingMode;
  taxRounding: RoundingMode;

  costPoolMethod: CostPoolMethod;

  avgCostDisplayMode: DisplayRoundingMode;
  avgCostDigits: number;
  roiDisplayMode: DisplayRoundingMode;
  roiDigits: number;

  unrealizedPLMode: UnrealizedPLMode;
  marketValueMode: MarketValueMode;
  includeEstimatedSellFee: boolean;
  includeEstimatedSellTax: boolean;
  truncateRule: TruncateRule;
};

/** Legacy compatibility shape used by existing V3 settings/forms. */
export type FeeSettings = {
  brokerProfileId?: BrokerProfileId;
  brokerName: string;
  feeRate: number;
  discount: number;
  minimumFee: number;
  discountMode?: FeeDiscountMode;
  orderChannel?: OrderChannel;
  lotType?: TradeLotType;
  etfSellTaxRate?: number;
  stockSellTaxRate?: number;
  unrealizedPLMode?: UnrealizedPLMode;
  marketValueMode?: MarketValueMode;
  includeEstimatedSellFee?: boolean;
  includeEstimatedSellTax?: boolean;
};

export const DEFAULT_BROKER_PROFILE_ID = 'default';
export const HUANAN_YONGCHANG_PROFILE_ID = 'huanan-yongchang';

/** Existing App finance behavior is the default/fallback profile. */
export const defaultBrokerProfile: BrokerProfile = {
  id: DEFAULT_BROKER_PROFILE_ID,
  name: 'App 預設',
  commissionRate: 0.001425,
  commissionDiscount: 1,
  minimumCommission: 1,
  discountMode: 'instant',
  orderChannel: 'electronic',
  lotType: 'board',
  etfSellTaxRate: 0.001,
  stockSellTaxRate: 0.003,
  tradeAmountRounding: 'floor',
  commissionRounding: 'floor',
  taxRounding: 'floor',
  costPoolMethod: 'movingWeightedAverage',
  avgCostDisplayMode: 'raw',
  avgCostDigits: 2,
  roiDisplayMode: 'raw',
  roiDigits: 2,
  unrealizedPLMode: 'GROSS',
  marketValueMode: 'gross',
  includeEstimatedSellFee: false,
  includeEstimatedSellTax: false,
  truncateRule: 'NONE',
};

/** Approved Huanan Yongchang values. Formulas remain the same public formulas. */
export const huananYongchangBrokerProfile: BrokerProfile = {
  ...defaultBrokerProfile,
  id: HUANAN_YONGCHANG_PROFILE_ID,
  name: '華南永昌證券',
  commissionRate: 0.001425,
  commissionDiscount: 0.65,
  minimumCommission: 20,
  etfSellTaxRate: 0.001,
  stockSellTaxRate: 0.003,
  tradeAmountRounding: 'floor',
  commissionRounding: 'floor',
  taxRounding: 'floor',
  costPoolMethod: 'movingWeightedAverage',
  avgCostDisplayMode: 'truncate',
  avgCostDigits: 2,
  roiDisplayMode: 'truncate',
  roiDigits: 2,
  unrealizedPLMode: 'NET',
  marketValueMode: 'netLiquidation',
  includeEstimatedSellFee: true,
  includeEstimatedSellTax: true,
  truncateRule: 'TRUNCATE_2_DECIMALS',
};

export const builtInBrokerProfiles: BrokerProfile[] = [
  defaultBrokerProfile,
  huananYongchangBrokerProfile,
].map(profile => ({ ...profile }));

const finiteOr = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export function normalizeBrokerProfile(
  input: Partial<BrokerProfile> | undefined | null,
  fallback: BrokerProfile = defaultBrokerProfile,
): BrokerProfile {
  const value = input ?? {};
  return {
    ...fallback,
    ...value,
    id: String(value.id ?? fallback.id),
    name: String(value.name ?? fallback.name),
    commissionRate: finiteOr(value.commissionRate, fallback.commissionRate),
    commissionDiscount: finiteOr(value.commissionDiscount, fallback.commissionDiscount),
    minimumCommission: Math.max(0, finiteOr(value.minimumCommission, fallback.minimumCommission)),
    etfSellTaxRate: Math.max(0, finiteOr(value.etfSellTaxRate, fallback.etfSellTaxRate)),
    stockSellTaxRate: Math.max(0, finiteOr(value.stockSellTaxRate, fallback.stockSellTaxRate)),
    avgCostDigits: Math.max(0, Math.floor(finiteOr(value.avgCostDigits, fallback.avgCostDigits))),
    roiDigits: Math.max(0, Math.floor(finiteOr(value.roiDigits, fallback.roiDigits))),
  };
}

/** New brokers always start from the complete App default profile. */
export function createBrokerProfileFromDefault(args: { id: string; name: string; overrides?: Partial<BrokerProfile> }): BrokerProfile {
  return normalizeBrokerProfile({
    ...defaultBrokerProfile,
    ...(args.overrides ?? {}),
    id: args.id,
    name: args.name,
  });
}

export function normalizeBrokerProfiles(raw: unknown): BrokerProfile[] {
  const source = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, BrokerProfile>();
  byId.set(defaultBrokerProfile.id, { ...defaultBrokerProfile });
  byId.set(huananYongchangBrokerProfile.id, { ...huananYongchangBrokerProfile });
  for (const candidate of source) {
    if (!candidate || typeof candidate !== 'object') continue;
    const obj = candidate as Partial<BrokerProfile>;
    const id = String(obj.id ?? '').trim();
    if (!id) continue;
    const fallback = id === HUANAN_YONGCHANG_PROFILE_ID ? huananYongchangBrokerProfile : defaultBrokerProfile;
    byId.set(id, normalizeBrokerProfile(obj, fallback));
  }
  // Built-ins are authoritative for their finance contract.
  byId.set(defaultBrokerProfile.id, { ...defaultBrokerProfile });
  byId.set(huananYongchangBrokerProfile.id, { ...huananYongchangBrokerProfile });
  return Array.from(byId.values());
}

export function isHuananBroker(value?: string | null): boolean {
  const normalized = String(value ?? '').replace(/\s+/g, '').toLowerCase();
  return normalized === HUANAN_YONGCHANG_PROFILE_ID || normalized.includes('華南永昌');
}

/**
 * Resolve by stable id first. A legacy broker display name is only a migration fallback.
 * Unknown/deleted ids safely fall back to App Default.
 */
export function resolveBrokerProfile(
  brokerProfileId?: string | null,
  profiles: BrokerProfile[] = builtInBrokerProfiles,
  legacyBrokerName?: string | null,
): BrokerProfile {
  const normalized = normalizeBrokerProfiles(profiles);
  const id = String(brokerProfileId ?? '').trim();
  if (id) {
    const found = normalized.find(profile => profile.id === id);
    return found ? { ...found } : { ...defaultBrokerProfile };
  }
  if (isHuananBroker(legacyBrokerName)) return { ...huananYongchangBrokerProfile };
  return { ...defaultBrokerProfile };
}

export function applyRounding(value: number, mode: RoundingMode): number {
  if (!Number.isFinite(value)) return 0;
  if (mode === 'ceil') return Math.ceil(value);
  if (mode === 'round') return Math.round(value);
  return Math.floor(value);
}

export function truncateTowardZero(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** Math.max(0, digits);
  return Math.trunc(value * factor) / factor;
}

export function roundForDisplay(value: number, mode: DisplayRoundingMode, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  if (mode === 'raw') return value;
  if (mode === 'truncate') return truncateTowardZero(value, digits);
  const factor = 10 ** Math.max(0, digits);
  return Math.round(value * factor) / factor;
}

const profileLike = (settings: FeeSettings | BrokerProfile = defaultBrokerProfile) => {
  const canonical = 'commissionRate' in settings;
  return {
    commissionRate: finiteOr(canonical ? settings.commissionRate : settings.feeRate, defaultBrokerProfile.commissionRate),
    commissionDiscount: finiteOr(canonical ? settings.commissionDiscount : settings.discount, defaultBrokerProfile.commissionDiscount),
    minimumCommission: Math.max(0, finiteOr(canonical ? settings.minimumCommission : settings.minimumFee, defaultBrokerProfile.minimumCommission)),
    commissionRounding: canonical ? settings.commissionRounding : defaultBrokerProfile.commissionRounding,
    etfSellTaxRate: Math.max(0, finiteOr(settings.etfSellTaxRate, defaultBrokerProfile.etfSellTaxRate)),
    stockSellTaxRate: Math.max(0, finiteOr(settings.stockSellTaxRate, defaultBrokerProfile.stockSellTaxRate)),
    taxRounding: canonical ? settings.taxRounding : defaultBrokerProfile.taxRounding,
    discountMode: settings.discountMode ?? defaultBrokerProfile.discountMode,
  };
};

export type CommissionQuote = {
  tradeAmount: number;
  grossFee: number;
  chargedFee: number;
  rebate: number;
};

export function estimateCommissionQuote(tradeAmount: number, settings: FeeSettings | BrokerProfile = defaultBrokerProfile): CommissionQuote {
  const p = profileLike(settings);
  const amount = Math.max(0, Number(tradeAmount) || 0);
  const grossFee = Math.max(p.minimumCommission, applyRounding(amount * p.commissionRate, p.commissionRounding));
  const discounted = Math.max(p.minimumCommission, applyRounding(amount * p.commissionRate * p.commissionDiscount, p.commissionRounding));
  if (p.discountMode === 'monthlyRebate') {
    return { tradeAmount: amount, grossFee, chargedFee: grossFee, rebate: Math.max(0, grossFee - discounted) };
  }
  return { tradeAmount: amount, grossFee, chargedFee: discounted, rebate: 0 };
}

export function estimateBuyFee(tradeAmount: number, settings: FeeSettings | BrokerProfile = defaultBrokerProfile): number {
  return estimateCommissionQuote(tradeAmount, settings).chargedFee;
}

export function estimateSellFee(tradeAmount: number, settings: FeeSettings | BrokerProfile = defaultBrokerProfile): number {
  return estimateCommissionQuote(tradeAmount, settings).chargedFee;
}

export function estimateEtfSellTax(tradeAmount: number, taxRate = defaultBrokerProfile.etfSellTaxRate): number {
  return applyRounding(Math.max(0, Number(tradeAmount) || 0) * Math.max(0, Number(taxRate) || 0), defaultBrokerProfile.taxRounding);
}

export function estimateSellTaxByProfile(
  tradeAmount: number,
  profile: BrokerProfile = defaultBrokerProfile,
  instrumentType: 'etf' | 'stock' = 'etf',
): number {
  const rate = instrumentType === 'stock' ? profile.stockSellTaxRate : profile.etfSellTaxRate;
  return applyRounding(Math.max(0, Number(tradeAmount) || 0) * rate, profile.taxRounding);
}

export function estimateSellTaxBySettings(tradeAmount: number, settings: FeeSettings | BrokerProfile = defaultBrokerProfile): number {
  const p = profileLike(settings);
  return applyRounding(Math.max(0, Number(tradeAmount) || 0) * p.etfSellTaxRate, p.taxRounding);
}

export function estimateBrokerBookValue(
  tradeAmount: number,
  settings: FeeSettings | BrokerProfile = defaultBrokerProfile,
  instrumentType: 'etf' | 'stock' = 'etf',
) {
  const canonical = 'commissionRate' in settings ? settings : null;
  const grossAmount = canonical
    ? applyRounding(Math.max(0, Number(tradeAmount) || 0), canonical.tradeAmountRounding)
    : Math.floor(Math.max(0, Number(tradeAmount) || 0));
  const sellFee = estimateSellFee(grossAmount, settings);
  const sellTax = canonical
    ? estimateSellTaxByProfile(grossAmount, canonical, instrumentType)
    : estimateSellTaxBySettings(grossAmount, settings);
  return { grossAmount, sellFee, sellTax, bookValue: grossAmount - sellFee - sellTax };
}

export function profileToFeeSettings(profile: BrokerProfile): FeeSettings {
  return {
    brokerProfileId: profile.id,
    brokerName: profile.name,
    feeRate: profile.commissionRate,
    discount: profile.commissionDiscount,
    minimumFee: profile.minimumCommission,
    discountMode: profile.discountMode,
    orderChannel: profile.orderChannel,
    lotType: profile.lotType,
    etfSellTaxRate: profile.etfSellTaxRate,
    stockSellTaxRate: profile.stockSellTaxRate,
    unrealizedPLMode: profile.unrealizedPLMode,
    marketValueMode: profile.marketValueMode,
    includeEstimatedSellFee: profile.includeEstimatedSellFee,
    includeEstimatedSellTax: profile.includeEstimatedSellTax,
  };
}

export const defaultFeeSettings: FeeSettings = profileToFeeSettings(defaultBrokerProfile);

export function makeHuananFeeSettings(args: Partial<FeeSettings> = {}): FeeSettings {
  return {
    ...profileToFeeSettings(huananYongchangBrokerProfile),
    ...args,
    brokerProfileId: HUANAN_YONGCHANG_PROFILE_ID,
    brokerName: args.brokerName ?? huananYongchangBrokerProfile.name,
  };
}

export const huananYongchangFeeSettings: FeeSettings = makeHuananFeeSettings();

/** Legacy resolver retained for existing forms while state migrates to BrokerProfile[]. */
export function resolveBrokerFeeSettings(broker?: string | null, settings: FeeSettings = defaultFeeSettings): FeeSettings {
  const hasBroker = Boolean(String(broker ?? '').trim());
  if (hasBroker && isHuananBroker(broker)) return makeHuananFeeSettings();
  if (hasBroker) return { ...settings, brokerProfileId: settings.brokerProfileId ?? DEFAULT_BROKER_PROFILE_ID, brokerName: String(broker) };
  if (settings.brokerProfileId === HUANAN_YONGCHANG_PROFILE_ID || isHuananBroker(settings.brokerName)) return makeHuananFeeSettings(settings);
  return { ...defaultFeeSettings, ...settings, brokerProfileId: settings.brokerProfileId ?? DEFAULT_BROKER_PROFILE_ID };
}
