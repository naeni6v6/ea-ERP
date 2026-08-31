import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';
import type { CardExpenseStatus } from '../api/types';

/** 공용 소품 — 터치 영역 최소 44pt, 한국어 존댓말 */

export function Spinner() {
  return (
    <View style={{ paddingVertical: 32, alignItems: 'center' }}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <Text style={{ color: colors.inkFaint, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.errorBox}>
      <Text style={{ color: colors.neg, fontSize: 14, lineHeight: 20 }}>{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={s.retryBtn} hitSlop={8}>
          <Text style={{ color: colors.ink, fontWeight: '600' }}>다시 시도</Text>
        </Pressable>
      )}
    </View>
  );
}

const STATUS: Record<CardExpenseStatus, { label: string; fg: string; bg: string; border: string }> = {
  PENDING: { label: '미제출', fg: colors.warn, bg: colors.warnSoft, border: '#ecd9ae' },
  SUBMITTED: { label: '승인 대기', fg: colors.brandDeep, bg: colors.brandSoft, border: '#f3cf9c' },
  CONFIRMED: { label: '승인 완료', fg: colors.pos, bg: colors.posSoft, border: '#bcdfcc' },
  REJECTED: { label: '반려', fg: colors.neg, bg: colors.negSoft, border: '#f0c4bc' },
  EXCLUDED: { label: '제외', fg: colors.inkFaint, bg: colors.bgSoft, border: colors.line },
};

export function StatusChip({ status }: { status: CardExpenseStatus }) {
  const c = STATUS[status];
  return (
    <View style={[s.chip, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>{c.label}</Text>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  busy,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [s.primaryBtn, off && { opacity: 0.45 }, pressed && !off && { opacity: 0.85 }, style]}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{title}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  errorBox: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0c4bc',
    backgroundColor: colors.negSoft,
    gap: 10,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
  },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
