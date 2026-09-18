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
  Number.isFinite(value)
    ? value.toFixed(4).replace(/0+$/,'').replace(/.$/,'')
    : '—';

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

  const grouped = useMemo(() => {
    const map = new Map<string, typeof dividendView.monthRows>();
    dividendView.monthRows.forEach(event => {
      const key = event.payDate || event.exDate || '日期未定';
      const rows = map.get(key) ?? [];
      rows.push(event);
      map.set(key, rows);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [dividendView.monthRows]);

  const privacy = common.prefs.privacyMode;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DIVIDEND TRACKER</Text>
        <Text style={styles.title}>股息月曆</Text>
        <Text style={styles.subtitle}>掌握除息、發放與每月被動收入</Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>預估年度總股息</Text>
        <Text style={styles.heroValue}>
          {privacy ? '••••••' : money(dividendView.yearExpected)}
        </Text>
        <Text style={styles.heroUnit}>TWD</Text>

        <View style={styles.heroDivider} />

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>平均月領</Text>
            <Text style={styles.heroStatValue}>
              {privacy ? '••••' : money(dividendView.averageMonthly)}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>本月預估</Text>
            <Text style={styles.heroStatValue}>
              {privacy ? '••••' : money(dividendView.currentMonthExpected)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.monthRow}
      >
        {dividendView.months.map(item => {
          const active = item.month === selectedMonth;
          return (
            <Pressable
              key={item.key}
              onPress={() => setSelectedMonth(item.month)}
              style={[
                styles.monthPill,
                active && styles.monthPillActive,
              ]}
            >
              <Text
                style={[
                  styles.monthText,
                  active && styles.monthTextActive,
                ]}
              >
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

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>{selectedMonth} 月配息明細</Text>
          <Text style={styles.sectionSubtitle}>
            依發放日期分組 · {dividendView.monthRows.length} 筆
          </Text>
        </View>
      </View>

      <View style={styles.groups}>
        {grouped.length ? (
          grouped.map(([date, events]) => (
            <View key={date} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{date}</Text>
                <View style={styles.dateLine} />
              </View>

              <View style={styles.eventList}>
                {events.map(event => {
                  const paid = event.status === 'paid';
                  return (
                    <Pressable
                      key={event.id}
                      onPress={() => onEditEvent?.(event.id)}
                      style={styles.eventCard}
                    >
                      <View style={styles.eventTop}>
                        <View style={styles.identity}>
                          <View style={styles.symbolPill}>
                            <Text style={styles.symbolText}>{event.symbol}</Text>
                          </View>
                          <View style={styles.identityText}>
                            <Text style={styles.eventName}>{event.name}</Text>
                            <Text style={styles.eventMeta}>
                              {event.frequencyLabel} · DPS {dps(event.dividendPerShare)} × {event.eligibleShares.toLocaleString()} 股
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusPill,
                            paid ? styles.statusPaid : styles.statusPending,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              paid ? styles.statusPaidText : styles.statusPendingText,
                            ]}
                          >
                            {paid ? '已發放' : '預計發放'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.eventBottom}>
                        <View>
                          <Text style={styles.amountLabel}>
                            {paid ? '實際入帳' : '預估領息'}
                          </Text>
                          <Text style={styles.amountValue}>
                            {privacy ? '••••' : money(event.displayAmount)}
                          </Text>
                        </View>

                        <View style={styles.datePills}>
                          <View style={styles.infoPill}>
                            <Text style={styles.infoPillText}>
                              除息 {event.exDate || '—'}
                            </Text>
                          </View>
                          <View style={styles.infoPill}>
                            <Text style={styles.infoPillText}>
                              發放 {event.payDate || '—'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {!paid && onMarkPaid ? (
                        <Pressable
                          onPress={() => onMarkPaid(event.id)}
                          style={styles.confirmButton}
                        >
                          <Text style={styles.confirmButtonText}>確認入帳</Text>
                        </Pressable>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>本月尚無配息事件</Text>
            <Text style={styles.emptyText}>可切換其他月份查看配息安排。</Text>
          </View>
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
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
  },
  header: {
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
  heroCard: {
    borderRadius: 16,
    backgroundColor: V3_THEME.colors.primary,
    padding: 20,
    ...V3_THEME.shadow,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
  },
  heroValue: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  heroUnit: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '700',
  },
  heroDivider: {
    marginTop: 18,
    marginBottom: 14,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 20,
  },
  heroStat: {
    flex: 1,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '600',
  },
  heroStatValue: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  monthRow: {
    marginTop: 18,
    gap: 8,
    paddingRight: 18,
  },
  monthPill: {
    minWidth: 58,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  monthPillActive: {
    borderColor: V3_THEME.colors.primary,
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  monthText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  monthTextActive: {
    color: V3_THEME.colors.primary,
  },
  monthDot: {
    width: 5,
    height: 5,
    marginTop: 3,
    borderRadius: 3,
    backgroundColor: '#93C5FD',
  },
  monthDotActive: {
    backgroundColor: V3_THEME.colors.primary,
  },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    ...V3_THEME.typography.cardTitle,
  },
  sectionSubtitle: {
    marginTop: 3,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
  },

  groups: {
    gap: 18,
  },
  dateGroup: {
    gap: 10,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateHeaderText: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  dateLine: {
    flex: 1,
    height: 1,
    marginLeft: 10,
    backgroundColor: V3_THEME.colors.borderGlow,
  },
  eventList: {
    gap: 12,
  },
  eventCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 16,
    ...V3_THEME.shadow,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  identity: {
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
    paddingHorizontal: 9,
  },
  symbolText: {
    color: V3_THEME.colors.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  eventName: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  eventMeta: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    lineHeight: 14,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPaid: {
    backgroundColor: V3_THEME.colors.positiveSoft,
  },
  statusPending: {
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusPaidText: {
    color: V3_THEME.colors.taiwanDown,
  },
  statusPendingText: {
    color: V3_THEME.colors.primary,
  },
  eventBottom: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  amountLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
  },
  amountValue: {
    marginTop: 4,
    color: V3_THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: '900',
  },
  datePills: {
    alignItems: 'flex-end',
    gap: 5,
  },
  infoPill: {
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  infoPillText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
  },
  confirmButton: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: V3_THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  emptyTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 5,
    color: V3_THEME.colors.textSecondary,
    fontSize: 11,
  },
});

export default DividendScreen;
