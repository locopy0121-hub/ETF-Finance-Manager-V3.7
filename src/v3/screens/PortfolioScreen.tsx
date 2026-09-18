import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { calculateHoldingView, calculatePortfolioView } from '../engine';
import { classifyEtf, type EtfCategory } from '../etfResearch';
import { V3_THEME, resolvePnlTone } from '../theme';
import type { ScreenCommon } from '../screensBase';

type PortfolioTab = 'all' | 'tw' | 'us';

type PortfolioScreenProps = {
  common: ScreenCommon;
  onOpenHolding?: (symbol: string) => void;
};

type HoldingRow = {
  symbol: string;
  name: string;
  categories: Exclude<EtfCategory, 'all'>[];
  view: ReturnType<typeof calculateHoldingView>;
  market: 'TW' | 'US';
};

const CATEGORY_LABELS: Record<Exclude<EtfCategory, 'all'>, string> = {
  market: '市值型',
  dividend: '高股息',
  tech: '科技型',
  bond: '債券型',
  leveraged: '槓桿 / 反向',
  active: '主動式',
  esg: 'ESG',
};

const CATEGORY_COLORS: Record<string, string> = {
  dividend: '#0066FF',
  market: '#60A5FA',
  bond: '#93C5FD',
  tech: '#2563EB',
  active: '#7C3AED',
  esg: '#10B981',
  leveraged: '#F59E0B',
};

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

const isUsSymbol = (symbol: string) => /^[A-Z]{1,5}$/.test(symbol);

function AllocationDonut({
  items,
  total,
}: {
  items: Array<{ key: string; label: string; value: number; color: string }>;
  total: number;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg width={126} height={126} viewBox="0 0 126 126">
        <Circle
          cx={63}
          cy={63}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={16}
        />
        <G rotation="-90" origin="63,63">
          {items.map(item => {
            const ratio = total > 0 ? item.value / total : 0;
            const dash = ratio * circumference;
            const node = (
              <Circle
                key={item.key}
                cx={63}
                cy={63}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={16}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return node;
          })}
        </G>
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutCaption}>持倉市值</Text>
        <Text style={styles.donutValue}>{money(total)}</Text>
      </View>
    </View>
  );
}

