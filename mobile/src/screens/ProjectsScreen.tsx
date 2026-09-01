import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../components/themed';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProjects } from '../api/queries';
import type { Project } from '../api/types';
import { OfflineBanner } from '../components/OfflineBanner';
import { DelayedBadge, StatusBadge } from '../components/StatusBadge';
import { Progress } from '../components/Progress';
import { Empty, ErrorView, Spinner } from '../components/ui';
import { num } from '../lib/money';
import { colors, ft, numFont, sh } from '../theme';
import type { RootStackParamList } from '../navigation/types';

const FILTERS = [
  { code: '', label: '전체' },
  { code: 'URGENT', label: '긴급' },
  { code: 'ACTIVE', label: '진행' },
  { code: 'PLANNED', label: '예정' },
  { code: 'ON_HOLD', label: '보류' },
  { code: 'DONE', label: '완료' },
];

/** 프로젝트 목록 — 웹 projects 페이지의 카드 그리드를 1열로. 긴급 > 지연 > 나머지 순 */
export function ProjectsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const q = useProjects();
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const all = (q.data ?? []).filter((p) => !filter || p.status === filter);
    const rank = (p: Project) => (p.status === 'URGENT' ? 0 : p.isDelayed ? 1 : 2);
    return [...all].sort((a, b) => rank(a) - rank(b));
  }, [q.data, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner dataUpdatedAt={q.dataUpdatedAt || undefined} />

      <View style={s.filterRow}>
        {FILTERS.map((f) => {
          const on = filter === f.code;
          return (
            <Pressable key={f.code} onPress={() => setFilter(f.code)} style={[s.filterChip, on && s.filterOn]} hitSlop={4}>
              <Text style={[{ fontSize: 13, color: on ? '#fff' : colors.inkMute }, on ? ft.bold : ft.semibold]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {q.isLoading ? (
        <Spinner />
      ) : q.isError && !q.data ? (
        <ErrorView
          message={q.error instanceof Error ? q.error.message : '프로젝트를 불러오지 못했습니다'}
          onRetry={() => q.refetch()}
        />
      ) : !rows.length ? (
        <Empty>{filter ? '해당 상태의 프로젝트가 없습니다' : '참여 중인 프로젝트가 없습니다'}</Empty>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.brand} />
          }
          renderItem={({ item: p }) => (
            <Pressable style={s.card} onPress={() => nav.navigate('ProjectDetail', { projectId: p.id, name: p.name })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <StatusBadge kind="PROJECT_STATUS" code={p.status} />
                {p.isDelayed && <DelayedBadge />}
                <Text style={[s.code, numFont]}>{p.code}</Text>
              </View>
              <Text style={[s.name, ft.bold]} numberOfLines={1}>
                {p.name}
              </Text>
              {!!p.goal && (
                <Text style={s.goal} numberOfLines={2}>
                  {p.goal}
                </Text>
              )}
              <View style={{ marginTop: 8 }}>
                <Progress value={p.progress} />
              </View>
              <View style={s.metaBox}>
                <MetaRow label="기간" value={fmtRange(p.startDate, p.planEndDate)} />
                <MetaRow label="담당" value={[p.leadDepartment?.name, p.owner?.name].filter(Boolean).join(' · ') || '—'} />
                <MetaRow label="수주금액" value={`${num(p.contractAmount)}원`} numeric />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const sd = (iso: string | null): string => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '—');
const fmtRange = (a: string | null, b: string | null) => `${sd(a)} ~ ${sd(b)}`;

function MetaRow({ label, value, numeric }: { label: string; value: string; numeric?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={[s.metaValue, numeric && numFont]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.bg,
  },
  filterChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: colors.fill,
  },
  filterOn: { backgroundColor: colors.ink },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 15,
    gap: 6,
    ...sh.card,
  },
  code: { marginLeft: 'auto', fontSize: 12, color: colors.inkFaint },
  name: { fontSize: 16, color: colors.ink },
  goal: { fontSize: 13, lineHeight: 19, color: colors.inkMute },
  metaBox: { marginTop: 8, gap: 4 },
  metaLabel: { width: 58, fontSize: 12.5, color: colors.inkFaint },
  metaValue: { flex: 1, fontSize: 12.5, color: colors.inkMute },
});
