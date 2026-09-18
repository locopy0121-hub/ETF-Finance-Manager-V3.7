import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  V3_THEME,
  resolvePnlTone,
  type MarketColorMode,
} from '../theme';

export type PortfolioViewModel = ReturnType<
  typeof import('../engine').calculatePortfolioView
>;

export type HeroAssetCardProps = {
  portfolio: PortfolioViewModel;
  market?: MarketColorMode;
  style?: ViewStyle;
  currencyLabel?: string;
};

type PnlBadgeProps = {
  label: string;
  value: number;
  market: MarketColorMode;
};

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

const signedMoney = (value: number) => {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe > 0 ? '+' : safe < 0 ? '-' : '';
  return `${sign}${money(Math.abs(safe))}`;
};

function PnlBadge({ label, value, market }: PnlBadgeProps) {
  const tone = resolvePnlTone(value, market);

  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={[styles.badgeValue, { color: tone.foreground }]}>
        {signedMoney(value)}
      </Text>
    </View>
  );
}

/**
 * Top-level portfolio hero.
 *
 * Accounting boundary:
 * - Receives the engine View Model only.
 * - Never reads ledger entries.
 * - Never calculates commission, tax, cost basis, market value, or P/L.
 * - Local math is formatting/presentation only.
 */
export function HeroAssetCard({
  portfolio,
  market = 'TW',
  style,
  currencyLabel = 'TWD',
}: HeroAssetCardProps) {
  const [hidden, setHidden] = useState(false);

  const assetText = hidden ? '＊＊＊＊＊＊' : money(portfolio.totalAssets);

  // Decorative curve direction only. No financial value is recomputed here.
  const chartPath = useMemo(
    () =>
      portfolio.todayPnl >= 0
        ? 'M0 78 C28 74 42 56 68 61 C91 66 103 43 130 48 C154 52 169 27 194 31 C218 35 236 15 268 19'
        : 'M0 24 C30 29 42 48 70 42 C98 36 112 57 138 53 C164 49 179 70 203 66 C229 62 244 79 268 76',
    [portfolio.todayPnl],
  );

  const fillPath = `${chartPath} L268 96 L0 96 Z`;

  return (
    <View style={[styles.card, style]}>
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox="0 0 360 210"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id="heroBackground" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={V3_THEME.colors.heroGradientStart} />
            <Stop offset="1" stopColor={V3_THEME.colors.heroGradientEnd} />
          </LinearGradient>

          <LinearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
            <Stop offset="1" stopColor={V3_THEME.colors.accent} stopOpacity={0.01} />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="360" height="210" rx="16" fill="url(#heroBackground)" />

        <Path
          d={fillPath}
          transform="translate(82 78)"
          fill="url(#chartFill)"
          opacity={0.9}
        />
        <Path
          d={chartPath}
          transform="translate(82 78)"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.78}
        />
      </Svg>

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>總資產 ({currencyLabel})</Text>
          <View style={styles.valueRow}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={styles.heroValue}
            >
              {assetText}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hidden ? '顯示總資產' : '隱藏總資產'}
              hitSlop={10}
              onPress={() => setHidden(v => !v)}
              style={({ pressed }) => [
                styles.eyeButton,
                pressed && styles.eyeButtonPressed,
              ]}
            >
              <Text style={styles.eyeIcon}>{hidden ? '◎' : '◉'}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.spacer} />

      <View style={styles.badgeRow}>
        <PnlBadge
          label="今日損益"
          value={portfolio.todayPnl}
          market={market}
        />
        <PnlBadge
          label="累積損益"
          value={portfolio.totalPnl}
          market={market}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 220,
    overflow: 'hidden',
    borderRadius: V3_THEME.radius.card,
    padding: V3_THEME.spacing.xl,
    backgroundColor: V3_THEME.colors.heroGradientStart,
    ...V3_THEME.shadow,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  eyebrow: {
    ...V3_THEME.typography.helper,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: V3_THEME.spacing.sm,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '94%',
  },
  heroValue: {
    ...V3_THEME.typography.heroValue,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  eyeButton: {
    width: 34,
    height: 34,
    marginLeft: V3_THEME.spacing.sm,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeButtonPressed: {
    opacity: 0.68,
  },
  eyeIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
    minHeight: 74,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: V3_THEME.spacing.sm,
    zIndex: 2,
  },
  badge: {
    minHeight: 38,
    paddingHorizontal: V3_THEME.spacing.md,
    paddingVertical: V3_THEME.spacing.sm,
    borderRadius: V3_THEME.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  badgeLabel: {
    ...V3_THEME.typography.helper,
    color: 'rgba(255,255,255,0.78)',
  },
  badgeValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export default HeroAssetCard;
