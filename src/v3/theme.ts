import type { TextStyle, ViewStyle } from 'react-native';

/**
 * V3.7.9 visual design system.
 *
 * Visual-only tokens. This module must never contain accounting formulas,
 * brokerage rules, tax rules, or portfolio calculations.
 */
export const V3_THEME = {
  colors: {
    background: '#0D131A',
    surfaceGlass: 'rgba(255, 255, 255, 0.05)',
    borderGlow: 'rgba(255, 255, 255, 0.12)',
    textPrimary: '#F7FAFC',
    textSecondary: '#8E9BAE',
    accent: '#4FD1A5',
    accentSoft: 'rgba(79, 209, 165, 0.15)',
    heroGradientStart: '#122820',
    heroGradientEnd: '#0D131A',

    taiwanUp: '#FF5B64',
    taiwanDown: '#35C987',
    usUp: '#35C987',
    usDown: '#FF5B64',

    positiveSoft: 'rgba(53, 201, 135, 0.15)',
    negativeSoft: 'rgba(255, 91, 100, 0.15)',
    neutralSoft: 'rgba(142, 155, 174, 0.15)',
  },

  radius: {
    card: 16,
    pill: 20,
  },

  border: {
    width: 1,
    color: 'rgba(255, 255, 255, 0.12)',
  },

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
      fontSize: 28,
      fontWeight: '700',
      color: '#F7FAFC',
      letterSpacing: -0.5,
    } satisfies TextStyle,
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: '#F7FAFC',
    } satisfies TextStyle,
    helper: {
      fontSize: 12,
      fontWeight: '500',
      color: '#8E9BAE',
    } satisfies TextStyle,
  },
} as const;

export type MarketColorMode = 'TW' | 'US';

export type PnlTone = {
  foreground: string;
  background: string;
};

/**
 * Presentation-only color resolver.
 * Taiwan: red up / green down.
 * US: green up / red down.
 */
export function resolvePnlTone(value: number, market: MarketColorMode = 'TW'): PnlTone {
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
      background: isUp ? V3_THEME.colors.positiveSoft : V3_THEME.colors.negativeSoft,
    };
  }

  return {
    foreground: isUp ? V3_THEME.colors.taiwanUp : V3_THEME.colors.taiwanDown,
    background: isUp ? V3_THEME.colors.negativeSoft : V3_THEME.colors.positiveSoft,
  };
}

export const glassCardStyle: ViewStyle = {
  backgroundColor: V3_THEME.colors.surfaceGlass,
  borderWidth: V3_THEME.border.width,
  borderColor: V3_THEME.border.color,
  borderRadius: V3_THEME.radius.card,
};
