import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LayoutMode, MiniLayoutType, MonitorTemplate, TemplateModeConfig } from '../../types/monitor';

const LAYOUT_TYPES: MiniLayoutType[] = ['SINGLE_ROW', 'DUAL_ROW', 'LIST', 'MINI_CARD', 'GRID'];

interface TemplateEditorModalProps {
  visible: boolean;
  template: MonitorTemplate | null;
  availableFields: string[];
  onSave: (template: MonitorTemplate) => void;
  onResetToDefault: (templateId: string) => void;
  onClose: () => void;
}

const numberValue = (value: string, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

export function TemplateEditorModal({ visible, template, availableFields, onSave, onResetToDefault, onClose }: TemplateEditorModalProps) {
  const [draft, setDraft] = useState<MonitorTemplate | null>(template);
  const [mode, setMode] = useState<LayoutMode>('NORMAL');
  useEffect(() => setDraft(template), [template]);

  const config = useMemo(() => draft ? (mode === 'NORMAL' ? draft.normalConfig : draft.miniConfig) : null, [draft, mode]);
  if (!draft || !config) return null;

  const patchConfig = (patch: Partial<TemplateModeConfig>) => {
    setDraft(current => current ? {
      ...current,
      ...(mode === 'NORMAL'
        ? { normalConfig: { ...current.normalConfig, ...patch } }
        : { miniConfig: { ...current.miniConfig, ...patch } }),
    } : current);
  };

  const toggleField = (field: string) => {
    const enabled = config.displayFields.includes(field);
    const displayFields = enabled ? config.displayFields.filter(x => x !== field) : [...config.displayFields, field];
    const fieldOrder = enabled ? config.fieldOrder.filter(x => x !== field) : [...config.fieldOrder, field];
    patchConfig({ displayFields, fieldOrder });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>{draft.name}</Text>
            <Pressable onPress={onClose}><Text>關閉</Text></Pressable>
          </View>
          <View style={styles.segment}>
            {(['NORMAL', 'MINI'] as LayoutMode[]).map(item => (
              <Pressable key={item} onPress={() => setMode(item)} style={[styles.segmentButton, mode === item && styles.selected]}>
                <Text>{item === 'NORMAL' ? '一般模式' : '縮小模式'}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.section}>顯示欄位與順序</Text>
            <View style={styles.wrap}>
              {availableFields.map(field => (
                <Pressable key={field} onPress={() => toggleField(field)} style={[styles.chip, config.displayFields.includes(field) && styles.selected]}>
                  <Text>{field}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.section}>排列方式</Text>
            <View style={styles.wrap}>
              {LAYOUT_TYPES.map(layoutType => (
                <Pressable key={layoutType} onPress={() => patchConfig({ layoutType })} style={[styles.chip, config.layoutType === layoutType && styles.selected]}>
                  <Text>{layoutType}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.section}>字體 / 間距 / 最大顯示數</Text>
            <View style={styles.row}>
              <TextInput keyboardType="numeric" value={String(config.fontSize)} onChangeText={v => patchConfig({ fontSize: numberValue(v, config.fontSize, 6, 48) })} style={styles.input} />
              <TextInput keyboardType="numeric" value={String(config.itemSpacing)} onChangeText={v => patchConfig({ itemSpacing: numberValue(v, config.itemSpacing, 0, 48) })} style={styles.input} />
              <TextInput keyboardType="numeric" value={String(config.maxDisplayCount)} onChangeText={v => patchConfig({ maxDisplayCount: numberValue(v, config.maxDisplayCount, 1, 30) })} style={styles.input} />
            </View>
            <Text style={styles.section}>對齊</Text>
            <View style={styles.wrap}>
              {(['left', 'center', 'right'] as const).map(textAlign => (
                <Pressable key={textAlign} onPress={() => patchConfig({ textAlign })} style={[styles.chip, config.textAlign === textAlign && styles.selected]}><Text>{textAlign}</Text></Pressable>
              ))}
            </View>
            <Text style={styles.section}>背景 / 邊框</Text>
            <TextInput value={config.backgroundColor} onChangeText={backgroundColor => patchConfig({ backgroundColor })} style={styles.inputWide} placeholder="背景色" />
            <TextInput value={config.borderColor} onChangeText={borderColor => patchConfig({ borderColor })} style={styles.inputWide} placeholder="邊框色" />
            <View style={styles.row}>
              <TextInput keyboardType="numeric" value={String(config.opacity)} onChangeText={v => patchConfig({ opacity: numberValue(v, config.opacity, 0, 1) })} style={styles.input} />
              <TextInput keyboardType="numeric" value={String(config.borderRadius)} onChangeText={v => patchConfig({ borderRadius: numberValue(v, config.borderRadius, 0, 64) })} style={styles.input} />
              <TextInput keyboardType="numeric" value={String(config.borderWidth)} onChangeText={v => patchConfig({ borderWidth: numberValue(v, config.borderWidth, 0, 12) })} style={styles.input} />
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={() => onResetToDefault(draft.id)} style={styles.action}><Text>恢復預設</Text></Pressable>
            <Pressable onPress={() => onSave(draft)} style={[styles.action, styles.selected]}><Text>儲存模板</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.65)', justifyContent: 'center', padding: 18 },
  panel: { maxHeight: '88%', borderRadius: 18, backgroundColor: '#111827', padding: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  segment: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  segmentButton: { flex: 1, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', borderRadius: 9 },
  selected: { backgroundColor: 'rgba(58,199,255,.22)', borderColor: '#3AC7FF' },
  body: { gap: 8, paddingBottom: 12 },
  section: { marginTop: 8, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', borderRadius: 8 },
  row: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minWidth: 70, borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', borderRadius: 8, padding: 8 },
  inputWide: { borderWidth: 1, borderColor: 'rgba(255,255,255,.16)', borderRadius: 8, padding: 8 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  action: { paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', borderRadius: 9 },
});
