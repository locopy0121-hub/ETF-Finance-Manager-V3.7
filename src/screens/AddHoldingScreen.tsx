import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ScaledText as Text } from '../components/ScaledText';
import { Holding } from '../data/portfolio';
import { FeeSettings, estimateBuyFee } from '../data/tradeSettings';
import { money } from '../domain/metrics';
import { preciseTradeAmount, roundHalfUp } from '../v3/financeFormat';
import { searchEtfCatalog, EtfCatalogItem } from '../services/etfCatalog';
import { useEtfCatalog } from '../services/useEtfCatalog';
import { Card, Chip, Header, palette, SectionTitle } from '../components/Ui';
import DatePickerField from '../components/DatePickerField';

type Props = {
  existingHoldings: Holding[];
  feeSettings: FeeSettings;
  onCancel: () => void;
  onSave: (holding: Holding) => void;
  onSaveBatch: (holdings: Holding[]) => void;
};

const TAGS = ['核心持有', '長期持有', '觀察中'] as const;
const localIsoDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

export default function AddHoldingScreen({ existingHoldings, feeSettings, onCancel, onSave, onSaveBatch }: Props) {
  const { catalog, loading, error: catalogError, onlineCount, refresh } = useEtfCatalog();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EtfCatalogItem | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(localIsoDate);
  const [shares, setShares] = useState('');
  const [tradeAvgPrice, setTradeAvgPrice] = useState('');
  const [actualFee, setActualFee] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [annualDividend, setAnnualDividend] = useState('');
  const [tag, setTag] = useState<(typeof TAGS)[number]>('長期持有');
  const [error, setError] = useState('');

  const results = useMemo(() => searchEtfCatalog(catalog, query), [catalog, query]);

  // Exact symbol entry: automatically select and bring in the ETF name.
  useEffect(() => {
    const normalized = query.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[0-9]{4,6}[A-Z]?$/.test(normalized)) return;
    const exact = catalog.find(item => item.symbol.toUpperCase() === normalized);
    if (exact && exact.symbol !== selected?.symbol) setSelected(exact);
  }, [query, catalog, selected?.symbol]);

  const parsedShares = Number(shares.replace(/,/g, ''));
  const parsedTradePrice = Number(tradeAvgPrice.replace(/,/g, ''));
  const roundedShares = Number.isFinite(parsedShares) ? Math.round(parsedShares) : 0;
  const roundedTradePrice = Number.isFinite(parsedTradePrice) ? Math.round(parsedTradePrice * 100) / 100 : 0;
  const tradeAmount = roundedShares > 0 && roundedTradePrice > 0 ? preciseTradeAmount(roundedTradePrice, roundedShares) : 0;
  const estimatedFee = estimateBuyFee(tradeAmount, feeSettings);
  const parsedActualFee = actualFee.trim() === '' ? NaN : Number(actualFee.replace(/,/g, ''));
  const appliedFee = roundHalfUp(Number.isFinite(parsedActualFee) && parsedActualFee >= 0 ? parsedActualFee : estimatedFee, 2);
  const totalCost = tradeAmount > 0 ? roundHalfUp(tradeAmount + appliedFee, 2) : 0;
  const effectiveAvgCost = parsedShares > 0 ? tradeAmount / parsedShares : 0;

  const existingHolding = useMemo(() => selected ? existingHoldings.find(h => h.symbol.toUpperCase() === selected.symbol.toUpperCase()) : undefined, [existingHoldings, selected]);
  const existingPureCost = existingHolding ? ((existingHolding.purchaseRecords?.length ? existingHolding.purchaseRecords.reduce((sum,r)=>sum+Number(r.purchaseCost||0),0) : existingHolding.shares * (existingHolding.tradeAvgPrice ?? existingHolding.avgCost))) : 0;
  const existingTotalCost = existingHolding ? ((existingHolding.purchaseRecords?.length ? existingHolding.purchaseRecords.reduce((sum,r)=>sum+Number(r.totalCost||0),0) : existingPureCost + Number(existingHolding.buyFee||0))) : 0;
  const postAddShares = (existingHolding?.shares ?? 0) + (Number.isFinite(parsedShares) && parsedShares > 0 ? parsedShares : 0);
  const postAddPureCost = existingPureCost + Math.max(0, tradeAmount);
  const postAddTotalCost = existingTotalCost + Math.max(0, totalCost);
  const postAddAvgCost = postAddShares > 0 ? postAddPureCost / postAddShares : 0;
  const duplicatePurchase = useMemo(() => {
    if (!existingHolding || !purchaseDate || !Number.isFinite(parsedShares) || !Number.isFinite(parsedTradePrice)) return false;
    return (existingHolding.purchaseRecords ?? []).some(r => r.date === purchaseDate && Math.abs(r.shares - parsedShares) < 0.0001 && Math.abs(r.tradePrice - parsedTradePrice) < 0.005 && Math.abs((r.fee ?? 0) - appliedFee) < 0.5);
  }, [existingHolding, purchaseDate, parsedShares, parsedTradePrice, appliedFee]);

  const choose = (item: EtfCatalogItem) => {
    setSelected(item);
    setQuery(`${item.symbol} ${item.name}`);
    setError('');
  };

  const commitSave = () => {
    if (!selected) return setError('請先搜尋並選擇 ETF。輸入代號可自動帶入名稱，輸入名稱可從清單選擇。');
    const s = selected.symbol.toUpperCase();
    const sh = Math.round(Number(shares.replace(/,/g, '')));
    const normalizedPurchaseDate = purchaseDate.trim();
    const price = Math.round(Number(tradeAvgPrice.replace(/,/g, '')) * 100) / 100;
    const weightPct = targetWeight.trim() === '' ? 0 : Number(targetWeight);
    const dividend = annualDividend.trim() === '' ? 0 : Number(annualDividend);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedPurchaseDate) || Number.isNaN(new Date(`${normalizedPurchaseDate}T00:00:00`).getTime())) return setError('購入日期請使用 YYYY-MM-DD，例如 2026-09-05。');
    if (!Number.isFinite(sh) || sh <= 0) return setError('新增股數必須大於 0。');
    if (!Number.isFinite(price) || price <= 0) return setError('成交價格必須大於 0。');
    if (!Number.isFinite(appliedFee) || appliedFee < 0) return setError('手續費不可小於 0。');
    if (!Number.isFinite(weightPct) || weightPct < 0 || weightPct > 100) return setError('目標比重請輸入 0～100。');
    if (!Number.isFinite(dividend) || dividend < 0) return setError('每股年配息不可小於 0。');

    setError('');
    onSave({
      symbol: s,
      name: selected.name,
      subtitle: `TWSE 主檔 · ${tag}`,
      shares: sh,
      tradeAvgPrice: price,
      buyFee: appliedFee,
      feeRate: feeSettings.feeRate,
      feeDiscount: feeSettings.discount,
      avgCost: price,
      // 手續費只存在於總成本；平均成本與損益基準使用實際成交價格。
      fallbackPrice: price,
      targetWeight: weightPct / 100,
      annualDividendPerShare: dividend,
      tag,
      purchaseRecords: [{ id: `${Date.now()}`, date: normalizedPurchaseDate, shares: sh, tradePrice: Number(price.toFixed(2)), purchaseCost: preciseTradeAmount(price, sh), fee: roundHalfUp(appliedFee, 2), totalCost: roundHalfUp(preciseTradeAmount(price, sh) + appliedFee, 2) }],
    });
  };

  const save = () => {
    if (duplicatePurchase) {
      Alert.alert('疑似重複購入紀錄', '這筆資料與既有的購入日期、股數、成交價格與手續費高度相同。若是同一張券商截圖，建議不要重複新增。', [
        { text: '取消', style: 'cancel' },
        { text: '仍要新增', style: 'destructive', onPress: commitSave },
      ]);
      return;
    }
    commitSave();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Header title="新增 ETF 購入紀錄" subtitle="TWSE 主檔搜尋 · 手動輸入更穩定" slogan="輸入一次，代號與名稱自動配對。" />

        <Card>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.backButton}><Text style={styles.backText}>‹ 返回持倉</Text></Pressable>
            <View style={styles.chipRow}><Chip text="TWSE 主檔" tone="green" /><Chip text="含手續費成本" tone="blue" /></View>
          </View>
          <SectionTitle icon="⌕" title="搜尋 ETF" subtitle="輸入代號自動帶入名稱；輸入名稱或關鍵字顯示相關清單" />

          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={value => { setQuery(value); if (selected && !value.includes(selected.symbol)) setSelected(null); }}
              placeholder="例如：00878、國泰、高股息"
              placeholderTextColor="#9AACBB"
              style={styles.searchInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {!!query && <Pressable onPress={() => { setQuery(''); setSelected(null); }} style={styles.clear}><Text style={styles.clearText}>×</Text></Pressable>}
          </View>

          <View style={styles.catalogState}>
            <Text style={styles.catalogText}>{loading ? 'TWSE 主檔同步中…' : onlineCount > 0 ? `TWSE 線上主檔 ${onlineCount} 筆` : '使用本機備援 ETF 清單'}</Text>
            {!!catalogError && <Pressable onPress={refresh}><Text style={styles.retry}>重新同步</Text></Pressable>}
          </View>

          {query.trim() !== '' && !selected && (
            <View style={styles.resultsBox}>
              {results.length ? results.map(item => (
                <Pressable key={item.symbol} onPress={() => choose(item)} style={styles.resultRow}>
                  <View style={styles.resultSymbol}><Text style={styles.resultSymbolText}>{item.symbol}</Text></View>
                  <View style={styles.resultNameWrap}><Text style={styles.resultName}>{item.name}</Text><Text style={styles.resultSource}>{item.source === 'TWSE' ? 'TWSE 官方主檔' : '本機備援'}</Text></View>
                  <Text style={styles.resultChevron}>›</Text>
                </Pressable>
              )) : <Text style={styles.noResult}>找不到符合的 ETF。若 TWSE 主檔尚未同步，可稍後按「重新同步」。</Text>}
            </View>
          )}

          {!!selected && (
            <View style={styles.selectedBox}>
              <View style={styles.selectedBadge}><Text style={styles.selectedSymbol}>{selected.symbol}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.selectedName}>{selected.name}</Text><Text style={styles.selectedSub}>代號與名稱已自動配對</Text></View>
              <Chip text={selected.source === 'TWSE' ? 'TWSE' : '備援'} tone={selected.source === 'TWSE' ? 'green' : 'gray'} />
            </View>
          )}
        </Card>

        <Card>
          <SectionTitle icon="$" title="庫存與交易成本" subtitle="購入日期、股數與實際成交價格建立單筆購入紀錄，再自動彙整成本" />
          <DatePickerField label="購入日期" value={purchaseDate} onChange={setPurchaseDate} required />
          <Text style={styles.dateHint}>點擊日期或 📅 開啟月曆；預設今天，也可選擇過去實際成交日期。</Text>
          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="新增股數 *" value={shares} onChangeText={setShares} placeholder="1000" keyboardType="decimal-pad" /></View>
            <View style={styles.col}><Field label="成交價格 *" value={tradeAvgPrice} onChangeText={setTradeAvgPrice} placeholder="104.95" keyboardType="decimal-pad" /></View>
          </View>

          <View style={styles.feePanel}>
            <View style={styles.rowBetween}><Text style={styles.feeTitle}>買進手續費</Text><Chip text={`${feeSettings.brokerName}`} tone="gray" /></View>
            <Text style={styles.feeHint}>預設費率 {(feeSettings.feeRate * 100).toFixed(4)}% × 折扣 {(feeSettings.discount * 10).toFixed(1)} 折，最低 {money(feeSettings.minimumFee)}。可在資料中心修改。</Text>
            <View style={styles.feeMetrics}>
              <PreviewMetric label="購入成本" value={money(Math.max(0, tradeAmount))} />
              <PreviewMetric label="預估手續費" value={money(Math.max(0, estimatedFee), 0)} />
              <PreviewMetric label="含費平均成本" value={money(Math.max(0, effectiveAvgCost), 2)} />
            </View>
            <Field label="手續費（可輸入實際金額）" value={actualFee} onChangeText={setActualFee} placeholder={estimatedFee ? String(estimatedFee) : '例如 20'} keyboardType="decimal-pad" prefix="" />
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}><Field label="目標比重" value={targetWeight} onChangeText={setTargetWeight} placeholder="25" keyboardType="decimal-pad" suffix="%" /></View>
            <View style={styles.col}><Field label="每股年配息估值" value={annualDividend} onChangeText={setAnnualDividend} placeholder="1.80" keyboardType="decimal-pad" prefix="" /></View>
          </View>

          <Text style={styles.fieldLabel}>持有分類</Text>
          <View style={styles.tagRow}>{TAGS.map(item => {
            const active = tag === item;
            return <Pressable key={item} onPress={() => setTag(item)} style={[styles.tagButton, active && styles.tagButtonActive]}><Text style={[styles.tagText, active && styles.tagTextActive]}>{item}</Text></Pressable>;
          })}</View>
        </Card>

        <Card>
          <SectionTitle icon="▦" title="新增後預覽" subtitle="TWSE 現價會在儲存後自動更新" />
          <View style={styles.previewList}>
            <PreviewLine label="購入日期" value={purchaseDate || '----'} />
            <PreviewLine label="ETF代號" value={selected?.symbol || '----'} />
            <PreviewLine label="ETF名稱" value={selected?.name || '尚未選擇'} />
            <PreviewLine label="新增股數" value={Number.isFinite(parsedShares) && parsedShares > 0 ? `${parsedShares.toLocaleString('zh-TW')} 股` : '0 股'} />
            <PreviewLine label="成交價格" value={Number.isFinite(parsedTradePrice) && parsedTradePrice > 0 ? parsedTradePrice.toFixed(2) : '0.00'} />
            <PreviewLine label="購入成本" value={money(Math.max(0, tradeAmount))} />
            <PreviewLine label="手續費" value={money(Math.max(0, appliedFee))} />
            <PreviewLine label="含費總成本" value={money(Math.max(0, totalCost))} strong />
          </View>
          {!!existingHolding && <View style={styles.existingBox}>
            <Text style={styles.existingTitle}>✓ 已有 {existingHolding.symbol} 持倉</Text>
            <Text style={styles.existingText}>本次儲存只新增一筆購入紀錄，不會建立第二個 ETF 持倉。</Text>
            <View style={styles.previewList}>
              <PreviewLine label="原持有股數" value={`${existingHolding.shares.toLocaleString('zh-TW')} 股`} />
              <PreviewLine label="本次新增" value={`${Math.max(0, parsedShares || 0).toLocaleString('zh-TW')} 股`} />
              <PreviewLine label="新增後總股數" value={`${postAddShares.toLocaleString('zh-TW')} 股`} strong />
              <PreviewLine label="原持有總成本" value={money(existingTotalCost)} />
              <PreviewLine label="本次含費成本" value={money(Math.max(0, totalCost))} />
              <PreviewLine label="新增後總成本" value={money(postAddTotalCost)} strong />
              <PreviewLine label="新增後平均成交成本" value={postAddAvgCost.toFixed(2)} strong />
            </View>
            {duplicatePurchase && <View style={styles.duplicateBox}><Text style={styles.duplicateText}>⚠ 偵測到疑似重複購入紀錄，儲存時會再次要求確認。</Text></View>}
          </View>}
          <View style={styles.twseBox}><Text style={styles.twseTitle}>成本與行情分離</Text><Text style={styles.twseText}>總成本 = 純買進成本 + 手續費；損益只用純買進成本計算；市場現價只由 TWSE 行情服務更新。新增後不需要手動輸入市場價。</Text></View>
        </Card>

        {!!error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

        <Pressable accessibilityRole="button" onPress={save} style={styles.saveButton}><Text style={styles.saveText}>儲存購入紀錄</Text><Text style={styles.saveSub}>同 ETF 可持續新增購入紀錄，系統自動彙整持倉</Text></Pressable>
        <Text style={styles.note}>＊ TWSE OpenAPI 主檔優先；無網路時使用本機備援清單。手續費預估可由券商實際金額覆蓋，以利與券商帳務核對。</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', prefix, suffix }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: any; prefix?: string; suffix?: string; }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputWrap}>{!!prefix && <Text style={styles.affix}>{prefix}</Text>}<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9AACBB" keyboardType={keyboardType} style={styles.input} autoCapitalize="characters" />{!!suffix && <Text style={styles.affix}>{suffix}</Text>}</View></View>;
}
function PreviewMetric({ label, value }: { label: string; value: string }) { return <View style={styles.previewMetric}><Text style={styles.previewLabel}>{label}</Text><Text style={styles.previewValue} numberOfLines={1}>{value}</Text></View>; }
function PreviewLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <View style={styles.previewLine}><Text style={styles.previewLineLabel}>{label}</Text><Text style={[styles.previewLineValue, strong && styles.previewLineStrong]}>{value}</Text></View>; }

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { paddingBottom: 110 }, topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }, backButton: { minHeight: 40, justifyContent: 'center', paddingRight: 12 }, backText: { color: palette.blue, fontWeight: '900', fontSize: 13 },
  searchWrap: { minHeight: 54, borderWidth: 1.5, borderColor: '#BFDCCF', borderRadius: 16, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, searchIcon: { color: palette.green, fontSize: 20, marginRight: 8 }, searchInput: { flex: 1, minWidth: 0, color: palette.text, fontSize: 16, paddingVertical: 12 }, clear: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.surfaceSoft, alignItems: 'center', justifyContent: 'center' }, clearText: { color: palette.muted, fontSize: 22 },
  catalogState: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, paddingHorizontal: 2 }, catalogText: { color: palette.muted, fontSize: 9 }, retry: { color: palette.blue, fontSize: 10, fontWeight: '900' },
  resultsBox: { marginTop: 10, borderWidth: 1, borderColor: palette.line, borderRadius: 15, overflow: 'hidden', backgroundColor: '#FFFFFF' }, resultRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: palette.line }, resultSymbol: { minWidth: 64, height: 34, borderRadius: 10, backgroundColor: palette.greenSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 }, resultSymbolText: { color: palette.green, fontWeight: '900', fontSize: 12 }, resultNameWrap: { flex: 1, minWidth: 0 }, resultName: { color: palette.text, fontWeight: '900', fontSize: 13 }, resultSource: { color: palette.muted, fontSize: 9, marginTop: 2 }, resultChevron: { color: palette.muted, fontSize: 24 }, noResult: { color: palette.muted, fontSize: 10, lineHeight: 16, padding: 13 },
  selectedBox: { marginTop: 11, borderRadius: 15, backgroundColor: palette.greenSoft, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 }, selectedBadge: { minWidth: 70, height: 40, borderRadius: 12, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }, selectedSymbol: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 }, selectedName: { color: palette.text, fontWeight: '900', fontSize: 14 }, selectedSub: { color: palette.muted, fontSize: 9, marginTop: 2 },
  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 }, dateField: { flex: 1, minWidth: 0 }, todayButton: { minHeight: 50, paddingHorizontal: 16, borderRadius: 14, backgroundColor: palette.greenSoft, borderWidth: 1, borderColor: palette.green, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, todayText: { color: palette.green, fontSize: 12, fontWeight: '900' }, dateHint: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: -7, marginBottom: 12 },
  twoCol: { flexDirection: 'row', gap: 10 }, col: { flex: 1, minWidth: 0 }, fieldWrap: { marginBottom: 13 }, fieldLabel: { color: palette.text, fontSize: 12, fontWeight: '900', marginBottom: 6 }, inputWrap: { minHeight: 50, borderWidth: 1, borderColor: palette.line, borderRadius: 14, backgroundColor: palette.surfaceSoft, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, input: { flex: 1, minWidth: 0, color: palette.text, fontSize: 16, paddingVertical: 10 }, affix: { color: palette.muted, fontWeight: '800', fontSize: 12, marginHorizontal: 3 },
  feePanel: { backgroundColor: '#F8FBFA', borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: 12, marginBottom: 12 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, feeTitle: { color: palette.text, fontSize: 13, fontWeight: '900' }, feeHint: { color: palette.muted, fontSize: 9, lineHeight: 15, marginTop: 5, marginBottom: 9 }, feeMetrics: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, tagButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, tagButtonActive: { borderColor: palette.green, backgroundColor: palette.greenSoft }, tagText: { color: palette.muted, fontSize: 12, fontWeight: '800' }, tagTextActive: { color: palette.green },
  batchList:{marginTop:10,gap:7},batchSummary:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},batchSummaryText:{fontSize:10,fontWeight:'900',color:palette.text},batchAddAll:{minHeight:36,paddingHorizontal:11,borderRadius:11,backgroundColor:palette.green,alignItems:'center',justifyContent:'center'},batchAddAllText:{fontSize:9,fontWeight:'900',color:'#FFFFFF'},batchRow:{borderWidth:1,borderColor:palette.line,borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#FFFFFF'},batchRowVerified:{borderColor:'#A7D8C4',backgroundColor:'#F7FFFB'},batchInfo:{flex:1,minWidth:0},batchTitle:{fontSize:10,fontWeight:'900',color:palette.text},batchText:{fontSize:9,color:palette.muted,marginTop:4},batchMath:{fontSize:9,color:palette.text,fontWeight:'800',marginTop:4},batchEvidence:{fontSize:8,color:palette.green,marginTop:2},batchApply:{paddingHorizontal:10,minHeight:34,borderRadius:10,backgroundColor:palette.greenSoft,alignItems:'center',justifyContent:'center'},batchApplyText:{fontSize:9,fontWeight:'900',color:palette.green},
  scanActions: { flexDirection: 'row', gap: 10 }, scanButton: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: palette.green, backgroundColor: palette.greenSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, scanButtonDisabled: { opacity: 0.55 }, scanButtonIcon: { fontSize: 17 }, scanButtonText: { color: palette.green, fontSize: 12, fontWeight: '900' }, scanResult: { marginTop: 10, borderRadius: 14, padding: 11, backgroundColor: palette.surfaceSoft, borderWidth: 1, borderColor: palette.line }, scanResultTitle: { color: palette.text, fontWeight: '900', fontSize: 11 }, scanResultText: { color: palette.text, fontSize: 10, lineHeight: 16, marginTop: 4 }, scanWarning: { color: palette.muted, fontSize: 9, lineHeight: 15, marginTop: 2 }, scanPrivacy: { color: palette.muted, fontSize: 9, lineHeight: 15, marginTop: 9 },
  previewList: { borderWidth: 1, borderColor: palette.line, borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFFFFF' }, previewLine: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingHorizontal: 13, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.line }, previewLineLabel: { flex: 0.42, color: palette.muted, fontSize: 10, fontWeight: '800' }, previewLineValue: { flex: 0.58, color: palette.text, fontSize: 13, fontWeight: '800', textAlign: 'right' }, previewLineStrong: { color: palette.green, fontSize: 14, fontWeight: '900' }, existingBox: { marginTop: 12, borderRadius: 15, backgroundColor: palette.greenSoft, borderWidth: 1, borderColor: '#BFDCCF', padding: 12 }, existingTitle: { color: palette.green, fontSize: 13, fontWeight: '900' }, existingText: { color: palette.text, fontSize: 9, lineHeight: 15, marginTop: 4, marginBottom: 10 }, duplicateBox: { marginTop: 10, borderRadius: 12, padding: 10, backgroundColor: palette.redSoft }, duplicateText: { color: palette.red, fontSize: 10, fontWeight: '900', lineHeight: 16 },
  previewRow: { flexDirection: 'row', gap: 8 }, previewMetric: { flex: 1, minWidth: 0, borderRadius: 14, backgroundColor: palette.surfaceSoft, padding: 10 }, previewLabel: { color: palette.muted, fontSize: 9 }, previewValue: { color: palette.text, fontWeight: '900', fontSize: 12, marginTop: 5 }, twseBox: { marginTop: 12, borderRadius: 14, backgroundColor: palette.greenSoft, padding: 12 }, twseTitle: { color: palette.green, fontWeight: '900', fontSize: 12 }, twseText: { color: palette.text, fontSize: 10, lineHeight: 16, marginTop: 5 },
  errorBox: { marginHorizontal: 16, marginBottom: 12, backgroundColor: palette.redSoft, borderRadius: 13, padding: 12 }, errorText: { color: palette.red, fontSize: 11, lineHeight: 17, fontWeight: '800' }, saveButton: { marginHorizontal: 16, minHeight: 62, borderRadius: 18, backgroundColor: palette.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, saveText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 }, saveSub: { color: '#E9FFF7', fontSize: 10, marginTop: 4 }, note: { color: palette.muted, fontSize: 9, lineHeight: 15, paddingHorizontal: 18, marginTop: 12 },
});
