import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {
  PageFieldKey,
  V3CardAlign,
  V3PageCard,
  V3Preferences,
} from '../model';
import {
  EFFECT_KINDS,
  effectDefaults,
  type EffectKind,
  type VisualEffect,
} from '../../ui/editorSchema';
import { V3_THEME } from '../theme';

type SettingsMenuKey =
  | 'theme'
  | 'cards'
  | 'charts'
  | 'widget'
  | 'notifications'
  | 'ai';

type EditorTab = 'card' | 'fields' | 'display' | 'effects';
type FieldKind = 'system' | 'chart' | 'divider' | 'custom';

type FrameFieldDraft = {
  id: string;
  kind: FieldKind;
  label: string;
  binding?: string;
  visible: boolean;
};

export type PageFrameEditorDraft = {
  title: string;
  titleFontSize: number;
  align: V3CardAlign;
  backgroundColor: string;
  radius: number;
  opacity: number;
  fields: FrameFieldDraft[];
  effects: VisualEffect[];
};

export type PageFrameEditorModalProps = {
  visible: boolean;
  page: PageFieldKey;
  card: V3PageCard | null;
  onClose: () => void;
  onSave: (card: V3PageCard, draft: PageFrameEditorDraft) => void;
};

export type SettingsScreenProps = {
  prefs: V3Preferences;
  onChange: (patch: Partial<V3Preferences>) => void;
};

const MENU: Array<{
  key: SettingsMenuKey;
  icon: string;
  title: string;
  subtitle: string;
}> = [
  {
    key: 'theme',
    icon: '◐',
    title: '佈景主題',
    subtitle: '科技未來 · #0D131A',
  },
  {
    key: 'cards',
    icon: '▣',
    title: '卡片預設設定',
    subtitle: '圓角 · 透明度 · 間距',
  },
  {
    key: 'charts',
    icon: '⌁',
    title: '圖表設定',
    subtitle: '樣式 · 互動 · 顯示',
  },
  {
    key: 'widget',
    icon: '◫',
    title: 'Widget 設定',
    subtitle: '桌面元件與顯示欄位',
  },
  {
    key: 'notifications',
    icon: '◉',
    title: '通知設定',
    subtitle: '盤後摘要與重要提醒',
  },
  {
    key: 'ai',
    icon: '✦',
    title: 'AI 設定',
    subtitle: '入口 · 確認寫入 · 顯示',
  },
];

const FIELD_PRESETS: Array<{
  binding: string;
  label: string;
}> = [
  { binding: 'symbol', label: 'ETF 代碼' },
  { binding: 'name', label: '名稱' },
  { binding: 'price', label: '現價' },
  { binding: 'changePct', label: '漲跌幅' },
  { binding: 'shares', label: '持股數' },
  { binding: 'avgCost', label: '平均成本' },
  { binding: 'todayPnl', label: '今日損益' },
  { binding: 'totalPnl', label: '總損益' },
];

const FIELD_KIND_LABELS: Record<FieldKind, string> = {
  system: '系統欄位',
  chart: '圖表欄位',
  divider: '文字分隔',
  custom: '自訂欄位',
};

const effectLabel = (kind: EffectKind) =>
  ({
    profitLoss: '損益配色',
    outline: '外框',
    outerGlow: '外發光',
    innerGlow: '內發光',
    outerShadow: '外陰影',
    innerShadow: '內陰影',
    gradient: '漸層',
    glass: '毛玻璃',
    fade: '淡化',
    breathe: '呼吸',
    blink: '閃爍',
    alertPulse: '警示脈衝',
    shimmer: '微光掃描',
    sweep: '掃光',
    scalePulse: '縮放脈衝',
    fadeInOut: '淡入淡出',
  })[kind] ?? kind;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeField(
  kind: FieldKind,
  label: string,
  binding?: string,
): FrameFieldDraft {
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    label,
    binding,
    visible: true,
  };
}

function cardFieldsToDraft(card: V3PageCard | null): FrameFieldDraft[] {
  if (!card) return [];

  return card.fields.map(binding => ({
    id: `system-${binding}`,
    kind: 'system' as const,
    label:
      FIELD_PRESETS.find(item => item.binding === binding)?.label ??
      binding,
    binding,
    visible: true,
  }));
}

