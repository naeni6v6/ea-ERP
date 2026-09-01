import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './themed';
import { colors, ft } from '../theme';

/**
 * 용도 선택.
 * 가로 스크롤은 스크롤바가 없어 뒤쪽 항목이 있는지 알 수 없다 —
 * 목록은 항상 줄바꿈(wrap)으로 전부 펼쳐 보여준다.
 */
export function PurposeChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.wrapRow}>
      {options.map((p) => {
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
      })}
    </View>
  );
}

/**
 * 접었다 펴는 용도 선택 — 목록 행처럼 자리가 좁은 곳에서 쓴다.
 * 닫혀 있을 때는 고른 용도(또는 안내)만 한 줄로 보이고, 누르면 전체 목록이 펼쳐진다.
 */
export function PurposePicker({
  options,
  value,
  onChange,
  placeholder = '용도 선택',
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <View style={{ gap: 8 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [s.field, open && s.fieldOpen, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[s.fieldText, value ? { color: colors.ink, ...ft.semibold } : null]} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkFaint} />
      </Pressable>

      {open && (
        <PurposeChips
          options={options}
          value={value}
          onChange={(p) => {
            onChange(p);
            setOpen(false);
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: colors.fill,
  },
  chipOn: { backgroundColor: colors.brandSoft },
  label: { fontSize: 14, color: colors.inkMute },
  labelOn: { color: colors.brandDeep, ...ft.bold },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.fill,
  },
  fieldOpen: { backgroundColor: colors.brandSoft },
  fieldText: { flex: 1, fontSize: 14, color: colors.inkFaint },
});
