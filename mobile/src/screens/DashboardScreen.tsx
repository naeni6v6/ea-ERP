import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/themed';
import { StatusBar } from 'expo-status-bar';
import { CompositeNavigationProp, useIsFocused, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCards, useDashboard, useMonthlyPnl, useUnsubmitted, visibleRows } from '../api/queries';
import type { ProjectKpiRow } from '../api/types';
import { OfflineBanner } from '../components/OfflineBanner';
import { NoticeBanner } from '../components/NoticeBanner';
import { Kpi, KpiGrid } from '../components/Kpi';
import { Progress } from '../components/Progress';
import { CardSummaryItem } from '../components/CardSummaryItem';
import { TrendBars } from '../components/TrendBars';
import { Empty, ErrorView, Spinner } from '../components/ui';
import { big, won } from '../lib/money';
import { colors, ft, numFont, sh } from '../theme';
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
  const unsubCount = visibleRows(unsub.data?.rows).length;

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
        contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={dash.isFetching && !dash.isLoading}
            onRefresh={refresh}
            tintColor={colors.brand}
          />
        }
      >
        <NoticeBanner />

        {unsubCount > 0 && (
          <Pressable style={s.banner} onPress={() => nav.navigate('Submit')}>
            <View style={{ flex: 1 }}>
              <Text style={[s.bannerTitle, ft.bold]}>아직 제출하지 않은 지출이 {unsubCount}건 있어요</Text>
              <Text style={s.bannerSub}>용도를 입력하고 제출해주세요</Text>
            </View>
            <View style={s.bannerBtn}>
              <Text style={[{ color: '#fff', fontSize: 14 }, ft.bold]}>지금 제출하기</Text>
            </View>
          </Pressable>
        )}

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
            <Section title="프로젝트 관리" onMore={() => nav.navigate('Projects')}>
              <View style={s.projRow}>
                <ProjStat label="전체" value={d.projects.total} />
                <View style={s.projDivider} />
                <ProjStat label="진행" value={d.projects.active} color={colors.brandDeep} />
                <View style={s.projDivider} />
                <ProjStat label="지연" value={d.projects.delayed} color={d.projects.delayed > 0 ? colors.neg : undefined} />
                <View style={s.projDivider} />
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
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12.5, color: colors.inkFaint, marginBottom: 5 }}>전체 업무 완료율</Text>
                <Progress value={d.projects.taskCompletionPct} />
              </View>
            </Section>

            {d.pnl && (
              <Section title="이번 달 손익">
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
              <Section title="자금 현황">
                <KpiGrid>
                  <Kpi label="가용현금" value={d.treasury.availableCash} tone="pos" />
                  <Kpi label="경영유보금" value={d.treasury.reserveTotal} />
                  <Kpi label="확정 지급예정" value={d.treasury.plannedConfirmed} tone="neg" />
                  <Kpi label="오늘 순현금" value={d.treasury.todayNet} tone={big(d.treasury.todayNet) < 0n ? 'neg' : 'pos'} />
                </KpiGrid>

                <View style={s.subCard}>
                  <Text style={[s.subTitle, ft.bold]}>계좌 잔액</Text>
                  {d.treasury.accounts.map((a) => (
                    <View key={a.id} style={s.acctRow}>
                      <Text style={s.acctName} numberOfLines={1}>
                        {a.alias} <Text style={{ color: colors.inkFaint }}>({a.bankName})</Text>
                        {a.isRestricted ? ' 🔒' : ''}
                      </Text>
                      <Text style={[s.acctBal, ft.semibold, numFont]}>{won(a.balance)}</Text>
                    </View>
                  ))}
                </View>

              </Section>
            )}

          </>
        ) : null}

        <Section title="내 카드">
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

function Section({
  title,
  children,
  onMore,
}: {
  title: string;
  children: React.ReactNode;
  onMore?: () => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={s.sectionHead}>
        {/* 웹 .page-title의 브랜드 세로바 액센트 */}
        <View style={s.titleBar} />
        <Text style={[s.sectionTitle, ft.extrabold]}>{title}</Text>
        {onMore && (
          <Pressable onPress={onMore} hitSlop={8} style={{ marginLeft: 'auto' }}>
            <Text style={[{ fontSize: 13, color: colors.brandDeep }, ft.semibold]}>전체 보기 ›</Text>
          </Pressable>
        )}
      </View>
      {children}
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
    <Pressable onPress={onPress} style={[s.miniRow, !first && s.miniRowBorder]}>
      <View style={[s.statusDot, { backgroundColor: STATUS_DOT[p.status] ?? colors.inkFaint }]} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[s.miniName, ft.semibold]} numberOfLines={1}>
            {p.name}
          </Text>
          {p.isDelayed && <Text style={[s.miniDelay, ft.bold]}>지연</Text>}
        </View>
        <Progress value={p.progress} showLabel={false} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text style={[s.miniPct, ft.bold, numFont]}>{Math.round(p.progress)}%</Text>
        <Text style={[s.miniTasks, numFont]}>☑ {p.doneTasks}/{p.totalTasks}</Text>
      </View>
    </Pressable>
  );
}

function ProjStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={s.projStat}>
      <Text style={[s.projVal, ft.extrabold, numFont, color ? { color } : null]}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.inkFaint }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.brandSoft,
    borderRadius: 16,
    padding: 14,
    ...sh.card,
  },
  bannerTitle: { color: colors.brandDeep, fontSize: 15, lineHeight: 21 },
  bannerSub: { color: colors.inkMute, fontSize: 13, marginTop: 2 },
  bannerBtn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  titleBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.brand },
  sectionTitle: { fontSize: 17, color: colors.ink },
  subCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    marginTop: 10,
    ...sh.card,
  },
  subTitle: { fontSize: 13.5, color: colors.ink },
  acctRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  acctName: { flex: 1, fontSize: 13.5, color: colors.inkMute },
  acctBal: { fontSize: 13.5, color: colors.ink },
  projRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 12,
    ...sh.card,
  },
  projStat: { flex: 1, alignItems: 'center', gap: 2 },
  projDivider: { width: 1, backgroundColor: colors.line, marginVertical: 6 },
  projVal: { fontSize: 22, color: colors.ink },
  projListCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginTop: 10,
    ...sh.card,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    minHeight: 44,
  },
  miniRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  miniName: { flexShrink: 1, fontSize: 14, color: colors.ink },
  miniDelay: { fontSize: 11, color: colors.neg },
  miniPct: { fontSize: 13, color: colors.ink },
  miniTasks: { fontSize: 11.5, color: colors.inkFaint },
  moreRow: { paddingVertical: 11, alignItems: 'center' },
});
