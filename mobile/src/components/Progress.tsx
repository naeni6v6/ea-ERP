import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import { colors, ft, numFont } from '../theme';

/** 진행률 막대 — 웹과 같은 바이올렛(viz) 팔레트 */
export function Progress({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={s.row}>
      <View style={s.track}>
        <View style={[s.fill, { width: `${v}%` }]} />
      </View>
      {showLabel && <Text style={[s.label, ft.semibold, numFont]}>{Math.round(v)}%</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.vizSoft,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.viz },
  label: { fontSize: 12, color: colors.inkMute, minWidth: 34, textAlign: 'right' },
});
