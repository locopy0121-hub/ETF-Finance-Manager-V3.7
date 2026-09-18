import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { TradeMode } from '../../types/etf';
import type { CashReconciliation, LedgerEntry } from '../model';
import type { ScreenCommon } from '../screensBase';
import { calculateTradePreview } from '../engine';
import { preciseTradeAmount } from '../financeFormat';
import { normalizeBrokerProfiles, resolveBrokerProfile } from '../../data/brokerProfiles';
import { useEtfCatalog } from '../../services/useEtfCatalog';
import { searchEtfCatalog } from '../../services/etfCatalog';
import { V3_THEME } from '../theme';

type LedgerKind = 'buy' | 'sell' | 'dividend';

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

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
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
  const first = common.holdings[0];

  const [kind, setKind] = useState<LedgerKind>('buy');
  const [symbol, setSymbol] = useState(first?.symbol ?? '');
  const [name, setName] = useState(first?.name ?? '');
  const [dateText, setDateText] = useState(today());
  const [shares, setShares] = useState('1000');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
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

  const selectedBroker = resolveBrokerProfile(
    brokerProfileId,
    common.brokerProfiles,
  );

  const candidates = useMemo(
    () => searchEtfCatalog(catalog, symbol, 5),
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

  const submit = () => {
    const normalized = symbol.trim().toUpperCase();

    if (kind === 'buy') {
      if (!normalized || !(tradeAmount > 0)) {
        Alert.alert('資料不足', '請輸入 ETF 代號、股數與成交價格。');
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
        Alert.alert('資料不足', '請輸入 ETF 代號、股數與成交價格。');
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
      if (!normalized || !(Number(amount) > 0)) {
        Alert.alert('資料不足', '請輸入 ETF 代號與實際股息收入。');
        return;
      }
      onDividend(normalized, Number(amount), dateText);
    }

    Alert.alert('完成', '交易紀錄已寫入共用帳務資料鏈。');
  };

  const addCash = () => {
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
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SMART LEDGER</Text>
        <Text style={styles.title}>智慧記帳</Text>
        <Text style={styles.subtitle}>交易紀錄統一進入現有帳務核心</Text>
      </View>

      <View style={styles.segmented}>
        {([
          ['buy', '買進'],
          ['sell', '賣出'],
          ['dividend', '股息收入'],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setKind(key)}
            style={[
              styles.segment,
              kind === key && styles.segmentActive,
            ]}
          >
            <Text
              style={[
                styles.segmentText,
                kind === key && styles.segmentTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.cardTitle}>
          {kind === 'buy'
            ? '新增買進紀錄'
            : kind === 'sell'
              ? '新增賣出紀錄'
              : '新增股息收入'}
        </Text>

        <InputField
          label="ETF 代號"
          value={symbol}
          onChangeText={value => setSymbol(value.toUpperCase())}
          placeholder="例如 0050"
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
                <Text style={styles.candidateSymbol}>{item.symbol}</Text>
                <Text style={styles.candidateName}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <InputField
          label="ETF 名稱"
          value={name}
          onChangeText={setName}
          placeholder="自動帶入或手動輸入"
        />

        <InputField
          label="交易日期"
          value={dateText}
          onChangeText={setDateText}
          placeholder="YYYY-MM-DD"
        />

        {kind === 'buy' || kind === 'sell' ? (
          <>
            <View style={styles.doubleFields}>
              <View style={styles.flexOne}>
                <InputField
                  label="成交價格"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.flexOne}>
                <InputField
                  label="股數"
                  value={shares}
                  onChangeText={setShares}
                  keyboardType="numeric"
                />
              </View>
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

            <View style={styles.previewCard}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>成交金額</Text>
                <Text style={styles.previewValue}>
                  {Math.round(tradeAmount).toLocaleString()}
                </Text>
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

            <InputField
              label="實際成交手續費"
              value={actualFeeText}
              onChangeText={setActualFeeText}
              keyboardType="decimal-pad"
              placeholder={String(preview.calculatedFee)}
            />

            {kind === 'sell' ? (
              <InputField
                label="實際證交稅"
                value={actualTaxText}
                onChangeText={setActualTaxText}
                keyboardType="decimal-pad"
                placeholder={String(preview.calculatedTax)}
              />
            ) : null}

            <InputField
              label="帳戶 / 交割戶"
              value={account}
              onChangeText={setAccount}
              placeholder="選填"
            />
          </>
        ) : (
          <InputField
            label="實際股息收入"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        )}

        <Pressable onPress={submit} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>新增交易紀錄</Text>
        </Pressable>
      </View>

      <View style={styles.cashCard}>
        <Text style={styles.cardTitle}>現金資金</Text>
        <Text style={styles.cardSubtitle}>保留原本入金 / 出金資料鏈</Text>
        <InputField
          label="金額（正數入金 / 負數出金）"
          value={cashAmount}
          onChangeText={setCashAmount}
          keyboardType="decimal-pad"
        />
        <InputField
          label="備註"
          value={cashNote}
          onChangeText={setCashNote}
        />
        <Pressable onPress={addCash} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>新增現金紀錄</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>最近帳務</Text>
        <Text style={styles.sectionMeta}>{common.ledger.length} 筆</Text>
      </View>

      <View style={styles.historyList}>
        {[...common.ledger]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map(entry => (
            <View key={entry.id} style={styles.historyCard}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyTitle}>
                  {entry.symbol ?? '現金'} · {entry.kind}
                </Text>
                <Text style={styles.historyMeta}>
                  {entry.date} · {Math.round(entry.amount).toLocaleString()}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  Alert.alert('刪除紀錄', '確定刪除這筆帳務紀錄？', [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '刪除',
                      style: 'destructive',
                      onPress: () => onDeleteLedger(entry.id),
                    },
                  ])
                }
              >
                <Text style={styles.deleteText}>刪除</Text>
              </Pressable>
            </View>
          ))}
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

  segmented: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
  },
  segment: { flex: 1, minHeight: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#FFFFFF', ...V3_THEME.shadow },
  segmentText: { color: V3_THEME.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  segmentTextActive: { color: V3_THEME.colors.primary },

  formCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 18,
    ...V3_THEME.shadow,
  },
  cashCard: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 18,
  },
  cardTitle: { ...V3_THEME.typography.cardTitle },
  cardSubtitle: { marginTop: 4, marginBottom: 8, color: V3_THEME.colors.textSecondary, fontSize: 10 },

  fieldWrap: { marginTop: 14 },
  fieldLabel: { marginTop: 14, marginBottom: 6, color: V3_THEME.colors.textSecondary, fontSize: 10, fontWeight: '700' },
  input: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#F8FAFC',
    color: V3_THEME.colors.textPrimary,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },
  doubleFields: { flexDirection: 'row', gap: 10 },
  flexOne: { flex: 1 },

  candidates: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    overflow: 'hidden',
  },
  candidateRow: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V3_THEME.colors.borderGlow,
  },
  candidateSymbol: { width: 70, color: V3_THEME.colors.primary, fontSize: 11, fontWeight: '900' },
  candidateName: { flex: 1, color: V3_THEME.colors.textPrimary, fontSize: 11, fontWeight: '700' },

  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceActive: { borderColor: V3_THEME.colors.primary, backgroundColor: V3_THEME.colors.accentSoft },
  choiceText: { color: V3_THEME.colors.textSecondary, fontSize: 10, fontWeight: '700' },
  choiceTextActive: { color: V3_THEME.colors.primary },

  previewCard: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: V3_THEME.colors.accentSoft,
    padding: 14,
    gap: 8,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { color: V3_THEME.colors.textSecondary, fontSize: 10, fontWeight: '600' },
  previewValue: { color: V3_THEME.colors.primary, fontSize: 12, fontWeight: '900' },

  primaryButton: {
    marginTop: 18,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: V3_THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  secondaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V3_THEME.colors.primary,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: V3_THEME.colors.primary, fontSize: 12, fontWeight: '900' },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { ...V3_THEME.typography.cardTitle },
  sectionMeta: { color: V3_THEME.colors.textSecondary, fontSize: 10, fontWeight: '700' },
  historyList: { gap: 10 },
  historyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyInfo: { flex: 1 },
  historyTitle: { color: V3_THEME.colors.textPrimary, fontSize: 12, fontWeight: '800' },
  historyMeta: { marginTop: 3, color: V3_THEME.colors.textSecondary, fontSize: 9 },
  deleteText: { color: '#EF4444', fontSize: 10, fontWeight: '800' },
});

export default LedgerScreen;
