import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import type { TradeMode } from '../../types/etf';
import type { CashReconciliation, LedgerEntry } from '../model';
import type { ScreenCommon } from '../screensBase';
import { calculateTradePreview } from '../engine';
import { preciseTradeAmount } from '../financeFormat';
import {
  normalizeBrokerProfiles,
  resolveBrokerProfile,
} from '../../data/brokerProfiles';
import { useEtfCatalog } from '../../services/useEtfCatalog';
import { searchEtfCatalog } from '../../services/etfCatalog';
import { V3_THEME } from '../theme';

type LedgerKind = 'buy' | 'sell' | 'dividend' | 'other';

type LedgerScreenProps = {
  common: ScreenCommon;
  cashReconciliation: CashReconciliation;
  onReconcile: (value: CashReconciliation) => void;
  onBuy: (value: {
    symbol: string;
    name: string;
    date: string;
    shares: number;
    price: number;
    tradeMode: TradeMode;
    strategy: 'long' | 'swing';
    account: string;
    brokerProfileId: string;
    calculatedFee: number;
    actualFee: number;
  }) => void;
  onSell: (value: {
    symbol: string;
    date: string;
    shares: number;
    price: number;
    tradeMode: TradeMode;
    brokerProfileId: string;
    calculatedFee: number;
    calculatedTax: number;
    actualFee: number;
    actualTax: number;
  }) => void;
  onCash: (value: {
    amount: number;
    date: string;
    account: string;
    note?: string;
  }) => void;
  onDividend: (symbol: string, amount: number, date: string) => void;
  onUpdateLedger: (value: LedgerEntry) => void;
  onDeleteLedger: (id: string) => void;
  onSettings: () => void;
};

const formatDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const parseDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const money = (value: number) =>
  Math.round(Number.isFinite(value) ? value : 0).toLocaleString('zh-TW');

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  suffix,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  suffix?: string;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          style={styles.input}
        />
        {suffix ? <Text style={styles.inputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function RecordBadge({ kind }: { kind: LedgerEntry['kind'] }) {
  const map: Record<LedgerEntry['kind'], { label: string; bg: string; fg: string }> = {
    buy: { label: '買進', bg: '#FEF2F2', fg: '#EF4444' },
    sell: { label: '賣出', bg: '#EFF6FF', fg: '#0066FF' },
    dividend: { label: '股息', bg: '#ECFDF5', fg: '#10B981' },
    cashIn: { label: '入金', bg: '#ECFDF5', fg: '#10B981' },
    cashOut: { label: '出金', bg: '#FFF7ED', fg: '#F97316' },
  };

  const tone = map[kind];

  return (
    <View style={[styles.recordBadge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.recordBadgeText, { color: tone.fg }]}>
        {tone.label}
      </Text>
    </View>
  );
}

function recordSignedAmount(entry: LedgerEntry) {
  if (entry.kind === 'buy' || entry.kind === 'cashOut') {
    return -Math.abs(entry.amount);
  }

  return Math.abs(entry.amount);
}

export function LedgerScreen({
  common,
  onBuy,
  onSell,
  onCash,
  onDividend,
  onDeleteLedger,
}: LedgerScreenProps) {
  const { catalog } = useEtfCatalog();
  const scrollRef = useRef<ScrollView>(null);
  const first = common.holdings[0];

  const [kind, setKind] = useState<LedgerKind>('buy');
  const [symbol, setSymbol] = useState(first?.symbol ?? '');
  const [name, setName] = useState(first?.name ?? '');
  const [dateText, setDateText] = useState(formatDate(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [shares, setShares] = useState('1000');
  const [price, setPrice] = useState('');
  const [dividendAmount, setDividendAmount] = useState('');
  const [actualFeeText, setActualFeeText] = useState('');
  const [actualTaxText, setActualTaxText] = useState('');
  const [tradeMode, setTradeMode] = useState<TradeMode>(
    first?.liquidationTradeMode ?? 'ODD_LOT',
  );
  const [brokerProfileId, setBrokerProfileId] = useState(
    common.defaultBrokerProfileId,
  );
  const [account, setAccount] = useState(first?.account ?? '');
  const [cashAmount, setCashAmount] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [showAllRecords, setShowAllRecords] = useState(false);

  const selectedBroker = resolveBrokerProfile(
    brokerProfileId,
    common.brokerProfiles,
  );

  const candidates = useMemo(
    () => searchEtfCatalog(catalog, symbol, 6),
    [catalog, symbol],
  );

  useEffect(() => {
    const key = symbol.trim().toUpperCase();
    if (!key) return;

    const holding = common.holdings.find(item => item.symbol === key);
    const exact = catalog.find(item => item.symbol === key);

    if (holding) {
      setName(holding.name);
      setTradeMode(holding.liquidationTradeMode);
      setAccount(holding.account ?? '');
    } else if (exact) {
      setName(exact.name);
    }
  }, [symbol, catalog, common.holdings]);

  const tradeAmount = preciseTradeAmount(
    Number(price || 0),
    Number(shares || 0),
  );

  const preview = calculateTradePreview({
    symbol: symbol || 'PREVIEW',
    shares: Number(shares || 0),
    price: Number(price || 0),
    tradeMode,
    side: kind === 'sell' ? 'sell' : 'buy',
    brokerProfile: selectedBroker,
  });

  const actualFee =
    actualFeeText.trim() === ''
      ? preview.calculatedFee
      : Math.max(0, Number(actualFeeText) || 0);

  const actualTax =
    kind === 'sell'
      ? actualTaxText.trim() === ''
        ? preview.calculatedTax
        : Math.max(0, Number(actualTaxText) || 0)
      : 0;

  const recentRecords = useMemo(
    () =>
      [...common.ledger]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, showAllRecords ? 40 : 6),
    [common.ledger, showAllRecords],
  );

  const onDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setDatePickerOpen(false);
    }

    if (event.type === 'dismissed' || !selectedDate) return;
    setDateText(formatDate(selectedDate));
  };

  const submit = () => {
    const normalized = symbol.trim().toUpperCase();

    if (kind === 'buy') {
      if (!normalized || !(tradeAmount > 0)) {
        Alert.alert('資料不足', '請輸入 ETF 代號、成交價格與成交股數。');
        return;
      }

      onBuy({
        symbol: normalized,
        name: name || normalized,
        date: dateText,
        shares: Number(shares),
        price: Number(price),
        tradeMode,
        strategy: 'long',
        account,
        brokerProfileId,
        calculatedFee: preview.calculatedFee,
        actualFee,
      });
    }

    if (kind === 'sell') {
      if (!normalized || !(tradeAmount > 0)) {
        Alert.alert('資料不足', '請輸入 ETF 代號、成交價格與成交股數。');
        return;
      }

      onSell({
        symbol: normalized,
        date: dateText,
        shares: Number(shares),
        price: Number(price),
        tradeMode,
        brokerProfileId,
        calculatedFee: preview.calculatedFee,
        calculatedTax: preview.calculatedTax,
        actualFee,
        actualTax,
      });
    }

    if (kind === 'dividend') {
      if (!normalized || !(Number(dividendAmount) > 0)) {
        Alert.alert('資料不足', '請輸入 ETF 代號與實際股息收入。');
        return;
      }

      onDividend(normalized, Number(dividendAmount), dateText);
    }

    if (kind === 'other') {
      const value = Number(cashAmount);

      if (!value) {
        Alert.alert('資料不足', '請輸入現金變動金額。');
        return;
      }

      onCash({
        amount: value,
        date: dateText,
        account,
        note: cashNote.trim() || undefined,
      });

      setCashAmount('');
      setCashNote('');
    }

    Alert.alert('完成', '交易紀錄已寫入共用帳務資料鏈。');
  };

  const jumpToRecords = () => {
    setShowAllRecords(true);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 50);
  };

  const formTitle =
    kind === 'buy'
      ? '新增買進紀錄'
      : kind === 'sell'
        ? '新增賣出紀錄'
        : kind === 'dividend'
          ? '新增股息收入'
          : '新增其他資金紀錄';

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>SMART LEDGER</Text>
          <Text style={styles.title}>智慧記帳</Text>
          <Text style={styles.subtitle}>
            交易、股息與資金異動統一寫入既有帳務資料鏈
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={jumpToRecords}
          style={styles.historyShortcut}
        >
          <Text style={styles.historyShortcutText}>記帳紀錄</Text>
        </Pressable>
      </View>

      <View style={styles.segmented}>
        {([
          ['buy', '買進'],
          ['sell', '賣出'],
          ['dividend', '股息收入'],
          ['other', '其他'],
        ] as const).map(([key, label]) => {
          const active = kind === key;

          return (
            <Pressable
              key={key}
              onPress={() => setKind(key)}
              style={[
                styles.segment,
                active && styles.segmentActive,
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

      <View style={styles.formCard}>
        <View style={styles.formHeader}>
          <View>
            <Text style={styles.cardTitle}>{formTitle}</Text>
            <Text style={styles.cardSubtitle}>
              {kind === 'other'
                ? '正數為入金，負數為出金'
                : '確認內容後再寫入帳務紀錄'}
            </Text>
          </View>

          <View style={styles.formTypePill}>
            <Text style={styles.formTypeText}>
              {kind === 'buy'
                ? 'BUY'
                : kind === 'sell'
                  ? 'SELL'
                  : kind === 'dividend'
                    ? 'DIVIDEND'
                    : 'CASH'}
            </Text>
          </View>
        </View>

        {kind !== 'other' ? (
          <>
            <InputField
              label="標的搜尋"
              value={symbol}
              onChangeText={value => setSymbol(value.toUpperCase())}
              placeholder="搜尋 ETF，例如 00919、00878"
            />

            {symbol && candidates.length > 0 ? (
              <View style={styles.candidates}>
                {candidates.map(item => (
                  <Pressable
                    key={item.symbol}
                    onPress={() => {
                      setSymbol(item.symbol);
                      setName(item.name);
                    }}
                    style={styles.candidateRow}
                  >
                    <View style={styles.candidateSymbolPill}>
                      <Text style={styles.candidateSymbol}>
                        {item.symbol}
                      </Text>
                    </View>
                    <Text style={styles.candidateName}>{item.name}</Text>
                    <Text style={styles.candidateArrow}>›</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {name ? (
              <View style={styles.selectedAssetCard}>
                <Text style={styles.selectedAssetLabel}>已選擇標的</Text>
                <Text style={styles.selectedAssetValue}>
                  {symbol} · {name}
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.fieldWrap}>
          <Text style={styles.fieldLabel}>交易日期</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDatePickerOpen(true)}
            style={styles.datePickerButton}
          >
            <View>
              <Text style={styles.datePickerCaption}>DATE</Text>
              <Text style={styles.datePickerValue}>{dateText}</Text>
            </View>
            <View style={styles.calendarIcon}>
              <Text style={styles.calendarIconText}>▦</Text>
            </View>
          </Pressable>

          {datePickerOpen ? (
            <DateTimePicker
              value={parseDate(dateText)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          ) : null}
        </View>

        {kind === 'buy' || kind === 'sell' ? (
          <>
            <View style={styles.doubleFields}>
              <View style={styles.flexOne}>
                <InputField
                  label="成交價格 (TWD)"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              </View>
              <View style={styles.flexOne}>
                <InputField
                  label="成交股數"
                  value={shares}
                  onChangeText={setShares}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
            </View>

            <InputField
              label="手續費"
              value={actualFeeText}
              onChangeText={setActualFeeText}
              keyboardType="decimal-pad"
              placeholder={String(preview.calculatedFee)}
              suffix="TWD"
            />

            {kind === 'sell' ? (
              <InputField
                label="證交稅"
                value={actualTaxText}
                onChangeText={setActualTaxText}
                keyboardType="decimal-pad"
                placeholder={String(preview.calculatedTax)}
                suffix="TWD"
              />
            ) : null}

            <View style={styles.previewCard}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>成交金額</Text>
                <Text style={styles.previewValue}>{money(tradeAmount)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>公式預估手續費</Text>
                <Text style={styles.previewValue}>
                  {preview.calculatedFee.toLocaleString()}
                </Text>
              </View>
              {kind === 'sell' ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>公式預估證交稅</Text>
                  <Text style={styles.previewValue}>
                    {preview.calculatedTax.toLocaleString()}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.fieldLabel}>交易模式</Text>
            <View style={styles.choiceRow}>
              {([
                ['ROUND_LOT', '整股'],
                ['ODD_LOT', '零股 / 定期定額'],
              ] as const).map(([key, label]) => (
                <Pressable
                  key={key}
                  onPress={() => setTradeMode(key)}
                  style={[
                    styles.choice,
                    tradeMode === key && styles.choiceActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      tradeMode === key && styles.choiceTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>券商 Profile</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.choiceRow}
            >
              {normalizeBrokerProfiles(common.brokerProfiles).map(profile => (
                <Pressable
                  key={profile.id}
                  onPress={() => setBrokerProfileId(profile.id)}
                  style={[
                    styles.choice,
                    brokerProfileId === profile.id && styles.choiceActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      brokerProfileId === profile.id && styles.choiceTextActive,
                    ]}
                  >
                    {profile.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <InputField
              label="帳戶 / 交割戶"
              value={account}
              onChangeText={setAccount}
              placeholder="選填"
            />
          </>
        ) : null}

        {kind === 'dividend' ? (
          <InputField
            label="股息收入 (TWD)"
            value={dividendAmount}
            onChangeText={setDividendAmount}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        ) : null}

        {kind === 'other' ? (
          <>
            <InputField
              label="金額 (TWD)"
              value={cashAmount}
              onChangeText={setCashAmount}
              keyboardType="decimal-pad"
              placeholder="正數入金 / 負數出金"
            />
            <InputField
              label="帳戶"
              value={account}
              onChangeText={setAccount}
              placeholder="選填"
            />
            <InputField
              label="備註"
              value={cashNote}
              onChangeText={setCashNote}
              placeholder="例如：薪資入金、生活支出、券商轉入"
            />
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={submit}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>新增交易紀錄</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>最近紀錄</Text>
          <Text style={styles.sectionSubtitle}>
            最新 {showAllRecords ? recentRecords.length : Math.min(6, recentRecords.length)} 筆
          </Text>
        </View>

        <Pressable
          onPress={() => setShowAllRecords(current => !current)}
          style={styles.moreButton}
        >
          <Text style={styles.moreButtonText}>
            {showAllRecords ? '收合' : '查看更多'} ›
          </Text>
        </Pressable>
      </View>

      <View style={styles.historyList}>
        {recentRecords.length > 0 ? (
          recentRecords.map(entry => {
            const signed = recordSignedAmount(entry);
            const positive = signed >= 0;

            return (
              <View key={entry.id} style={styles.historyCard}>
                <View style={styles.historyTop}>
                  <View style={styles.historyIdentity}>
                    <RecordBadge kind={entry.kind} />
                    <View style={styles.historyTextWrap}>
                      <Text style={styles.historyTitle}>
                        {entry.symbol
                          ? `${entry.symbol} ${entry.name ?? ''}`.trim()
                          : entry.note || '現金資金異動'}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {entry.date}
                        {entry.shares
                          ? ` · ${entry.shares.toLocaleString()} 股`
                          : ''}
                        {entry.price
                          ? ` · ${entry.price.toFixed(2)}`
                          : ''}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.historyAmount,
                      positive
                        ? styles.historyAmountPositive
                        : styles.historyAmountNegative,
                    ]}
                  >
                    {positive ? '+' : '-'}
                    {money(Math.abs(signed))}
                  </Text>
                </View>

                <View style={styles.historyBottom}>
                  <Text style={styles.historyDetail}>
                    {entry.account ? `帳戶：${entry.account}` : '共用帳務紀錄'}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      Alert.alert(
                        '刪除紀錄',
                        '確定刪除這筆帳務紀錄？',
                        [
                          { text: '取消', style: 'cancel' },
                          {
                            text: '刪除',
                            style: 'destructive',
                            onPress: () => onDeleteLedger(entry.id),
                          },
                        ],
                      )
                    }
                  >
                    <Text style={styles.deleteText}>刪除</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>尚無記帳紀錄</Text>
            <Text style={styles.emptyText}>
              新增第一筆買進、賣出、股息或資金異動後會顯示在這裡。
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

  headerRow: {
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
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
    fontSize: 11,
    lineHeight: 17,
  },
  historyShortcut: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyShortcutText: {
    color: '#0066FF',
    fontSize: 10,
    fontWeight: '900',
  },

  segmented: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  segmentActive: {
    backgroundColor: '#0066FF',
  },
  segmentText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },

  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  formHeader: {
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
  },
  cardSubtitle: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 10,
  },
  formTypePill: {
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  formTypeText: {
    color: '#0066FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  fieldWrap: {
    marginTop: 15,
  },
  fieldLabel: {
    marginTop: 15,
    marginBottom: 7,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  inputShell: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '800',
    paddingVertical: 0,
  },
  inputSuffix: {
    marginLeft: 8,
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },

  candidates: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  candidateRow: {
    minHeight: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  candidateSymbolPill: {
    minWidth: 62,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  candidateSymbol: {
    color: '#0066FF',
    fontSize: 10,
    fontWeight: '900',
  },
  candidateName: {
    flex: 1,
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
  },
  candidateArrow: {
    color: '#94A3B8',
    fontSize: 20,
  },
  selectedAssetCard: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    padding: 11,
  },
  selectedAssetLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '700',
  },
  selectedAssetValue: {
    marginTop: 3,
    color: '#0066FF',
    fontSize: 11,
    fontWeight: '900',
  },

  datePickerButton: {
    minHeight: 66,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerCaption: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  datePickerValue: {
    marginTop: 4,
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '900',
  },
  calendarIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarIconText: {
    color: '#0066FF',
    fontSize: 17,
    fontWeight: '900',
  },

  doubleFields: {
    flexDirection: 'row',
    gap: 10,
  },
  flexOne: {
    flex: 1,
  },

  previewCard: {
    marginTop: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    padding: 14,
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  previewValue: {
    color: '#0066FF',
    fontSize: 12,
    fontWeight: '900',
  },

  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choice: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: {
    borderColor: '#0066FF',
    backgroundColor: '#EFF6FF',
  },
  choiceText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  choiceTextActive: {
    color: '#0066FF',
  },

  primaryButton: {
    marginTop: 20,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  primaryButtonPressed: {
    opacity: 0.84,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  sectionHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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
  moreButton: {
    minHeight: 34,
    justifyContent: 'center',
  },
  moreButtonText: {
    color: '#0066FF',
    fontSize: 10,
    fontWeight: '900',
  },

  historyList: {
    gap: 12,
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 15,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  historyTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '900',
  },
  historyMeta: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 9,
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  historyAmountPositive: {
    color: '#10B981',
  },
  historyAmountNegative: {
    color: '#EF4444',
  },
  historyBottom: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyDetail: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '600',
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '900',
  },
  recordBadge: {
    minWidth: 46,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  recordBadgeText: {
    fontSize: 9,
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
    fontSize: 13,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 5,
    color: '#64748B',
    fontSize: 10,
    lineHeight: 16,
  },
});

export default LedgerScreen;
