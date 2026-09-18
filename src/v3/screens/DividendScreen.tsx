import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { calculateDividendView } from '../engine';
import type { ScreenCommon } from '../screensBase';

type DividendScreenProps = {
  common: ScreenCommon;
  onEditEvent?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
};

type DividendRow = ReturnType<typeof calculateDividendView>['rows'][number];

type DayEvents = {
  ex: DividendRow[];
  pay: DividendRow[];
};

type CalendarCell = {
  key: string;
  day: number | null;
  dateKey: string | null;
  isToday: boolean;
  events: DayEvents;
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const;

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

const dps = (value: number) =>
  Number.isFinite(value)
    ? value.toFixed(4).replace(/\.?0+$/, '')
    : '—';

const makeDateKey = (year: number, month: number, day: number) =>
  String(year) +
  '-' +
  String(month).padStart(2, '0') +
  '-' +
  String(day).padStart(2, '0');

const getTodayKey = () => {
  const date = new Date();
  return makeDateKey(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
};

const formatSelectedDate = (value: string) => {
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return month && day ? String(month) + ' 月 ' + String(day) + ' 日' : value;
};

export function DividendScreen({
  common,
  onEditEvent,
  onMarkPaid,
}: DividendScreenProps) {
  const initialDate = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(getTodayKey);

  const year = calendarMonth.getFullYear();
  const selectedMonth = calendarMonth.getMonth() + 1;
  const monthKey =
    String(year) + '-' + String(selectedMonth).padStart(2, '0');
  const todayKey = getTodayKey();

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

  const monthEvents = useMemo(
    () =>
      dividendView.rows.filter(
        event =>
          String(event.exDate || '').startsWith(monthKey) ||
          String(event.payDate || '').startsWith(monthKey),
      ),
    [dividendView.rows, monthKey],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DayEvents>();

    const ensure = (key: string) => {
      const current = map.get(key);
      if (current) return current;
      const created: DayEvents = { ex: [], pay: [] };
      map.set(key, created);
      return created;
    };

    monthEvents.forEach(event => {
      if (event.exDate && event.exDate.startsWith(monthKey)) {
        ensure(event.exDate).ex.push(event);
      }
      if (event.payDate && event.payDate.startsWith(monthKey)) {
        ensure(event.payDate).pay.push(event);
      }
    });

    return map;
  }, [monthEvents, monthKey]);

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const firstWeekday = new Date(year, selectedMonth - 1, 1).getDay();
    const daysInMonth = new Date(year, selectedMonth, 0).getDate();
    const requiredCells = firstWeekday + daysInMonth;
    const cellCount = Math.max(35, Math.ceil(requiredCells / 7) * 7);

    return Array.from({ length: cellCount }, (_, index) => {
      const day = index - firstWeekday + 1;
      const inMonth = day >= 1 && day <= daysInMonth;
      const key = inMonth ? makeDateKey(year, selectedMonth, day) : null;

      return {
        key: key || 'blank-' + String(index),
        day: inMonth ? day : null,
        dateKey: key,
        isToday: key === todayKey,
        events: key
          ? eventsByDate.get(key) ?? { ex: [], pay: [] }
          : { ex: [], pay: [] },
      };
    });
  }, [eventsByDate, selectedMonth, todayKey, year]);

  const calendarWeeks = useMemo(() => {
    const weeks: CalendarCell[][] = [];
    for (let index = 0; index < calendarCells.length; index += 7) {
      weeks.push(calendarCells.slice(index, index + 7));
    }
    return weeks;
  }, [calendarCells]);

  const selectedEvents = useMemo(
    () =>
      monthEvents.filter(
        event =>
          event.exDate === selectedDate || event.payDate === selectedDate,
      ),
    [monthEvents, selectedDate],
  );

  const privacy = common.prefs.privacyMode;

  const shiftMonth = (delta: number) => {
    const selectedDay = Math.max(1, Number(selectedDate.slice(8, 10)) || 1);
    const next = new Date(year, selectedMonth - 1 + delta, 1);
    const nextYear = next.getFullYear();
    const nextMonth = next.getMonth() + 1;
    const daysInNextMonth = new Date(nextYear, nextMonth, 0).getDate();

    setCalendarMonth(next);
    setSelectedDate(
      makeDateKey(
        nextYear,
        nextMonth,
        Math.min(selectedDay, daysInNextMonth),
      ),
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>DIVIDEND TRACKER</Text>
        <Text style={styles.title}>股息月曆</Text>
        <Text style={styles.subtitle}>
          以月曆查看除息日、領息日與當日配息明細
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.monthDividendHero}>
          <Text style={styles.monthDividendLabel}>
            {selectedMonth} 月預估股息
          </Text>
          <Text style={styles.monthDividendValue}>
            {privacy ? '••••••' : money(dividendView.currentMonthExpected)}
          </Text>
          <Text style={styles.monthDividendUnit}>TWD</Text>
        </View>

        <View style={styles.summaryMetaRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>年度預估</Text>
            <Text style={styles.summaryValue}>
              {privacy ? '••••••' : money(dividendView.yearExpected)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>平均月領</Text>
            <Text style={styles.summaryValue}>
              {privacy ? '••••' : money(dividendView.averageMonthly)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.calendarCard}>
        <View style={styles.monthSwitcher}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上一個月"
            onPress={() => shiftMonth(-1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.monthButtonPressed,
            ]}
          >
            <Text style={styles.monthButtonText}>‹</Text>
          </Pressable>

          <View style={styles.monthTitleWrap}>
            <Text style={styles.monthTitle}>
              {year} 年 {selectedMonth} 月
            </Text>
            <Text style={styles.monthSubtitle}>
              {monthEvents.length} 筆除息 / 領息事件
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="下一個月"
            onPress={() => shiftMonth(1)}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && styles.monthButtonPressed,
            ]}
          >
            <Text style={styles.monthButtonText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.eventDot, styles.exDot]} />
            <Text style={styles.legendText}>除息日</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.eventDot, styles.payDot]} />
            <Text style={styles.legendText}>領息日</Text>
          </View>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((label, index) => (
            <View key={label} style={styles.weekdayCell}>
              <Text
                style={[
                  styles.weekdayText,
                  (index === 0 || index === 6) && styles.weekendText,
                ]}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarWeeks.map((week, weekIndex) => (
            <View key={'week-' + String(weekIndex)} style={styles.weekRow}>
              {week.map((cell, columnIndex) => {
                const selected = cell.dateKey === selectedDate;
                const hasEx = cell.events.ex.length > 0;
                const hasPay = cell.events.pay.length > 0;
                const allEvents = [...cell.events.ex, ...cell.events.pay];
                const firstSymbol = allEvents[0]?.symbol;
                const uniqueCount = new Set(allEvents.map(event => event.id)).size;
                const isWeekend = columnIndex === 0 || columnIndex === 6;

                return (
                  <Pressable
                    key={cell.key}
                    disabled={!cell.dateKey}
                    onPress={() => {
                      if (cell.dateKey) setSelectedDate(cell.dateKey);
                    }}
                    style={({ pressed }) => [
                      styles.dayCell,
                      !cell.dateKey && styles.dayCellBlank,
                      selected && styles.dayCellSelected,
                      pressed && cell.dateKey && styles.dayCellPressed,
                    ]}
                  >
                    {cell.day ? (
                      <>
                        {cell.isToday ? (
                          <View style={styles.todayCircle}>
                            <Text style={styles.todayText}>{cell.day}</Text>
                          </View>
                        ) : (
                          <Text
                            style={[
                              styles.dayNumber,
                              isWeekend && styles.dayNumberWeekend,
                              selected && styles.dayNumberSelected,
                            ]}
                          >
                            {cell.day}
                          </Text>
                        )}

                        <View style={styles.markerRow}>
                          {hasEx ? (
                            <View style={[styles.eventDot, styles.exDot]} />
                          ) : null}
                          {hasPay ? (
                            <View style={[styles.eventDot, styles.payDot]} />
                          ) : null}
                        </View>

                        {firstSymbol ? (
                          <View style={styles.microLabel}>
                            <Text
                              numberOfLines={1}
                              style={styles.microLabelText}
                            >
                              {firstSymbol}
                              {uniqueCount > 1
                                ? ' +' + String(uniqueCount - 1)
                                : ''}
                            </Text>
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>
            {formatSelectedDate(selectedDate)} 明細
          </Text>
          <Text style={styles.sectionSubtitle}>
            {selectedEvents.length
              ? String(selectedEvents.length) + ' 筆配息事件'
              : '此日期沒有除息或領息事件'}
          </Text>
        </View>
      </View>

      <View style={styles.detailsList}>
        {selectedEvents.length ? (
          selectedEvents.map(event => {
            const paid = event.status === 'paid';
            const isExDate = event.exDate === selectedDate;
            const isPayDate = event.payDate === selectedDate;
            const eventLabel =
              isExDate && isPayDate
                ? '除息 / 領息'
                : isPayDate
                  ? '領息日'
                  : '除息日';

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventTop}>
                  <View style={styles.eventIdentity}>
                    <View style={styles.symbolPill}>
                      <Text style={styles.symbolText}>{event.symbol}</Text>
                    </View>
                    <View style={styles.eventIdentityText}>
                      <Text style={styles.eventName}>{event.name}</Text>
                      <Text style={styles.eventFrequency}>
                        {event.frequencyLabel}
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
                        paid
                          ? styles.statusPaidText
                          : styles.statusPendingText,
                      ]}
                    >
                      {paid ? '已發放' : '預計發放'}
                    </Text>
                  </View>
                </View>

                <View style={styles.eventTypeRow}>
                  <View
                    style={[
                      styles.eventTypePill,
                      isPayDate
                        ? styles.eventTypePay
                        : styles.eventTypeEx,
                    ]}
                  >
                    <Text
                      style={[
                        styles.eventTypeText,
                        isPayDate
                          ? styles.eventTypePayText
                          : styles.eventTypeExText,
                      ]}
                    >
                      {eventLabel}
                    </Text>
                  </View>
                  <Text style={styles.eventDateText}>{selectedDate}</Text>
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>每股配息</Text>
                    <Text style={styles.metricValue}>
                      {dps(event.dividendPerShare)}
                    </Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>持有股數</Text>
                    <Text style={styles.metricValue}>
                      {event.eligibleShares.toLocaleString('zh-TW')}
                    </Text>
                  </View>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>預估領息</Text>
                    <Text style={styles.metricValue}>
                      {privacy ? '••••' : money(event.estimatedAmount)}
                    </Text>
                  </View>
                </View>

                {paid ? (
                  <View style={styles.paidAmountRow}>
                    <Text style={styles.paidAmountLabel}>實際入帳</Text>
                    <Text style={styles.paidAmountValue}>
                      {privacy ? '••••' : money(event.actualAmount)}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.dateInfoRow}>
                  <View style={styles.infoPill}>
                    <View style={[styles.eventDot, styles.exDot]} />
                    <Text style={styles.infoPillText}>
                      除息 {event.exDate || '—'}
                    </Text>
                  </View>
                  <View style={styles.infoPill}>
                    <View style={[styles.eventDot, styles.payDot]} />
                    <Text style={styles.infoPillText}>
                      發放 {event.payDate || '—'}
                    </Text>
                  </View>
                </View>

                {onEditEvent ||
                (!paid && onMarkPaid && isPayDate) ? (
                  <View style={styles.actionRow}>
                    {onEditEvent ? (
                      <Pressable
                        onPress={() => onEditEvent(event.id)}
                        style={styles.editButton}
                      >
                        <Text style={styles.editButtonText}>編輯事件</Text>
                      </Pressable>
                    ) : null}

                    {!paid && onMarkPaid && isPayDate ? (
                      <Pressable
                        onPress={() => onMarkPaid(event.id)}
                        style={styles.confirmButton}
                      >
                        <Text style={styles.confirmButtonText}>確認入帳</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>這一天沒有配息事件</Text>
            <Text style={styles.emptyText}>
              點擊月曆中帶有紅色或綠色標記的日期查看詳細資料。
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    color: '#0066FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    marginTop: 4,
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 5,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },

  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  monthDividendHero: {
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  monthDividendLabel: {
    color: '#0066FF',
    fontSize: 10,
    fontWeight: '800',
  },
  monthDividendValue: {
    marginTop: 6,
    color: '#0F172A',
    fontSize: 28,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  monthDividendUnit: {
    marginTop: 2,
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },
  summaryMetaRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#E2E8F0',
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  summaryValue: {
    marginTop: 5,
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  calendarCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthButtonPressed: {
    opacity: 0.72,
  },
  monthButtonText: {
    color: '#0066FF',
    fontSize: 27,
    fontWeight: '500',
    lineHeight: 30,
  },
  monthTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  monthTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
  },
  monthSubtitle: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
  },

  legendRow: {
    marginTop: 13,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  exDot: {
    backgroundColor: '#EF4444',
  },
  payDot: {
    backgroundColor: '#10B981',
  },

  weekdayRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 5,
  },
  weekdayCell: {
    flex: 1,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  weekendText: {
    color: '#EF4444',
  },

  calendarGrid: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    minWidth: 0,
    height: 66,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 6,
    paddingHorizontal: 2,
  },
  dayCellBlank: {
    borderColor: 'transparent',
    backgroundColor: '#F8FAFC',
  },
  dayCellSelected: {
    borderColor: '#0066FF',
    backgroundColor: '#EFF6FF',
  },
  dayCellPressed: {
    opacity: 0.72,
  },
  dayNumber: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 24,
  },
  dayNumberWeekend: {
    color: '#B91C1C',
  },
  dayNumberSelected: {
    color: '#0066FF',
  },
  todayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  markerRow: {
    marginTop: 2,
    minHeight: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  microLabel: {
    marginTop: 3,
    maxWidth: '96%',
    minHeight: 14,
    borderRadius: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 3,
    justifyContent: 'center',
  },
  microLabelText: {
    color: '#475569',
    fontSize: 6.5,
    fontWeight: '900',
  },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
  },
  sectionSubtitle: {
    marginTop: 3,
    color: '#64748B',
    fontSize: 10,
  },

  detailsList: {
    gap: 12,
  },
  eventCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  eventIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolPill: {
    minWidth: 64,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  symbolText: {
    color: '#0066FF',
    fontSize: 11,
    fontWeight: '900',
  },
  eventIdentityText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  eventName: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
  },
  eventFrequency: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusPaid: {
    backgroundColor: '#ECFDF5',
  },
  statusPending: {
    backgroundColor: '#EFF6FF',
  },
  statusText: {
    fontSize: 9,
    fontWeight: '900',
  },
  statusPaidText: {
    color: '#059669',
  },
  statusPendingText: {
    color: '#0066FF',
  },

  eventTypeRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  eventTypePill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  eventTypeEx: {
    backgroundColor: '#FEF2F2',
  },
  eventTypePay: {
    backgroundColor: '#ECFDF5',
  },
  eventTypeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  eventTypeExText: {
    color: '#DC2626',
  },
  eventTypePayText: {
    color: '#059669',
  },
  eventDateText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },

  metricGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  metricBox: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 5,
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },

  paidAmountRow: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paidAmountLabel: {
    color: '#047857',
    fontSize: 9,
    fontWeight: '800',
  },
  paidAmountValue: {
    color: '#047857',
    fontSize: 14,
    fontWeight: '900',
  },

  dateInfoRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  infoPill: {
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoPillText: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '700',
  },

  actionRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: {
    color: '#0066FF',
    fontSize: 10,
    fontWeight: '900',
  },
  confirmButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 5,
    color: '#64748B',
    fontSize: 10,
    lineHeight: 16,
  },
});

export default DividendScreen;
