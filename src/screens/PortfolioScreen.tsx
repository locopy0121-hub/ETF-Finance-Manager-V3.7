import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from '../components/ScaledText';
import { Holding } from '../data/portfolio';
import { holdingMetrics, money, percent, portfolioMetrics, quote, signedMoney, signedPercent } from '../domain/metrics';
import { TwseQuote } from '../services/twse';
import { Card, Chip, EtfCodeBadge, Header, palette, Progress, RefreshText } from '../components/Ui';
import { HoldingLayoutField, LayoutSettings } from '../storage/appStorage';
import { PageLayoutEditor } from '../components/PageLayoutEditor';

type Props = { layout: LayoutSettings; onLayoutChange:(p:Partial<LayoutSettings>)=>void; holdings: Holding[]; quotes: Record<string, TwseQuote>; lastSuccessAt?: number; quoteError?: string; refresh: () => void; onAddHolding: () => void; onEditHolding: (symbol: string) => void; onDeleteHolding: (symbol: string) => void };

export default function PortfolioScreen({ layout, onLayoutChange, holdings, quotes, lastSuccessAt, quoteError, refresh, onAddHolding, onEditHolding, onDeleteHolding }: Props) {
  const [layoutOpen,setLayoutOpen]=useState(false);
  const p = portfolioMetrics(holdings, quotes);
  return (
    <>
    <PageLayoutEditor visible={layoutOpen} title="庫存排版設定" choices={HOLDING_CHOICES} selected={layout.holdingFields} spans={layout.holdingFieldSpans} onClose={()=>setLayoutOpen(false)} onSave={(keys,spans)=>onLayoutChange({holdingFields:keys as HoldingLayoutField[],holdingFieldSpans:spans})}/>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Header title="我的持倉" subtitle="TWSE 即時比對 · 每筆購入紀錄自動彙整" slogan="長期持有，與更好的自己同行。" onLayoutPress={()=>setLayoutOpen(true)} />
      <Card>
        <View style={styles.summaryRow}><Summary label="總成本" value={money(p.totalCost)} /><Summary label="目前市值" value={money(p.marketValue)} /><Summary label="未實現損益" value={signedMoney(p.pnl)} good={p.pnl >= 0} bad={p.pnl < 0} /></View>
        <RefreshText lastSuccessAt={lastSuccessAt} error={quoteError} onPress={refresh} />
      </Card>

      <View style={styles.inventoryActions}>
        <Pressable accessibilityRole="button" onPress={onAddHolding} style={styles.addButton}>
          <Text style={styles.addIcon}>＋</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.addTitle}>新增 ETF 購入紀錄</Text>
            <Text style={styles.addSub}>同一 ETF 可多次購入；輸入新增股數、成交行情與手續費</Text>
          </View>
          <Text style={styles.addChevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.sectionBar}><Text style={styles.sectionTitle}>持倉明細（{holdings.length} 檔）</Text><Text style={styles.sort}>依代碼排序⌄</Text></View>
      {holdings.map(h => {
        const m = holdingMetrics(h, quotes);
        const weight = p.marketValue ? m.marketValue / p.marketValue : 0;
        const live = !!quotes[h.symbol];
        return (
          <Card key={h.symbol}>
            <View style={styles.holdingHead}>
              <EtfCodeBadge symbol={h.symbol}/>
              <View style={{ flex: 1 }}><Text style={styles.name}>{h.name}</Text><Text style={styles.subtitle}>{h.subtitle}</Text></View>
              <Chip text={h.tag} tone={h.tag === '觀察中' ? 'orange' : h.symbol === '00878' ? 'blue' : 'green'} />
            </View>
            <View style={[styles.customMetrics,{gap:layout.compactCards?5:8}]}>{layout.holdingFields.map(f=>{const q:any=quotes[h.symbol];const prev=Number(q?.previousClose??q?.open??m.price);const today=(m.price-prev)*h.shares;const div=Number((h as any).receivedDividend??0);const total=m.pnl+div;const lastBuy=(h.purchaseRecords??[]).map(r=>r.date).sort().at(-1)||'—';const map:any={shares:['持有股數',h.shares.toLocaleString('zh-TW')],avgCost:['平均成本',quote(h.tradeAvgPrice??h.avgCost)],tradeAvgPrice:['成交行情',quote(h.tradeAvgPrice??h.avgCost)],price:[live?'TWSE 現價':'最後有效價',quote(m.price)],marketValue:['目前市值',money(m.marketValue)],totalCost:['持有總成本',money(m.totalCost)],perShare:['每股差額',signedMoney(m.perShare,2)],pnl:['成本損益',signedMoney(m.pnl)],pnlPct:['成本損益 %',signedPercent(m.pnlPct)],todayPnl:['今日損益',signedMoney(today)],todayPnlPct:['今日損益 %',signedPercent(prev>0?(m.price-prev)/prev:0)],totalPnl:['含息總損益',signedMoney(total)],totalPnlPct:['含息總損益 %',signedPercent(m.cost>0?total/m.cost:0)],buyFee:['買進手續費',money(h.buyFee??0,0)],annualDividend:['預估年配息',money(h.shares*h.annualDividendPerShare)],cumulativeDividend:['累積配息',money(div)],cashYield:['預估殖利率',m.marketValue>0?signedPercent((h.shares*h.annualDividendPerShare)/m.marketValue):'0.00%'],targetWeight:['目標比重',percent(h.targetWeight,0)],currentWeight:['目前比重',percent(weight,0)],lastBuyDate:['最後買進日',lastBuy],purchaseCount:['買進筆數',`${h.purchaseRecords?.length??1} 筆`],open:['開盤',q?.open?quote(Number(q.open)):'—'],high:['最高',q?.high?quote(Number(q.high)):'—'],low:['最低',q?.low?quote(Number(q.low)):'—'],previousClose:['昨收',q?.previousClose?quote(Number(q.previousClose)):'—'],volume:['成交量',q?.volume?Number(q.volume).toLocaleString('zh-TW'):'—'],broker:['券商',String((h as any).broker??'—')],account:['帳戶',String((h as any).account??'—')]};const a=map[f];const signed=['perShare','pnl','pnlPct','todayPnl','todayPnlPct','totalPnl','totalPnlPct'].includes(f);return <View key={f} style={[styles.customMetric,{width:(layout.holdingFieldSpans[f]||6)===6?'100%':(layout.holdingFieldSpans[f]||6)===3?'49%':'32%',padding:layout.compactCards?7:10}]}><Text style={[styles.metricLabel,{fontSize:10}]}>{a[0]}</Text><Text style={[styles.customMetricValue,{fontSize:13},signed&&{color:(f==='perShare'?m.perShare:m.pnl)>=0?palette.red:palette.green}]}>{a[1]}</Text></View>})}</View>
            <View style={styles.weightRow}><View style={{ flex: 1 }}><View style={styles.rowBetween}><Text style={styles.weightLabel}>目前比重 <Text style={styles.weightValue}>{percent(weight, 0)}</Text></Text><Text style={styles.target}>目標 {percent(h.targetWeight, 0)}</Text></View><Progress value={weight * 100} tone={h.symbol === '00878' ? 'green' : 'blue'} /></View>
              <View style={styles.statusBox}>{m.pnl >= 0 ? <><Text style={styles.ok}>✓ 配置追蹤中</Text><Text style={styles.statusSub}>TWSE 價格比對均價</Text></> : <><Text style={styles.bad}>! 距離回本</Text><Text style={styles.statusSub}>需上漲 {percent(m.breakEvenPct)}</Text></>}</View>
            </View>
            <View style={styles.purchaseBox}>
              <Text style={styles.purchaseTitle}>購入紀錄（{h.purchaseRecords?.length ?? 1} 筆）</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator><View style={styles.purchaseTable}>{(h.purchaseRecords ?? [{ id: `legacy-${h.symbol}`, date: '既有庫存', shares: h.shares, tradePrice: h.tradeAvgPrice ?? h.avgCost, purchaseCost: h.shares * (h.tradeAvgPrice ?? h.avgCost), fee: h.buyFee ?? 0, totalCost: h.shares * h.avgCost }]).map(r => (
                <View key={r.id} style={styles.purchaseRow}>
                  <Text style={styles.purchaseDate}>{r.date}</Text>
                  <Text style={styles.purchaseText}>{r.shares.toLocaleString('zh-TW')} 股</Text>
                  <Text style={styles.purchaseText}>行情 {r.tradePrice.toFixed(2)}</Text>
                  <Text style={styles.purchaseText}>成本 {money(r.purchaseCost)}</Text>
                  <Text style={styles.purchaseText}>費 {money(r.fee)}</Text>
                </View>
              ))}</View></ScrollView>
            </View>
            <View style={styles.manageRow}>
              <Pressable accessibilityRole="button" style={styles.editButton} onPress={() => onEditHolding(h.symbol)}><Text style={styles.editText}>✎ 修改庫存</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={() => Alert.alert('刪除 ETF 庫存', `確定要刪除 ${h.symbol} ${h.name} 嗎？\n\n此動作只刪除 App 目前庫存資料，不會影響券商帳戶。`, [{ text: '取消', style: 'cancel' }, { text: '刪除', style: 'destructive', onPress: () => onDeleteHolding(h.symbol) }])}><Text style={styles.deleteText}>刪除</Text></Pressable>
            </View>
          </Card>
        );
      })}
      <Text style={styles.footer}>最終價格來源：TWSE。若行情暫時無法取得，App 只顯示最後有效價格，不以 Yahoo 覆蓋 TWSE。</Text>
    </ScrollView>
    </>
  );
}

