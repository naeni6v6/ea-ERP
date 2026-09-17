import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './themed';
import { brandGradient, card, colors, ft, sh, tight } from '../theme';
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
          <Text style={{ color: colors.ink, ...ft.semibold }}>다시 시도</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * 화면 안의 묶음 제목 — 제목 한 줄 + (선택) 설명 + (선택) 오른쪽 링크.
 * 색 막대 같은 장식 없이 굵기·자간만으로 위계를 낸다. 모든 화면이 이것을 쓴다.
 */
export function Section({
  title,
  desc,
  right,
  onMore,
  moreLabel = '전체 보기',
  children,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
  onMore?: () => void;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={s.sectionHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.sectionTitle, ft.extrabold, tight]}>{title}</Text>
          {!!desc && <Text style={s.sectionDesc}>{desc}</Text>}
        </View>
        {right}
        {onMore && (
          <Pressable onPress={onMore} hitSlop={8}>
            <Text style={[{ fontSize: 13, color: colors.brandDeep }, ft.semibold]}>{moreLabel} ›</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

/** 카드 안의 작은 제목 — 섹션 제목보다 한 단계 아래 */
export function CardTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.cardTitleRow}>
      <Text style={[s.cardTitle, ft.bold]}>{children}</Text>
      {right}
    </View>
  );
}

/**
 * 선택 칩 — 필터·기간 등. 켜진 칩은 먹색 알약, 꺼진 칩은 흰 바탕에 옅은 윤곽선.
 * 회색 면 칩보다 배경과 분리돼 보여 화면이 정돈된다.
 */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} hitSlop={4} accessibilityState={{ selected: on }}>
      <Text style={[{ fontSize: 13, color: on ? '#fff' : colors.inkMute }, on ? ft.bold : ft.semibold]}>{label}</Text>
    </Pressable>
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
    <View style={[s.statusChip, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: 12, ...ft.bold }}>{c.label}</Text>
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
      style={({ pressed }) => [s.primaryWrap, !off && sh.glow, off && { opacity: 0.45 }, pressed && !off && { opacity: 0.85 }, style]}
    >
      {/* 웹 아바타와 같은 from-brand to-brand-dark 사선 그라데이션 */}
      <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.primaryBtn}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontSize: 16, ...ft.bold }}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  errorBox: {
    margin: 16,
    padding: 14,
    borderRadius: 14,
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
    ...card,
    borderRadius: 12,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 17, color: colors.ink },
  sectionDesc: { fontSize: 12.5, color: colors.inkFaint, marginTop: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 14.5, color: colors.ink },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  statusChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  primaryWrap: { borderRadius: 16 },
  primaryBtn: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