function initialDraft(card: V3PageCard | null): PageFrameEditorDraft {
  return {
    title: card?.title ?? '新卡片',
    titleFontSize: clamp(
      Math.round(16 * ((card?.style.fontScale ?? 100) / 100)),
      12,
      24,
    ),
    align: card?.style.align ?? 'left',
    backgroundColor: '#161F30',
    radius: card?.style.radius ?? 16,
    opacity: card?.style.backgroundOpacity ?? 95,
    fields: cardFieldsToDraft(card),
    effects: [],
  };
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.menuIcon}>
        <Text style={styles.menuIconText}>{icon}</Text>
      </View>

      <View style={styles.menuTextWrap}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function SegmentedTabs({
  value,
  onChange,
}: {
  value: EditorTab;
  onChange: (next: EditorTab) => void;
}) {
  const tabs: Array<[EditorTab, string]> = [
    ['card', '卡片設定'],
    ['fields', '資料欄位'],
    ['display', '顯示內容'],
    ['effects', '特效 Stack'],
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.editorTabs}
    >
      {tabs.map(([key, label]) => {
        const active = value === key;

        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.editorTab,
              active && styles.editorTabActive,
            ]}
          >
            <Text
              style={[
                styles.editorTabText,
                active && styles.editorTabTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const steps = Math.round((max - min) / step);
  const activeIndex = Math.round((value - min) / step);

  return (
    <View style={styles.controlBlock}>
      <View style={styles.controlHeader}>
        <Text style={styles.controlLabel}>{label}</Text>
        <Text style={styles.controlValue}>
          {value}
          {suffix}
        </Text>
      </View>

      <View style={styles.sliderRow}>
        <Pressable
          onPress={() => onChange(clamp(value - step, min, max))}
          style={styles.stepButton}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>

        <View style={styles.sliderTrack}>
          {Array.from({ length: steps + 1 }, (_, index) => (
            <Pressable
              key={index}
              onPress={() => onChange(min + index * step)}
              style={[
                styles.sliderSegment,
                index <= activeIndex && styles.sliderSegmentActive,
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={() => onChange(clamp(value + step, min, max))}
          style={styles.stepButton}
        >
          <Text style={styles.stepButtonText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AlignSelector({
  value,
  onChange,
}: {
  value: V3CardAlign;
  onChange: (value: V3CardAlign) => void;
}) {
  return (
    <View style={styles.alignRow}>
      {(
        [
          ['left', '靠左'],
          ['center', '置中'],
          ['right', '靠右'],
        ] as const
      ).map(([key, label]) => {
        const active = value === key;

        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[
              styles.alignButton,
              active && styles.alignButtonActive,
            ]}
          >
            <Text
              style={[
                styles.alignText,
                active && styles.alignTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DraggableFieldRow({
  field,
  index,
  onMove,
  onDelete,
  onToggle,
}: {
  field: FrameFieldDraft;
  index: number;
  onMove: (index: number, by: number) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 24) onMove(index, 1);
          if (gesture.dy < -24) onMove(index, -1);
        },
      }),
    [index, onMove],
  );

  return (
    <View style={styles.fieldRow}>
      <View {...panResponder.panHandlers} style={styles.dragHandle}>
        <Text style={styles.dragHandleText}>☰</Text>
      </View>

      <View style={styles.fieldRowText}>
        <Text style={styles.fieldRowTitle}>{field.label}</Text>
        <Text style={styles.fieldRowMeta}>
          {FIELD_KIND_LABELS[field.kind]}
          {field.binding ? ` · ${field.binding}` : ''}
        </Text>
      </View>

      <Pressable
        onPress={() => onToggle(field.id)}
        style={[
          styles.visibilityPill,
          field.visible && styles.visibilityPillActive,
        ]}
      >
        <Text
          style={[
            styles.visibilityText,
            field.visible && styles.visibilityTextActive,
          ]}
        >
          {field.visible ? '顯示' : '隱藏'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onDelete(field.id)}
        style={styles.deleteFieldButton}
      >
        <Text style={styles.deleteFieldText}>×</Text>
      </Pressable>
    </View>
  );
}

function EffectRow({
  effect,
  onToggle,
  onDelete,
}: {
  effect: VisualEffect;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={styles.effectRow}>
      <View style={styles.effectOrder}>
        <Text style={styles.effectOrderText}>{effect.order + 1}</Text>
      </View>

      <View style={styles.fieldRowText}>
        <Text style={styles.fieldRowTitle}>{effectLabel(effect.kind)}</Text>
        <Text style={styles.fieldRowMeta}>
          強度 {effect.intensity} · {effect.speedMs}ms
        </Text>
      </View>

      <Switch
        value={effect.enabled}
        onValueChange={() => onToggle(effect.id)}
        trackColor={{
          false: 'rgba(255,255,255,0.12)',
          true: 'rgba(79,209,165,0.35)',
        }}
        thumbColor={
          effect.enabled
            ? V3_THEME.colors.accent
            : V3_THEME.colors.textSecondary
        }
      />

      <Pressable
        onPress={() => onDelete(effect.id)}
        style={styles.deleteFieldButton}
      >
        <Text style={styles.deleteFieldText}>×</Text>
      </Pressable>
    </View>
  );
}

export function PageFrameEditorModal({
  visible,
  page,
  card,
  onClose,
  onSave,
}: PageFrameEditorModalProps) {
  const [tab, setTab] = useState<EditorTab>('card');
  const [draft, setDraft] = useState<PageFrameEditorDraft>(() =>
    initialDraft(card),
  );

  React.useEffect(() => {
    if (!visible) return;
    setTab('card');
    setDraft(initialDraft(card));
  }, [visible, card?.id]);

  const reset = () => setDraft(initialDraft(card));

  const updateFields = (
    updater: (fields: FrameFieldDraft[]) => FrameFieldDraft[],
  ) => {
    setDraft(current => ({
      ...current,
      fields: updater(current.fields),
    }));
  };

  const moveField = (index: number, by: number) => {
    updateFields(fields => {
      const to = clamp(index + by, 0, fields.length - 1);
      if (to === index) return fields;

      const next = [...fields];
      const [item] = next.splice(index, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const addSystemField = (binding: string, label: string) => {
    updateFields(fields => [
      ...fields,
      makeField('system', label, binding),
    ]);
  };

  const addFieldKind = (kind: FieldKind) => {
    if (kind === 'divider') {
      updateFields(fields => [
        ...fields,
        makeField('divider', '文字分隔'),
      ]);
      return;
    }

    if (kind === 'chart') {
      updateFields(fields => [
        ...fields,
        makeField('chart', '圖表欄位', 'chart'),
      ]);
      return;
    }

    updateFields(fields => [
      ...fields,
      makeField('custom', '自訂欄位', 'custom'),
    ]);
  };

  const addEffect = (kind: EffectKind) => {
    setDraft(current => ({
      ...current,
      effects: [
        ...current.effects,
        effectDefaults(kind, current.effects.length),
      ],
    }));
  };

  const save = () => {
    if (!card) return;

    const visibleFields = draft.fields
      .filter(field => field.visible)
      .map(field => field.binding ?? field.id);

    const nextCard: V3PageCard = {
      ...card,
      title: draft.title.trim() || card.title,
      fields: visibleFields,
      style: {
        ...card.style,
        align: draft.align,
        radius: draft.radius,
        backgroundOpacity: draft.opacity,
        fontScale: Math.round((draft.titleFontSize / 16) * 100),
      },
    };

    onSave(nextCard, draft);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.editorSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.editorHeader}>
            <View style={styles.editorHeaderText}>
              <Text style={styles.editorEyebrow}>PAGE FRAME EDITOR 2.0</Text>
              <Text style={styles.editorTitle}>
                {card?.title ?? '卡片編輯器'}
              </Text>
              <Text style={styles.editorSubtitle}>
                {page} · 純 UI / Layout 設定
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <SegmentedTabs value={tab} onChange={setTab} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.editorBody}
          >
            {tab === 'card' ? (
              <>
                <Text style={styles.fieldLabel}>卡片標題</Text>
                <TextInput
                  value={draft.title}
                  onChangeText={title =>
                    setDraft(current => ({ ...current, title }))
                  }
                  placeholder="輸入卡片標題"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  style={styles.input}
                />

                <SliderControl
                  label="標題字級"
                  value={draft.titleFontSize}
                  min={12}
                  max={24}
                  onChange={titleFontSize =>
                    setDraft(current => ({
                      ...current,
                      titleFontSize,
                    }))
                  }
                  suffix="pt"
                />

                <Text style={styles.fieldLabel}>對齊方式</Text>
                <AlignSelector
                  value={draft.align}
                  onChange={align =>
                    setDraft(current => ({ ...current, align }))
                  }
                />

                <Text style={styles.fieldLabel}>背景顏色</Text>
                <TextInput
                  value={draft.backgroundColor}
                  onChangeText={backgroundColor =>
                    setDraft(current => ({
                      ...current,
                      backgroundColor,
                    }))
                  }
                  autoCapitalize="characters"
                  style={styles.input}
                />

                <View
                  style={[
                    styles.colorPreview,
                    { backgroundColor: draft.backgroundColor },
                  ]}
                />

                <SliderControl
                  label="卡片圓角"
                  value={draft.radius}
                  min={0}
                  max={32}
                  step={2}
                  onChange={radius =>
                    setDraft(current => ({ ...current, radius }))
                  }
                  suffix="px"
                />

                <SliderControl
                  label="卡片透明度"
                  value={draft.opacity}
                  min={50}
                  max={100}
                  step={5}
                  onChange={opacity =>
                    setDraft(current => ({ ...current, opacity }))
                  }
                  suffix="%"
                />

                <View style={styles.defaultHint}>
                  <Text style={styles.defaultHintText}>
                    Page Frame Editor 2.0 預設：圓角 16px · 透明度 95%
                  </Text>
                </View>
              </>
            ) : null}

            {tab === 'fields' ? (
              <>
                <Text style={styles.groupTitle}>新增系統欄位</Text>
                <View style={styles.fieldPresetGrid}>
                  {FIELD_PRESETS.map(item => (
                    <Pressable
                      key={item.binding}
                      onPress={() =>
                        addSystemField(item.binding, item.label)
                      }
                      style={styles.fieldPresetButton}
                    >
                      <Text style={styles.fieldPresetText}>
                        ＋ {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.groupTitle}>其他欄位類型</Text>
                <View style={styles.fieldPresetGrid}>
                  {(
                    [
                      ['chart', '圖表欄位'],
                      ['divider', '文字分隔'],
                      ['custom', '自訂欄位'],
                    ] as const
                  ).map(([kind, label]) => (
                    <Pressable
                      key={kind}
                      onPress={() => addFieldKind(kind)}
                      style={styles.fieldPresetButton}
                    >
                      <Text style={styles.fieldPresetText}>
                        ＋ {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.groupTitle}>
                  欄位順序 · 拖曳 ☰ 調整
                </Text>

                <View style={styles.fieldList}>
                  {draft.fields.map((field, index) => (
                    <DraggableFieldRow
                      key={field.id}
                      field={field}
                      index={index}
                      onMove={moveField}
                      onDelete={id =>
                        updateFields(fields =>
                          fields.filter(item => item.id !== id),
                        )
                      }
                      onToggle={id =>
                        updateFields(fields =>
                          fields.map(item =>
                            item.id === id
                              ? { ...item, visible: !item.visible }
                              : item,
                          ),
                        )
                      }
                    />
                  ))}
                </View>
              </>
            ) : null}

            {tab === 'display' ? (
              <>
                <Text style={styles.groupTitle}>顯示內容</Text>
                <Text style={styles.helperText}>
                  控制目前卡片要顯示或隱藏哪些欄位；只影響畫面，不改變任何資料來源與計算結果。
                </Text>

                <View style={styles.fieldList}>
                  {draft.fields.map(field => (
                    <View key={field.id} style={styles.displayRow}>
                      <View style={styles.fieldRowText}>
                        <Text style={styles.fieldRowTitle}>
                          {field.label}
                        </Text>
                        <Text style={styles.fieldRowMeta}>
                          {FIELD_KIND_LABELS[field.kind]}
                        </Text>
                      </View>

                      <Switch
                        value={field.visible}
                        onValueChange={() =>
                          updateFields(fields =>
                            fields.map(item =>
                              item.id === field.id
                                ? {
                                    ...item,
                                    visible: !item.visible,
                                  }
                                : item,
                            ),
                          )
                        }
                        trackColor={{
                          false: 'rgba(255,255,255,0.12)',
                          true: 'rgba(79,209,165,0.35)',
                        }}
                        thumbColor={
                          field.visible
                            ? V3_THEME.colors.accent
                            : V3_THEME.colors.textSecondary
                        }
                      />
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {tab === 'effects' ? (
              <>
                <Text style={styles.groupTitle}>新增特效</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.effectPicker}
                >
                  {EFFECT_KINDS.map(kind => (
                    <Pressable
                      key={kind}
                      onPress={() => addEffect(kind)}
                      style={styles.effectChip}
                    >
                      <Text style={styles.effectChipText}>
                        ＋ {effectLabel(kind)}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.groupTitle}>Effect Stack</Text>
                <Text style={styles.helperText}>
                  特效依序由上而下套用；此 Stack 只處理外觀效果。
                </Text>

                <View style={styles.fieldList}>
                  {draft.effects.map(effect => (
                    <EffectRow
                      key={effect.id}
                      effect={effect}
                      onToggle={id =>
                        setDraft(current => ({
                          ...current,
                          effects: current.effects.map(item =>
                            item.id === id
                              ? {
                                  ...item,
                                  enabled: !item.enabled,
                                }
                              : item,
                          ),
                        }))
                      }
                      onDelete={id =>
                        setDraft(current => ({
                          ...current,
                          effects: current.effects.filter(
                            item => item.id !== id,
                          ),
                        }))
                      }
                    />
                  ))}
                </View>
              </>
            ) : null}
          </ScrollView>

          <View style={styles.editorFooter}>
            <Pressable
              onPress={onClose}
              style={[styles.footerButton, styles.footerButtonSecondary]}
            >
              <Text style={styles.footerSecondaryText}>取消</Text>
            </Pressable>

            <Pressable
              onPress={reset}
              style={[styles.footerButton, styles.footerButtonSecondary]}
            >
              <Text style={styles.footerSecondaryText}>恢復預設</Text>
            </Pressable>

            <Pressable
              onPress={save}
              style={[styles.footerButton, styles.footerButtonPrimary]}
            >
              <Text style={styles.footerPrimaryText}>儲存並退出</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SettingsScreen({
  prefs,
  onChange,
}: SettingsScreenProps) {
  const [menu, setMenu] = useState<SettingsMenuKey>('theme');
  const [selectedPage, setSelectedPage] =
    useState<PageFieldKey>('dashboard');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const isEditModeActive = prefs.globalEditMode;

  const pageCards = prefs.pageLayouts[selectedPage]?.cards ?? [];
  const editingCard =
    pageCards.find(card => card.id === editingCardId) ?? null;

  const setEditMode = (value: boolean) => {
    onChange({ globalEditMode: value });
  };

  const saveFrame = (
    nextCard: V3PageCard,
    _draft: PageFrameEditorDraft,
  ) => {
    const layout = prefs.pageLayouts[selectedPage];
    if (!layout) return;

    onChange({
      pageLayouts: {
        ...prefs.pageLayouts,
        [selectedPage]: {
          ...layout,
          cards: layout.cards.map(card =>
            card.id === nextCard.id ? nextCard : card,
          ),
        },
      },
    });

    setEditingCardId(null);
  };

  const menuAction = (key: SettingsMenuKey) => {
    setMenu(key);

    if (key === 'cards') return;

    Alert.alert(
      MENU.find(item => item.key === key)?.title ?? '設定',
      '此新版 SettingsScreen 已建立對應入口；詳細子頁可在下一階段逐模組接入現有設定資料。',
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>SETTINGS / PAGE FRAME EDITOR 2.0</Text>
        <Text style={styles.pageTitle}>設定與頁面編輯器</Text>
        <Text style={styles.pageSubtitle}>
          外觀、卡片、圖表、Widget、通知與 AI 集中管理
        </Text>
      </View>

      <View style={styles.editModeCard}>
        <View style={styles.editModeText}>
          <Text style={styles.editModeTitle}>頁面編輯模式</Text>
          <Text style={styles.editModeSubtitle}>
            開啟後，全 App 卡片可顯示 ⚙️ 編輯入口
          </Text>
        </View>

        <Switch
          value={isEditModeActive}
          onValueChange={setEditMode}
          trackColor={{
            false: 'rgba(255,255,255,0.12)',
            true: 'rgba(79,209,165,0.35)',
          }}
          thumbColor={
            isEditModeActive
              ? V3_THEME.colors.accent
              : V3_THEME.colors.textSecondary
          }
        />
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            isEditModeActive && styles.statusDotActive,
          ]}
        />
        <Text style={styles.statusText}>
          {isEditModeActive
            ? '編輯模式已開啟'
            : '編輯模式已關閉'}
        </Text>
      </View>

      <View style={styles.menuCard}>
        {MENU.map(item => (
          <MenuRow
            key={item.key}
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            onPress={() => menuAction(item.key)}
          />
        ))}
      </View>

      <View style={styles.frameSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>頁面框架編輯</Text>
            <Text style={styles.sectionSubtitle}>
              選擇頁面與卡片後開啟 Page Frame Editor
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pageSelector}
        >
          {(
            [
              ['dashboard', '首頁'],
              ['ledger', '智慧記帳'],
              ['portfolio', '庫存'],
              ['dividend', '股息'],
              ['calculator', '試算'],
              ['detail', 'ETF 詳情'],
            ] as const
          ).map(([key, label]) => {
            const active = selectedPage === key;

            return (
              <Pressable
                key={key}
                onPress={() => setSelectedPage(key)}
                style={[
                  styles.pagePill,
                  active && styles.pagePillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pagePillText,
                    active && styles.pagePillTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.cardList}>
          {pageCards.length > 0 ? (
            pageCards.map(card => (
              <View key={card.id} style={styles.frameCard}>
                <View style={styles.frameCardInfo}>
                  <Text style={styles.frameCardTitle}>{card.title}</Text>
                  <Text style={styles.frameCardMeta}>
                    {card.kind} · {card.fields.length} 欄位 ·{' '}
                    {card.hidden ? '已隱藏' : '顯示中'}
                  </Text>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`編輯 ${card.title}`}
                  onPress={() => setEditingCardId(card.id)}
                  style={styles.gearButton}
                >
                  <Text style={styles.gearText}>⚙️</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>目前沒有卡片設定</Text>
              <Text style={styles.emptyText}>
                可由既有 Page Layout 系統建立卡片後，再使用新版 Frame Editor 調整。
              </Text>
            </View>
          )}
        </View>
      </View>

      <PageFrameEditorModal
        visible={!!editingCard}
        page={selectedPage}
        card={editingCard}
        onClose={() => setEditingCardId(null)}
        onSave={saveFrame}
      />
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

  header: {
    marginBottom: V3_THEME.spacing.xl,
  },
  eyebrow: {
    ...V3_THEME.typography.helper,
    color: V3_THEME.colors.accent,
    letterSpacing: 1.1,
  },
  pageTitle: {
    marginTop: 5,
    color: V3_THEME.colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  pageSubtitle: {
    marginTop: 6,
    color: V3_THEME.colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },

  editModeCard: {
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: V3_THEME.spacing.lg,
  },
  editModeText: {
    flex: 1,
  },
  editModeTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  editModeSubtitle: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  statusRow: {
    marginTop: V3_THEME.spacing.sm,
    marginBottom: V3_THEME.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: V3_THEME.colors.textSecondary,
  },
  statusDotActive: {
    backgroundColor: V3_THEME.colors.accent,
  },
  statusText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },

  menuCard: {
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    overflow: 'hidden',
  },
  menuRow: {
    minHeight: 72,
    paddingHorizontal: V3_THEME.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: V3_THEME.colors.borderGlow,
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  menuIconText: {
    color: V3_THEME.colors.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  menuTextWrap: {
    flex: 1,
    minWidth: 0,
    marginLeft: V3_THEME.spacing.md,
  },
  menuTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  menuSubtitle: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
  },
  chevron: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 24,
    fontWeight: '400',
  },

  frameSection: {
    marginTop: V3_THEME.spacing.xxl,
  },
  sectionHeader: {
    marginBottom: V3_THEME.spacing.md,
  },
  sectionTitle: {
    ...V3_THEME.typography.cardTitle,
  },
  sectionSubtitle: {
    ...V3_THEME.typography.helper,
    marginTop: 3,
  },
  pageSelector: {
    gap: V3_THEME.spacing.sm,
    paddingRight: V3_THEME.spacing.lg,
  },
  pagePill: {
    minHeight: 38,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagePillActive: {
    backgroundColor: V3_THEME.colors.accentSoft,
    borderColor: 'rgba(79,209,165,0.30)',
  },
  pagePillText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  pagePillTextActive: {
    color: V3_THEME.colors.accent,
  },

  cardList: {
    marginTop: V3_THEME.spacing.md,
    gap: V3_THEME.spacing.sm,
  },
  frameCard: {
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  frameCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  frameCardTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  frameCardMeta: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
  },
  gearButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  gearText: {
    fontSize: 18,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  editorSheet: {
    maxHeight: '94%',
    minHeight: '72%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#101820',
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginTop: 9,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  editorHeader: {
    paddingHorizontal: V3_THEME.spacing.lg,
    paddingTop: V3_THEME.spacing.md,
    paddingBottom: V3_THEME.spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  editorHeaderText: {
    flex: 1,
  },
  editorEyebrow: {
    color: V3_THEME.colors.accent,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  editorTitle: {
    marginTop: 4,
    color: V3_THEME.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  editorSubtitle: {
    marginTop: 3,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 22,
  },

  editorTabs: {
    paddingHorizontal: V3_THEME.spacing.lg,
    paddingVertical: V3_THEME.spacing.sm,
    gap: V3_THEME.spacing.sm,
  },
  editorTab: {
    minHeight: 36,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorTabActive: {
    backgroundColor: V3_THEME.colors.accentSoft,
    borderColor: 'rgba(79,209,165,0.28)',
  },
  editorTabText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  editorTabTextActive: {
    color: V3_THEME.colors.accent,
  },
  editorBody: {
    paddingHorizontal: V3_THEME.spacing.lg,
    paddingTop: V3_THEME.spacing.md,
    paddingBottom: 110,
  },

  fieldLabel: {
    marginTop: V3_THEME.spacing.md,
    marginBottom: 7,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    color: V3_THEME.colors.textPrimary,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  controlBlock: {
    marginTop: V3_THEME.spacing.lg,
  },
  controlHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  controlLabel: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  controlValue: {
    color: V3_THEME.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  sliderTrack: {
    flex: 1,
    height: 10,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  sliderSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  sliderSegmentActive: {
    backgroundColor: V3_THEME.colors.accent,
  },

  alignRow: {
    flexDirection: 'row',
    gap: V3_THEME.spacing.sm,
  },
  alignButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignButtonActive: {
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  alignText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  alignTextActive: {
    color: V3_THEME.colors.accent,
  },
  colorPreview: {
    height: 44,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
  },
  defaultHint: {
    marginTop: V3_THEME.spacing.lg,
    borderRadius: 12,
    backgroundColor: 'rgba(79,209,165,0.08)',
    padding: V3_THEME.spacing.md,
  },
  defaultHintText: {
    color: V3_THEME.colors.accent,
    fontSize: 10,
    lineHeight: 15,
  },

  groupTitle: {
    marginTop: V3_THEME.spacing.md,
    marginBottom: V3_THEME.spacing.sm,
    color: V3_THEME.colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  helperText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
  },
  fieldPresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: V3_THEME.spacing.sm,
  },
  fieldPresetButton: {
    minHeight: 34,
    borderRadius: V3_THEME.radius.pill,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldPresetText: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },

  fieldList: {
    gap: V3_THEME.spacing.sm,
  },
  fieldRow: {
    minHeight: 58,
    borderRadius: 12,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragHandle: {
    width: 34,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandleText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 17,
  },
  fieldRowText: {
    flex: 1,
    minWidth: 0,
  },
  fieldRowTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  fieldRowMeta: {
    marginTop: 3,
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
  },
  visibilityPill: {
    borderRadius: V3_THEME.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  visibilityPillActive: {
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  visibilityText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
  },
  visibilityTextActive: {
    color: V3_THEME.colors.accent,
  },
  deleteFieldButton: {
    width: 32,
    height: 32,
    marginLeft: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteFieldText: {
    color: '#FF7580',
    fontSize: 20,
  },

  displayRow: {
    minHeight: 58,
    borderRadius: 12,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  effectPicker: {
    gap: V3_THEME.spacing.sm,
    paddingRight: V3_THEME.spacing.lg,
  },
  effectChip: {
    minHeight: 34,
    borderRadius: V3_THEME.radius.pill,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectChipText: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  effectRow: {
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  effectOrder: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: V3_THEME.colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectOrderText: {
    color: V3_THEME.colors.accent,
    fontSize: 10,
    fontWeight: '800',
  },

  editorFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 82,
    paddingHorizontal: V3_THEME.spacing.lg,
    paddingVertical: V3_THEME.spacing.md,
    borderTopWidth: 1,
    borderTopColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#101820',
    flexDirection: 'row',
    gap: V3_THEME.spacing.sm,
  },
  footerButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: V3_THEME.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  footerButtonSecondary: {
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: V3_THEME.colors.surfaceGlass,
  },
  footerButtonPrimary: {
    backgroundColor: V3_THEME.colors.accent,
  },
  footerSecondaryText: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  footerPrimaryText: {
    color: '#07130F',
    fontSize: 10,
    fontWeight: '900',
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
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 6,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.72,
  },
});

export default SettingsScreen;