function Summary({ label, value, good, bad }: any) { return <View style={styles.summary}><Text style={styles.summaryLabel}>{label}</Text><Text style={[styles.summaryValue, good && { color: palette.green }, bad && { color: palette.red }]}>{value}</Text></View>; }
function Metric({ label, value, good, bad }: any) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, good && { color: palette.green }, bad && { color: palette.red }]}>{value}</Text></View>; }

const styles = StyleSheet.create({
  content: { paddingBottom: 98 },customMetrics:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',marginTop:14,borderTopWidth:1,borderTopColor:palette.line,paddingTop:12},customMetric:{borderWidth:1,borderColor:palette.line,borderRadius:10,backgroundColor:palette.surfaceSoft,minHeight:58},customMetricValue:{color:palette.text,fontWeight:'900',textAlign:'right',marginTop:4},
  inventoryActions: { paddingHorizontal: 16, marginBottom: 10 },
  addButton: { minHeight: 70, borderRadius: 18, backgroundColor: palette.greenSoft, borderWidth: 1, borderColor: '#CBEFE0', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  addIcon: { width: 36, height: 36, borderRadius: 18, textAlign: 'center', lineHeight: 34, backgroundColor: palette.green, color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  addTitle: { color: palette.text, fontSize: 15, fontWeight: '900' },
  addSub: { color: palette.muted, fontSize: 10, marginTop: 3 },
  addChevron: { color: palette.green, fontSize: 30 },
  purchaseTable:{minWidth:720}, purchaseBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.line }, purchaseTitle: { color: palette.text, fontSize: 11, fontWeight: '900', marginBottom: 7 }, purchaseRow: { flexDirection: 'row', gap: 12, paddingVertical: 7, minWidth:720 }, purchaseDate: { color: palette.blue, fontSize: 9, fontWeight: '900' }, purchaseText: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  manageRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.line },
  editButton: { flex: 1, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#B9E8D4', backgroundColor: palette.greenSoft, alignItems: 'center', justifyContent: 'center' },
  editText: { color: palette.green, fontSize: 10, fontWeight: '900' },
  deleteButton: { minWidth: 86, minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: palette.redSoft, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: palette.red, fontSize: 10, fontWeight: '900' },

  summaryRow: { flexDirection: 'row' }, summary: { flex: 1, borderRightWidth: 1, borderRightColor: palette.line, paddingRight: 8, marginRight: 8 }, summaryLabel: { color: palette.muted, fontSize: 11 }, summaryValue: { color: palette.text, fontWeight: '900', fontSize: 18, marginTop: 7 },
  sectionBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 4, marginBottom: 8 }, sectionTitle: { color: palette.text, fontWeight: '900', fontSize: 19 }, sort: { color: palette.muted, fontSize: 12 },
  holdingHead: { flexDirection: 'row', alignItems: 'center', gap: 10 }, symbolBadge: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }, badgeText: { color: '#fff', fontWeight: '900', fontSize: 15 }, name: { color: palette.text, fontSize: 18, fontWeight: '900' }, subtitle: { color: palette.muted, fontSize: 11, marginTop: 3 },
  metricsRow: { flexDirection: 'row', minWidth: 840, marginTop: 14, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 12 }, metric: { width: 120, paddingVertical: 5, paddingRight: 6 }, metricLabel: { color: palette.muted, fontSize: 10 }, metricValue: { color: palette.text, fontSize: 13, fontWeight: '900', marginTop: 4 },
  weightRow: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: palette.line, marginTop: 8, paddingTop: 12, alignItems: 'center' }, rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }, weightLabel: { color: palette.muted, fontSize: 11 }, weightValue: { color: palette.blue, fontWeight: '900' }, target: { color: palette.muted, fontSize: 11 }, statusBox: { width: 124 }, ok: { color: palette.green, fontWeight: '900', fontSize: 11 }, bad: { color: palette.red, fontWeight: '900', fontSize: 11 }, statusSub: { color: palette.muted, fontSize: 10, marginTop: 3 }, footer: { color: palette.muted, paddingHorizontal: 18, fontSize: 10, lineHeight: 16, marginBottom: 12 },
});

