import React, { useMemo, useRef } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MiniLayoutType, TemplateModeConfig, WindowRect } from '../../types/monitor';

interface MiniMonitorContainerProps {
  layout: WindowRect;
  config: TemplateModeConfig;
  values: Record<string, React.ReactNode>;
  onRestoreNormalLayout: () => void;
  onControlPress?: (field: string) => void;
}

const DOUBLE_TAP_MS = 360;

const layoutStyle = (type: MiniLayoutType) => {
  switch (type) {
    case 'SINGLE_ROW': return styles.singleRow;
    case 'DUAL_ROW': return styles.dualRow;
    case 'LIST': return styles.list;
    case 'MINI_CARD': return styles.miniCard;
    case 'GRID': return styles.grid;
  }
};

export function MiniMonitorContainer({ layout, config, values, onRestoreNormalLayout, onControlPress }: MiniMonitorContainerProps) {
  const lastTapAt = useRef(0);
  const fields = useMemo(() => {
    const enabled = new Set(config.displayFields);
    const ordered = config.fieldOrder.filter(field => enabled.has(field));
    return ordered.slice(0, Math.max(1, config.maxDisplayCount));
  }, [config.displayFields, config.fieldOrder, config.maxDisplayCount]);

  const onDoubleClick = () => {
    const now = Date.now();
    if (now - lastTapAt.current <= DOUBLE_TAP_MS) {
      lastTapAt.current = 0;
      onRestoreNormalLayout();
      return;
    }
    lastTapAt.current = now;
  };

  const stopControlPropagation = (event: GestureResponderEvent, field: string) => {
    event.stopPropagation();
    onControlPress?.(field);
  };

  return (
    <Pressable
      accessibilityLabel="Mini Monitor"
      onPress={onDoubleClick}
      style={[
        styles.root,
        { width: layout.width, minHeight: layout.height, backgroundColor: config.backgroundColor, opacity: config.opacity,
          borderRadius: config.borderRadius, borderWidth: config.borderWidth, borderColor: config.borderColor,
          padding: Math.max(2, config.itemSpacing) },
      ]}
    >
      <View style={[styles.flow, layoutStyle(config.layoutType), { gap: config.itemSpacing }]}>
        {fields.map(field => (
          <Pressable key={field} onPress={event => stopControlPropagation(event, field)} style={styles.item}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: config.fontSize, textAlign: config.textAlign }}>
              {values[field] ?? '—'}
            </Text>
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  flow: { width: '100%', flexGrow: 1 },
  singleRow: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center' },
  dualRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  list: { flexDirection: 'column', flexWrap: 'nowrap' },
  miniCard: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start' },
  item: { minWidth: 54, flexGrow: 1, flexShrink: 1 },
});
