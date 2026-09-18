import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { calculateDividendView } from '../engine';
import { V3_THEME } from '../theme';
import type { ScreenCommon } from '../screensBase';

type DividendScreenProps = {
  common: ScreenCommon;
  onEditEvent?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
};

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

const dps = (value: number) =>
  Number.isFinite(value) ? value.toFixed(4).replace(/0+$/,'').replace(/.$/,'') : '—';

function SummaryMetric({
  label,
  value,
  accent = 'gold',
}: {
  label: string;
  value: string;
  accent?: 'gold' | 'green';
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          accent === 'green' ? styles.summaryGreen : styles.summaryGold,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function MonthSelector({
  months,
  selected,
  onSelect,
}: {
  months: ReturnType<typeof calculateDividendView>['months'];
  selected: number;
  onSelect: (month: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.monthScroller}
    >
      {months.map(item => {
        const active = selected === item.month;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(item.month)}
            style={({ pressed }) => [
              styles.monthPill,
              active && styles.monthPillActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.monthText, active && styles.monthTextActive]}>
              {item.month}月
            </Text>
            {item.hasDividend ? (
              <View
                style={[
                  styles.monthDot,
                  active && styles.monthDotActive,
                ]}
              />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function StatusBadge({ paid }: { paid: boolean }) {
  return (
    <View
      style={[
        styles.statusBadge,
        paid ? styles.statusPaid : styles.statusPending,
      ]}
    >
      <Text
        style={[
          styles.statusText,
          paid ? styles.statusPaidText : styles.statusPendingText,
        ]}
      >
        {paid ? '已入帳' : '待發放'}
      </Text>
    </View>
  );
}

function DateBadge({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <View style={styles.dateBadge}>
      <Text style={styles.dateBadgeLabel}>{label}</Text>
      <Text style={styles.dateBadgeValue}>{value || '—'}</Text>
    </View>
  );
}

/**
 * DividendScreen
 *
 * Financial data boundary:
 * - All summary/event values come from calculateDividendView().
 * - This component never reads Ledger fee/tax fields.
 * - This component never calculates tax, supplemental health premium,
 *   commission, cost basis, or settlement values.
 */
export function DividendScreen({
  common,
  onEditEvent,
  onMarkPaid,
}: DividendScreenProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const year = now.getFullYear();

  const dividendView = useMemo(
    () =>
      calculateDividendView(
        common.holdings,
        common.ledger,
        common.dividends,
        year,
        selectedMonth,
      ),
    [
      common.holdings,
      common.ledger,
      common.dividends,
      year,
      selectedMonth,
    ],
  );

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
            <Text style={styles.eyebrow}>DIVIDEND TRACKER</Text>
            <Text style={styles.pageTitle}>股息月曆</Text>
          </View>

          <View style={styles.yearPill}>
            <Text style={styles.yearText}>{year}</Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryMetric
            label="預估年度總股息 (TWD)"
            value={privacy ? '••••••' : money(dividendView.yearExpected)}
          />
          <SummaryMetric
            label="平均月領股息"
            value={privacy ? '••••' : money(dividendView.averageMonthly)}
            accent="green"
          />
          <SummaryMetric
            label="當月預估入帳"
            value={privacy ? '••••' : money(dividendView.currentMonthExpected)}
          />
        </View>

        <View style={styles.glowLine} />
      </View>

      <View style={styles.monthSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>月份</Text>
            <Text style={styles.sectionSubtitle}>
              有配息的月份會顯示高亮圓點
            </Text>
          </View>
        </View>

        <MonthSelector
          months={dividendView.months}
          selected={selectedMonth}
          onSelect={setSelectedMonth}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>
              {selectedMonth} 月除息 / 領息明細
            </Text>
            <Text style={styles.sectionSubtitle}>
              {dividendView.monthRows.length} 筆事件
            </Text>
          </View>

          <View style={styles.monthAmountPill}>
            <Text style={styles.monthAmountLabel}>本月</Text>
            <Text style={styles.monthAmountValue}>
              {privacy ? '••••' : money(dividendView.currentMonthExpected)}
            </Text>
          </View>
        </View>

        <View style={styles.list}>
          {dividendView.monthRows.length > 0 ? (
            dividendView.monthRows.map(event => {
              const paid = event.status === 'paid';

              return (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.symbol} ${event.name}`}
                  onPress={() => onEditEvent?.(event.id)}
                  style={({ pressed }) => [
                    styles.eventCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.eventTopRow}>
                    <View style={styles.identity}>
                      <View style={styles.symbolPill}>
                        <Text style={styles.symbolText}>{event.symbol}</Text>
                      </View>

                      <View style={styles.nameWrap}>
                        <Text style={styles.eventName} numberOfLines={1}>
                          {event.name}
                        </Text>
                        <View style={styles.metaRow}>
                          <View style={styles.frequencyPill}>
                            <Text style={styles.frequencyText}>
                              {event.frequencyLabel}
                            </Text>
                          </View>
                          <StatusBadge paid={paid} />
                        </View>
                      </View>
                    </View>

                    <View style={styles.amountBlock}>
                      <Text style={styles.amountLabel}>
                        {paid ? '實際入帳' : '預估領息'}
                      </Text>
                      <Text
                        style={[
                          styles.amountValue,
                          paid ? styles.amountPaid : styles.amountPending,
                        ]}
                      >
                        {privacy ? '••••' : money(event.displayAmount)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.eventMiddleRow}>
                    <View style={styles.formulaBlock}>
                      <Text style={styles.formulaLabel}>每股配息 × 資格股數</Text>
                      <Text style={styles.formulaValue}>
                        {dps(event.dividendPerShare)}
                        <Text style={styles.formulaMuted}> × </Text>
                        {event.eligibleShares.toLocaleString()} 股
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dateRow}>
                    <DateBadge label="除息日" value={event.exDate} />
                    <DateBadge label="發放日" value={event.payDate} />
                  </View>

                  {!paid && onMarkPaid ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onMarkPaid(event.id)}
                      style={({ pressed }) => [
                        styles.confirmButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.confirmButtonText}>確認入帳</Text>
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>本月尚無配息事件</Text>
              <Text style={styles.emptyText}>
                可切換其他月份查看已排定的除息與發放紀錄。
              </Text>
            </View>
          )}
        </View>
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

  summaryCard: {
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.xl,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    ...V3_THEME.typography.helper,
    color: '#E8C76A',
    letterSpacing: 1.2,
  },
  pageTitle: {
    marginTop: 4,
    color: V3_THEME.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  yearPill: {
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(232,199,106,0.28)',
    backgroundColor: 'rgba(232,199,106,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  yearText: {
    color: '#E8C76A',
    fontSize: 12,
    fontWeight: '800',
  },

  summaryGrid: {
    marginTop: V3_THEME.spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: V3_THEME.spacing.md,
  },
  summaryMetric: {
    flexGrow: 1,
    minWidth: '30%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: V3_THEME.spacing.md,
  },
  summaryLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  summaryValue: {
    marginTop: 7,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryGold: {
    color: '#E8C76A',
  },
  summaryGreen: {
    color: V3_THEME.colors.accent,
  },
  glowLine: {
    marginTop: V3_THEME.spacing.lg,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(232,199,106,0.42)',
  },

  monthSection: {
    marginTop: V3_THEME.spacing.xxl,
  },
  section: {
    marginTop: V3_THEME.spacing.xxl,
  },
  sectionHeader: {
    marginBottom: V3_THEME.spacing.md,
  },
  sectionHeaderRow: {
    marginBottom: V3_THEME.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: V3_THEME.spacing.md,
  },
  sectionTitle: {
    ...V3_THEME.typography.cardTitle,
  },
  sectionSubtitle: {
    ...V3_THEME.typography.helper,
    marginTop: 3,
  },

  monthScroller: {
    gap: V3_THEME.spacing.sm,
    paddingRight: V3_THEME.spacing.lg,
  },
  monthPill: {
    minWidth: 58,
    height: 42,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  monthPillActive: {
    backgroundColor: 'rgba(232,199,106,0.12)',
    borderColor: 'rgba(232,199,106,0.42)',
  },
  monthText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  monthTextActive: {
    color: '#E8C76A',
  },
  monthDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
    backgroundColor: V3_THEME.colors.accent,
  },
  monthDotActive: {
    backgroundColor: '#E8C76A',
  },

  monthAmountPill: {
    borderRadius: V3_THEME.radius.pill,
    backgroundColor: V3_THEME.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'flex-end',
  },
  monthAmountLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  monthAmountValue: {
    marginTop: 2,
    color: V3_THEME.colors.accent,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  list: {
    gap: V3_THEME.spacing.md,
  },
  eventCard: {
    width: '100%',
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.lg,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: V3_THEME.spacing.md,
  },
  identity: {
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
    borderColor: 'rgba(232,199,106,0.30)',
    backgroundColor: 'rgba(232,199,106,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  symbolText: {
    color: '#E8C76A',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: V3_THEME.spacing.md,
  },
  eventName: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    marginTop: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  frequencyPill: {
    borderRadius: V3_THEME.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  frequencyText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },

  statusBadge: {
    borderRadius: V3_THEME.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPaid: {
    backgroundColor: V3_THEME.colors.positiveSoft,
  },
  statusPending: {
    backgroundColor: 'rgba(232,199,106,0.12)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusPaidText: {
    color: V3_THEME.colors.accent,
  },
  statusPendingText: {
    color: '#E8C76A',
  },

  amountBlock: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  amountValue: {
    marginTop: 4,
    fontSize: 19,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  amountPaid: {
    color: V3_THEME.colors.accent,
  },
  amountPending: {
    color: '#E8C76A',
  },

  eventMiddleRow: {
    marginTop: V3_THEME.spacing.lg,
  },
  formulaBlock: {
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: V3_THEME.spacing.md,
  },
  formulaLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  formulaValue: {
    marginTop: 4,
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  formulaMuted: {
    color: V3_THEME.colors.textSecondary,
  },

  dateRow: {
    marginTop: V3_THEME.spacing.md,
    flexDirection: 'row',
    gap: V3_THEME.spacing.sm,
  },
  dateBadge: {
    flex: 1,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dateBadgeLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  dateBadgeValue: {
    marginTop: 2,
    color: V3_THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },

  confirmButton: {
    marginTop: V3_THEME.spacing.md,
    minHeight: 40,
    borderRadius: V3_THEME.radius.pill,
    backgroundColor: V3_THEME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: V3_THEME.colors.accent,
    fontSize: 12,
    fontWeight: '800',
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
  pressed: {
    opacity: 0.72,
  },
});

export default DividendScreen;
