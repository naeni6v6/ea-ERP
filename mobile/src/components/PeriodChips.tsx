import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from './ui';
import { lastDayOf, shiftMonth, todaySeoul } from '../lib/dates';

export type PeriodKey = 'this_month' | 'last_month' | 'recent_3m' | 'this_year';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'this_month', label: '이번 달' },
  { key: 'last_month', label: '지난 달' },
  { key: 'recent_3m', label: '최근 3개월' },
  { key: 'this_year', label: '올해' },
];

/** 기간 프리셋 → from/to (KST) — 웹 전역 필터의 프리셋을 모바일에 맞게 추린 것 */
export function resolvePeriod(key: PeriodKey): { from: string; to: string } {
  const today = todaySeoul();
  const ym = today.slice(0, 7);
  if (key === 'this_month') return { from: `${ym}-01`, to: today };
  if (key === 'last_month') {
    const prev = shiftMonth(ym, -1);
    return { from: `${prev}-01`, to: `${prev}-${String(lastDayOf(prev)).padStart(2, '0')}` };
  }
  if (key === 'recent_3m') return { from: `${shiftMonth(ym, -2)}-01`, to: today };
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

export function PeriodChips({ value, onChange }: { value: PeriodKey; onChange: (k: PeriodKey) => void }) {
  return (
    <View style={s.row}>
      {PERIODS.map((p) => (
        <Chip key={p.key} label={p.label} on={p.key === value} onPress={() => onChange(p.key)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
