import type { ColorTargetType, MonitorColorConfig, MonitorColorSettings, QuoteStatus } from '../types/monitor';

export interface ResolveMonitorColorParams {
  targetType: ColorTargetType;
  value?: number;
  quoteStatus?: QuoteStatus;
  config: MonitorColorConfig;
  themeColors: MonitorColorSettings;
}

export const resolveMonitorColor = ({ targetType, value = 0, quoteStatus, config, themeColors }: ResolveMonitorColorParams): string => {
  if (config.mode === 'CUSTOM' && config.customColor) return config.customColor;
  if (config.mode === 'THEME_GENERAL' || targetType === 'GENERAL_TEXT') return themeColors.textPrimary;
  if (targetType === 'PROFIT_LOSS') {
    if (value > 0) return themeColors.gain;
    if (value < 0) return themeColors.loss;
    return themeColors.neutral;
  }
  if (targetType === 'MARKET_QUOTE') {
    switch (quoteStatus) {
      case 'LIMIT_UP': return themeColors.limitUp;
      case 'LIMIT_DOWN': return themeColors.limitDown;
      case 'UP': return themeColors.gain;
      case 'DOWN': return themeColors.loss;
      case 'FLAT':
      default: return themeColors.neutral;
    }
  }
  return themeColors.textPrimary;
};

export const PROFIT_LOSS_FIELDS = new Set([
  'unrealizedProfit','totalProfit','todayProfit','roi',
  'instantPnl','instantRoi','todayPnl','todayPnlPct','totalRoi',
]);
export const MARKET_QUOTE_FIELDS = new Set([
  'currentPrice','changeAmount','changePercent','price','change','changePct','premium',
]);

export const monitorColorTargetForField = (field: string): ColorTargetType => {
  if (PROFIT_LOSS_FIELDS.has(field)) return 'PROFIT_LOSS';
  if (MARKET_QUOTE_FIELDS.has(field)) return 'MARKET_QUOTE';
  return 'GENERAL_TEXT';
};
