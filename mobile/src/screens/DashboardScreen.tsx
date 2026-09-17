import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/themed';
import { StatusBar } from 'expo-status-bar';
import { CompositeNavigationProp, useIsFocused, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCards, useDashboard, useMonthlyPnl, useUnsubmitted } from '../api/queries';
import type { ProjectKpiRow } from '../api/types';
import { OfflineBanner } from '../components/OfflineBanner';
import { NoticeBanner } from '../components/NoticeBanner';
import { Kpi, KpiGrid } from '../components/Kpi';
import { Progress } from '../components/Progress';
import { CardSummaryItem } from '../components/CardSummaryItem';
import { ExpenseAnalysis } from '../components/ExpenseAnalysis';
import { TrendBars } from '../components/TrendBars';
import { CardTitle, Empty, ErrorView, Section, Spinner } from '../components/ui';
import { big, won } from '../lib/money';
import { todaySeoul } from '../lib/dates';
import { card, colors, ft, numFont, tight } from '../theme';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * 홈 대시보드 — 웹 홈과 같은 단일 진입점.
 * GET /metrics/dashboard 응답의 pnl(CEO/ADMIN)·treasury(CEO) 키 유무로
 * 권한별 섹션이 자동 결정된다. 클라이언트에서 권한을 재구현하지 않는다.
 */
export function DashboardScreen() {
  const nav = useNavigation<Nav>();
  // 홈만 헤더가 검은 띠라 상태바 글자를 밝게 — 다른 탭으로 가면 전역(dark)으로 돌아간다
  const focused = useIsFocused();
  const dash = useDashboard();
  const cards = useCards();
  const unsub = useUnsubmitted();
  // 손익 추이 그래프 — 대시보드 응답에 pnl이 있는 권한(CEO/ADMIN)에서만 조회
  const monthly = useMonthlyPnl(!!dash.data?.pnl);

  const refresh = () => {
    dash.refetch();
    cards.refetch();
    unsub.refetch();
  };

  const d = dash.data;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {focused && <StatusBar style="light" />}
      <OfflineBanner dataUpdatedAt={dash.dataUpdatedAt || undefined} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={dash.isFetching && !dash.isLoading}
            onRefresh={refresh}
            tintColor={colors.brand}
          />
        }
      >
        {/* 미제출 안내는 헤더 종 배지가 맡는다 — 홈 상단은 공지만 */}
        <NoticeBanner />

        {dash.isLoading ? (
          <Spinner />
        ) : dash.isError && !d ? (
          <ErrorView
            message={dash.error instanceof Error ? dash.error.message : '대시보드를 불러오지 못했습니다'}
            onRetry={refresh}
          />
        ) : d ? (
          <>
            {/* 대표가 매일 가장 먼저 보는 것 — 진행 중인 프로젝트. 웹 홈처럼 맨 위에 둔다 */}
            <Section title="프로젝트" desc={`전체 업무 완료율 ${Math.round(d.projects.taskCompletionPct)}%`} onMore={() => nav.navigate('Projects')}>
              <View style={s.projRow}>
                <ProjStat label="전체" value={d.projects.total} />
                <ProjStat label="진행" value={d.projects.active} color={colors.brandDeep} />
                <ProjStat label="지연" value={d.projects.delayed} color={d.projects.delayed > 0 ? colors.neg : undefined} />
                <ProjStat label="위험" value={d.projects.atRisk} color={d.projects.atRisk > 0 ? colors.warn : undefined} />
              </View>
              <View style={s.projListCard}>
                {sortKpiRows(d.projects.projects).slice(0, 8).map((p, i) => (
                  <ProjectMiniRow
                    key={p.id}
                    row={p}
                    first={i === 0}
                    onPress={() => nav.navigate('ProjectDetail', { projectId: p.id, name: p.name })}
                  />
                ))}
                {d.projects.projects.length > 8 && (
                  <Pressable onPress={() => nav.navigate('Projects')} style={s.moreRow} hitSlop={6}>
                    <Text style={[{ fontSize: 13, color: colors.brandDeep }, ft.semibold]}>
                      외 {d.projects.projects.length - 8}건 더 보기 ›
                    </Text>
                  </Pressable>
                )}
              </View>
            </Section>

            {d.pnl && (
              <Section title="이번 달 손익" onMore={() => nav.navigate('Pnl')} moreLabel="손익 상세">
                <KpiGrid>
                  <Kpi label="매출" value={d.pnl.sales} />
                  <Kpi label="매출총이익" value={d.pnl.grossProfit} />
                  <Kpi label="영업이익" value={d.pnl.operatingProfit} tone={big(d.pnl.operatingProfit) < 0n ? 'neg' : undefined} />
                  <Kpi label="당기순이익" value={d.pnl.netIncome} tone={big(d.pnl.netIncome) < 0n ? 'neg' : 'pos'} />
                </KpiGrid>
                {monthly.data && monthly.data.length > 0 && <TrendBars data={monthly.data} />}
              </Section>
            )}

            {d.treasury && (
              <Section title="자금 현황" onMore={() => nav.navigate('Treasury')} moreLabel="자금 상세">
                <KpiGrid>
                  <Kpi label="가용현금" value={d.treasury.availableCash} tone="pos" />
                  <Kpi label="경영유보금" value={d.treasury.reserveTotal} />
                  <Kpi label="확정 지급예정" value={d.treasury.plannedConfirmed} tone="neg" />
                  <Kpi label="오늘 순현금" value={d.treasury.todayNet} tone={big(d.treasury.todayNet) < 0n ? 'neg' : 'pos'} />
                </KpiGrid>

                <View style={s.subCard}>
                  <CardTitle>계좌 잔액</CardTitle>
                  {d.treasury.accounts.map((a, i) => (
                    <View key={a.id} style={[s.acctRow, i > 0 && s.acctRowLine]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Text style={[s.acctName, ft.semibold]} numberOfLines={1}>
                            {a.alias}
                          </Text>
                          {a.isRestricted && <Ionicons name="lock-closed" size={12} color={colors.inkFaint} />}
                        </View>
                        <Text style={s.acctBank} numberOfLines={1}>
                          {a.bankName}
                        </Text>
                      </View>
                      <Text style={[s.acctBal, ft.bold, numFont]}>{won(a.balance)}</Text>
                    </View>
                  ))}
                </View>
              </Section>
            )}

            {/* 이번 달 지출 분석 — 웹 홈의 도넛 카드와 같은 데이터·같은 규칙 */}
            <Section title={`${Number(todaySeoul().slice(5, 7))}월 지출 분석`}>
              <ExpenseAnalysis />
            </Section>
          </>
        ) : null}

        <Section title="내 카드" onMore={() => nav.navigate('Submit', { seg: 'card' })} moreLabel="지출 내역">
          {cards.isLoading ? (
            <Spinner />
          ) : !cards.data?.filter((c) => c.isActive).length ? (
            <Empty>등록된 카드가 없습니다</Empty>
          ) : (
            <View style={{ gap: 10 }}>
              {cards.data
                .filter((c) => c.isActive)
                .map((c) => (
                  <CardSummaryItem key={c.id} card={c} />
                ))}
            </View>
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

/** 긴급 > 지연 > 위험 > 나머지 — 대표가 봐야 할 것부터 */
function sortKpiRows(rows: ProjectKpiRow[]): ProjectKpiRow[] {
  const rank = (p: ProjectKpiRow) =>
    p.status === 'URGENT' ? 0 : p.isDelayed ? 1 : p.isAtRisk ? 2 : p.status === 'DONE' || p.status === 'CANCELLED' ? 4 : 3;
  return [...rows].sort((a, b) => rank(a) - rank(b));
}

/** 웹 보드의 상태 점 색 (ProjectBoard.tsx STATUS_DOT) */
const STATUS_DOT: Record<string, string> = {
  URGENT: '#e60000',
  PLANNED: '#a9a099',
  ACTIVE: '#2a78d6',
  ON_HOLD: '#c9820f',
  DONE: '#2f8f5b',
  CANCELLED: '#c8c2bb',
};

function ProjectMiniRow({ row: p, first, onPress }: { row: ProjectKpiRow; first: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.miniRow, !first && s.miniRowBorder, pressed && { opacity: 0.7 }]}>
      <View style={[s.statusDot, { backgroundColor: STATUS_DOT[p.status] ?? colors.inkFaint }]} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.miniName, ft.semibold]} numberOfLines={1}>
            {p.name}
          </Text>
          {p.isDelayed && (
            <View style={s.miniDelay}>
              <Text style={[{ fontSize: 10.5, color: colors.neg }, ft.bold]}>지연</Text>
            </View>
          )}
        </View>
        <Progress value={p.progress} showLabel={false} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2, minWidth: 44 }}>
        <Text style={[s.miniPct, ft.bold, numFont]}>{Math.round(p.progress)}%</Text>
        <Text style={[s.miniTasks, numFont]}>
          {p.doneTasks}/{p.totalTasks}건
        </Text>
      </View>
    </Pressable>
  );
}

function ProjStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={s.projStat}>
      <Text style={[s.projVal, ft.extrabold, numFont, tight, color ? { color } : null]}>{value}</Text>
      <Text style={s.projLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  subCard: {
    padding: 16,
    paddingTop: 14,
    marginTop: 10,
    ...card,
  },
  acctRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center', paddingVertical: 9 },
  acctRowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  acctName: { flexShrink: 1, fontSize: 14, color: colors.ink },
  acctBank: { fontSize: 12, color: colors.inkFaint, marginTop: 1 },
  acctBal: { fontSize: 14, color: colors.ink },
  projRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    ...card,
  },
  projStat: { flex: 1, alignItems: 'center', gap: 3 },
  projVal: { fontSize: 24, color: colors.ink, lineHeight: 28 },
  projLabel: { fontSize: 12, color: colors.inkFaint },
  projListCard: {
    paddingHorizontal: 16,
    marginTop: 10,
    ...card,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    minHeight: 48,
  },
  miniRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  miniName: { flexShrink: 1, fontSize: 14.5, color: colors.ink },
  miniDelay: { backgroundColor: colors.negSoft, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  miniPct: { fontSize: 13.5, color: colors.ink },
  miniTasks: { fontSize: 11.5, color: colors.inkFaint },
  moreRow: { paddingVertical: 12, alignItems: 'center' },
});
