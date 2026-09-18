import React, { useEffect, useMemo, useState } from 'react';
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
  ThemeId,
} from '../model';
import {
  EFFECT_KINDS,
  effectDefaults,
  type EffectKind,
  type VisualEffect,
} from '../../ui/editorSchema';
import { V3_THEME } from '../theme';
import type { AppSettings, CloseNotificationSettings, WidgetSettings } from '../../storage/appStorage';
import type { BrokerProfile } from '../../data/brokerProfiles';
import { createBrokerProfile } from '../../data/brokerProfiles';
import {
  deleteSafetyBackup,
  listSafetyBackups,
  type SafetyBackup,
} from '../safetyBackup';

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
  appSettings: AppSettings;
  availableSymbols: string[];
  brokerProfiles: BrokerProfile[];
  defaultBrokerProfileId: string;
  onChange: (patch: Partial<V3Preferences>) => void;
  onWidgetChange: (patch: Partial<WidgetSettings>) => void;
  onNotifyChange: (patch: Partial<CloseNotificationSettings>) => void;
  onOtaChange: (patch: Partial<AppSettings['ota']>) => void;
  onCheckOta: () => void | Promise<void>;
  onRefreshQuotes: () => void | boolean | Promise<void | boolean>;
  onBrokerProfilesChange: (profiles: BrokerProfile[]) => void;
  onDefaultBrokerProfileChange: (id: string) => void;
  onPickImage: () => void | Promise<string | undefined>;
  onPickCardImage: () => void | Promise<string | undefined>;
  onClearCardImage: () => void;
  onExportBackup: () => void | Promise<void>;
  onImportBackup: () => void | Promise<void>;
  onClearPnl: () => Promise<unknown>;
  onClearCash: () => Promise<unknown>;
  onClearAccountingData: () => Promise<unknown>;
  onRecalculate: () => Promise<unknown>;
  onRestoreSafety: (id: string) => Promise<boolean>;
  accountingResetLabel?: string;
  accountingResetFailSafe?: string;
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
    subtitle: '專業明亮 · #F8FAFC',
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
    backgroundColor: '#FFFFFF',
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

type ToolboxGroup =
  | 'layout'
  | 'monitor'
  | 'visual'
  | 'system'
  | 'data'
  | 'safety';

const TOOLBOX_GROUPS: Array<{
  key: ToolboxGroup;
  icon: string;
  title: string;
  subtitle: string;
}> = [
  { key: 'layout', icon: '🖥️', title: '全局版面修改編輯', subtitle: 'Layout · 頁面卡片順序 · 組件顯示' },
  { key: 'monitor', icon: '📹', title: '監視器與觀察清單', subtitle: 'Monitor · Watchlist · 警報與刷新' },
  { key: 'visual', icon: '🎨', title: '視覺與主題', subtitle: '主題 · 卡片 · 圖表 · Widget' },
  { key: 'system', icon: '🤖', title: '系統與 AI', subtitle: 'AI · 通知 · 行情更新 · OTA' },
  { key: 'data', icon: '💾', title: '資料管理與備份', subtitle: 'JSON 備份 · 重建 · 歷史紀錄' },
  { key: 'safety', icon: '🛡️', title: '帳務安全與重置', subtitle: '安全備份鎖 · 券商 Profile · 全帳務重置' },
];

const THEME_CHOICES: Array<[ThemeId, string]> = [
  ['obsidianGold', '黑曜金'],
  ['deepSeaTech', '深海科技'],
  ['classicFinance', '經典金融'],
  ['forestEye', '森林之眼'],
  ['amethystNight', '紫晶夜'],
  ['neonNight', '霓虹夜'],
];

function AccordionCard({
  icon,
  title,
  subtitle,
  open,
  onPress,
  children,
}: {
  icon: string;
  title: string;
  subtitle: string;
  open: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.toolboxCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.toolboxHeader,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.toolboxIcon}>
          <Text style={styles.toolboxIconText}>{icon}</Text>
        </View>
        <View style={styles.toolboxHeaderText}>
          <Text style={styles.toolboxTitle}>{title}</Text>
          <Text style={styles.toolboxSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.toolboxChevron}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open ? <View style={styles.toolboxBody}>{children}</View> : null}
    </View>
  );
}

function SettingToggle({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingRowText}>
        <Text style={styles.settingRowLabel}>{label}</Text>
        {note ? <Text style={styles.settingRowNote}>{note}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: 'rgba(255,255,255,0.12)',
          true: 'rgba(79,209,165,0.35)',
        }}
        thumbColor={value ? V3_THEME.colors.accent : V3_THEME.colors.textSecondary}
      />
    </View>
  );
}