const HOLDING_CHOICES=[
{key:'shares',label:'持有股數',category:'資產'},{key:'avgCost',label:'平均成本',category:'成本'},{key:'tradeAvgPrice',label:'成交行情',category:'成本'},{key:'price',label:'TWSE 現價',category:'市場'},{key:'marketValue',label:'目前市值',category:'資產'},{key:'totalCost',label:'持有總成本',category:'成本'},{key:'perShare',label:'每股差額',category:'損益'},{key:'pnl',label:'成本損益',category:'損益'},{key:'pnlPct',label:'成本損益 %',category:'損益'},{key:'todayPnl',label:'今日損益',category:'損益'},{key:'todayPnlPct',label:'今日損益 %',category:'損益'},{key:'totalPnl',label:'含息總損益',category:'損益'},{key:'totalPnlPct',label:'含息總損益 %',category:'損益'},{key:'buyFee',label:'買進手續費',category:'成本'},{key:'annualDividend',label:'預估年配息',category:'配息'},{key:'cumulativeDividend',label:'累積配息',category:'配息'},{key:'cashYield',label:'預估殖利率',category:'配息'},{key:'targetWeight',label:'目標比重',category:'配置'},{key:'currentWeight',label:'目前比重',category:'配置'},{key:'lastBuyDate',label:'最後買進日',category:'日期提醒'},{key:'purchaseCount',label:'買進筆數',category:'交易'},{key:'open',label:'開盤',category:'市場'},{key:'high',label:'最高',category:'市場'},{key:'low',label:'最低',category:'市場'},{key:'previousClose',label:'昨收',category:'市場'},{key:'volume',label:'成交量',category:'市場'},{key:'broker',label:'券商',category:'其他'},{key:'account',label:'帳戶',category:'其他'}
];