export function PortfolioScreen({
  common,
  onOpenHolding,
}: PortfolioScreenProps) {
  const [tab, setTab] = useState<PortfolioTab>('all');

  const portfolio = useMemo(
    () =>
      calculatePortfolioView(
        common.holdings,
        common.quotes,
        common.cashBalance,
        common.ledger,
        common.dividends,
      ),
    [
      common.holdings,
      common.quotes,
      common.cashBalance,
      common.ledger,
      common.dividends,
    ],
  );

  const rows = useMemo<HoldingRow[]>(
    () =>
      common.holdings
        .map(holding => {
          const categories = classifyEtf(holding.symbol, holding.name);
          return {
            symbol: holding.symbol,
            name: holding.name,
            categories,
            market: isUsSymbol(holding.symbol) ? 'US' : 'TW',
            view: calculateHoldingView(
              holding,
              common.quotes,
              common.ledger,
              common.dividends,
            ),
          };
        })
        .filter(row => row.view.shares > 0)
        .sort((a, b) => b.view.marketValue - a.view.marketValue),
    [
      common.holdings,
      common.quotes,
      common.ledger,
      common.dividends,
    ],
  );

  const filteredRows = useMemo(
    () =>
      rows.filter(row =>
        tab === 'all' ? true : tab === 'tw' ? row.market === 'TW' : row.market === 'US',
      ),
    [rows, tab],
  );

  const allocation = useMemo(() => {
    const totals = new Map<string, number>();
    rows.forEach(row => {
      const key = row.categories[0] ?? 'market';
      totals.set(key, (totals.get(key) ?? 0) + row.view.marketValue);
    });
    return [...totals.entries()]
      .map(([key, value]) => ({
        key,
        label:
          CATEGORY_LABELS[key as Exclude<EtfCategory, 'all'>] ?? '其他',
        value,
        color: CATEGORY_COLORS[key] ?? '#CBD5E1',
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const privacy = common.prefs.privacyMode;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PORTFOLIO</Text>
        <Text style={styles.title}>庫存持股</Text>
        <Text style={styles.subtitle}>資產配置與持股表現一目了然</Text>
      </View>

      <View style={styles.allocationCard}>
        <View style={styles.allocationHeader}>
          <View>
            <Text style={styles.cardTitle}>資產配置</Text>
            <Text style={styles.cardSub}>依 ETF 類型分布</Text>
          </View>
          <View style={styles.totalPill}>
            <Text style={styles.totalPillLabel}>總市值</Text>
            <Text style={styles.totalPillValue}>
              {privacy ? '••••' : money(portfolio.marketValue)}
            </Text>
          </View>
        </View>

        <View style={styles.allocationBody}>
          <AllocationDonut items={allocation} total={portfolio.marketValue} />
          <View style={styles.legend}>
            {allocation.slice(0, 4).map(item => (
              <View key={item.key} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendValue}>
                  {portfolio.marketValue > 0
                    ? `${((item.value / portfolio.marketValue) * 100).toFixed(1)}%`
                    : '0%'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.segmented}>
        {([
          ['all', '全部'],
          ['tw', '台股 ETF'],
          ['us', '美股 ETF'],
        ] as const).map(([key, label]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.segment, active && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>持股清單</Text>
        <Text style={styles.sectionMeta}>{filteredRows.length} 檔</Text>
      </View>

      <View style={styles.list}>
        {filteredRows.map(row => {
          const tone = resolvePnlTone(row.view.cashPnl, row.market);
          return (
            <Pressable
              key={row.symbol}
              onPress={() => onOpenHolding?.(row.symbol)}
              style={styles.holdingCard}
            >
              <View style={styles.cardTop}>
                <View style={styles.identity}>
                  <View style={styles.symbolPill}>
                    <Text style={styles.symbolText}>{row.symbol}</Text>
                  </View>
                  <View style={styles.identityText}>
                    <Text style={styles.holdingName}>{row.name}</Text>
                    <View style={styles.tagRow}>
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{row.market === 'TW' ? '台股 ETF' : '美股 ETF'}</Text>
                      </View>
                      {row.categories.slice(0, 1).map(category => (
                        <View key={category} style={styles.tag}>
                          <Text style={styles.tagText}>{CATEGORY_LABELS[category]}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={[styles.pnlBadge, { backgroundColor: tone.background }]}>
                  <Text style={[styles.pnlValue, { color: tone.foreground }]}>
                    {privacy
                      ? '••••'
                      : `${row.view.cashPnl > 0 ? '+' : ''}${money(row.view.cashPnl)}`}
                  </Text>
                  <Text style={[styles.pnlPct, { color: tone.foreground }]}>
                    {privacy ? '••••' : `${row.view.cashRoi > 0 ? '+' : ''}${row.view.cashRoi.toFixed(2)}%`}
                  </Text>
                </View>
              </View>

              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>現價</Text>
                  <Text style={styles.metricValue}>{row.view.price.toFixed(2)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>平均成本</Text>
                  <Text style={styles.metricValue}>{row.view.avgCost.toFixed(2)}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>持有股數</Text>
                  <Text style={styles.metricValue}>{row.view.shares.toLocaleString()}</Text>
                </View>
                <View style={[styles.metric, styles.metricRight]}>
                  <Text style={styles.metricLabel}>當前市值</Text>
                  <Text style={styles.metricValue}>
                    {privacy ? '••••' : money(row.view.marketValue)}
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
  screen: { flex: 1, backgroundColor: V3_THEME.colors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 120 },
  header: { marginBottom: 16 },
  eyebrow: { color: V3_THEME.colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 4, ...V3_THEME.typography.pageTitle },
  subtitle: { marginTop: 5, color: V3_THEME.colors.textSecondary, fontSize: 12 },

  allocationCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 18,
    ...V3_THEME.shadow,
  },
  allocationHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardTitle: { ...V3_THEME.typography.cardTitle },
  cardSub: { marginTop: 3, color: V3_THEME.colors.textSecondary, fontSize: 10 },
  totalPill: {
    borderRadius: 12,
    backgroundColor: V3_THEME.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  totalPillLabel: { color: V3_THEME.colors.textSecondary, fontSize: 9, fontWeight: '700' },
  totalPillValue: { marginTop: 2, color: V3_THEME.colors.primary, fontSize: 13, fontWeight: '900' },
  allocationBody: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  donutWrap: { width: 126, height: 126, alignItems: 'center', justifyContent: 'center' },
  donutCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCaption: { color: V3_THEME.colors.textSecondary, fontSize: 9 },
  donutValue: { marginTop: 3, color: V3_THEME.colors.textPrimary, fontSize: 12, fontWeight: '900' },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  legendLabel: { flex: 1, color: V3_THEME.colors.textSecondary, fontSize: 11, fontWeight: '600' },
  legendValue: { color: V3_THEME.colors.textPrimary, fontSize: 11, fontWeight: '800' },

  segmented: {
    marginTop: 18,
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    ...V3_THEME.shadow,
  },
  segmentText: { color: V3_THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  segmentTextActive: { color: V3_THEME.colors.primary },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...V3_THEME.typography.cardTitle },
  sectionMeta: { color: V3_THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  list: { gap: 14 },
  holdingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 18,
    ...V3_THEME.shadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  identity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  symbolPill: {
    minWidth: 68,
    height: 36,
    borderRadius: 999,
    backgroundColor: V3_THEME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  symbolText: { color: V3_THEME.colors.primary, fontSize: 12, fontWeight: '900' },
  identityText: { flex: 1, minWidth: 0, marginLeft: 12 },
  holdingName: { color: V3_THEME.colors.textPrimary, fontSize: 15, fontWeight: '800' },
  tagRow: { marginTop: 5, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  tag: { borderRadius: 999, backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { color: V3_THEME.colors.textSecondary, fontSize: 9, fontWeight: '700' },
  pnlBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'flex-end' },
  pnlValue: { fontSize: 12, fontWeight: '900' },
  pnlPct: { marginTop: 2, fontSize: 9, fontWeight: '800' },
  metrics: { marginTop: 18, flexDirection: 'row', gap: 10 },
  metric: { flex: 1, minWidth: 0 },
  metricRight: { alignItems: 'flex-end' },
  metricLabel: { color: V3_THEME.colors.textSecondary, fontSize: 9, fontWeight: '600' },
  metricValue: { marginTop: 5, color: V3_THEME.colors.textPrimary, fontSize: 12, fontWeight: '900' },
});

export default PortfolioScreen;
