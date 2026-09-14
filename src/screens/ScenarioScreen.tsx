import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { ScaledText as Text } from '../components/ScaledText';
import { appGoals, Holding } from '../data/portfolio';
import { LayoutSettings } from '../storage/appStorage';
import { PageLayoutEditor } from '../components/PageLayoutEditor';
import { holdingMetrics, money, portfolioMetrics, projectFutureValue, quote, signedMoney, signedPercent } from '../domain/metrics';
import { DividendReinvestmentMode, simulateMonthlyPlan } from '../domain/simulation';
import { TwseQuote } from '../services/twse';
import { Card, Header, palette, SectionTitle } from '../components/Ui';
import { useEtfCatalog } from '../services/useEtfCatalog';
import { searchEtfCatalog } from '../services/etfCatalog';

type AllocationMode = 'ratio' | 'amount';

const parseNumber = (value: string) => {
  const n = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

const clampYears = (value: string) => Math.max(1, Math.min(60, Math.floor(parseNumber(value) || 1)));
const clampAnnualReturnPct = (value: string) => Math.max(-99, Math.min(100, parseNumber(value))); 

const SCENARIO_CHOICES=[{key:'selection',label:'ETF 組合選擇',category:'設定'},{key:'shock',label:'市場下跌衝擊',category:'分析'},{key:'contribution',label:'定期定額設定',category:'設定'},{key:'allocation',label:'配置比例 / 金額',category:'設定'},{key:'annualReturn',label:'年化報酬率',category:'假設'},{key:'reinvest',label:'股息再投入策略',category:'股息'},{key:'summary',label:'模擬摘要',category:'結果'},{key:'yearly',label:'年度結果',category:'結果'},{key:'monthly',label:'月份明細',category:'結果'},{key:'cashflow',label:'現金流情境',category:'結果'}];
export default function ScenarioScreen({ holdings, quotes, layout, onLayoutChange }: { holdings: Holding[]; quotes: Record<string, TwseQuote>; layout:LayoutSettings; onLayoutChange:(p:Partial<LayoutSettings>)=>void }) {
  const [layoutOpen,setLayoutOpen]=useState(false);
  const page=layout.pageLayouts.scenario??{fields:SCENARIO_CHOICES.map(x=>x.key),spans:{selection:6,shock:6,contribution:6,allocation:3,annualReturn:3,reinvest:6,summary:6,yearly:6,monthly:6,cashflow:6}};
  const { catalog } = useEtfCatalog();
  const [sourceMode, setSourceMode] = useState<'holdings'|'free'>('holdings');
  const [freeQuery, setFreeQuery] = useState('');
  const [freeHoldings, setFreeHoldings] = useState<Holding[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(() => holdings.map(h => h.symbol));
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('ratio');
  const [monthlyTotalInput, setMonthlyTotalInput] = useState('6000');
  const [yearsInput, setYearsInput] = useState('5');
  const [annualReturnInput, setAnnualReturnInput] = useState(String((appGoals.assumedAnnualReturn * 100).toFixed(1)));
  const [ratioInputs, setRatioInputs] = useState<Record<string, string>>({});
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [reinvestDividends, setReinvestDividends] = useState(false);
  const [dividendMode, setDividendMode] = useState<DividendReinvestmentMode>('original');
  const [dividendTargetSymbol, setDividendTargetSymbol] = useState<string>(() => holdings[0]?.symbol ?? '');
  const [dividendRatioInputs, setDividendRatioInputs] = useState<Record<string, string>>({});
  const [expandedYears, setExpandedYears] = useState<number[]>([]);

  useEffect(() => {
    setSelectedSymbols(current => {
      const valid = current.filter(symbol => holdings.some(h => h.symbol === symbol));
      const newlyAdded = holdings.map(h => h.symbol).filter(symbol => !current.includes(symbol));
      return [...valid, ...newlyAdded];
    });
  }, [holdings]);

  const universe = sourceMode === 'holdings' ? holdings : freeHoldings;
  const selectedHoldings = useMemo(() => universe.filter(h => selectedSymbols.includes(h.symbol)), [universe, selectedSymbols]);
  const freeResults = useMemo(() => searchEtfCatalog(catalog, freeQuery).slice(0, 8), [catalog, freeQuery]);
  const addFreeEtf = (item:any) => {
    if (!freeHoldings.some(h => h.symbol === item.symbol)) setFreeHoldings(cur => [...cur, { symbol:item.symbol, name:item.name, subtitle:'自由模擬 ETF', shares:0, avgCost:100, tradeAvgPrice:100, buyFee:0, fallbackPrice:100, targetWeight:0, annualDividendPerShare:0, tag:'模擬' }]);
    setSelectedSymbols(cur => cur.includes(item.symbol) ? cur : [...cur, item.symbol]); setFreeQuery('');
  };
  const p = portfolioMetrics(selectedHoldings, quotes);
  const hasSelection = selectedHoldings.length > 0;

  const applyTargetRatios = () => {
    const total = selectedHoldings.reduce((sum, h) => sum + Math.max(0, h.targetWeight), 0);
    const next: Record<string, string> = {};
    selectedHoldings.forEach(h => {
      const ratio = total > 0 ? (h.targetWeight / total) * 100 : 100 / Math.max(1, selectedHoldings.length);
      next[h.symbol] = ratio.toFixed(2).replace(/\.00$/, '');
    });
    setRatioInputs(next);
  };

  const applyCurrentRatios = () => {
    const totalValue = selectedHoldings.reduce((sum, h) => sum + holdingMetrics(h, quotes).marketValue, 0);
    const next: Record<string, string> = {};
    let used = 0;
    selectedHoldings.forEach((h, index) => {
      const raw = totalValue > 0 ? holdingMetrics(h, quotes).marketValue / totalValue * 100 : 100 / Math.max(1, selectedHoldings.length);
      const ratio = index === selectedHoldings.length - 1 ? Math.max(0, 100 - used) : Math.round(raw * 100) / 100;
      next[h.symbol] = ratio.toFixed(2).replace(/\.00$/, '');
      used += ratio;
    });
    setRatioInputs(next);
  };

  const applyEqualRatios = () => {
    const count = Math.max(1, selectedHoldings.length);
    const base = Math.floor((100 / count) * 100) / 100;
    const next: Record<string, string> = {};
    let used = 0;
    selectedHoldings.forEach((h, index) => {
      const ratio = index === selectedHoldings.length - 1 ? 100 - used : base;
      next[h.symbol] = ratio.toFixed(2).replace(/\.00$/, '');
      used += ratio;
    });
    setRatioInputs(next);
  };

  useEffect(() => {
    if (!selectedHoldings.some(h => h.symbol === dividendTargetSymbol)) {
      setDividendTargetSymbol(selectedHoldings[0]?.symbol ?? '');
    }
    const currentDividendSymbols = Object.keys(dividendRatioInputs);
    const selectedSet = new Set(selectedHoldings.map(h => h.symbol));
    const needsReset = selectedHoldings.length > 0 && (
      currentDividendSymbols.length !== selectedHoldings.length ||
      currentDividendSymbols.some(symbol => !selectedSet.has(symbol))
    );
    if (needsReset || currentDividendSymbols.length === 0) {
      const count = Math.max(1, selectedHoldings.length);
      const base = Math.floor((100 / count) * 100) / 100;
      const next: Record<string, string> = {};
      let used = 0;
      selectedHoldings.forEach((h, index) => {
        const ratio = index === selectedHoldings.length - 1 ? 100 - used : base;
        next[h.symbol] = ratio.toFixed(2).replace(/\.00$/, '');
        used += ratio;
      });
      setDividendRatioInputs(next);
    }
  }, [selectedSymbols.join('|')]);

  useEffect(() => {
    const total = selectedHoldings.reduce((sum, h) => sum + Math.max(0, h.targetWeight), 0);
    const ratios: Record<string, string> = {};
    const amounts: Record<string, string> = {};
    selectedHoldings.forEach(h => {
      const ratio = total > 0 ? (h.targetWeight / total) * 100 : 100 / Math.max(1, selectedHoldings.length);
      ratios[h.symbol] = ratio.toFixed(2).replace(/\.00$/, '');
      amounts[h.symbol] = Math.round(parseNumber(monthlyTotalInput) * ratio / 100).toString();
    });
    setRatioInputs(ratios);
    setAmountInputs(current => ({ ...amounts, ...Object.fromEntries(Object.entries(current).filter(([symbol]) => selectedSymbols.includes(symbol))) }));
    setExpandedYears([]);
  }, [selectedSymbols.join('|')]);

  const toggle = (symbol: string) => {
    setSelectedSymbols(current =>
      current.includes(symbol) ? current.filter(item => item !== symbol) : [...current, symbol],
    );
  };

  const changeAllocationMode = (nextMode: AllocationMode) => {
    if (nextMode === allocationMode) return;
    if (nextMode === 'amount') {
      const total = Math.max(0, parseNumber(monthlyTotalInput));
      const totalRatio = selectedHoldings.reduce((sum, h) => sum + parseNumber(ratioInputs[h.symbol] ?? '0'), 0);
      if (Math.abs(totalRatio - 100) < 0.02) {
        const nextAmounts: Record<string, string> = {};
        selectedHoldings.forEach(h => {
          nextAmounts[h.symbol] = Math.round(total * parseNumber(ratioInputs[h.symbol] ?? '0') / 100).toString();
        });
        setAmountInputs(nextAmounts);
      }
    } else {
      const totalAmount = selectedHoldings.reduce((sum, h) => sum + Math.max(0, parseNumber(amountInputs[h.symbol] ?? '0')), 0);
      if (totalAmount > 0) {
        const nextRatios: Record<string, string> = {};
        let used = 0;
        selectedHoldings.forEach((h, index) => {
          const raw = Math.max(0, parseNumber(amountInputs[h.symbol] ?? '0')) / totalAmount * 100;
          const ratio = index === selectedHoldings.length - 1 ? Math.max(0, 100 - used) : Math.round(raw * 100) / 100;
          nextRatios[h.symbol] = ratio.toFixed(2).replace(/\.00$/, '');
          used += ratio;
        });
        setRatioInputs(nextRatios);
        setMonthlyTotalInput(Math.round(totalAmount).toString());
      }
    }
    setAllocationMode(nextMode);
  };

  const applyDividendTargetRatios = () => {
    const total = selectedHoldings.reduce((sum, h) => sum + Math.max(0, h.targetWeight), 0);
    const next: Record<string, string> = {};
    let used = 0;
    selectedHoldings.forEach((h, index) => {
      const raw = total > 0 ? h.targetWeight / total * 100 : 100 / Math.max(1, selectedHoldings.length);
      const ratio = index === selectedHoldings.length - 1 ? Math.max(0, 100 - used) : Math.round(raw * 100) / 100;
      next[h.symbol] = ratio.toFixed(2).replace(/\.00$/, '');
      used += ratio;
    });
    setDividendRatioInputs(next);
  };

  const applyDividendEqualRatios = () => {
    const count = Math.max(1, selectedHoldings.length);
    const base = Math.floor((100 / count) * 100) / 100;
    const next: Record<string, string> = {};
    let used = 0;
    selectedHoldings.forEach((h, index) => {
      const ratio = index === selectedHoldings.length - 1 ? 100 - used : base;
      next[h.symbol] = ratio.toFixed(2).replace(/\.00$/, '');
      used += ratio;
    });
    setDividendRatioInputs(next);
  };

  const ratioTotal = selectedHoldings.reduce((sum, h) => sum + parseNumber(ratioInputs[h.symbol] ?? '0'), 0);
  const ratioIsValid = hasSelection && Math.abs(ratioTotal - 100) < 0.02;
  const years = clampYears(yearsInput);
  const requestedMonthlyTotal = Math.max(0, parseNumber(monthlyTotalInput));
  const annualReturnPct = clampAnnualReturnPct(annualReturnInput);
  const annualReturn = annualReturnPct / 100;

  const allocations = useMemo(() => {
    if (allocationMode === 'ratio') {
      return selectedHoldings.map(h => ({
        symbol: h.symbol,
        amount: ratioIsValid ? requestedMonthlyTotal * parseNumber(ratioInputs[h.symbol] ?? '0') / 100 : 0,
      }));
    }
    return selectedHoldings.map(h => ({
      symbol: h.symbol,
      amount: Math.max(0, parseNumber(amountInputs[h.symbol] ?? '0')),
    }));
  }, [allocationMode, selectedHoldings, ratioInputs, amountInputs, ratioIsValid, requestedMonthlyTotal]);

  const monthlyContribution = allocations.reduce((sum, item) => sum + item.amount, 0);
  const dividendRatioTotal = selectedHoldings.reduce((sum, h) => sum + parseNumber(dividendRatioInputs[h.symbol] ?? '0'), 0);
  const dividendRatioIsValid = selectedHoldings.length > 0 && Math.abs(dividendRatioTotal - 100) < 0.02;
  const dividendTargetIsValid = selectedHoldings.some(h => h.symbol === dividendTargetSymbol);
  const dividendPlanIsValid = !reinvestDividends || dividendMode === 'original' || (dividendMode === 'single' ? dividendTargetIsValid : dividendRatioIsValid);
  const simulationReady = hasSelection && monthlyContribution > 0 && (allocationMode === 'amount' || ratioIsValid) && dividendPlanIsValid;

  const dividendDestinationLabel = !reinvestDividends
    ? '不再投入'
    : dividendMode === 'original'
      ? '各自回投原 ETF'
      : dividendMode === 'single'
        ? `集中投入 ${dividendTargetSymbol || '未選擇'}`
        : '依比例分配';

  const simulation = useMemo(() => simulateMonthlyPlan({
    holdings: selectedHoldings,
    quotes,
    allocations: simulationReady ? allocations : selectedHoldings.map(h => ({ symbol: h.symbol, amount: 0 })),
    years,
    annualReturn,
    dividendReinvestment: {
      enabled: reinvestDividends,
      mode: dividendMode,
      targetSymbol: dividendTargetSymbol,
      ratios: Object.fromEntries(selectedHoldings.map(h => [h.symbol, Math.max(0, parseNumber(dividendRatioInputs[h.symbol] ?? '0'))])),
    },
  }), [selectedHoldings, quotes, allocations, years, annualReturn, reinvestDividends, dividendMode, dividendTargetSymbol, dividendRatioInputs, simulationReady]);

  const toggleYear = (year: number) => {
    setExpandedYears(current => current.includes(year) ? current.filter(item => item !== year) : [...current, year]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Header title="情境實驗室" subtitle="先選持有 ETF，再進行壓力測試與長期投入模擬。" slogan="用數據預見未來，投資更從容。" onLayoutPress={()=>setLayoutOpen(true)} />
      <PageLayoutEditor visible={layoutOpen} title="情境實驗室排版設定" choices={SCENARIO_CHOICES} selected={page.fields} spans={page.spans} onClose={()=>setLayoutOpen(false)} onSave={(fields,spans)=>onLayoutChange({pageLayouts:{...layout.pageLayouts,scenario:{fields,spans}}})}/>

      {page.fields.includes('selection')?<Card>
        <SectionTitle icon="☑" title="選擇 ETF 模擬組合" subtitle="可使用目前持倉，或自由搜尋任意 ETF 搭配；模擬資料不會改動真實庫存" />
        <View style={styles.modeRow}>
          <ModeButton active={sourceMode === 'holdings'} title="目前持倉" subtitle="從真實庫存挑選" onPress={() => { setSourceMode('holdings'); setSelectedSymbols(holdings.map(h=>h.symbol)); }} />
          <ModeButton active={sourceMode === 'free'} title="自由選 ETF" subtitle="不限持有標的" onPress={() => { setSourceMode('free'); setSelectedSymbols(freeHoldings.map(h=>h.symbol)); }} />
        </View>
        {sourceMode === 'free' && <View style={styles.freeBox}>
          <Text style={styles.principleLabel}>搜尋 ETF 代號或名稱加入組合</Text>
          <TextInput value={freeQuery} onChangeText={setFreeQuery} placeholder="例如：0050、00878、高股息" placeholderTextColor={palette.muted} style={styles.freeInput} />
          {!!freeQuery && freeResults.map(item => <Pressable key={item.symbol} style={styles.freeResult} onPress={()=>addFreeEtf(item)}><Text style={styles.freeSymbol}>{item.symbol}</Text><Text style={styles.freeName}>{item.name}</Text><Text style={styles.freeAdd}>＋加入</Text></Pressable>)}
        </View>}
        <View style={styles.selectionHeader}>
          <View style={styles.selectionSummary}>
            <Text style={styles.selectionCount}>已選 {selectedHoldings.length} / {universe.length} 檔</Text>
            <Text style={styles.selectionValue}>組合目前市值 {money(p.marketValue)}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={() => setSelectedSymbols(universe.map(h => h.symbol))}>
              <Text style={styles.actionText}>全選</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.clearButton]} onPress={() => setSelectedSymbols([])}>
              <Text style={[styles.actionText, styles.clearText]}>清除</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.holdingList}>
          {universe.map(h => {
            const checked = selectedSymbols.includes(h.symbol);
            const m = holdingMetrics(h, quotes);
            return (
              <Pressable
                key={h.symbol}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={() => toggle(h.symbol)}
                style={[styles.holdingOption, checked && styles.holdingOptionSelected]}
              >
                <View style={[styles.check, checked && styles.checkSelected]}>
                  <Text style={[styles.checkText, checked && styles.checkTextSelected]}>{checked ? '✓' : ''}</Text>
                </View>
                <View style={styles.holdingInfo}>
                  <Text style={styles.holdingTitle}>{h.symbol}　{h.name}</Text>
                  <Text style={styles.holdingMeta}>{h.shares.toLocaleString('zh-TW')} 股 ・ 均價 {quote(h.tradeAvgPrice??h.avgCost)} ・ TWSE {quote(m.price)}</Text>
                </View>
                <Text style={styles.holdingValue}>{money(m.marketValue)}</Text>
              </Pressable>
            );
          })}
        </View>

        {!hasSelection && (
          <View style={styles.emptyNotice}>
            <Text style={styles.emptyText}>請至少選擇 1 檔 ETF，下面的模擬結果才會開始計算。</Text>
          </View>
        )}
      </Card>:null}
      {page.fields.includes('shock')?<Card>
        <SectionTitle icon="▥" title="市場下跌衝擊" subtitle="僅計算目前勾選的 ETF 組合" />
        <View style={styles.scenarioRow}>
          {[-0.10, -0.20, -0.30].map((shock, i) => {
            const value = hasSelection ? p.marketValue * (1 + shock) : 0;
            return (
              <View key={shock} style={[styles.shockBox, i === 1 && { backgroundColor: palette.blueSoft }, i === 2 && { backgroundColor: palette.redSoft }]}>
                <Text style={styles.shockLabel}>市場下跌</Text>
                <Text style={[styles.shockPct, { color: i === 2 ? palette.red : i === 1 ? palette.blue : palette.green }]}>{(shock * 100).toFixed(0)}%</Text>
                <Text style={styles.small}>模擬資產價值</Text>
                <Text style={styles.shockValue}>{money(value)}</Text>
                <Text style={[styles.loss, { color: i === 2 ? palette.red : i === 1 ? palette.blue : palette.green }]}>{signedMoney(value - p.marketValue)}</Text>
              </View>
            );
          })}
        </View>

        {hasSelection && (
          <View style={styles.impactList}>
            <Text style={styles.impactTitle}>各檔 ETF 在 -20% 情境下</Text>
            {selectedHoldings.map(h => {
              const m = holdingMetrics(h, quotes);
              return (
                <View key={h.symbol} style={styles.impactRow}>
                  <Text style={styles.impactName}>{h.symbol} {h.name}</Text>
                  <Text style={styles.impactValue}>{money(m.marketValue * 0.8)}</Text>
                  <Text style={styles.impactLoss}>{signedMoney(-m.marketValue * 0.2)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>:null}
      {page.fields.includes('contribution')?<Card>
        <SectionTitle icon="◎" title="定期定額設定" subtitle="比例配置或逐檔固定金額，模擬年限可自由輸入" />

        <View style={styles.modeRow}>
          <ModeButton active={allocationMode === 'ratio'} title="比例配置" subtitle="設定總額＋各 ETF 比例" onPress={() => changeAllocationMode('ratio')} />
          <ModeButton active={allocationMode === 'amount'} title="固定金額" subtitle="逐檔輸入每月金額" onPress={() => changeAllocationMode('amount')} />
        </View>

        {allocationMode === 'ratio' ? (
          <>
            <Field label="每月投入總額" value={monthlyTotalInput} onChangeText={setMonthlyTotalInput} suffix="元 / 月" />
            <Text style={styles.principleLabel}>比例原則</Text>
            <View style={styles.helperActions}>
              <Pressable style={styles.helperButton} onPress={applyTargetRatios}><Text style={styles.helperText}>依目標比重</Text></Pressable>
              <Pressable style={styles.helperButton} onPress={applyCurrentRatios}><Text style={styles.helperText}>依目前比重</Text></Pressable>
              <Pressable style={styles.helperButton} onPress={applyEqualRatios}><Text style={styles.helperText}>平均分配</Text></Pressable>
            </View>
            <View style={styles.allocationList}>
              {selectedHoldings.map(h => (
                <View key={h.symbol} style={styles.allocationRow}>
                  <View style={styles.allocationNameBox}>
                    <Text style={styles.allocationSymbol}>{h.symbol}</Text>
                    <Text style={styles.allocationName} numberOfLines={1}>{h.name}</Text>
                  </View>
                  <TextInput
                    value={ratioInputs[h.symbol] ?? ''}
                    onChangeText={text => setRatioInputs(current => ({ ...current, [h.symbol]: text }))}
                    keyboardType="decimal-pad"
                    style={styles.compactInput}
                    placeholder="0"
                    placeholderTextColor={palette.muted}
                  />
                  <Text style={styles.unit}>%</Text>
                  <Text style={styles.allocationMoney}>{money(ratioIsValid ? requestedMonthlyTotal * parseNumber(ratioInputs[h.symbol] ?? '0') / 100 : 0)}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.ratioStatus, !ratioIsValid && { color: palette.red }]}>比例合計 {ratioTotal.toFixed(2)}% {ratioIsValid ? '✓' : '・需等於 100%'}</Text>
          </>
        ) : (
          <View style={styles.allocationList}>
            {selectedHoldings.map(h => (
              <View key={h.symbol} style={styles.allocationRow}>
                <View style={styles.allocationNameBox}>
                  <Text style={styles.allocationSymbol}>{h.symbol}</Text>
                  <Text style={styles.allocationName} numberOfLines={1}>{h.name}</Text>
                </View>
                <TextInput
                  value={amountInputs[h.symbol] ?? ''}
                  onChangeText={text => setAmountInputs(current => ({ ...current, [h.symbol]: text }))}
                  keyboardType="number-pad"
                  style={[styles.compactInput, styles.amountInput]}
                  placeholder="0"
                  placeholderTextColor={palette.muted}
                />
                <Text style={styles.unit}>元/月</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.settingGrid}>
          <View style={styles.settingCell}>
            <Text style={styles.fieldLabel}>模擬年限</Text>
            <View style={styles.inlineInputRow}>
              <TextInput
                value={yearsInput}
                onChangeText={setYearsInput}
                onBlur={() => setYearsInput(String(clampYears(yearsInput)))}
                keyboardType="number-pad"
                style={styles.yearInput}
                placeholder="5"
                placeholderTextColor={palette.muted}
              />
              <Text style={styles.unit}>年</Text>
            </View>
            <Text style={styles.fieldHint}>可輸入 1～60 年</Text>
          </View>
          <View style={styles.settingCell}>
            <Text style={styles.fieldLabel}>年化報酬率假設</Text>
            <View style={styles.inlineInputRow}>
              <TextInput
                value={annualReturnInput}
                onChangeText={setAnnualReturnInput}
                onBlur={() => setAnnualReturnInput(clampAnnualReturnPct(annualReturnInput).toFixed(2).replace(/\.00$/, ''))}
                keyboardType="decimal-pad"
                style={styles.yearInput}
                placeholder="6"
                placeholderTextColor={palette.muted}
              />
              <Text style={styles.unit}>% / 年</Text>
            </View>
            <Text style={styles.fieldHint}>可自行輸入 -99%～100%，會換算成每月複利率</Text>
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>股息再投入</Text>
            <Text style={styles.switchHint}>開啟後，可指定配息要回投原 ETF、集中投入某一檔，或依比例分配</Text>
          </View>
          <Switch value={reinvestDividends} onValueChange={setReinvestDividends} trackColor={{ false: palette.track, true: palette.greenSoft }} thumbColor={reinvestDividends ? palette.green : '#FFFFFF'} />
        </View>

        {reinvestDividends && (
          <View style={styles.dividendPanel}>
            <Text style={styles.dividendPanelTitle}>股息目的 ETF</Text>
            <Text style={styles.fieldHint}>只影響本次模擬；不會修改真實庫存。</Text>
            <View style={styles.dividendModeRow}>
              <DividendModeButton active={dividendMode === 'original'} title="回投原 ETF" onPress={() => setDividendMode('original')} />
              <DividendModeButton active={dividendMode === 'single'} title="指定單一 ETF" onPress={() => setDividendMode('single')} />
              <DividendModeButton active={dividendMode === 'ratio'} title="多檔比例分配" onPress={() => setDividendMode('ratio')} />
            </View>

            {dividendMode === 'original' && (
              <View style={styles.dividendInfoBox}>
                <Text style={styles.dividendInfoText}>每檔 ETF 產生的股息，回到該 ETF 自己繼續複利。</Text>
              </View>
            )}

            {dividendMode === 'single' && (
              <View style={styles.dividendTargetList}>
                {selectedHoldings.map(h => {
                  const active = dividendTargetSymbol === h.symbol;
                  return (
                    <Pressable key={h.symbol} onPress={() => setDividendTargetSymbol(h.symbol)} style={[styles.dividendTargetRow, active && styles.dividendTargetRowActive]}>
                      <View style={[styles.radio, active && styles.radioActive]}><View style={[styles.radioDot, active && styles.radioDotActive]} /></View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.dividendTargetName}>{h.symbol}　{h.name}</Text>
                        <Text style={styles.dividendTargetHint}>所有已選 ETF 的模擬股息集中投入此檔</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {dividendMode === 'ratio' && (
              <>
                <View style={styles.helperActions}>
                  <Pressable style={styles.helperButton} onPress={applyDividendTargetRatios}><Text style={styles.helperText}>依目標比重</Text></Pressable>
                  <Pressable style={styles.helperButton} onPress={applyDividendEqualRatios}><Text style={styles.helperText}>平均分配</Text></Pressable>
                </View>
                <View style={styles.allocationList}>
                  {selectedHoldings.map(h => (
                    <View key={`div-${h.symbol}`} style={styles.allocationRow}>
                      <View style={styles.allocationNameBox}>
                        <Text style={styles.allocationSymbol}>{h.symbol}</Text>
                        <Text style={styles.allocationName} numberOfLines={1}>{h.name}</Text>
                      </View>
                      <TextInput
                        value={dividendRatioInputs[h.symbol] ?? ''}
                        onChangeText={text => setDividendRatioInputs(current => ({ ...current, [h.symbol]: text }))}
                        keyboardType="decimal-pad"
                        style={styles.compactInput}
                        placeholder="0"
                        placeholderTextColor={palette.muted}
                      />
                      <Text style={styles.unit}>%</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.ratioStatus, !dividendRatioIsValid && { color: palette.red }]}>股息分配合計 {dividendRatioTotal.toFixed(2)}% {dividendRatioIsValid ? '✓' : '・需等於 100%'}</Text>
              </>
            )}
          </View>
        )}

        <View style={styles.simSummary}>
          <SummaryItem label="起始資產" value={money(p.marketValue)} />
          <SummaryItem label="每月投入" value={money(monthlyContribution)} />
          <SummaryItem label="模擬年限" value={`${years} 年`} />
          <SummaryItem label="年化率假設" value={`${annualReturnPct.toFixed(2).replace(/\.00$/, '')}%`} />
          <SummaryItem label="股息去向" value={dividendDestinationLabel} />
        </View>

        {!simulationReady && hasSelection && (
          <View style={styles.emptyNotice}>
            <Text style={styles.emptyText}>{!dividendPlanIsValid ? (dividendMode === 'single' ? '請選擇股息再投入的目的 ETF。' : '股息再投入的分配比例合計必須為 100%。') : allocationMode === 'ratio' && !ratioIsValid ? '比例合計必須為 100% 才能開始定期定額模擬。' : '請輸入大於 0 的每月投入金額。'}</Text>
          </View>
        )}
      </Card>:null}
      {page.fields.includes('yearly')?<Card>
        <SectionTitle icon="▤" title="年月模擬結果" subtitle="點擊任一年，可展開該年的 1～12 月變化" />
        {simulationReady ? (
          <>
            <View style={styles.resultHero}>
              <View>
                <Text style={styles.resultHeroLabel}>{years} 年後預估市值</Text>
                <Text style={styles.resultHeroValue}>{money(simulation.finalValue)}</Text>
              </View>
              <View style={styles.resultHeroRight}>
                <Text style={styles.resultReturn}>{signedPercent(simulation.cumulativeReturn)}</Text>
                <Text style={styles.small}>累積報酬</Text>
              </View>
            </View>
            <View style={styles.resultMetaRow}>
              <SummaryItem label="累積定期投入" value={money(simulation.cumulativeContribution)} />
              <SummaryItem label="累積配息" value={money(simulation.cumulativeDividend)} />
              <SummaryItem label="累積損益" value={signedMoney(simulation.cumulativePnl)} tone={simulation.cumulativePnl >= 0 ? 'green' : 'red'} />
            </View>

            <View style={styles.yearList}>
              {simulation.years.map(year => {
                const expanded = expandedYears.includes(year.year);
                return (
                  <View key={year.year} style={styles.yearBlock}>
                    <Pressable onPress={() => toggleYear(year.year)} style={styles.yearHeader}>
                      <View style={styles.yearBadge}><Text style={styles.yearBadgeText}>第 {year.year} 年</Text></View>
                      <View style={styles.yearHeadline}>
                        <Text style={styles.yearEndValue}>{money(year.endValue)}</Text>
                        <Text style={styles.yearSub}>年投入 {money(year.annualContribution)} ・ 年配息 {money(year.annualDividend)}</Text>
                      </View>
                      <View style={styles.yearReturnBox}>
                        <Text style={[styles.yearReturn, { color: year.cumulativePnl >= 0 ? palette.green : palette.red }]}>{signedPercent(year.cumulativeReturn)}</Text>
                        <Text style={styles.expandText}>{expanded ? '收合 ▲' : '展開 ▼'}</Text>
                      </View>
                    </Pressable>

                    {expanded && (
                      <View style={styles.monthList}>
                        {year.months.map(month => (
                          <View key={`${year.year}-${month.month}`} style={styles.monthCard}>
                            <View style={styles.monthTitleRow}>
                              <Text style={styles.monthTitle}>{month.month} 月</Text>
                              <Text style={[styles.monthReturn, { color: month.cumulativePnl >= 0 ? palette.green : palette.red }]}>{signedPercent(month.cumulativeReturn)}</Text>
                            </View>
                            <View style={styles.monthGrid}>
                              <Metric label="當月投入" value={money(month.monthlyContribution)} />
                              <Metric label="累積投入(含起始)" value={money(month.cumulativeInvested)} />
                              <Metric label="預估市值" value={money(month.estimatedValue)} />
                              <Metric label="當月配息" value={money(month.monthlyDividend)} />
                              <Metric label="股息再投入" value={money(month.reinvestedDividend)} tone={month.reinvestedDividend > 0 ? 'green' : undefined} />
                              <Metric label="累積配息" value={money(month.cumulativeDividend)} />
                              <Metric label="當月損益" value={signedMoney(month.monthlyPnl)} tone={month.monthlyPnl >= 0 ? 'green' : 'red'} />
                            </View>
                            <View style={styles.monthFooter}>
                              <Text style={styles.monthFooterLabel}>累積報酬</Text>
                              <Text style={[styles.monthFooterValue, { color: month.cumulativePnl >= 0 ? palette.green : palette.red }]}>{signedMoney(month.cumulativePnl)} ・ {signedPercent(month.cumulativeReturn)}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyNotice}>
            <Text style={styles.emptyText}>完成上方 ETF 選擇與定期定額設定後，這裡會產生第 1 年到第 {years} 年的結果；點擊任一年即可展開 12 個月。</Text>
          </View>
        )}
      </Card>:null}
      {page.fields.includes('cashflow')?<Card>
        <SectionTitle icon="♧" title="現金流情境" subtitle="依目前勾選 ETF 的估計配息計算" />
        <View style={styles.futureRow}>
          <Cash title="配息正常" value={p.annualDividend} hint="維持目前估計" />
          <Cash title="配息下降 10%" value={p.annualDividend * 0.9} hint="壓力測試" />
          <Cash title="股息再投入" value={projectFutureValue(p.marketValue, 0, 0.04, 5)} hint={reinvestDividends ? dividendDestinationLabel : '尚未啟用'} />
        </View>
      </Card>:null}

      <View style={styles.note}>
        <Text style={styles.noteText}>ⓘ 情境模擬完全與真實庫存分離。股息目的 ETF 僅改變模擬資金流向，不回寫真實庫存。TWSE 行情只作為模擬起始價格；年化報酬率可由使用者自行輸入並換算為每月複利率，配息與未來市值均為試算假設，非投資建議。</Text>
      </View>
    </ScrollView>
  );
}

function ModeButton({ active, title, subtitle, onPress }: { active: boolean; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}>
      <Text style={[styles.modeTitle, active && { color: palette.green }]}>{title}</Text>
      <Text style={styles.modeSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function DividendModeButton({ active, title, onPress }: { active: boolean; title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.dividendModeButton, active && styles.dividendModeButtonActive]}>
      <Text style={[styles.dividendModeText, active && { color: palette.green }]}>{title}</Text>
    </Pressable>
  );
}

function Field({ label, value, onChangeText, suffix }: { label: string; value: string; onChangeText: (value: string) => void; suffix?: string }) {
  return (
    <View style={styles.fieldBox}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inlineInputRow}>
        <TextInput value={value} onChangeText={onChangeText} keyboardType="number-pad" style={styles.mainInput} placeholder="0" placeholderTextColor={palette.muted} />
        {!!suffix && <Text style={styles.unit}>{suffix}</Text>}
      </View>
    </View>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, tone === 'green' && { color: palette.green }, tone === 'red' && { color: palette.red }]}>{value}</Text>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === 'green' && { color: palette.green }, tone === 'red' && { color: palette.red }]}>{value}</Text>
    </View>
  );
}

function Cash({ title, value, hint }: { title: string; value: number; hint: string }) {
  return (
    <View style={styles.cash}>
      <Text style={styles.cashTitle}>{title}</Text>
      <Text style={styles.cashValue}>{money(value)}</Text>
      <Text style={styles.small}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  freeBox: { marginTop: 12, borderRadius: 13, backgroundColor: palette.surfaceSoft, padding: 10 }, freeInput: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: '#fff', paddingHorizontal: 12, color: palette.text, fontWeight: '800' }, freeResult: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: palette.line }, freeSymbol: { color: palette.blue, fontWeight: '900', width: 54 }, freeName: { color: palette.text, fontWeight: '800', flex: 1 }, freeAdd: { color: palette.green, fontWeight: '900' },
  content: { paddingBottom: 98 },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  selectionSummary: { flex: 1 },
  selectionCount: { color: palette.text, fontSize: 16, fontWeight: '900' },
  selectionValue: { color: palette.green, fontSize: 12, fontWeight: '800', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 7 },
  actionButton: { minHeight: 38, minWidth: 56, borderRadius: 11, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.greenSoft },
  clearButton: { backgroundColor: palette.surfaceSoft },
  actionText: { color: palette.green, fontWeight: '900', fontSize: 12 },
  clearText: { color: palette.muted },
  holdingList: { gap: 8 },
  holdingOption: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FFFFFF', padding: 11 },
  holdingOptionSelected: { borderColor: palette.green, backgroundColor: palette.greenSoft },
  check: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: '#FFFFFF' },
  checkSelected: { borderColor: palette.green, backgroundColor: palette.green },
  checkText: { color: palette.muted, fontWeight: '900' },
  checkTextSelected: { color: '#FFFFFF' },
  holdingInfo: { flex: 1, minWidth: 0 },
  holdingTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  holdingMeta: { color: palette.muted, fontSize: 9, marginTop: 4 },
  holdingValue: { color: palette.text, fontSize: 11, fontWeight: '900', marginLeft: 8 },
  emptyNotice: { marginTop: 10, borderRadius: 12, backgroundColor: palette.redSoft, padding: 10 },
  emptyText: { color: palette.red, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  scenarioRow: { flexDirection: 'row', gap: 8 },
  shockBox: { flex: 1, backgroundColor: palette.greenSoft, borderRadius: 15, padding: 10 },
  shockLabel: { color: palette.text, fontSize: 11, fontWeight: '800' },
  shockPct: { fontWeight: '900', fontSize: 23, marginTop: 3 },
  small: { color: palette.muted, fontSize: 9, marginTop: 6 },
  shockValue: { color: palette.text, fontWeight: '900', fontSize: 12, marginTop: 3 },
  loss: { fontWeight: '900', fontSize: 11, marginTop: 6 },
  impactList: { marginTop: 12, backgroundColor: palette.surfaceSoft, borderRadius: 14, padding: 10 },
  impactTitle: { color: palette.text, fontSize: 11, fontWeight: '900', marginBottom: 5 },
  impactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: palette.line },
  impactName: { flex: 1, color: palette.text, fontSize: 9, fontWeight: '800' },
  impactValue: { width: 90, textAlign: 'right', color: palette.text, fontSize: 9, fontWeight: '800' },
  impactLoss: { width: 85, textAlign: 'right', color: palette.red, fontSize: 9, fontWeight: '900' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeButton: { flex: 1, minHeight: 66, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceSoft, padding: 11 },
  modeButtonActive: { borderColor: palette.green, backgroundColor: palette.greenSoft },
  modeTitle: { color: palette.text, fontSize: 13, fontWeight: '900' },
  modeSubtitle: { color: palette.muted, fontSize: 9, marginTop: 4, lineHeight: 13 },
  fieldBox: { backgroundColor: palette.surfaceSoft, borderRadius: 14, padding: 12, marginBottom: 10 },
  fieldLabel: { color: palette.text, fontSize: 11, fontWeight: '900' },
  inlineInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  mainInput: { flex: 1, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FFFFFF', color: palette.text, fontSize: 18, fontWeight: '900', paddingHorizontal: 12 },
  yearInput: { width: 86, minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FFFFFF', color: palette.text, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  unit: { color: palette.muted, fontSize: 10, fontWeight: '800' },
  principleLabel: { color: palette.muted, fontSize: 9, fontWeight: '800', marginBottom: 6 },
  helperActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  helperButton: { backgroundColor: palette.blueSoft, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 },
  helperText: { color: palette.blue, fontSize: 10, fontWeight: '900' },
  allocationList: { gap: 7 },
  allocationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 52, borderBottomWidth: 1, borderBottomColor: palette.line, paddingVertical: 6 },
  allocationNameBox: { flex: 1, minWidth: 0 },
  allocationSymbol: { color: palette.text, fontSize: 12, fontWeight: '900' },
  allocationName: { color: palette.muted, fontSize: 9, marginTop: 2 },
  compactInput: { width: 72, minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FFFFFF', color: palette.text, fontSize: 14, fontWeight: '900', textAlign: 'right', paddingHorizontal: 9 },
  amountInput: { width: 92 },
  allocationMoney: { width: 76, color: palette.green, fontSize: 9, fontWeight: '900', textAlign: 'right' },
  ratioStatus: { color: palette.green, fontSize: 10, fontWeight: '900', marginTop: 9, textAlign: 'right' },
  settingGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  settingCell: { flex: 1, backgroundColor: palette.surfaceSoft, borderRadius: 14, padding: 11 },
  settingValue: { color: palette.green, fontSize: 20, fontWeight: '900', marginTop: 9 },
  fieldHint: { color: palette.muted, fontSize: 9, marginTop: 5, lineHeight: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, borderRadius: 14, backgroundColor: palette.surfaceSoft, padding: 11 },
  switchTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  switchHint: { color: palette.muted, fontSize: 9, lineHeight: 13, marginTop: 3, paddingRight: 8 },
  dividendPanel: { marginTop: 9, borderRadius: 14, borderWidth: 1, borderColor: palette.line, backgroundColor: '#FFFFFF', padding: 11 },
  dividendPanelTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  dividendModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10, marginBottom: 9 },
  dividendModeButton: { minHeight: 40, flexGrow: 1, minWidth: '30%', borderRadius: 11, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  dividendModeButtonActive: { borderColor: palette.green, backgroundColor: palette.greenSoft },
  dividendModeText: { color: palette.text, fontSize: 10, fontWeight: '900', textAlign: 'center' },
  dividendInfoBox: { borderRadius: 11, backgroundColor: palette.greenSoft, padding: 10 },
  dividendInfoText: { color: palette.text, fontSize: 10, lineHeight: 15, fontWeight: '700' },
  dividendTargetList: { gap: 7 },
  dividendTargetRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceSoft, padding: 9 },
  dividendTargetRowActive: { borderColor: palette.green, backgroundColor: palette.greenSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: palette.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  radioActive: { borderColor: palette.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'transparent' },
  radioDotActive: { backgroundColor: palette.green },
  dividendTargetName: { color: palette.text, fontSize: 11, fontWeight: '900' },
  dividendTargetHint: { color: palette.muted, fontSize: 8, lineHeight: 12, marginTop: 2 },
  simSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  summaryItem: { flexGrow: 1, flexBasis: '46%', minWidth: 0, borderRadius: 12, backgroundColor: palette.surfaceSoft, padding: 9 },
  summaryLabel: { color: palette.muted, fontSize: 8, lineHeight: 11 },
  summaryValue: { color: palette.text, fontSize: 11, fontWeight: '900', marginTop: 4 },
  resultHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, backgroundColor: palette.greenSoft, padding: 14 },
  resultHeroLabel: { color: palette.muted, fontSize: 10, fontWeight: '700' },
  resultHeroValue: { color: palette.text, fontSize: 24, fontWeight: '900', marginTop: 4 },
  resultHeroRight: { alignItems: 'flex-end' },
  resultReturn: { color: palette.green, fontSize: 18, fontWeight: '900' },
  resultMetaRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  yearList: { gap: 9, marginTop: 12 },
  yearBlock: { borderRadius: 15, borderWidth: 1, borderColor: palette.line, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  yearHeader: { flexDirection: 'row', alignItems: 'center', padding: 11, gap: 9 },
  yearBadge: { minWidth: 58, borderRadius: 10, backgroundColor: palette.blueSoft, paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center' },
  yearBadgeText: { color: palette.blue, fontSize: 10, fontWeight: '900' },
  yearHeadline: { flex: 1, minWidth: 0 },
  yearEndValue: { color: palette.text, fontSize: 13, fontWeight: '900' },
  yearSub: { color: palette.muted, fontSize: 8, marginTop: 3 },
  yearReturnBox: { alignItems: 'flex-end' },
  yearReturn: { fontSize: 11, fontWeight: '900' },
  expandText: { color: palette.muted, fontSize: 8, marginTop: 3, fontWeight: '800' },
  monthList: { padding: 8, paddingTop: 0, backgroundColor: palette.surfaceSoft },
  monthCard: { marginTop: 8, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, padding: 10 },
  monthTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  monthTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  monthReturn: { fontSize: 11, fontWeight: '900' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  metric: { width: '50%', paddingHorizontal: 3, paddingVertical: 5 },
  metricLabel: { color: palette.muted, fontSize: 8 },
  metricValue: { color: palette.text, fontSize: 10, fontWeight: '900', marginTop: 2 },
  monthFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 7, marginTop: 4 },
  monthFooterLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  monthFooterValue: { fontSize: 10, fontWeight: '900' },
  futureRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  cash: { flex: 1, backgroundColor: palette.surfaceSoft, borderRadius: 14, padding: 10 },
  cashTitle: { color: palette.text, fontWeight: '900', fontSize: 11 },
  cashValue: { color: palette.text, fontWeight: '900', fontSize: 13, marginTop: 8 },
  note: { marginHorizontal: 16, backgroundColor: '#EEF5F8', padding: 10, borderRadius: 12 },
  noteText: { color: palette.muted, fontSize: 10, lineHeight: 15 },
});
