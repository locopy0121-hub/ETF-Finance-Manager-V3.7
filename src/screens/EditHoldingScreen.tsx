import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ScaledText as Text } from '../components/ScaledText';
import { Holding } from '../data/portfolio';
import { FeeSettings, estimateBuyFee } from '../data/tradeSettings';
import { money } from '../domain/metrics';
import { preciseTradeAmount, roundHalfUp } from '../v3/financeFormat';
import { Card, Chip, Header, palette, SectionTitle } from '../components/Ui';

const TAGS = ['核心持有', '長期持有', '觀察中'] as const;

type Props = {
  holding: Holding;
  feeSettings: FeeSettings;
  onCancel: () => void;
  onSave: (holding: Holding) => void;
};

const parse = (value: string) => {
  const n = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
};

export default function EditHoldingScreen({ holding, feeSettings, onCancel, onSave }: Props) {
  const [shares, setShares] = useState(String(holding.shares));
  const [tradeAvgPrice, setTradeAvgPrice] = useState(String(holding.tradeAvgPrice ?? holding.avgCost));
  const [actualFee, setActualFee] = useState(String(holding.buyFee ?? 0));
  const [targetWeight, setTargetWeight] = useState(String((holding.targetWeight * 100).toFixed(2).replace(/\.00$/, '')));
  const [annualDividend, setAnnualDividend] = useState(String(holding.annualDividendPerShare ?? 0));
  const [tag, setTag] = useState<(typeof TAGS)[number]>(TAGS.includes(holding.tag as any) ? holding.tag as any : '長期持有');
  const [error, setError] = useState('');

  const values = useMemo(() => {
    const sh = parse(shares);
    const price = parse(tradeAvgPrice);
    const amount = Number.isFinite(sh) && Number.isFinite(price) && sh > 0 && price > 0 ? preciseTradeAmount(price, sh) : 0;
    const estimatedFee = estimateBuyFee(amount, feeSettings);
    const enteredFee = parse(actualFee);
    const fee = roundHalfUp(Number.isFinite(enteredFee) && enteredFee >= 0 ? enteredFee : estimatedFee, 2);
    const totalCost = amount > 0 ? roundHalfUp(amount + fee, 2) : 0;
    const effectiveAvg = Number.isFinite(sh) && sh > 0 ? totalCost / sh : 0;
    return { sh, price, amount, estimatedFee, fee, totalCost, effectiveAvg };
  }, [shares, tradeAvgPrice, actualFee, feeSettings]);

  const save = () => {
    const weightPct = parse(targetWeight);
    const dividend = parse(annualDividend);
    if (!Number.isFinite(values.sh) || values.sh <= 0) return setError('持有股數必須大於 0。');
    if (!Number.isFinite(values.price) || values.price <= 0) return setError('成交均價必須大於 0。');
    if (!Number.isFinite(values.fee) || values.fee < 0) return setError('手續費不可小於 0。');
    if (!Number.isFinite(weightPct) || weightPct < 0 || weightPct > 100) return setError('目標比重請輸入 0～100。');
    if (!Number.isFinite(dividend) || dividend < 0) return setError('每股年配息不可小於 0。');

    setError('');
    onSave({
      ...holding,
      shares: values.sh,
      tradeAvgPrice: values.price,
      buyFee: values.fee,
      feeRate: feeSettings.feeRate,
      feeDiscount: feeSettings.discount,
      avgCost: values.effectiveAvg,
      targetWeight: weightPct / 100,
      annualDividendPerShare: dividend,
      tag,
      subtitle: `TWSE 主檔 · ${tag}`,
    });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Header title="修改 ETF 庫存" subtitle="重新計算含手續費平均成本" slogan="修改只影響真實庫存，不改變歷史模擬結果。" />

        <Card>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.backButton}><Text style={styles.backText}>‹ 返回持倉</Text></Pressable>
            <Chip text="TWSE 最終行情" tone="green" />
          </View>
          <SectionTitle icon="✎" title="ETF 基本資料" subtitle="代號與名稱固定，避免修改到錯誤標的" />
          <View style={styles.identityBox}>
            <View style={styles.symbolBadge}><Text style={styles.symbolText}>{holding.symbol}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{holding.name}</Text>
              <Text style={styles.hint}>ETF 代號與名稱如需更換，請刪除後重新新增庫存。</Text>
            </View>
          </View>
        </Card>

        <Card>
          <SectionTitle icon="$" title="庫存與交易成本" subtitle="修改後會立即重算總成本與含費平均成本" />
          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="持有股數 *" value={shares} onChangeText={setShares} keyboardType="decimal-pad" /></View>
            <View style={styles.col}><Field label="成交均價（未含費）*" value={tradeAvgPrice} onChangeText={setTradeAvgPrice} keyboardType="decimal-pad" prefix="" /></View>
          </View>
          <View style={styles.feePanel}>
            <Text style={styles.feeTitle}>手續費</Text>
            <Text style={styles.hint}>若保留實際券商手續費，系統以實際金額計算；清空或輸入無效值時才依目前費率估算。</Text>
            <View style={styles.previewRow}>
              <Preview label="成交金額" value={money(values.amount, 2)} />
              <Preview label="預估手續費" value={money(values.estimatedFee, 2)} />
              <Preview label="含費均價" value={money(values.effectiveAvg, 4)} />
            </View>
            <Field label="實際買進手續費" value={actualFee} onChangeText={setActualFee} keyboardType="decimal-pad" prefix="" />
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="目標比重" value={targetWeight} onChangeText={setTargetWeight} keyboardType="decimal-pad" suffix="%" /></View>
            <View style={styles.col}><Field label="每股年配息估值" value={annualDividend} onChangeText={setAnnualDividend} keyboardType="decimal-pad" prefix="" /></View>
          </View>

          <Text style={styles.label}>持有分類</Text>
          <View style={styles.tagRow}>{TAGS.map(item => {
            const active = tag === item;
            return <Pressable key={item} onPress={() => setTag(item)} style={[styles.tagButton, active && styles.tagButtonActive]}><Text style={[styles.tagText, active && styles.tagTextActive]}>{item}</Text></Pressable>;
          })}</View>
        </Card>

        <Card>
          <SectionTitle icon="▦" title="修改後預覽" subtitle="TWSE 行情不由這裡手動修改" />
          <View style={styles.previewRow}>
            <Preview label="股數" value={Number.isFinite(values.sh) && values.sh > 0 ? values.sh.toLocaleString('zh-TW') : '0'} />
            <Preview label="含費總成本" value={money(values.totalCost, 2)} />
            <Preview label="含費平均成本" value={money(values.effectiveAvg, 4)} />
          </View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onCancel}><Text style={styles.cancelText}>取消</Text></Pressable>
            <Pressable style={styles.saveButton} onPress={save}><Text style={styles.saveText}>儲存修改</Text></Pressable>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, keyboardType, prefix, suffix }: any) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><View style={styles.inputRow}>{prefix && <Text style={styles.affix}>{prefix}</Text>}<TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={styles.input} placeholderTextColor={palette.muted} />{suffix && <Text style={styles.affix}>{suffix}</Text>}</View></View>;
}
function Preview({ label, value }: { label: string; value: string }) { return <View style={styles.preview}><Text style={styles.previewLabel}>{label}</Text><Text style={styles.previewValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingBottom: 100 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  backButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 }, backText: { color: palette.green, fontWeight: '900', fontSize: 12 },
  identityBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, backgroundColor: palette.surfaceSoft, padding: 12 },
  symbolBadge: { minWidth: 66, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.blue }, symbolText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  name: { color: palette.text, fontSize: 18, fontWeight: '900' }, hint: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: 4 },
  twoCol: { flexDirection: 'row', gap: 8 }, col: { flex: 1, minWidth: 0 }, field: { marginBottom: 11 }, label: { color: palette.text, fontSize: 10, fontWeight: '900', marginBottom: 6 },
  inputRow: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FFFFFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' }, input: { flex: 1, color: palette.text, fontSize: 15, fontWeight: '800', paddingVertical: 8 }, affix: { color: palette.muted, fontSize: 10, fontWeight: '800', marginHorizontal: 4 },
  feePanel: { borderRadius: 14, backgroundColor: palette.surfaceSoft, padding: 11, marginBottom: 11 }, feeTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  previewRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginVertical: 8 }, preview: { flex: 1, minWidth: 92, borderRadius: 11, backgroundColor: palette.greenSoft, padding: 9 }, previewLabel: { color: palette.muted, fontSize: 8 }, previewValue: { color: palette.text, fontSize: 11, fontWeight: '900', marginTop: 4 },
  tagRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' }, tagButton: { minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, tagButtonActive: { borderColor: palette.green, backgroundColor: palette.greenSoft }, tagText: { color: palette.muted, fontSize: 10, fontWeight: '800' }, tagTextActive: { color: palette.green },
  error: { color: palette.red, fontSize: 10, lineHeight: 15, fontWeight: '800', marginTop: 8 }, actions: { flexDirection: 'row', gap: 8, marginTop: 12 }, cancelButton: { flex: 1, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: palette.text, fontWeight: '900' }, saveButton: { flex: 2, minHeight: 48, borderRadius: 13, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#FFFFFF', fontWeight: '900' },
});
