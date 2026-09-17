export type LayoutMode = 'NORMAL' | 'MINI';
export type MiniLayoutType = 'SINGLE_ROW' | 'DUAL_ROW' | 'LIST' | 'MINI_CARD' | 'GRID';
export type PulseStatus = 'IDLE' | 'REFRESHING' | 'SUCCESS' | 'ERROR' | 'PAUSED';
export type ColorTargetType = 'PROFIT_LOSS' | 'MARKET_QUOTE' | 'GENERAL_TEXT';
export type QuoteStatus = 'UP' | 'DOWN' | 'FLAT' | 'LIMIT_UP' | 'LIMIT_DOWN';
export type MarketStatus = 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET';

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MonitorColorConfig {
  mode: 'CUSTOM' | 'THEME_GENERAL' | 'THEME_PROFIT_LOSS';
  customColor?: string;
}

export interface TemplateModeConfig {
  displayFields: string[];
  fieldOrder: string[];
  maxDisplayCount: number;
  layoutType: MiniLayoutType;
  fontSize: number;
  textAlign: 'left' | 'center' | 'right';
  itemSpacing: number;
  backgroundColor: string;
  opacity: number;
  borderRadius: number;
  borderWidth: number;
  borderColor: string;
}

export interface MonitorTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  normalConfig: TemplateModeConfig;
  miniConfig: TemplateModeConfig;
  colorConfig: Record<string, MonitorColorConfig>;
}

export interface MonitorInstanceState {
  instanceId: string;
  activeTemplateId: string;
  isMinimized: boolean;
  normalLayout: WindowRect;
  miniLayout: WindowRect;
}

export interface MonitorSnapshot {
  timestamp: number;
  marketStatus: MarketStatus;
  portfolioSummary: Record<string, unknown>;
  etfSummaries: Record<string, Record<string, unknown>>;
  rawQuotes: Record<string, unknown>;
}

export interface MonitorColorSettings {
  textPrimary: string;
  gain: string;
  loss: string;
  neutral: string;
  limitUp: string;
  limitDown: string;
}

export interface MonitorPersistedSettings {
  schemaVersion: 3;
  instance: MonitorInstanceState;
  templates: MonitorTemplate[];
  templateOverrides: Record<string, Partial<MonitorTemplate>>;
  miniConfig: TemplateModeConfig;
  refreshInterval: number;
  colorSettings: MonitorColorSettings;
}

export const DEFAULT_NORMAL_LAYOUT: WindowRect = { x: 18, y: 180, width: 390, height: 240 };
export const DEFAULT_MINI_LAYOUT: WindowRect = { x: 18, y: 180, width: 220, height: 88 };

export const DEFAULT_COLOR_SETTINGS: MonitorColorSettings = {
  textPrimary: '#FFFFFF',
  gain: '#FF4D4F',
  loss: '#22C55E',
  neutral: '#F5C542',
  limitUp: '#FF4D4F',
  limitDown: '#22C55E',
};
