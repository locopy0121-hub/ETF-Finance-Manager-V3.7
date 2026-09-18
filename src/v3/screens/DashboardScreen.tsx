import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { calculateHoldingView, calculatePortfolioView } from '../engine';
import { HeroAssetCard } from '../components/HeroAssetCard';
import { V3_THEME, resolvePnlTone } from '../theme';
import type { ScreenCommon } from '../screensBase';

type DashboardScreenProps = {
  common: ScreenCommon;
  onOpenPortfolio: () => void;
  onOpenDividend: () => void;
  onOpenLedger: () => void;
  onOpenCalculator: () => void;
};

type QuickActionProps = {
  icon: string;
  label: string;
  onPress: () => void;
};

type PnlBadgeProps = {
  label: string;
  value: number;
  valueText: string;
};

const formatMoney = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

const formatPrice = (value: number) =>
  Number.isFinite(value) ? value.toFixed(2) : '—';

const formatPercent = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
};

function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        pressed && styles.quickActionPressed,
      ]}
    >
      <View style={styles.quickIconWrap}>
        <Text style={styles.quickIcon}>{icon}</Text>
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function PnlBadge({ label, value, valueText }: PnlBadgeProps) {
  const tone = resolvePnlTone(value, 'TW');

  return (
    <View style={[styles.pnlBadge, { backgroundColor: tone.background }]}>
      <Text style={styles.pnlBadgeLabel}>{label}</Text>
      <Text style={[styles.pnlBadgeValue, { color: tone.foreground }]}>
        {valueText}
      </Text>
    </View>
  );
}

function MiniTrend({
  positive,
}: {
  positive: boolean;
}) {
  const d = positive
    ? 'M2 28 C12 27 17 21 25 23 C34 25 39 16 48 18 C58 20 62 9 72 12 C82 15 88 5 98 7'
    : 'M2 7 C13 9 18 17 27 14 C36 11 42 22 51 19 C61 16 67 27 76 24 C86 21 91 30 98 28';

  return (
    <Svg
      width={100}
      height={34}
      viewBox="0 0 100 34"
      pointerEvents="none"
    >
      <Path
        d={d}
        fill="none"
        stroke={positive ? V3_THEME.colors.taiwanUp : V3_THEME.colors.taiwanDown}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </Svg>
  );
}

/**
 * V3.7.9 Dashboard
 *
 * Data boundary:
 * - Portfolio totals come from calculatePortfolioView().
 * - Per-holding rows come from calculateHoldingView().
 * - This screen never reads Ledger settlement fields directly.
 * - This screen never calculates commission, tax, cost basis, or accounting P/L.
 */
