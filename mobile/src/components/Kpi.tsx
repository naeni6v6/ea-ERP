import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import { card, colors, ft, numFont, tight } from '../theme';
import { compact, won, type Money } from '../lib/money';

/** KPI 카드 — 웹과 같은 패턴: 큰 글씨는 억/만 축약, 아래 작은 글씨로 정확한 원 병기 */
export function Kpi({ label, value, tone }: { label: string; value: Money; tone?: 'pos' | 'neg' }) {
  const color = tone === 'pos' ? colors.pos : tone === 'neg' ? colors.neg : colors.ink;
  return (
    <View style={s.card}>
      <Text style={[s.label, ft.medium]}>{label}</Text>
      <Text style={[s.value, ft.extrabold, numFont, tight, { color }]}>{compact(value)}</Text>
      <Text style={[s.exact, numFont]}>{won(value)}</Text>
    </View>
  );
}

/** 2열 KPI 그리드 */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={s.grid}>{children}</View>;
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...card,
  },
  label: { fontSize: 12.5, color: colors.inkFaint },
  value: { fontSize: 24, marginTop: 6, lineHeight: 30 },
  exact: { fontSize: 11.5, color: colors.inkFaint, marginTop: 2 },
});
