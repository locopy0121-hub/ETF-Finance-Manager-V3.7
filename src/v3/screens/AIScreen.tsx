import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { researchEtf } from '../../services/aiResearch';
import { fetchTwseDividend } from '../../services/twseDividends';
import type { ScreenCommon } from '../screensBase';

type SourceLink = { label: string; url?: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; sources: SourceLink[] };
type AIScreenProps = { common: ScreenCommon };

const QUICK_PROMPTS = [
  '0050 最新配息與除息日',
  'VOO 最新市場新聞與重點',
  'AAPL 最近重大消息',
  '聯準會利率與 CPI 最新總經事件',
] as const;
const TWSE_DIVIDEND_URL = 'https://www.twse.com.tw/zh/ETFortune/dividendList';

const resolveSecuritySymbol = (query: string) => {
  const upper = query.toUpperCase();
  const tw = upper.match(/\b\d{4,6}[A-Z]?\b/)?.[0];
  if (tw) return tw;
  if (/(總經|聯準會|利率|CPI|通膨|就業|非農|GDP|匯率|央行)/i.test(query)) return null;
  const ignored = new Set(['ETF', 'AI', 'FED', 'CPI', 'GDP', 'TWSE']);
  return upper.match(/\b[A-Z]{1,5}\b/g)?.find(token => !ignored.has(token)) ?? null;
};

const researchAnswer = (
  symbol: string,
  sections: Array<{ key: string; title: string; lines: string[] }>,
) => {
  const preferred = ['highlights', 'news', 'risk'];
  const selected = preferred
    .map(key => sections.find(section => section.key === key))
    .filter((section): section is { key: string; title: string; lines: string[] } => !!section)
    .slice(0, 3);
  const body = selected
    .map(section => section.title + '\n' + section.lines.slice(0, 4).map(line => '• ' + line).join('\n'))
    .join('\n\n');
  return (symbol === 'MARKET' ? '總經 / 市場即時整理' : symbol + ' 即時研究') +
    '\n\n' + (body || '目前沒有取得足夠的即時公開資訊。');
};

