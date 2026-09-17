import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/themed';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProjects } from '../api/queries';
import type { Project } from '../api/types';
import { OfflineBanner } from '../components/OfflineBanner';
import { DelayedBadge, StatusBadge } from '../components/StatusBadge';
import { Progress } from '../components/Progress';
import { Chip, Empty, ErrorView, Spinner } from '../components/ui';
import { compact, num } from '../lib/money';
import { card, colors, ft, numFont, tight } from '../theme';
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

      {/* 상태 필터 — 가로로 넘겨 본다 (좁은 화면에서 줄바꿈되지 않게) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterRow}
      >
        {FILTERS.map((f) => (
          <Chip key={f.code} label={f.label} on={filter === f.code} onPress={() => setFilter(f.code)} />
        ))}
      </ScrollView>

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
          contentContainerStyle={{ padding: 16, paddingTop: 6, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.brand} />
          }
          renderItem={({ item: p }) => (
            <Pressable
              style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
              onPress={() => nav.navigate('ProjectDetail', { projectId: p.id, name: p.name })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <StatusBadge kind="PROJECT_STATUS" code={p.status} />
                {p.isDelayed && <DelayedBadge />}
                <Text style={[s.code, numFont]}>{p.code}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.name, ft.extrabold, tight]} numberOfLines={1}>
                  {p.name}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.inkFaint} />
              </View>
              {!!p.goal && (
                <Text style={s.goal} numberOfLines={2}>
                  {p.goal}
                </Text>
              )}
              <View style={{ marginTop: 6 }}>
                <Progress value={p.progress} />
              </View>
              <View style={s.metaRow}>
                <Meta icon="calendar-outline" text={fmtRange(p.startDate, p.planEndDate)} />
                <Meta icon="person-outline" text={[p.leadDepartment?.name, p.owner?.name].filter(Boolean).join(' · ') || '담당 미정'} />
                <Meta icon="cash-outline" text={`${compact(p.contractAmount)}원`} numeric title={`${num(p.contractAmount)}원`} />
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const sd = (iso: string | null): string => (iso ? iso.slice(2, 10).replace(/-/g, '.') : '미정');
const fmtRange = (a: string | null, b: string | null) => `${sd(a)} ~ ${sd(b)}`;

function Meta({
  icon,
  text,
  numeric,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  numeric?: boolean;
  title?: string;
}) {
  return (
    <View style={s.meta} accessibilityLabel={title}>
      <Ionicons name={icon} size={13} color={colors.inkFaint} />
      <Text style={[s.metaText, numeric && numFont]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  // 가로 스크롤뷰는 세로 flex에 눌려 칩이 잘릴 수 있어 높이를 못 박는다 (칩 34 + 위아래 여백 10)
  filterScroll: { flexGrow: 0, flexShrink: 0, height: 54 },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  card: {
    padding: 16,
    gap: 6,
    ...card,
  },
  code: { marginLeft: 'auto', fontSize: 12, color: colors.inkFaint },
  name: { flex: 1, fontSize: 17, color: colors.ink },
  goal: { fontSize: 13, lineHeight: 19, color: colors.inkMute },
  metaRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6, columnGap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  metaText: { fontSize: 12.5, color: colors.inkMute, flexShrink: 1 },
});
