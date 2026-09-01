import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from './themed';
import { colors, ft } from '../theme';

/** 용도 칩 선택 — 수기 입력 대신 목록에서 고른다. 가로 스크롤(인라인) / 줄바꿈(상세) 두 모드 */
export function PurposeChips({
  options,
  value,
  onChange,
  wrap = false,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  wrap?: boolean;
}) {
  const chips = options.map((p) => {
    const on = p === value;
    return (
      <Pressable
        key={p}
        onPress={() => onChange(p)}
        style={[s.chip, on && s.chipOn]}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
      >
        <Text style={[s.label, on && s.labelOn]}>{p}</Text>
      </Pressable>
    );
  });

  if (wrap) {
    return <ScrollView contentContainerStyle={s.wrapRow} scrollEnabled={false}>{chips}</ScrollView>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {chips}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { gap: 6, paddingVertical: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: colors.bgSoft,
  },
  chipOn: { backgroundColor: colors.brandSoft },
  label: { fontSize: 14, color: colors.inkMute },
  labelOn: { color: colors.brandDeep, ...ft.bold },
});