function ChoicePill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choicePill,
        active && styles.choicePillActive,
      ]}
    >
      <Text
        style={[
          styles.choicePillText,
          active && styles.choicePillTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SmallAction({
  label,
  danger = false,
  onPress,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.smallAction,
        danger && styles.smallActionDanger,
      ]}
    >
      <Text
        style={[
          styles.smallActionText,
          danger && styles.smallActionDangerText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InlineNumber({
  label,
  value,
  min,
  max,
  step,
  suffix = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingRowText}>
        <Text style={styles.settingRowLabel}>{label}</Text>
        <Text style={styles.settingRowNote}>
          {value}{suffix}
        </Text>
      </View>
      <View style={styles.inlineStepper}>
        <Pressable
          onPress={() => onChange(clamp(value - step, min, max))}
          style={styles.stepButton}
        >
          <Text style={styles.stepButtonText}>−</Text>
        </Pressable>
        <Text style={styles.inlineStepperValue}>{value}</Text>
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

export function SettingsScreen({
  prefs,
  appSettings,
  availableSymbols,
  brokerProfiles,
  defaultBrokerProfileId,
  onChange,
  onWidgetChange,
  onNotifyChange,
  onOtaChange,
  onCheckOta,
  onRefreshQuotes,
  onBrokerProfilesChange,
  onDefaultBrokerProfileChange,
  onPickImage,
  onPickCardImage,
  onClearCardImage,
  onExportBackup,
  onImportBackup,
  onClearPnl,
  onClearCash,
  onClearAccountingData,
  onRecalculate,
  onRestoreSafety,
  accountingResetLabel = '清除全部帳務資料',
  accountingResetFailSafe = '清除前會建立完整安全備份；備份失敗即停止清除。',
}: SettingsScreenProps) {
  const [openGroups, setOpenGroups] = useState<Record<ToolboxGroup, boolean>>({
    layout: true,
    monitor: false,
    visual: false,
    system: false,
    data: false,
    safety: false,
  });
  const [selectedPage, setSelectedPage] = useState<PageFieldKey>('dashboard');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [monitorTarget, setMonitorTarget] =
    useState<'appBoard' | 'floating' | 'widget'>('floating');
  const [safetyBackups, setSafetyBackups] = useState<SafetyBackup[]>([]);
  const [selectedBrokerId, setSelectedBrokerId] = useState(
    defaultBrokerProfileId,
  );

  useEffect(() => {
    if (!openGroups.data && !openGroups.safety) return;
    let active = true;
    void listSafetyBackups().then(rows => {
      if (active) setSafetyBackups(rows);
    });
    return () => {
      active = false;
    };
  }, [openGroups.data, openGroups.safety]);

  const isEditModeActive = prefs.globalEditMode;
  const pageLayout = prefs.pageLayouts[selectedPage];
  const pageCards = pageLayout?.cards ?? [];
  const editingCard =
    pageCards.find(card => card.id === editingCardId) ?? null;
  const monitor = prefs.monitoring[monitorTarget];
  const selectedBroker =
    brokerProfiles.find(item => item.id === selectedBrokerId) ??
    brokerProfiles[0];

  const patchMonitor = (
    patch: Partial<typeof prefs.monitoring.floating>,
  ) => {
    onChange({
      monitoring: {
        ...prefs.monitoring,
        [monitorTarget]: {
          ...prefs.monitoring[monitorTarget],
          ...patch,
        },
      },
    });
  };

  const patchPageCustomize = (page: PageFieldKey, value: boolean) => {
    onChange({
      monitoring: {
        ...prefs.monitoring,
        pageCustomize: {
          ...prefs.monitoring.pageCustomize,
          [page]: value,
        },
      },
    });
  };

  const toggleWatchSymbol = (symbol: string) => {
    const next = prefs.watchlistSymbols.includes(symbol)
      ? prefs.watchlistSymbols.filter(item => item !== symbol)
      : [...prefs.watchlistSymbols, symbol];
    onChange({ watchlistSymbols: next });
  };

  const toggleMonitorSymbol = (symbol: string) => {
    const selected = monitor.selectedSymbols.includes(symbol);
    patchMonitor({
      selectedSymbols: selected
        ? monitor.selectedSymbols.filter(item => item !== symbol)
        : [...monitor.selectedSymbols, symbol],
    });
  };

  const moveCard = (index: number, by: number) => {
    if (!pageLayout) return;
    const to = clamp(index + by, 0, pageCards.length - 1);
    if (to === index) return;
    const cards = [...pageCards];
    const [item] = cards.splice(index, 1);
    cards.splice(to, 0, item);
    onChange({
      pageLayouts: {
        ...prefs.pageLayouts,
        [selectedPage]: {
          ...pageLayout,
          cards,
        },
      },
    });
  };

  const toggleCardHidden = (id: string) => {
    if (!pageLayout) return;
    onChange({
      pageLayouts: {
        ...prefs.pageLayouts,
        [selectedPage]: {
          ...pageLayout,
          cards: pageCards.map(card =>
            card.id === id ? { ...card, hidden: !card.hidden } : card,
          ),
        },
      },
    });
  };

  const saveFrame = (
    nextCard: V3PageCard,
    _draft: PageFrameEditorDraft,
  ) => {
    if (!pageLayout) return;
    onChange({
      pageLayouts: {
        ...prefs.pageLayouts,
        [selectedPage]: {
          ...pageLayout,
          cards: pageCards.map(card =>
            card.id === nextCard.id ? nextCard : card,
          ),
        },
      },
    });
    setEditingCardId(null);
  };

  const patchBroker = (patch: Partial<BrokerProfile>) => {
    if (!selectedBroker) return;
    onBrokerProfilesChange(
      brokerProfiles.map(profile =>
        profile.id === selectedBroker.id
          ? { ...profile, ...patch }
          : profile,
      ),
    );
  };

  const refreshSafety = async () => {
    setSafetyBackups(await listSafetyBackups());
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
          Page Frame Editor 2.0 與舊版百寶箱功能統一收納；只改 UI、監控、通知與系統設定，不改金融計算。
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
          onValueChange={globalEditMode => onChange({ globalEditMode })}
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
          {isEditModeActive ? 'Page Frame Editor 已啟用' : '一般瀏覽模式'}
        </Text>
      </View>

      <View style={styles.toolboxList}>
        {TOOLBOX_GROUPS.map(group => (
          <AccordionCard
            key={group.key}
            icon={group.icon}
            title={group.title}
            subtitle={group.subtitle}
            open={openGroups[group.key]}
            onPress={() =>
              setOpenGroups(current => ({
                ...current,
                [group.key]: !current[group.key],
              }))
            }
          >
            {group.key === 'layout' ? (
              <>
                <Text style={styles.groupTitle}>全局顯示控制</Text>
                <SettingToggle
                  label="底部導航列"
                  value={prefs.visibility.nav}
                  onChange={nav =>
                    onChange({
                      visibility: { ...prefs.visibility, nav },
                    })
                  }
                />
                <SettingToggle
                  label="即時行情"
                  value={prefs.visibility.liveQuote}
                  onChange={liveQuote =>
                    onChange({
                      visibility: { ...prefs.visibility, liveQuote },
                    })
                  }
                />
                <SettingToggle
                  label="今日損益"
                  value={prefs.visibility.todayPnl}
                  onChange={todayPnl =>
                    onChange({
                      visibility: { ...prefs.visibility, todayPnl },
                    })
                  }
                />
                <SettingToggle
                  label="總損益"
                  value={prefs.visibility.totalPnl}
                  onChange={totalPnl =>
                    onChange({
                      visibility: { ...prefs.visibility, totalPnl },
                    })
                  }
                />
                <SettingToggle
                  label="股息資訊"
                  value={prefs.visibility.dividends}
                  onChange={dividends =>
                    onChange({
                      visibility: { ...prefs.visibility, dividends },
                    })
                  }
                />

                <Text style={styles.groupTitle}>各頁面設定模式</Text>
                <View style={styles.choiceWrap}>
                  {(Object.keys(prefs.monitoring.pageCustomize) as PageFieldKey[]).map(page => (
                    <ChoicePill
                      key={page}
                      active={!!prefs.monitoring.pageCustomize[page]}
                      label={page}
                      onPress={() =>
                        patchPageCustomize(
                          page,
                          !prefs.monitoring.pageCustomize[page],
                        )
                      }
                    />
                  ))}
                </View>

                <Text style={styles.groupTitle}>Page Layout / 卡片順序</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pageSelector}
                >
                  {(
                    [
                      ['dashboard', '首頁'],
                      ['ledger', '記帳'],
                      ['portfolio', '庫存'],
                      ['dividend', '股息'],
                      ['calculator', '試算'],
                      ['detail', 'ETF 詳情'],
                    ] as const
                  ).map(([key, label]) => (
                    <ChoicePill
                      key={key}
                      active={selectedPage === key}
                      label={label}
                      onPress={() => setSelectedPage(key)}
                    />
                  ))}
                </ScrollView>

                <View style={styles.cardList}>
                  {pageCards.map((card, index) => (
                    <View key={card.id} style={styles.frameCard}>
                      <View style={styles.frameCardInfo}>
                        <Text style={styles.frameCardTitle}>{card.title}</Text>
                        <Text style={styles.frameCardMeta}>
                          {index + 1} · {card.kind} · {card.fields.length} 欄位 · {card.hidden ? '隱藏' : '顯示'}
                        </Text>
                      </View>
                      <SmallAction
                        label="↑"
                        onPress={() => moveCard(index, -1)}
                      />
                      <SmallAction
                        label="↓"
                        onPress={() => moveCard(index, 1)}
                      />
                      <SmallAction
                        label={card.hidden ? '顯示' : '隱藏'}
                        onPress={() => toggleCardHidden(card.id)}
                      />
                      <Pressable
                        onPress={() => setEditingCardId(card.id)}
                        style={styles.gearButton}
                      >
                        <Text style={styles.gearText}>⚙️</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {group.key === 'monitor' ? (
              <>
                <Text style={styles.groupTitle}>監視器目標</Text>
                <View style={styles.choiceWrap}>
                  <ChoicePill active={monitorTarget === 'appBoard'} label="App 內" onPress={() => setMonitorTarget('appBoard')} />
                  <ChoicePill active={monitorTarget === 'floating'} label="跨 App 浮動" onPress={() => setMonitorTarget('floating')} />
                  <ChoicePill active={monitorTarget === 'widget'} label="Monitor Widget" onPress={() => setMonitorTarget('widget')} />
                </View>

                <SettingToggle
                  label="啟用監視器"
                  note={monitor.title}
                  value={monitor.enabled}
                  onChange={enabled => patchMonitor({ enabled })}
                />
                <SettingToggle
                  label="狀態呼吸燈"
                  value={monitor.showBreathingLight}
                  onChange={showBreathingLight =>
                    patchMonitor({ showBreathingLight })
                  }
                />
                <SettingToggle
                  label="鎖定位置"
                  value={monitor.locked}
                  onChange={locked => patchMonitor({ locked })}
                />
                <SettingToggle
                  label="放開後磁吸"
                  value={monitor.snap}
                  onChange={snap => patchMonitor({ snap })}
                />
                <InlineNumber
                  label="更新頻率"
                  value={monitor.refreshSeconds}
                  min={0}
                  max={3600}
                  step={1}
                  suffix=" 秒"
                  onChange={refreshSeconds => patchMonitor({ refreshSeconds })}
                />
                <InlineNumber
                  label="漲跌幅警報門檻"
                  value={monitor.alertChangePct}
                  min={0}
                  max={20}
                  step={1}
                  suffix="%"
                  onChange={alertChangePct => patchMonitor({ alertChangePct })}
                />
                <InlineNumber
                  label="折溢價警報門檻"
                  value={monitor.alertPremiumPct}
                  min={0}
                  max={10}
                  step={1}
                  suffix="%"
                  onChange={alertPremiumPct => patchMonitor({ alertPremiumPct })}
                />
                <SettingToggle
                  label="警報通知"
                  value={monitor.alertNotification}
                  onChange={alertNotification =>
                    patchMonitor({ alertNotification })
                  }
                />
                <SettingToggle
                  label="警報閃爍"
                  value={monitor.alertFlash}
                  onChange={alertFlash => patchMonitor({ alertFlash })}
                />
                <SettingToggle
                  label="排程顯示"
                  value={monitor.schedule.enabled}
                  onChange={enabled =>
                    patchMonitor({
                      schedule: { ...monitor.schedule, enabled },
                    })
                  }
                />

                <Text style={styles.groupTitle}>觀察清單</Text>
                <View style={styles.choiceWrap}>
                  {availableSymbols.map(symbol => (
                    <ChoicePill
                      key={symbol}
                      active={prefs.watchlistSymbols.includes(symbol)}
                      label={symbol}
                      onPress={() => toggleWatchSymbol(symbol)}
                    />
                  ))}
                </View>

                <Text style={styles.groupTitle}>監視器指定 ETF</Text>
                <View style={styles.choiceWrap}>
                  {availableSymbols.map(symbol => (
                    <ChoicePill
                      key={symbol}
                      active={monitor.selectedSymbols.includes(symbol)}
                      label={symbol}
                      onPress={() => toggleMonitorSymbol(symbol)}
                    />
                  ))}
                </View>

                <SmallAction
                  label="立即刷新行情 / 同步監視器"
                  onPress={() => {
                    void onRefreshQuotes();
                  }}
                />
              </>
            ) : null}

            {group.key === 'visual' ? (
              <>
                <Text style={styles.groupTitle}>佈景主題</Text>
                <View style={styles.choiceWrap}>
                  {THEME_CHOICES.map(([id, label]) => (
                    <ChoicePill
                      key={id}
                      active={prefs.themeId === id}
                      label={label}
                      onPress={() => onChange({ themeId: id })}
                    />
                  ))}
                </View>

                <InlineNumber
                  label="全局卡片透明度"
                  value={prefs.cardOpacity}
                  min={35}
                  max={100}
                  step={5}
                  suffix="%"
                  onChange={cardOpacity => onChange({ cardOpacity })}
                />
                <InlineNumber
                  label="全局卡片圓角"
                  value={prefs.cardRadius}
                  min={0}
                  max={32}
                  step={2}
                  suffix="px"
                  onChange={cardRadius => onChange({ cardRadius })}
                />
                <InlineNumber
                  label="全局字體"
                  value={prefs.fontScale}
                  min={80}
                  max={160}
                  step={5}
                  suffix="%"
                  onChange={fontScale => onChange({ fontScale })}
                />

                <Text style={styles.groupTitle}>頁面 / 卡片背景</Text>
                <View style={styles.actionWrap}>
                  <SmallAction
                    label="選擇頁面背景"
                    onPress={() => {
                      void Promise.resolve(onPickImage()).then(uri => {
                        if (uri) onChange({ backgroundPreset: 'custom', backgroundImageUri: uri });
                      });
                    }}
                  />
                  <SmallAction
                    label="選擇卡片背景"
                    onPress={() => {
                      void Promise.resolve(onPickCardImage()).then(uri => {
                        if (uri) onChange({ cardBackgroundImageUri: uri });
                      });
                    }}
                  />
                  <SmallAction label="清除卡片背景" onPress={onClearCardImage} />
                </View>

                <Text style={styles.groupTitle}>圖表互動</Text>
                <SettingToggle
                  label="單擊切換圖表樣式"
                  value={prefs.chartInteraction.singleTapCycle}
                  onChange={singleTapCycle =>
                    onChange({
                      chartInteraction: {
                        ...prefs.chartInteraction,
                        singleTapCycle,
                      },
                    })
                  }
                />
                <SettingToggle
                  label="雙擊放大"
                  value={prefs.chartInteraction.doubleTapZoom}
                  onChange={doubleTapZoom =>
                    onChange({
                      chartInteraction: {
                        ...prefs.chartInteraction,
                        doubleTapZoom,
                      },
                    })
                  }
                />
                <SettingToggle
                  label="記住圖表樣式"
                  value={prefs.chartInteraction.rememberStyle}
                  onChange={rememberStyle =>
                    onChange({
                      chartInteraction: {
                        ...prefs.chartInteraction,
                        rememberStyle,
                      },
                    })
                  }
                />

                <Text style={styles.groupTitle}>Android Widget</Text>
                <SettingToggle
                  label="啟用 Widget"
                  value={appSettings.widget.enabled}
                  onChange={enabled => onWidgetChange({ enabled })}
                />
                <SettingToggle
                  label="Widget 呼吸燈"
                  value={appSettings.widget.showStatusLight}
                  onChange={showStatusLight => onWidgetChange({ showStatusLight })}
                />
                <SettingToggle
                  label="Widget 走勢圖"
                  value={appSettings.widget.showTrendChart}
                  onChange={showTrendChart => onWidgetChange({ showTrendChart })}
                />
                <InlineNumber
                  label="Widget 字體"
                  value={appSettings.widget.fontScale}
                  min={80}
                  max={160}
                  step={5}
                  suffix="%"
                  onChange={fontScale => onWidgetChange({ fontScale })}
                />
                <InlineNumber
                  label="Widget 背景透明度"
                  value={appSettings.widget.opacity}
                  min={20}
                  max={100}
                  step={5}
                  suffix="%"
                  onChange={opacity => onWidgetChange({ opacity })}
                />
              </>
            ) : null}

            {group.key === 'system' ? (
              <>
                <Text style={styles.groupTitle}>AI 財務助理</Text>
                <SettingToggle
                  label="啟用 AI"
                  value={prefs.ai.enabled}
                  onChange={enabled =>
                    onChange({ ai: { ...prefs.ai, enabled } })
                  }
                />
                <SettingToggle
                  label="各頁標題顯示 AI 入口"
                  value={prefs.ai.showHeaderButton}
                  onChange={showHeaderButton =>
                    onChange({ ai: { ...prefs.ai, showHeaderButton } })
                  }
                />
                <InlineNumber
                  label="AI 文字大小"
                  value={prefs.ai.fontScale}
                  min={80}
                  max={180}
                  step={5}
                  suffix="%"
                  onChange={fontScale =>
                    onChange({ ai: { ...prefs.ai, fontScale } })
                  }
                />

                <Text style={styles.groupTitle}>盤後通知</Text>
                <SettingToggle
                  label="啟用盤後通知"
                  value={appSettings.closeNotification.enabled}
                  onChange={enabled => onNotifyChange({ enabled })}
                />
                <SettingToggle
                  label="僅工作日"
                  value={appSettings.closeNotification.weekdaysOnly}
                  onChange={weekdaysOnly => onNotifyChange({ weekdaysOnly })}
                />
                <TextInput
                  value={appSettings.closeNotification.title}
                  onChangeText={title => onNotifyChange({ title })}
                  style={styles.input}
                  placeholder="通知標題"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                />

                <Text style={styles.groupTitle}>市場數據</Text>
                <SettingToggle
                  label="自動更新行情"
                  value={prefs.market.scheduleEnabled}
                  onChange={scheduleEnabled =>
                    onChange({
                      market: {
                        ...prefs.market,
                        scheduleEnabled,
                        autoRefresh: scheduleEnabled,
                      },
                    })
                  }
                />
                <SettingToggle
                  label="回到前景立即刷新"
                  value={prefs.market.refreshOnForeground}
                  onChange={refreshOnForeground =>
                    onChange({
                      market: { ...prefs.market, refreshOnForeground },
                    })
                  }
                />
                <SettingToggle
                  label="停止全部自動更新"
                  value={prefs.market.stopAll}
                  onChange={stopAll =>
                    onChange({ market: { ...prefs.market, stopAll } })
                  }
                />
                <InlineNumber
                  label="盤中更新頻率"
                  value={prefs.market.live.refreshSeconds}
                  min={1}
                  max={60}
                  step={1}
                  suffix=" 秒"
                  onChange={refreshSeconds =>
                    onChange({
                      market: {
                        ...prefs.market,
                        refreshSeconds,
                        live: { ...prefs.market.live, refreshSeconds },
                      },
                    })
                  }
                />

                <Text style={styles.groupTitle}>OTA 線上更新</Text>
                <SettingToggle
                  label="自動檢查 OTA"
                  value={appSettings.ota.autoCheck}
                  onChange={autoCheck => onOtaChange({ autoCheck })}
                />
                <InlineNumber
                  label="進入 App 後延遲檢查"
                  value={appSettings.ota.delayMinutes}
                  min={1}
                  max={60}
                  step={1}
                  suffix=" 分"
                  onChange={delayMinutes => onOtaChange({ delayMinutes })}
                />
                <SmallAction
                  label="立即檢查線上更新"
                  onPress={() => {
                    void onCheckOta();
                  }}
                />
              </>
            ) : null}

            {group.key === 'data' ? (
              <>
                <Text style={styles.groupTitle}>完整備份</Text>
                <View style={styles.actionWrap}>
                  <SmallAction
                    label="匯出 JSON 完整備份"
                    onPress={() => {
                      void onExportBackup();
                    }}
                  />
                  <SmallAction
                    label="匯入 / 還原 JSON"
                    onPress={() => {
                      void onImportBackup();
                    }}
                  />
                </View>
                <View style={styles.noticeCard}>
                  <Text style={styles.noticeTitle}>CSV</Text>
                  <Text style={styles.noticeText}>
                    目前 App 沒有 canonical CSV 匯入/匯出 callback；為避免用 JSON 假冒 CSV 或破壞 Ledger，本入口暫不執行資料寫入。
                  </Text>
                </View>

                <Text style={styles.groupTitle}>歷史紀錄 / 衍生資料</Text>
                <View style={styles.actionWrap}>
                  <SmallAction
                    label="重新計算衍生資料"
                    onPress={() => {
                      void onRecalculate();
                    }}
                  />
                  <SmallAction
                    label="清除損益快照"
                    danger
                    onPress={() =>
                      Alert.alert(
                        '清除損益快照',
                        '系統會先建立安全備份，再清除每日 / 盤中損益快照。',
                        [
                          { text: '取消', style: 'cancel' },
                          { text: '清除', style: 'destructive', onPress: () => void onClearPnl() },
                        ],
                      )
                    }
                  />
                  <SmallAction
                    label="清除現金進出紀錄"
                    danger
                    onPress={() =>
                      Alert.alert(
                        '清除現金進出紀錄',
                        '系統會先建立安全備份，再移除入金 / 出金紀錄。',
                        [
                          { text: '取消', style: 'cancel' },
                          { text: '清除', style: 'destructive', onPress: () => void onClearCash() },
                        ],
                      )
                    }
                  />
                </View>

                <Text style={styles.groupTitle}>安全備份歷史</Text>
                {safetyBackups.length ? (
                  safetyBackups.map(backup => (
                    <View key={backup.id} style={styles.backupRow}>
                      <View style={styles.backupInfo}>
                        <Text style={styles.backupTitle}>
                          {new Date(backup.createdAt).toLocaleString('zh-TW')}
                        </Text>
                        <Text style={styles.backupMeta}>
                          {backup.kind.toUpperCase()} · {backup.reason} · {backup.count} 筆
                        </Text>
                      </View>
                      <SmallAction
                        label="還原"
                        onPress={() => {
                          void onRestoreSafety(backup.id).then(ok => {
                            if (ok) {
                              Alert.alert('還原完成', '已恢復安全備份。');
                              void refreshSafety();
                            }
                          });
                        }}
                      />
                      <SmallAction
                        label="刪除"
                        danger
                        onPress={() => {
                          void deleteSafetyBackup(backup.id).then(refreshSafety);
                        }}
                      />
                    </View>
                  ))
                ) : (
                  <Text style={styles.helperText}>目前沒有安全備份。</Text>
                )}
              </>
            ) : null}

            {group.key === 'safety' ? (
              <>
                <Text style={styles.groupTitle}>券商 Profile</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pageSelector}
                >
                  {brokerProfiles.map(profile => (
                    <ChoicePill
                      key={profile.id}
                      active={selectedBroker?.id === profile.id}
                      label={profile.name}
                      onPress={() => setSelectedBrokerId(profile.id)}
                    />
                  ))}
                  <SmallAction
                    label="＋ 新增券商"
                    onPress={() => {
                      const profile = createBrokerProfile();
                      onBrokerProfilesChange([...brokerProfiles, profile]);
                      setSelectedBrokerId(profile.id);
                    }}
                  />
                </ScrollView>

                {selectedBroker ? (
                  <View style={styles.brokerPanel}>
                    <TextInput
                      value={selectedBroker.name}
                      onChangeText={name => patchBroker({ name })}
                      style={styles.input}
                      placeholder="券商名稱"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                    />
                    <TextInput
                      value={String(selectedBroker.commissionRate)}
                      onChangeText={value =>
                        patchBroker({ commissionRate: Math.max(0, Number(value) || 0) })
                      }
                      keyboardType="decimal-pad"
                      style={styles.input}
                      placeholder="手續費率"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                    />
                    <TextInput
                      value={String(selectedBroker.commissionDiscount)}
                      onChangeText={value =>
                        patchBroker({ commissionDiscount: Math.max(0, Number(value) || 0) })
                      }
                      keyboardType="decimal-pad"
                      style={styles.input}
                      placeholder="手續費折扣"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                    />
                    <View style={styles.actionWrap}>
                      <SmallAction
                        label={defaultBrokerProfileId === selectedBroker.id ? '✓ App 預設' : '設為 App 預設'}
                        onPress={() => onDefaultBrokerProfileChange(selectedBroker.id)}
                      />
                    </View>
                  </View>
                ) : null}

                <View style={styles.dataSafetyCard}>
                  <View style={styles.dataSafetyText}>
                    <Text style={styles.dataSafetyTitle}>
                      {accountingResetLabel}
                    </Text>
                    <Text style={styles.dataSafetySubtitle}>
                      {accountingResetFailSafe}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        accountingResetLabel,
                        `${accountingResetFailSafe}\n\n此動作會清除買賣、現金、配息入帳、庫存與損益快照，但保留 App 設定與版面。確定繼續？`,
                        [
                          { text: '取消', style: 'cancel' },
                          {
                            text: accountingResetLabel,
                            style: 'destructive',
                            onPress: () => {
                              void onClearAccountingData();
                            },
                          },
                        ],
                      )
                    }
                    style={styles.dangerButton}
                  >
                    <Text style={styles.dangerButtonText}>
                      {accountingResetLabel}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </AccordionCard>
        ))}
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
    ...V3_THEME.shadow,
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

  dataSafetyCard: {
    marginTop: V3_THEME.spacing.xxl,
    borderRadius: V3_THEME.radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255,91,100,0.24)',
    backgroundColor: 'rgba(255,91,100,0.06)',
    padding: V3_THEME.spacing.lg,
  },
  dataSafetyText: {
    marginBottom: V3_THEME.spacing.md,
  },
  dataSafetyTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  dataSafetySubtitle: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    lineHeight: 16,
  },
  dangerButton: {
    minHeight: 42,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,91,100,0.30)',
    backgroundColor: 'rgba(255,91,100,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dangerButtonText: {
    color: '#FF7580',
    fontSize: 11,
    fontWeight: '900',
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

  toolboxList: {
    gap: V3_THEME.spacing.md,
  },
  toolboxCard: {
    borderRadius: V3_THEME.radius.card,
    borderWidth: V3_THEME.border.width,
    borderColor: V3_THEME.border.color,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    overflow: 'hidden',
  },
  toolboxHeader: {
    minHeight: 76,
    paddingHorizontal: V3_THEME.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolboxIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V3_THEME.colors.accentSoft,
  },
  toolboxIconText: {
    fontSize: 20,
  },
  toolboxHeaderText: {
    flex: 1,
    minWidth: 0,
    marginLeft: V3_THEME.spacing.md,
  },
  toolboxTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  toolboxSubtitle: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
  },
  toolboxChevron: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 18,
    fontWeight: '700',
  },
  toolboxBody: {
    paddingHorizontal: V3_THEME.spacing.lg,
    paddingBottom: V3_THEME.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: V3_THEME.colors.borderGlow,
  },
  settingRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: V3_THEME.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  settingRowText: {
    flex: 1,
    minWidth: 0,
  },
  settingRowLabel: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  settingRowNote: {
    marginTop: 3,
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: V3_THEME.spacing.sm,
  },
  choicePill: {
    minHeight: 34,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choicePillActive: {
    backgroundColor: V3_THEME.colors.accentSoft,
    borderColor: 'rgba(79,209,165,0.32)',
  },
  choicePillText: {
    color: V3_THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  choicePillTextActive: {
    color: V3_THEME.colors.accent,
  },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: V3_THEME.spacing.sm,
  },
  smallAction: {
    minHeight: 34,
    borderRadius: V3_THEME.radius.pill,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionDanger: {
    borderColor: 'rgba(255,91,100,0.30)',
    backgroundColor: 'rgba(255,91,100,0.10)',
  },
  smallActionText: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  smallActionDangerText: {
    color: '#FF7580',
  },
  inlineStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  inlineStepperValue: {
    minWidth: 34,
    textAlign: 'center',
    color: V3_THEME.colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  noticeCard: {
    marginTop: V3_THEME.spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#F8FAFC',
    padding: V3_THEME.spacing.md,
  },
  noticeTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  noticeText: {
    marginTop: 4,
    color: V3_THEME.colors.textSecondary,
    fontSize: 9,
    lineHeight: 14,
  },
  backupRow: {
    minHeight: 62,
    marginTop: V3_THEME.spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: V3_THEME.colors.surfaceGlass,
    padding: V3_THEME.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: V3_THEME.spacing.sm,
  },
  backupInfo: {
    flex: 1,
    minWidth: 0,
  },
  backupTitle: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  backupMeta: {
    marginTop: 3,
    color: V3_THEME.colors.textSecondary,
    fontSize: 8,
  },
  brokerPanel: {
    marginTop: V3_THEME.spacing.md,
    gap: V3_THEME.spacing.sm,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.28)',
    justifyContent: 'flex-end',
  },
  editorSheet: {
    maxHeight: '94%',
    minHeight: '72%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: V3_THEME.colors.borderGlow,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...V3_THEME.shadow,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginTop: 9,
    backgroundColor: '#CBD5E1',
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
    backgroundColor: '#F8FAFC',
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: V3_THEME.colors.primary,
  },
  footerSecondaryText: {
    color: V3_THEME.colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  footerPrimaryText: {
    color: '#FFFFFF',
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
