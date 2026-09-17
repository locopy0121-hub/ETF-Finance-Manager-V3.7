import React, { useRef } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MonitorTemplate } from '../../types/monitor';

const SHORT_PRESS_MAX_MS = 300;
const LONG_PRESS_MIN_MS = 500;

interface TemplateCardProps {
  template: MonitorTemplate;
  active?: boolean;
  onApply: (templateId: string) => void;
  onEdit: (template: MonitorTemplate) => void;
}

export function TemplateCard({ template, active = false, onApply, onEdit }: TemplateCardProps) {
  const pressStartedAt = useRef(0);
  const longPressHandled = useRef(false);

  const handlePressIn = () => {
    pressStartedAt.current = Date.now();
    longPressHandled.current = false;
  };

  const handleLongPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    if (Date.now() - pressStartedAt.current < LONG_PRESS_MIN_MS) return;
    longPressHandled.current = true;
    onEdit(template);
  };

  const handlePress = () => {
    if (longPressHandled.current) return;
    const duration = Date.now() - pressStartedAt.current;
    if (duration <= SHORT_PRESS_MAX_MS) onApply(template.id);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${template.name} 模板`}
      delayLongPress={LONG_PRESS_MIN_MS}
      onPressIn={handlePressIn}
      onLongPress={handleLongPress}
      onPress={handlePress}
      style={[styles.card, active && styles.active]}
    >
      <View style={styles.row}>
        <Text style={styles.title}>{template.name}</Text>
        {template.isDefault ? <Text style={styles.badge}>預設</Text> : null}
      </View>
      <Text style={styles.hint}>短按套用 · 長按編輯</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,.18)' },
  active: { borderWidth: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '700' },
  badge: { fontSize: 10, opacity: 0.72 },
  hint: { marginTop: 4, fontSize: 10, opacity: 0.62 },
});
