import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import type { PulseStatus } from '../../types/monitor';

interface PulseLightProps {
  status: PulseStatus;
  intervalMs: number;
  onManualRefresh?: () => void;
}

export function PulseLight({ status, intervalMs, onManualRefresh }: PulseLightProps) {
  const opacity = useRef(new Animated.Value(0.18)).current;

  useEffect(() => {
    opacity.stopAnimation();
    if (status === 'PAUSED') {
      opacity.setValue(0.08);
      return;
    }
    if (status === 'REFRESHING') {
      Animated.timing(opacity, { toValue: 1, duration: 90, useNativeDriver: true }).start();
      return;
    }
    if (status === 'ERROR') {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.22, duration: 260, useNativeDriver: true }),
      ]).start();
      return;
    }
    Animated.timing(opacity, {
      toValue: 0.18,
      duration: Math.max(120, intervalMs - 100),
      useNativeDriver: true,
    }).start();
  }, [intervalMs, opacity, status]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`監控器更新狀態 ${status}`} onPress={onManualRefresh}>
      <Animated.View style={[styles.light, { opacity }, status === 'PAUSED' && styles.paused]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  light: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3AC7FF' },
  paused: { backgroundColor: '#64748B' },
});
