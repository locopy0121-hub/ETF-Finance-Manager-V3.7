import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  calculateDividendView,
  calculateHoldingView,
  calculatePortfolioView,
} from '../engine';
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

type GridRow = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  order: number;
};

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>
        {value}
      </Text>
    </View>
  );
}

function GridPulse({
  active,
  positive,
}: {
  active: boolean;
  positive: boolean;
}) {
  const opacity = useRef(new Animated.Value(active ? 0.35 : 1)).current;

  useEffect(() => {
    if (!active) {
      opacity.stopAnimation();
      opacity.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, opacity]);

  return (
    <Animated.View
      style={[
        styles.gridPulse,
        {
          opacity,
          backgroundColor: positive
            ? V3_THEME.colors.taiwanUp
            : V3_THEME.colors.taiwanDown,
        },
      ]}
    />
  );
}

function focusChips(row: GridRow, threshold: number) {
  const chips: string[] = [];
  if (row.changePercent >= threshold) chips.push('短線大漲');
  if (row.changePercent <= -threshold) chips.push('短線急跌');
  if (row.high > 0 && row.price >= row.high * 0.995) chips.push('今日高');
  if (row.low > 0 && row.price <= row.low * 1.005) chips.push('今日低');
  return chips.slice(0, 2);
}

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

  const today = new Date();
  const dividendView = useMemo(
    () =>
      calculateDividendView(
        holdings,
        ledger,
        dividends,
        today.getFullYear(),
        today.getMonth() + 1,
      ),
    [holdings, ledger, dividends],
  );

  const focusRows = useMemo(
    () =>
      holdings
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
        .slice(0, 4),
    [holdings, quotes, ledger, dividends],
  );

  const gridMonitor = prefs.monitoring.gridMonitor;

  const gridRows = useMemo<GridRow[]>(() => {
    const sourceSymbols = prefs.watchlistSymbols.length
      ? prefs.watchlistSymbols
      : holdings.map(item => item.symbol);

    const unique = Array.from(new Set(sourceSymbols));

    const rows = unique.map((symbol, order) => {
      const holding = holdings.find(item => item.symbol === symbol);
      const quote = quotes[symbol] ?? {};
      const holdingView = holding
        ? calculateHoldingView(holding, quotes, ledger, dividends)
        : undefined;

      const price = Number(holdingView?.price ?? quote.price ?? 0);
      const previousClose = Number(
        holdingView?.previousClose ?? quote.previousClose ?? price,
      );
      const changePercent = Number(
        quote.changePercent ??
          (previousClose > 0
            ? ((price - previousClose) / previousClose) * 100
            : 0),
      );

      return {
        symbol,
        name: holding?.name ?? symbol,
        price,
        changePercent: Number.isFinite(changePercent) ? changePercent : 0,
        volume: Number(holdingView?.volume ?? quote.volume ?? 0),
        high: Number(holdingView?.high ?? quote.high ?? 0),
        low: Number(holdingView?.low ?? quote.low ?? 0),
        order,
      };
    });

    if (gridMonitor.autoSortBy === 'changePercent') {
      rows.sort((a, b) => b.changePercent - a.changePercent);
    } else if (gridMonitor.autoSortBy === 'price') {
      rows.sort((a, b) => b.price - a.price);
    } else if (gridMonitor.autoSortBy === 'volume') {
      rows.sort((a, b) => b.volume - a.volume);
    } else {
      rows.sort((a, b) => a.order - b.order);
    }

    return rows;
  }, [
    prefs.watchlistSymbols,
    holdings,
    quotes,
    ledger,
    dividends,
    gridMonitor.autoSortBy,
  ]);

  const hidden = prefs.privacyMode;

  const detachGridMonitor = () => {
    common.onMonitoringChange?.({
      ...prefs.monitoring,
      gridMonitor: {
        ...prefs.monitoring.gridMonitor,
        enabled: true,
        isFloating: true,
        columns: 2,
      },
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.welcome}>
        <Text style={styles.eyebrow}>ETF 財務管家</Text>
        <Text style={styles.title}>歡迎回來</Text>
        <Text style={styles.subtitle}>
          今天也用清楚的數據，穩定累積你的資產。
        </Text>
      </View>

      <HeroAssetCard portfolio={portfolio} market="TW" />

      <View style={styles.doubleColumn}>
        <StatCard
          label="年領股息"
          value={hidden ? '••••' : money(dividendView.yearExpected)}
          accent={V3_THEME.colors.primary}
        />
        <StatCard
          label="本月預估股息"
          value={hidden ? '••••' : money(dividendView.currentMonthExpected)}
          accent={V3_THEME.colors.primary}
        />
      </View>

      <View style={styles.disciplineCard}>
        <View style={styles.disciplineIcon}>
          <Text style={styles.disciplineIconText}>✓</Text>
        </View>
        <View style={styles.disciplineText}>
          <Text style={styles.disciplineTitle}>紀律投資</Text>
          <Text style={styles.disciplineBody}>
            維持既定投入節奏，避免因短期波動改變長期配置。
          </Text>
        </View>
        <Pressable onPress={onOpenCalculator}>
          <Text style={styles.link}>查看試算 ›</Text>
        </Pressable>
      </View>

      <View style={styles.quickRow}>
        {[
          ['庫存持倉', onOpenPortfolio],
          ['股息月曆', onOpenDividend],
          ['智慧記帳', onOpenLedger],
          ['情境模擬', onOpenCalculator],
        ].map(([label, onPress]) => (
          <Pressable
            key={label as string}
            onPress={onPress as () => void}
            style={styles.quickButton}
          >
            <Text style={styles.quickButtonText}>{label as string}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>主要持倉</Text>
          <Text style={styles.sectionSubtitle}>依目前市值排序</Text>
        </View>
        <Pressable onPress={onOpenPortfolio}>
          <Text style={styles.link}>查看全部 ›</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {focusRows.map(({ holding, view }) => {
          const tone = resolvePnlTone(view.cashPnl, 'TW');
          return (
            <Pressable
              key={holding.symbol}
              onPress={onOpenPortfolio}
              style={styles.holdingCard}
            >
              <View style={styles.holdingLeft}>
                <View style={styles.symbolPill}>
                  <Text style={styles.symbolText}>{holding.symbol}</Text>
                </View>
                <View style={styles.nameWrap}>
                  <Text style={styles.holdingName}>{holding.name}</Text>
                  <Text style={styles.holdingMeta}>
                    {view.shares.toLocaleString()} 股 · 現價 {view.price.toFixed(2)}
                  </Text>
                </View>
              </View>
              <View style={styles.holdingRight}>
                <Text style={styles.marketValue}>
                  {hidden ? '••••' : money(view.marketValue)}
                </Text>
                <View style={[styles.pnlPill, { backgroundColor: tone.background }]}>
                  <Text style={[styles.pnlText, { color: tone.foreground }]}>
                    {hidden
                      ? '••••'
                      : `${view.cashPnl > 0 ? '+' : ''}${money(view.cashPnl)}`}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {gridMonitor.enabled && gridMonitor.showInHome ? (
        <View style={styles.gridMonitorSection}>
          <View style={styles.gridMonitorHeader}>
            <View>
              <Text style={styles.sectionTitle}>雙欄宮格監控</Text>
              <Text style={styles.sectionSubtitle}>
                {prefs.watchlistSymbols.length
                  ? '來源：觀察清單'
                  : '來源：目前持股'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={detachGridMonitor}
              style={styles.detachButton}
            >
              <Text style={styles.detachButtonText}>
                {gridMonitor.isFloating ? '📌 已脫離' : '📌 脫離'}
              </Text>
            </Pressable>
          </View>

          <FlatList
            data={gridRows}
            keyExtractor={item => item.symbol}
            numColumns={2}
            scrollEnabled={false}
            columnWrapperStyle={styles.gridColumn}
            contentContainerStyle={styles.gridList}
            renderItem={({ item }) => {
              const positive = item.changePercent >= 0;
              const alert =
                Math.abs(item.changePercent) >= gridMonitor.alertThreshold;
              const tone = resolvePnlTone(item.changePercent, 'TW');
              const chips = gridMonitor.showFocusChips
                ? focusChips(item, gridMonitor.alertThreshold)
                : [];
              const strength = Math.min(
                100,
                (Math.abs(item.changePercent) /
                  Math.max(1, gridMonitor.alertThreshold)) *
                  100,
              );

              return (
                <View style={styles.gridTile}>
                  <View style={styles.gridTileHeader}>
                    <View style={styles.gridSymbolRow}>
                      {gridMonitor.showTrendLines ? (
                        <GridPulse active={alert} positive={positive} />
                      ) : null}
                      <Text style={styles.gridSymbol}>{item.symbol}</Text>
                    </View>
                    <Text
                      style={[
                        styles.gridChange,
                        { color: tone.foreground },
                      ]}
                    >
                      {item.changePercent > 0 ? '+' : ''}
                      {item.changePercent.toFixed(2)}%
                    </Text>
                  </View>

                  <Text style={styles.gridName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.gridPrice}>
                    {item.price > 0 ? item.price.toFixed(2) : '—'}
                  </Text>

                  {gridMonitor.showTrendLines ? (
                    <View style={styles.strengthTrack}>
                      <View
                        style={[
                          styles.strengthFill,
                          {
                            width: `${strength}%`,
                            backgroundColor: tone.foreground,
                          },
                        ]}
                      />
                    </View>
                  ) : null}

                  {chips.length ? (
                    <View style={styles.focusChipRow}>
                      {chips.map(chip => (
                        <View key={chip} style={styles.focusChip}>
                          <Text style={styles.focusChipText}>{chip}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Text style={styles.gridVolume}>
                    成交量 {item.volume > 0 ? item.volume.toLocaleString() : '—'}
                  </Text>
                </View>
              );
            }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: V3_THEME.colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
  },
  welcome: {
    marginBottom: 16,
  },
  eyebrow: {
    color: V3_THEME.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    ...V3_THEME.typography.pageTitle,
  },
  subtitle: {
    marginTop: 5,
    color: V3_THEME.colors.textSecondary,
    fontSize: 12,
  },
  doubleColumn: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 16,
    justifyContent: 'center',
    ...V3_THEME.shadow,
  },
  statLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    marginTop: 8,
    color: V3_THEME.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  disciplineCard: {
    marginTop: 16,
    minHeight: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: V3_THEME.colors.accentSoft,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  disciplineIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: V3_THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disciplineIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  disciplineText: {
    flex: 1,
  },
  disciplineTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  disciplineBody: {
    marginTop: 3,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },
  quickRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickButton: {
    width: '48%',
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickButtonText: {
    color: V3_THEME.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeader: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    ...V3_THEME.typography.cardTitle,
  },
  sectionSubtitle: {
    marginTop: 3,
    color: V3_THEME.colors.textSecondary,
    fontSize: 11,
  },
  link: {
    color: V3_THEME.colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  list: {
    gap: 12,
  },
  holdingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...V3_THEME.shadow,
  },
  holdingLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolPill: {
    minWidth: 66,
    height: 34,
    borderRadius: 999,
    backgroundColor: V3_THEME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  symbolText: {
    color: V3_THEME.colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  holdingName: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  holdingMeta: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
  },
  holdingRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  marketValue: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  pnlPill: {
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pnlText: {
    fontSize: 10,
    fontWeight: '800',
  },

  gridMonitorSection: {
    marginTop: 28,
  },
  gridMonitorHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detachButton: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: V3_THEME.colors.accentSoft,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detachButtonText: {
    color: V3_THEME.colors.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  gridList: {
    gap: 10,
  },
  gridColumn: {
    gap: 10,
  },
  gridTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 14,
    ...V3_THEME.shadow,
  },
  gridTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  gridSymbolRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gridPulse: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  gridSymbol: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  gridChange: {
    fontSize: 10,
    fontWeight: '900',
  },
  gridName: {
    marginTop: 6,
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  gridPrice: {
    marginTop: 8,
    color: V3_THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  strengthTrack: {
    marginTop: 10,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  strengthFill: {
    height: 4,
    borderRadius: 2,
  },
  focusChipRow: {
    marginTop: 9,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  focusChip: {
    borderRadius: 999,
    backgroundColor: V3_THEME.colors.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  focusChipText: {
    color: V3_THEME.colors.primary,
    fontSize: 8,
    fontWeight: '800',
  },
  gridVolume: {
    marginTop: 8,
    color: V3_THEME.colors.textSecondary,
    fontSize: 8,
    fontWeight: '600',
  },
});

export default DashboardScreen;
