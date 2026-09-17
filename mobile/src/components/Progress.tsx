import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './themed';
import { colors, ft, numFont } from '../theme';

/** 진행률 막대 — 웹과 같은 바이올렛(viz) 그라데이션. 100%면 초록으로 마무리 */
export function Progress({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const done = v >= 100;
  return (
    <View style={s.row}>
      <View style={s.track}>
        <LinearGradient
          colors={done ? [colors.pos, '#4fb07a'] : [colors.viz, colors.vizLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.fill, { width: `${v}%` }]}
        />
      </View>
      {showLabel && <Text style={[s.label, ft.semibold, numFont, done && { color: colors.pos }]}>{Math.round(v)}%</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.vizSoft,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999 },
  label: { fontSize: 12, color: colors.inkMute, minWidth: 34, textAlign: 'right' },
});
