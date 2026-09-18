import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Blueprint B — Professional Light Dashboard
 *
 * Visual-only tokens. No accounting, brokerage, tax, portfolio or settlement
 * logic is allowed in this module.
 */
export const V3_THEME = {
  colors: {
    background: '#F8FAFC',
    surfaceGlass: '#FFFFFF',
    surfaceMuted: '#F1F5F9',
    borderGlow: '#E2E8F0',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    accent: '#0066FF',
    primary: '#0066FF',
    accentSoft: '#EFF6FF',
    heroGradientStart: '#0066FF',
    heroGradientEnd: '#0044B3',

    taiwanUp: '#EF4444',
    taiwanDown: '#10B981',
    usUp: '#10B981',
    usDown: '#EF4444',

    positiveSoft: '#ECFDF5',
    negativeSoft: '#FEF2F2',
    neutralSoft: '#F1F5F9',
    shadow: 'rgba(15, 23, 42, 0.08)',
  },

  radius: {
    card: 16,
    pill: 999,
  },

  border: {
    width: 1,
    color: '#E2E8F0',
  },

  shadow: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  } satisfies ViewStyle,

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },

  typography: {
    heroValue: {
      fontSize: 30,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.6,
    } satisfies TextStyle,
    pageTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: '#0F172A',
      letterSpacing: -0.3,
    } satisfies TextStyle,
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#0F172A',
    } satisfies TextStyle,
    helper: {
      fontSize: 12,
      fontWeight: '500',
      color: '#64748B',
    } satisfies TextStyle,
  },
} as const;

export type MarketColorMode = 'TW' | 'US';

export type PnlTone = {
  foreground: string;
  background: string;
};

export function resolvePnlTone(
  value: number,
  market: MarketColorMode = 'TW',
): PnlTone {
  if (!Number.isFinite(value) || value === 0) {
    return {
      foreground: V3_THEME.colors.textSecondary,
      background: V3_THEME.colors.neutralSoft,
    };
  }

  const isUp = value > 0;

  if (market === 'US') {
    return {
      foreground: isUp ? V3_THEME.colors.usUp : V3_THEME.colors.usDown,
      background: isUp
        ? V3_THEME.colors.positiveSoft
        : V3_THEME.colors.negativeSoft,
    };
  }

  return {
    foreground: isUp ? V3_THEME.colors.taiwanUp : V3_THEME.colors.taiwanDown,
    background: isUp
      ? V3_THEME.colors.negativeSoft
      : V3_THEME.colors.positiveSoft,
  };
}

export const glassCardStyle: ViewStyle = {
  backgroundColor: V3_THEME.colors.surfaceGlass,
  borderWidth: V3_THEME.border.width,
  borderColor: V3_THEME.border.color,
  borderRadius: V3_THEME.radius.card,
  ...V3_THEME.shadow,
};
