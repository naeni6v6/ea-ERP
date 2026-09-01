import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/themed';
import {
  useBankAccounts,
  useDashboard,
  usePlannedIncomes,
  usePlannedPayments,
  useReserves,
} from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { OfflineBanner } from '../components/OfflineBanner';
import { Kpi, KpiGrid } from '../components/Kpi';
import { Empty, ErrorView, Spinner } from '../components/ui';
import { big, num, won } from '../lib/money';
import { colors, ft, numFont, sh } from '../theme';

const sd = (iso: string) => iso.slice(0, 10).replace(/-/g, '.');

/**
 * 자금 — 웹 treasury 페이지의 핵심을 모바일로 (대표 전용).
 * KPI·예측 → 계좌 잔액 → 입금 예정 → 지급 예정 → 경영유보금.
 * 등록·수정(계좌·예정·유보금)은 웹에서 한다 — 여기는 조회 전용.
 */
export function TreasuryScreen() {
  const { isCeo } = useAuth();
  const dash = useDashboard();
  const accounts = useBankAccounts(isCeo);
  const incomes = usePlannedIncomes(isCeo);
  const payments = usePlannedPayments(isCeo);
  const reserves = useReserves(isCeo);

  const t = dash.data?.treasury;
  const activeAccounts = (accounts.data ?? []).filter((a) => a.isActive);
  const totalBalance = activeAccounts.reduce((a, b) => a + big(b.balance), 0n);
  const activeReserves = (reserves.data ?? []).filter((r) => r.status === 'ACTIVE');

  const refresh = () => {
    dash.refetch();
    accounts.refetch();
    incomes.refetch();
    payments.refetch();
    reserves.refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner dataUpdatedAt={dash.dataUpdatedAt || undefined} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={dash.isFetching && !dash.isLoading} onRefresh={refresh} tintColor={colors.brand} />
        }
      >
        {dash.isLoading ? (
          <Spinner />
        ) : dash.isError && !t ? (
          <ErrorView
            message={dash.error instanceof Error ? dash.error.message : '자금 현황을 불러오지 못했습니다'}
            onRetry={refresh}
          />
        ) : t ? (
          <>
            <Section title="자금 현황">
              <KpiGrid>
                <Kpi label="가용현금" value={t.availableCash} tone="pos" />
                <Kpi label="경영유보금" value={t.reserveTotal} />
                <Kpi label="확정 지급예정" value={t.plannedConfirmed} tone="neg" />
                <Kpi label="오늘 순현금" value={t.todayNet} tone={big(t.todayNet) < 0n ? 'neg' : 'pos'} />
              </KpiGrid>
              {/* 자금 예측 — 웹 treasury의 7/30/90일 전망 */}
              <View style={s.card}>
                <Text style={[s.cardTitle, ft.bold]}>자금 예측</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(
                    [
                      ['7일 뒤', t.forecast.d7],
                      ['30일 뒤', t.forecast.d30],
                      ['90일 뒤', t.forecast.d90],
                    ] as const
                  ).map(([label, v]) => (
                    <View key={label} style={s.forecastCell}>
                      <Text style={{ fontSize: 11.5, color: colors.inkFaint }}>{label}</Text>
                      <Text style={[s.forecastVal, ft.bold, numFont, { color: big(v) < 0n ? colors.neg : colors.ink }]}>
                        {won(v)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </Section>

            <Section title="계좌 잔액">
              <View style={s.card}>
                {activeAccounts.map((a, i) => (
                  <View key={a.id} style={[s.row, i > 0 && s.rowLine]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[s.rowMain, ft.semibold]} numberOfLines={1}>
                        {a.alias}
                        {a.isRestricted ? ' 🔒' : ''}
                      </Text>
                      <Text style={s.rowSub} numberOfLines={1}>
                        {a.bankName}
                        {a.accountNoMasked ? ` · ${a.accountNoMasked}` : ''}
                        {a.department?.name ? ` · ${a.department.name}` : ''}
                      </Text>
                    </View>
                    <Text style={[s.rowNum, ft.bold, numFont]}>{won(a.balance)}</Text>
                  </View>
                ))}
                <View style={s.totalRow}>
                  <Text style={[{ fontSize: 13, color: colors.inkMute }, ft.semibold]}>합계</Text>
                  <Text style={[{ fontSize: 14.5, color: colors.ink }, ft.extrabold, numFont]}>{won(totalBalance)}</Text>
                </View>
              </View>
            </Section>

            <Section title="입금 예정">
              <View style={s.card}>
                {!incomes.data?.length ? (
                  <Empty>예정된 입금이 없습니다</Empty>
                ) : (
                  incomes.data.map((p, i) => (
                    <View key={p.id} style={[s.row, i > 0 && s.rowLine]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.rowMain, ft.semibold]} numberOfLines={1}>
                          {p.title}
                        </Text>
                        <Text style={[s.rowSub, numFont]}>{sd(p.dueDate)}</Text>
                      </View>
                      <Text style={[s.rowNum, ft.bold, numFont, { color: colors.pos }]}>+{num(p.amount)}원</Text>
                    </View>
                  ))
                )}
              </View>
            </Section>

            <Section title="지급 예정">
              <View style={s.card}>
                {!payments.data?.length ? (
                  <Empty>예정된 지급이 없습니다</Empty>
                ) : (
                  payments.data.map((p, i) => (
                    <View key={p.id} style={[s.row, i > 0 && s.rowLine]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[s.rowMain, ft.semibold]} numberOfLines={1}>
                            {p.title}
                          </Text>
                          <View style={[s.kindTag, { backgroundColor: p.kind === 'CONFIRMED' ? colors.negSoft : colors.bgSoft }]}>
                            <Text style={[{ fontSize: 10, color: p.kind === 'CONFIRMED' ? colors.neg : colors.inkMute }, ft.bold]}>
                              {p.kind === 'CONFIRMED' ? '확정' : '계획'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[s.rowSub, numFont]} numberOfLines={1}>
                          {sd(p.dueDate)}
                          {p.department?.name ? ` · ${p.department.name}` : ''}
                          {p.project?.name ? ` · ${p.project.name}` : ''}
                        </Text>
                      </View>
                      <Text style={[s.rowNum, ft.bold, numFont]}>-{num(p.amount)}원</Text>
                    </View>
                  ))
                )}
              </View>
            </Section>

            <Section title="경영유보금">
              <View style={s.card}>
                {!activeReserves.length ? (
                  <Empty>설정된 유보금이 없습니다</Empty>
                ) : (
                  activeReserves.map((r, i) => (
                    <View key={r.id} style={[s.row, i > 0 && s.rowLine]}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.rowMain, ft.semibold]} numberOfLines={1}>
                          {r.purpose}
                        </Text>
                        <Text style={s.rowSub}>{r.category}</Text>
                      </View>
                      <Text style={[s.rowNum, ft.bold, numFont]}>{won(r.amount)}</Text>
                    </View>
                  ))
                )}
              </View>
              <Text style={s.foot}>계좌·예정·유보금 등록과 수정은 웹 ERP에서 할 수 있어요</Text>
            </Section>
          </>
        ) : (
          <Empty>자금 정보는 대표만 볼 수 있습니다</Empty>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={s.titleBar} />
        <Text style={[s.sectionTitle, ft.extrabold]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  titleBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: colors.brand },
  sectionTitle: { fontSize: 17, color: colors.ink },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    gap: 2,
    ...sh.card,
  },
  cardTitle: { fontSize: 13.5, color: colors.ink, marginBottom: 6 },
  forecastCell: { flex: 1, backgroundColor: colors.bgSoft, borderRadius: 12, padding: 10, gap: 3 },
  forecastVal: { fontSize: 12.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowMain: { flexShrink: 1, fontSize: 14, color: colors.ink },
  rowSub: { fontSize: 11.5, color: colors.inkFaint, marginTop: 2 },
  rowNum: { fontSize: 13.5, color: colors.ink },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    marginTop: 4,
  },
  kindTag: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  foot: { textAlign: 'center', fontSize: 11.5, color: colors.inkFaint },
});
