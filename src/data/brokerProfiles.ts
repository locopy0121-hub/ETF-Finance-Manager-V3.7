import { HUANAN_CONFIG } from '../types/etf';

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

export const DEFAULT_BROKER_PROFILE_ID = 'default';
export const HUANAN_YONGCHANG_PROFILE_ID = 'huanan-yongchang';

const canonicalFinanceFields = {
  commissionRate: HUANAN_CONFIG.COMMISSION_RATE,
  commissionDiscount: HUANAN_CONFIG.COMMISSION_DISCOUNT,
  minimumCommissionRoundLot: HUANAN_CONFIG.MIN_COMMISSION_ROUND_LOT,
  minimumCommissionOddLot: HUANAN_CONFIG.MIN_COMMISSION_ODD_LOT,
  etfSellTaxRate: HUANAN_CONFIG.ETF_SELL_TAX_RATE,
  stockSellTaxRate: HUANAN_CONFIG.STOCK_SELL_TAX_RATE,
  tradeAmountRounding: 'floor' as const,
  commissionRounding: 'floor' as const,
  taxRounding: 'floor' as const,
  unrealizedPLMode: 'NET' as const,
  includeEstimatedSellFee: true,
  includeEstimatedSellTax: true,
};

export const defaultBrokerProfile: BrokerProfile = {
  id: DEFAULT_BROKER_PROFILE_ID,
  name: 'App 預設',
  ...canonicalFinanceFields,
};

export const huananYongchangBrokerProfile: BrokerProfile = {
  id: HUANAN_YONGCHANG_PROFILE_ID,
  name: '華南永昌證券',
  ...canonicalFinanceFields,
};

export const builtInBrokerProfiles: BrokerProfile[] = [
  defaultBrokerProfile,
  huananYongchangBrokerProfile,
].map((profile) => ({ ...profile }));

export function applyBrokerRounding(value: number, _mode: RoundingMode) {
  return Number.isFinite(value) ? Math.floor(value) : 0;
}

/**
 * Persisted profiles keep identity/name only. Canonical finance parameters are immutable.
 */
export function normalizeBrokerProfile(
  raw: Partial<BrokerProfile> | null | undefined,
  fallback: BrokerProfile = defaultBrokerProfile,
): BrokerProfile {
  return {
    id: String(raw?.id ?? fallback.id),
    name: String(raw?.name ?? fallback.name),
    ...canonicalFinanceFields,
  };
}

export function normalizeBrokerProfiles(raw: unknown): BrokerProfile[] {
  const source = Array.isArray(raw) ? raw : builtInBrokerProfiles;
  const map = new Map<string, BrokerProfile>();
  map.set(DEFAULT_BROKER_PROFILE_ID, { ...defaultBrokerProfile });

  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const id = String((item as Partial<BrokerProfile>).id ?? '').trim();
    if (!id) continue;
    const fallback = id === HUANAN_YONGCHANG_PROFILE_ID
      ? huananYongchangBrokerProfile
      : defaultBrokerProfile;
    map.set(id, normalizeBrokerProfile(item as Partial<BrokerProfile>, fallback));
  }

  if (!map.has(HUANAN_YONGCHANG_PROFILE_ID)) {
    map.set(HUANAN_YONGCHANG_PROFILE_ID, { ...huananYongchangBrokerProfile });
  }
  return [...map.values()];
}

export function createBrokerProfile(name = '新券商'): BrokerProfile {
  return {
    ...defaultBrokerProfile,
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
  };
}

export function isHuananBroker(value?: string | null) {
  const normalized = String(value ?? '').replace(/\s+/g, '').toLowerCase();
  return normalized === HUANAN_YONGCHANG_PROFILE_ID || normalized.includes('華南永昌');
}

export function resolveBrokerProfile(
  id?: string | null,
  profiles: BrokerProfile[] = builtInBrokerProfiles,
  legacyName?: string | null,
): BrokerProfile {
  const rows = normalizeBrokerProfiles(profiles);
  const key = String(id ?? '').trim();
  if (key) {
    const hit = rows.find((profile) => profile.id === key);
    if (hit) return { ...hit };
  }
  if (isHuananBroker(legacyName)) {
    const huanan = rows.find((profile) => profile.id === HUANAN_YONGCHANG_PROFILE_ID);
    if (huanan) return { ...huanan };
  }
  return { ...(rows.find((profile) => profile.id === DEFAULT_BROKER_PROFILE_ID) ?? defaultBrokerProfile) };
}

export function calculateBrokerTradeAmount(price: number, shares: number, _profile: BrokerProfile) {
  return Math.floor(Math.max(0, price) * Math.max(0, shares));
}

export function calculateBrokerCommission(
  amount: number,
  tradeMode: 'ROUND_LOT' | 'ODD_LOT',
  _profile: BrokerProfile,
) {
  if (!(amount > 0)) return 0;
  const minimum = tradeMode === 'ROUND_LOT'
    ? HUANAN_CONFIG.MIN_COMMISSION_ROUND_LOT
    : HUANAN_CONFIG.MIN_COMMISSION_ODD_LOT;
  return Math.max(
    minimum,
    Math.floor(amount * HUANAN_CONFIG.COMMISSION_RATE * HUANAN_CONFIG.COMMISSION_DISCOUNT),
  );
}

export function calculateBrokerSellTax(
  amount: number,
  _profile: BrokerProfile,
  instrument: 'etf' | 'stock' = 'etf',
) {
  if (!(amount > 0)) return 0;
  const rate = instrument === 'stock'
    ? HUANAN_CONFIG.STOCK_SELL_TAX_RATE
    : HUANAN_CONFIG.ETF_SELL_TAX_RATE;
  return Math.floor(amount * rate);
}