export function AIScreen({ common }: AIScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'intro',
      role: 'assistant',
      text: '我可以連網查詢台股 / 美股 ETF、個股公開資訊、總經事件，以及台股 ETF 最新除息與發放資訊。',
      sources: [{ label: 'App 即時研究服務' }],
    },
  ]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setConnected(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 40);
    return () => clearTimeout(timer);
  }, [messages.length, loading]);

  const networkLabel = useMemo(
    () => connected === false ? '🌐 目前離線' : connected === null ? '🌐 聯網檢查中' : '🌐 聯網已開啟',
    [connected],
  );

  const appendAssistant = (textValue: string, sources: SourceLink[]) => {
    setMessages(current => [
      ...current,
      {
        id: 'assistant-' + String(Date.now()) + '-' + String(current.length),
        role: 'assistant',
        text: textValue,
        sources,
      },
    ]);
  };

  const submit = async (forced?: string) => {
    const query = (forced ?? text).trim();
    if (!query || loading) return;
    const userMessage: ChatMessage = {
      id: 'user-' + String(Date.now()),
      role: 'user',
      text: query,
      sources: [],
    };
    setMessages(current => [...current, userMessage]);
    setText('');
    setLoading(true);

    try {
      const symbol = resolveSecuritySymbol(query);
      const wantsDividend = /(配息|股息|除息|發放日|最後買進日|除權息)/.test(query);
      if (symbol && /^\d{4,6}[A-Z]?$/.test(symbol) && wantsDividend) {
        const info = await fetchTwseDividend(symbol);
        if (info) {
          appendAssistant(
            symbol + ' ' + info.name +
              '\n每股配息：' + String(info.dividend) +
              '\n最後買進日：' + (info.lastBuyDate || '—') +
              '\n除息日：' + (info.exDate || '—') +
              '\n發放日：' + (info.payDate || '—'),
            [{ label: info.source, url: TWSE_DIVIDEND_URL }],
          );
          return;
        }
      }

      const researchSymbol = symbol ?? 'MARKET';
      const holdingName =
        common.holdings.find(item => item.symbol.toUpperCase() === researchSymbol)?.name ??
        (researchSymbol === 'MARKET' ? '全球總經市場' : researchSymbol);
      const result = await researchEtf(researchSymbol, holdingName, query);
      const sources = result.news.slice(0, 5).map(item => ({
        label: item.source || item.title,
        url: item.link,
      }));
      appendAssistant(
        researchAnswer(researchSymbol, result.sections),
        sources.length ? sources : [{ label: result.gatewayUsed ? 'AI Gateway' : '即時新聞聚合' }],
      );
    } catch (error) {
      appendAssistant(
        '連網查詢失敗：' + (error instanceof Error ? error.message : '目前無法取得即時資料'),
        [{ label: '網路 / 公開資料服務狀態' }],
      );
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([
      {
        id: 'intro-' + String(Date.now()),
        role: 'assistant',
        text: '對話已清空。可以重新查詢 ETF、個股、總經事件或最新除權息。',
        sources: [{ label: 'App 即時研究服務' }],
      },
    ]);
    setText('');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>AI RESEARCH</Text>
          <Text style={styles.title}>AI 助理</Text>
          <Text style={styles.subtitle}>公開資訊、新聞、總經與除權息即時查詢</Text>
        </View>
        <Pressable onPress={clearConversation} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>清空對話</Text>
        </Pressable>
      </View>

      <View style={[styles.networkBadge, connected === false && styles.networkBadgeOffline]}>
        <Text style={[styles.networkBadgeText, connected === false && styles.networkBadgeTextOffline]}>
          {networkLabel}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
        {QUICK_PROMPTS.map(prompt => (
          <Pressable key={prompt} onPress={() => void submit(prompt)} style={styles.quickPrompt}>
            <Text style={styles.quickPromptText}>{prompt}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        ref={scrollRef}
        style={styles.chat}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.assistantBubble]}
          >
            <Text style={[styles.bubbleText, message.role === 'user' && styles.userBubbleText]}>
              {message.text}
            </Text>
            {message.role === 'assistant' && message.sources.length ? (
              <View style={styles.sourceFooter}>
                <Text style={styles.sourceTitle}>資料來源</Text>
                {message.sources.map((source, index) => (
                  <Pressable
                    key={source.label + String(index)}
                    disabled={!source.url}
                    onPress={() => { if (source.url) void Linking.openURL(source.url); }}
                  >
                    <Text numberOfLines={2} style={[styles.sourceText, source.url && styles.sourceLink]}>
                      {String(index + 1)}. {source.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ))}
        {loading ? (
          <View style={[styles.bubble, styles.assistantBubble]}>
            <Text style={styles.loadingText}>正在連網整理最新資料…</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => void submit()}
          placeholder="查詢 ETF、個股、總經事件或除權息…"
          placeholderTextColor="#94A3B8"
          returnKeyType="send"
          style={styles.input}
        />
        <Pressable
          disabled={loading}
          onPress={() => void submit()}
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
        >
          <Text style={styles.sendButtonText}>{loading ? '查詢中' : '送出'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 18, paddingTop: 18 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0066FF', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 4, color: '#0F172A', fontSize: 26, fontWeight: '900' },
  subtitle: { marginTop: 5, color: '#64748B', fontSize: 11, lineHeight: 17 },
  clearButton: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  clearButtonText: { color: '#0066FF', fontSize: 10, fontWeight: '900' },
  networkBadge: { alignSelf: 'flex-start', marginTop: 14, borderRadius: 999, backgroundColor: '#ECFDF5', paddingHorizontal: 11, paddingVertical: 7 },
  networkBadgeOffline: { backgroundColor: '#FEF2F2' },
  networkBadgeText: { color: '#059669', fontSize: 10, fontWeight: '900' },
  networkBadgeTextOffline: { color: '#DC2626' },
  quickRow: { gap: 8, paddingTop: 13, paddingBottom: 12, paddingRight: 18 },
  quickPrompt: { maxWidth: 220, minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  quickPromptText: { color: '#0066FF', fontSize: 9, fontWeight: '800' },
  chat: { flex: 1 },
  chatContent: { gap: 10, paddingBottom: 14 },
  bubble: { maxWidth: '94%', borderRadius: 16, borderWidth: 1, padding: 13 },
  assistantBubble: { alignSelf: 'flex-start', borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  userBubble: { alignSelf: 'flex-end', borderColor: '#0066FF', backgroundColor: '#0066FF' },
  bubbleText: { color: '#0F172A', fontSize: 11, lineHeight: 18, fontWeight: '600' },
  userBubbleText: { color: '#FFFFFF' },
  sourceFooter: { marginTop: 10, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0', gap: 3 },
  sourceTitle: { color: '#94A3B8', fontSize: 8, fontWeight: '900' },
  sourceText: { color: '#64748B', fontSize: 8, lineHeight: 12 },
  sourceLink: { color: '#0066FF', textDecorationLine: 'underline' },
  loadingText: { color: '#64748B', fontSize: 10, fontWeight: '700' },
  inputBar: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  input: { flex: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#0F172A', paddingHorizontal: 13, fontSize: 11, fontWeight: '700' },
  sendButton: { minWidth: 70, minHeight: 46, borderRadius: 14, backgroundColor: '#0066FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  sendButtonDisabled: { opacity: 0.55 },
  sendButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});

export default AIScreen;
