import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

  const hidden = prefs.privacyMode;

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
});

export default DashboardScreen;
