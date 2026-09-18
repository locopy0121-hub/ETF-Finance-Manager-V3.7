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

type PortfolioTab = 'holdings' | 'allocation' | 'performance';

type PortfolioScreenProps = {
  common: ScreenCommon;
  onOpenHolding?: (symbol: string) => void;
};

type HoldingRow = {
  symbol: string;
  name: string;
  category: string;
  categories: Exclude<EtfCategory, 'all'>[];
  view: ReturnType<typeof calculateHoldingView>;
};

type AllocationItem = {
  key: string;
  label: string;
  value: number;
  color: string;
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

const ALLOCATION_COLORS = [
  '#4FD1A5',
  '#58A6FF',
  '#A78BFA',
  '#F59E0B',
  '#F472B6',
  '#22D3EE',
  '#94A3B8',
] as const;

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

const price = (value: number) =>
  Number.isFinite(value) ? value.toFixed(2) : '—';

const pct = (value: number) =>
  Number.isFinite(value)
    ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
    : '—';

function SegmentedControl({
  value,
  onChange,
}: {
  value: PortfolioTab;
  onChange: (next: PortfolioTab) => void;
}) {
  const tabs: Array<[PortfolioTab, string]> = [
    ['holdings', '持股明細'],
    ['allocation', '資產配置'],
    ['performance', '報酬分析'],
  ];

  return (
    <View style={styles.segmented}>
      {tabs.map(([key, label]) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(key)}
            style={({ pressed }) => [
              styles.segmentButton,
              active && styles.segmentButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                active && styles.segmentTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PnlBadge({
  value,
  percent,
}: {
  value: number;
  percent: number;
}) {
  const tone = resolvePnlTone(value, 'TW');

  return (
    <View style={[styles.pnlBadge, { backgroundColor: tone.background }]}>
      <Text style={[styles.pnlValue, { color: tone.foreground }]}>
        {value > 0 ? '+' : ''}
        {money(value)}
      </Text>
      <Text style={[styles.pnlPercent, { color: tone.foreground }]}>
        {pct(percent)}
      </Text>
    </View>
  );
}

function AllocationDonut({
  items,
  total,
}: {
  items: AllocationItem[];
  total: number;
}) {
  const radius = 42;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <Svg width={128} height={128} viewBox="0 0 128 128">
        <Circle
          cx={64}
          cy={64}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />

        <G rotation="-90" origin="64,64">
          {items.map(item => {
            const ratio = total > 0 ? item.value / total : 0;
            const dash = Math.max(0, ratio * circumference);
            const node = (
              <Circle
                key={item.key}
                cx={64}
                cy={64}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return node;
          })}
        </G>
      </Svg>

      <View pointerEvents="none" style={styles.donutCenter}>
        <Text style={styles.donutCenterLabel}>持倉總市值</Text>
        <Text style={styles.donutCenterValue}>
          {money(total)}
        </Text>
      </View>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  pnl,
}: {
  label: string;
  value: string;
  pnl?: number;
}) {
  const tone = pnl == null ? null : resolvePnlTone(pnl, 'TW');

  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone && { color: tone.foreground },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function HoldingCard({
  row,
  privacy,
  expanded,
  onPress,
}: {
  row: HoldingRow;
  privacy: boolean;
  expanded: boolean;
  onPress: () => void;
}) {
  const { view } = row;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.symbol} ${row.name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.holdingCard,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.holdingHeader}>
        <View style={styles.identityRow}>
          <View style={styles.symbolPill}>
            <Text style={styles.symbolText}>{row.symbol}</Text>
          </View>

          <View style={styles.identityText}>
            <Text style={styles.holdingName} numberOfLines={1}>
              {row.name}
            </Text>

            <View style={styles.categoryRow}>
              {row.categories.slice(0, 2).map(category => (
                <View key={category} style={styles.categoryPill}>
                  <Text style={styles.categoryText}>
                    {CATEGORY_LABELS[category]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <PnlBadge
          value={view.cashPnl}
          percent={view.cashRoi}
        />
      </View>

      <View style={styles.holdingMetrics}>
        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>現價 / 平均成本</Text>
          <Text style={styles.metricValue}>
            {price(view.price)}
            <Text style={styles.metricDivider}> / </Text>
            <Text style={styles.metricSecondary}>
              {price(view.avgCost)}
            </Text>
          </Text>
        </View>

        <View style={styles.metricBlock}>
          <Text style={styles.metricLabel}>持有股數</Text>
          <Text style={styles.metricValue}>
            {view.shares.toLocaleString()} 股
          </Text>
        </View>

        <View style={[styles.metricBlock, styles.metricBlockRight]}>
          <Text style={styles.metricLabel}>當前市值</Text>
          <Text style={styles.metricValue}>
            {privacy ? '••••' : money(view.marketValue)}
          </Text>
        </View>
      </View>

      {expanded ? (
        <View style={styles.expandedPanel}>
          <View style={styles.expandedMetric}>
            <Text style={styles.metricLabel}>含費平均成本</Text>
            <Text style={styles.expandedValue}>
              {price(view.cashAvgCost)}
            </Text>
          </View>

          <View style={styles.expandedMetric}>
            <Text style={styles.metricLabel}>純價格損益</Text>
            <Text style={styles.expandedValue}>
              {privacy ? '••••' : money(view.pricePnl)}
            </Text>
          </View>

          <View style={styles.expandedMetric}>
            <Text style={styles.metricLabel}>累積配息</Text>
            <Text style={styles.expandedValue}>
              {privacy ? '••••' : money(view.cumulativeDividend)}
            </Text>
          </View>

          <Text style={styles.detailHint}>
            再次點擊收合；接上標的詳情導航後可直接進入交易紀錄。
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * PortfolioScreen
 *
 * Financial data boundary:
 * - Portfolio summary: calculatePortfolioView()
 * - Holding rows: calculateHoldingView()
 * - No Ledger fee/tax reads.
 * - No commission, tax, historical cost, or settlement calculations.
 *
 * Local calculations in this file are presentation-only aggregation
 * of Engine-provided marketValue values for allocation percentages.
 */
export function PortfolioScreen({
  common,
  onOpenHolding,
}: PortfolioScreenProps) {
  const [tab, setTab] = useState<PortfolioTab>('holdings');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

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
          const view = calculateHoldingView(
            holding,
            common.quotes,
            common.ledger,
            common.dividends,
          );

          return {
            symbol: holding.symbol,
            name: holding.name,
            category: CATEGORY_LABELS[categories[0]],
            categories,
            view,
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

  const allocation = useMemo<AllocationItem[]>(() => {
    const totals = new Map<string, number>();

    rows.forEach(row => {
      const key = row.categories[0] ?? 'market';
      totals.set(
        key,
        (totals.get(key) ?? 0) + row.view.marketValue,
      );
    });

    return [...totals.entries()]
      .map(([key, value], index) => ({
        key,
        label:
          CATEGORY_LABELS[key as Exclude<EtfCategory, 'all'>] ??
          '其他',
        value,
        color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const handleHoldingPress = (symbol: string) => {
    if (onOpenHolding) {
      onOpenHolding(symbol);
      return;
    }

    setExpandedSymbol(current =>
      current === symbol ? null : symbol,
    );
  };

  const privacy = common.prefs.privacyMode;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.eyebrow}>PORTFOLIO</Text>
            <Text style={styles.pageTitle}>庫存持倉</Text>
          </View>

          <View style={styles.holdingCountPill}>
            <Text style={styles.holdingCountText}>
              {portfolio.holdingCount} 檔
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard
            label="持倉總市值"
            value={privacy ? '••••••' : money(portfolio.marketValue)}
          />
          <SummaryCard
            label="累積總損益"
            value={
              privacy
                ? '••••'
                : `${portfolio.totalPnl > 0 ? '+' : ''}${money(
                    portfolio.totalPnl,
                  )}`
            }
            pnl={portfolio.totalPnl}
          />
        </View>

        <View style={styles.allocationOverview}>
          <AllocationDonut
            items={allocation}
            total={portfolio.marketValue}
          />

          <View style={styles.legend}>
            {allocation.slice(0, 4).map(item => {
              const ratio =
                portfolio.marketValue > 0
                  ? (item.value / portfolio.marketValue) * 100
                  : 0;

              return (
                <View key={item.key} style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: item.color },
                    ]}
                  />
                  <Text style={styles.legendLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.legendValue}>
                    {ratio.toFixed(1)}%
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <SegmentedControl value={tab} onChange={setTab} />

      {tab === 'holdings' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>持股明細</Text>
              <Text style={styles.sectionSubtitle}>
                現價、成本、市值與含費損益
              </Text>
            </View>
          </View>

          <View style={styles.list}>
            {rows.length > 0 ? (
              rows.map(row => (
                <HoldingCard
                  key={row.symbol}
                  row={row}
                  privacy={privacy}
                  expanded={expandedSymbol === row.symbol}
                  onPress={() => handleHoldingPress(row.symbol)}
                />
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>尚無持倉</Text>
                <Text style={styles.emptyText}>
                  完成第一筆買進交易後，持股會顯示在這裡。
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : null}

      {tab === 'allocation' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>資產配置</Text>
              <Text style={styles.sectionSubtitle}>
                依 ETF 類別檢視持倉集中度
              </Text>
            </View>
          </View>

          <View style={styles.analysisCard}>
            <AllocationDonut
              items={allocation}
              total={portfolio.marketValue}
            />

            <View style={styles.allocationList}>
              {allocation.map(item => {
                const ratio =
                  portfolio.marketValue > 0
                    ? (item.value / portfolio.marketValue) * 100
                    : 0;

                return (
                  <View key={item.key} style={styles.allocationRow}>
                    <View style={styles.allocationNameWrap}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: item.color },
                        ]}
                      />
                      <Text style={styles.allocationName}>
                        {item.label}
                      </Text>
                    </View>

                    <View style={styles.allocationNumbers}>
                      <Text style={styles.allocationValue}>
                        {privacy ? '••••' : money(item.value)}
                      </Text>
                      <Text style={styles.allocationRatio}>
                        {ratio.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

      {tab === 'performance' ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>報酬分析</Text>
              <Text style={styles.sectionSubtitle}>
                Engine View Model 彙總結果
              </Text>
            </View>
          </View>

          <View style={styles.performanceGrid}>
            <SummaryCard
              label="今日損益"
              value={
                privacy
                  ? '••••'
                  : `${portfolio.todayPnl > 0 ? '+' : ''}${money(
                      portfolio.todayPnl,
                    )}`
              }
              pnl={portfolio.todayPnl}
            />
            <SummaryCard
              label="今日損益率"
              value={privacy ? '••••' : pct(portfolio.todayPnlPct)}
              pnl={portfolio.todayPnlPct}
            />
            <SummaryCard
              label="純價格損益"
              value={privacy ? '••••' : money(portfolio.pricePnl)}
              pnl={portfolio.pricePnl}
            />
            <SummaryCard
              label="含費未實現損益"
              value={
                privacy
                  ? '••••'
                  : money(portfolio.cashUnrealizedPnl)
              }
              pnl={portfolio.cashUnrealizedPnl}
            />
            <SummaryCard
              label="已實現含費損益"
              value={privacy ? '••••' : money(portfolio.realizedCashPnl)}
              pnl={portfolio.realizedCashPnl}
            />
            <SummaryCard
              label="累積配息"
              value={privacy ? '••••' : money(portfolio.cumulativeDividends)}
            />
          </View>
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
    paddingHorizontal: V3_THEME.spacing.lg,
    paddingTop: V3_THEME.spacing.lg,
    paddingBottom: 120,
  },

  summaryCard: {
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.xl,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    ...V3_THEME.typography.helper,
    color: V3_THEME.colors.accent,
    letterSpacing: 1.2,
  },
  pageTitle: {
    marginTop: 4,
    color: V3_THEME.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  holdingCountPill: {
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: V3_THEME.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  holdingCountText: {
    color: V3_THEME.colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  summaryRow: {
    marginTop: V3_THEME.spacing.xl,
    flexDirection: 'row',
    gap: V3_THEME.spacing.md,
  },
  summaryMetric: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: V3_THEME.spacing.md,
  },
  summaryLabel: {
    ...V3_THEME.typography.helper,
  },
  summaryValue: {
    marginTop: 7,
    color: V3_THEME.colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  allocationOverview: {
    marginTop: V3_THEME.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: V3_THEME.spacing.lg,
  },
  donutWrap: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
  },
  donutCenterLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  donutCenterValue: {
    marginTop: 3,
    color: V3_THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  legend: {
    flex: 1,
    gap: 9,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    color: V3_THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  legendValue: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  segmented: {
    marginTop: V3_THEME.spacing.lg,
    padding: 4,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    flexDirection: 'row',
  },
  segmentButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: V3_THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segmentButtonActive: {
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  segmentText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: V3_THEME.colors.accent,
  },
  pressed: {
    opacity: 0.72,
  },

  section: {
    marginTop: V3_THEME.spacing.xxl,
  },
  sectionHeader: {
    marginBottom: V3_THEME.spacing.md,
  },
  sectionTitle: {
    ...V3_THEME.typography.cardTitle,
  },
  sectionSubtitle: {
    ...V3_THEME.typography.helper,
    marginTop: 3,
  },
  list: {
    gap: V3_THEME.spacing.md,
  },

  holdingCard: {
    width: '100%',
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.lg,
  },
  holdingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: V3_THEME.spacing.md,
  },
  identityRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolPill: {
    minWidth: 68,
    height: 34,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: V3_THEME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  symbolText: {
    color: V3_THEME.colors.accent,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    marginLeft: V3_THEME.spacing.md,
  },
  holdingName: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  categoryRow: {
    marginTop: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  categoryPill: {
    borderRadius: V3_THEME.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  pnlBadge: {
    borderRadius: V3_THEME.radius.card,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  pnlValue: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pnlPercent: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  holdingMetrics: {
    marginTop: V3_THEME.spacing.lg,
    flexDirection: 'row',
    gap: V3_THEME.spacing.md,
  },
  metricBlock: {
    flex: 1,
    minWidth: 0,
  },
  metricBlockRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  metricValue: {
    marginTop: 4,
    color: V3_THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  metricDivider: {
    color: V3_THEME.colors.textSecondary,
  },
  metricSecondary: {
    color: V3_THEME.colors.textSecondary,
  },

  expandedPanel: {
    marginTop: V3_THEME.spacing.lg,
    paddingTop: V3_THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: V3_THEME.colors.borderGlow,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: V3_THEME.spacing.md,
  },
  expandedMetric: {
    minWidth: '28%',
    flexGrow: 1,
  },
  expandedValue: {
    marginTop: 4,
    color: V3_THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  detailHint: {
    width: '100%',
    marginTop: 2,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    lineHeight: 15,
  },

  analysisCard: {
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.lg,
    alignItems: 'center',
  },
  allocationList: {
    width: '100%',
    marginTop: V3_THEME.spacing.lg,
    gap: V3_THEME.spacing.md,
  },
  allocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allocationNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allocationName: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  allocationNumbers: {
    alignItems: 'flex-end',
  },
  allocationValue: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  allocationRatio: {
    marginTop: 2,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },

  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: V3_THEME.spacing.md,
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

export default PortfolioScreen;
