import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import { colors, ft } from '../theme';
import { useCodeLabel } from '../api/queries';

/** 프로젝트·태스크 상태 배지 — 웹 ui.tsx STATUS_TONE과 동일 색 규칙, 라벨은 코드값 */
const TONE: Record<string, { bg: string; fg: string }> = {
  URGENT: { bg: colors.urgent, fg: '#fff' },
  ACTIVE: { bg: colors.brandSoft, fg: colors.brandDeep },
  PLANNED: { bg: colors.bgSoft, fg: colors.inkMute },
  ON_HOLD: { bg: colors.warnSoft, fg: colors.warn },
  DONE: { bg: colors.posSoft, fg: colors.pos },
  CANCELLED: { bg: colors.bgSoft, fg: colors.inkFaint },
  TODO: { bg: colors.bgSoft, fg: colors.inkMute },
  IN_PROGRESS: { bg: colors.brandSoft, fg: colors.brandDeep },
  REVIEW: { bg: colors.warnSoft, fg: colors.warn },
};

export function StatusBadge({ kind, code }: { kind: 'PROJECT_STATUS' | 'TASK_STATUS'; code: string }) {
  const label = useCodeLabel();
  const t = TONE[code] ?? { bg: colors.bgSoft, fg: colors.inkMute };
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.text, code === 'URGENT' ? ft.bold : ft.semibold, { color: t.fg }]}>
        {label(kind, code)}
      </Text>
    </View>
  );
}

/** "지연" 강조 배지 */
export function DelayedBadge() {
  return (
    <View style={[s.badge, { backgroundColor: colors.negSoft }]}>
      <Text style={[s.text, ft.bold, { color: colors.neg }]}>지연</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: { fontSize: 11.5, lineHeight: 15 },
});
