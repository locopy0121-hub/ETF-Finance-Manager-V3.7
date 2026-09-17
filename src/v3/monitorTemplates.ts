import type { MonitorDisplayMode, MonitorField } from './monitoring';
import type { MonitorColorConfig, MonitorTemplate as CoreMonitorTemplate, TemplateModeConfig } from '../types/monitor';
import { monitorColorTargetForField } from '../utils/monitorColorResolver';

export type MonitorNativeMode = 'strip' | 'table' | 'puzzle';
export type MonitorTemplate = CoreMonitorTemplate & {
  id: MonitorDisplayMode;
  fields: MonitorField[];
  columns: 1 | 2 | 3;
  compact?: boolean;
  nativeMode: MonitorNativeMode;
};

const colorConfig = (fields: MonitorField[]): Record<string, MonitorColorConfig> => Object.fromEntries(
  fields.map(field => [field, { mode: monitorColorTargetForField(field) === 'GENERAL_TEXT' ? 'THEME_GENERAL' : 'THEME_PROFIT_LOSS' } satisfies MonitorColorConfig]),
);

const modeConfig = (fields: MonitorField[], layoutType: TemplateModeConfig['layoutType'], compact = false): TemplateModeConfig => ({
  displayFields: [...fields], fieldOrder: [...fields], maxDisplayCount: compact ? Math.min(3, fields.length) : fields.length,
  layoutType, fontSize: compact ? 11 : 13, textAlign: 'left', itemSpacing: compact ? 4 : 8,
  backgroundColor: '#08111F', opacity: 0.92, borderRadius: compact ? 10 : 16, borderWidth: 1, borderColor: '#3AC7FF',
});

const template = (id: MonitorDisplayMode, name: string, fields: MonitorField[], columns: 1 | 2 | 3, nativeMode: MonitorNativeMode, compact = false): MonitorTemplate => ({
  id, name, isDefault: true, fields: [...fields], columns, compact, nativeMode,
  normalConfig: modeConfig(fields, columns === 1 ? 'LIST' : 'GRID', compact),
  miniConfig: modeConfig(fields, compact ? 'SINGLE_ROW' : columns === 1 ? 'LIST' : 'DUAL_ROW', true),
  colorConfig: colorConfig(fields),
});

export const MONITOR_TEMPLATES: MonitorTemplate[] = [
  template('miniPnl', '迷你損益條', ['instantPnl', 'instantRoi'], 2, 'strip', true),
  template('holdingList', '持股清單', ['symbol', 'name', 'price', 'todayPnl'], 1, 'table'),
  template('dualColumn', '雙欄監控', ['symbol', 'price', 'changePct', 'instantPnl'], 2, 'puzzle'),
  template('cardMatrix', '卡片矩陣', ['symbol', 'price', 'changePct', 'instantPnl'], 2, 'puzzle'),
  template('todayPnl', '今日損益', ['symbol', 'todayPnl', 'todayPnlPct'], 2, 'puzzle'),
  template('totalAssets', '總資產', ['totalAssets', 'marketValue', 'instantPnl'], 2, 'puzzle'),
  template('dividendReminder', '股息提醒', ['symbol', 'dividend', 'updatedAt'], 1, 'table'),
  template('watchlist', '自選 ETF', ['symbol', 'name', 'price', 'changePct'], 1, 'table'),
  template('marketOverview', '市場快覽', ['symbol', 'price', 'change', 'changePct'], 2, 'puzzle'),
  template('singleEtf', '單一 ETF 深度', ['symbol', 'name', 'price', 'nav', 'premium', 'volume'], 1, 'table'),
  template('aiSummary', 'AI 摘要', ['symbol', 'instantPnl', 'todayPnl', 'updatedAt'], 1, 'table'),
  template('breathingLight', '極簡呼吸燈', ['updatedAt'], 1, 'strip', true),
];

export const monitorTemplate = (id: MonitorDisplayMode) => MONITOR_TEMPLATES.find(x => x.id === id) ?? MONITOR_TEMPLATES[1];
export const templateDefaultFields = (id: MonitorDisplayMode) => [...monitorTemplate(id).normalConfig.displayFields] as MonitorField[];