export function DashboardScreen({
  common,
  onOpenPortfolio,
  onOpenDividend,
  onOpenLedger,
  onOpenCalculator,
}: DashboardScreenProps) {
  const {
    holdings,
    quotes,
    cashBalance,
    ledger,
    dividends,
    prefs,
  } = common;

  const portfolio = useMemo(
    () =>
      calculatePortfolioView(
        holdings,
        quotes,
        cashBalance,
        ledger,
        dividends,
      ),
    [holdings, quotes, cashBalance, ledger, dividends],
  );

  const focusRows = useMemo(() => {
    const selected =
      prefs.selectedEtfSymbols.length > 0
        ? holdings.filter(holding =>
            prefs.selectedEtfSymbols.includes(holding.symbol),
          )
        : holdings;

    return selected
      .map(holding => ({
        holding,
        view: calculateHoldingView(
          holding,
          quotes,
          ledger,
          dividends,
        ),
      }))
      .filter(row => row.view.shares > 0)
      .sort((a, b) => b.view.marketValue - a.view.marketValue)
      .slice(0, 6);
  }, [
    holdings,
    quotes,
    ledger,
    dividends,
    prefs.selectedEtfSymbols,
  ]);

  const privateText = prefs.privacyMode ? '••••' : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <HeroAssetCard
        portfolio={portfolio}
        market="TW"
      />

      <View style={styles.quickSection}>
        <QuickAction
          icon="📦"
          label="庫存持倉"
          onPress={onOpenPortfolio}
        />
        <QuickAction
          icon="📅"
          label="股息月曆"
          onPress={onOpenDividend}
        />
        <QuickAction
          icon="📝"
          label="智慧記帳"
          onPress={onOpenLedger}
        />
        <QuickAction
          icon="📈"
          label="情境模擬"
          onPress={onOpenCalculator}
        />
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            我的焦點持倉 / 熱門 ETF
          </Text>
          <Text style={styles.sectionSubtitle}>
            即時行情與持倉表現
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看全部持倉"
          onPress={onOpenPortfolio}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.linkPressed}
        >
          <Text style={styles.sectionLink}>
            查看全部 ›
          </Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {focusRows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              尚無持倉資料
            </Text>
            <Text style={styles.emptyText}>
              完成第一筆交易後，焦點 ETF 會顯示在這裡。
            </Text>
          </View>
        ) : (
          focusRows.map(({ holding, view }) => {
            const positive = view.todayPnl >= 0;

            return (
              <Pressable
                key={holding.symbol}
                accessibilityRole="button"
                accessibilityLabel={`${holding.symbol} ${holding.name}`}
                onPress={onOpenPortfolio}
                style={({ pressed }) => [
                  styles.etfCard,
                  pressed && styles.etfCardPressed,
                ]}
              >
                <View style={styles.etfTopRow}>
                  <View style={styles.etfIdentity}>
                    <View style={styles.symbolPill}>
                      <Text style={styles.symbolText}>
                        {holding.symbol}
                      </Text>
                    </View>

                    <View style={styles.nameWrap}>
                      <Text style={styles.etfName} numberOfLines={1}>
                        {holding.name}
                      </Text>
                      <Text style={styles.etfMeta} numberOfLines={1}>
                        {view.shares.toLocaleString()} 股 · 市值{' '}
                        {privateText ?? formatMoney(view.marketValue)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.priceBlock}>
                    <Text style={styles.priceLabel}>
                      現價
                    </Text>
                    <Text style={styles.priceValue}>
                      {formatPrice(view.price)}
                    </Text>
                  </View>
                </View>

                <View style={styles.etfBottomRow}>
                  <View style={styles.trendWrap}>
                    <MiniTrend positive={positive} />
                  </View>

                  <View style={styles.badgesWrap}>
                    <PnlBadge
                      label="今日"
                      value={view.todayPnlPct}
                      valueText={formatPercent(view.todayPnlPct)}
                    />
                    <PnlBadge
                      label="損益"
                      value={view.cashPnl}
                      valueText={
                        privateText ??
                        `${view.cashPnl > 0 ? '+' : ''}${formatMoney(view.cashPnl)}`
                      }
                    />
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: V3_THEME.colors.background,
  },
  content: {
    paddingHorizontal: V3_THEME.spacing.lg,
    paddingTop: V3_THEME.spacing.lg,
    paddingBottom: 120,
  },

  quickSection: {
    marginTop: V3_THEME.spacing.lg,
    flexDirection: 'row',
    gap: V3_THEME.spacing.sm,
  },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    paddingHorizontal: V3_THEME.spacing.sm,
    paddingVertical: V3_THEME.spacing.md,
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  quickIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: V3_THEME.spacing.sm,
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  quickIcon: {
    fontSize: 20,
  },
  quickLabel: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },

  sectionHeader: {
    marginTop: V3_THEME.spacing.xxl,
    marginBottom: V3_THEME.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: V3_THEME.spacing.md,
  },
  sectionTitle: {
    ...V3_THEME.typography.cardTitle,
  },
  sectionSubtitle: {
    ...V3_THEME.typography.helper,
    marginTop: 3,
  },
  sectionLink: {
    color: V3_THEME.colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  linkPressed: {
    opacity: 0.6,
  },

  list: {
    gap: V3_THEME.spacing.md,
  },
  etfCard: {
    width: '100%',
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.lg,
  },
  etfCardPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.995 }],
  },
  etfTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: V3_THEME.spacing.md,
  },
  etfIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolPill: {
    minWidth: 68,
    height: 34,
    paddingHorizontal: V3_THEME.spacing.sm,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: V3_THEME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    color: V3_THEME.colors.accent,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  nameWrap: {
    minWidth: 0,
    flex: 1,
    marginLeft: V3_THEME.spacing.md,
  },
  etfName: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  etfMeta: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  priceValue: {
    marginTop: 2,
    color: V3_THEME.colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  etfBottomRow: {
    marginTop: V3_THEME.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: V3_THEME.spacing.md,
  },
  trendWrap: {
    flex: 1,
    minWidth: 92,
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: V3_THEME.spacing.sm,
  },
  pnlBadge: {
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: V3_THEME.radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pnlBadgeLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  pnlBadgeValue: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  emptyCard: {
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.xl,
  },
  emptyTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: V3_THEME.spacing.sm,
    color: V3_THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default DashboardScreen;
