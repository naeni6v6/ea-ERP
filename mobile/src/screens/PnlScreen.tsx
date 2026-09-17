import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/themed';
import { Ionicons } from '@expo/vector-icons';
import { usePnl, usePnlBreakdown } from '../api/queries';
import type { Pnl } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { OfflineBanner } from '../components/OfflineBanner';
import { PeriodChips, resolvePeriod, type PeriodKey } from '../components/PeriodChips';
import { CardTitle, Chip, Empty, ErrorView, Spinner } from '../components/ui';
import { big, num } from '../lib/money';
import { card, colors, ft, numFont } from '../theme';

/** 손익계산서 행 정의 — 웹 pnl/page.tsx ROWS와 1:1 */
const ROWS: { key: keyof Pnl; label: string; strong?: boolean; indent?: boolean; minus?: boolean }[] = [
  { key: 'sales', label: '매출액', strong: true },
  { key: 'cogs', label: '매출원가', indent: true, minus: true },
  { key: 'grossProfit', label: '매출총이익', strong: true },
  { key: 'sga', label: '판매비와관리비', indent: true, minus: true },
  { key: 'operatingProfit', label: '영업이익', strong: true },
  { key: 'nonOpIncome', label: '영업외수익', indent: true },
  { key: 'nonOpExpense', label: '영업외비용', indent: true, minus: true },
  { key: 'preTaxIncome', label: '법인세차감전순이익' },
  { key: 'incomeTax', label: '법인세비용', indent: true, minus: true },
  { key: 'netIncome', label: '당기순이익', strong: true },
];

const GROUPS: { key: string; label: string }[] = [
  { key: 'businessType', label: '사업유형별' },
  { key: 'department', label: '부서별' },
  { key: 'project', label: '프로젝트별' },
  { key: 'account', label: '계정과목별' },
];

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}%`);
const signColor = (v: bigint) => (v > 0n ? colors.pos : v < 0n ? colors.neg : colors.ink);

/**
 * 손익 — 웹 pnl 페이지를 모바일 폭에 맞춘 것 (CEO/ADMIN 전용).
 * 손익계산서 + 이익률 + 전년 동기 비교, 그리고 축별 분해 보기.
 */
export function PnlScreen() {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [yoy, setYoy] = useState(false);
  const [groupBy, setGroupBy] = useState('businessType');
  const { from, to } = resolvePeriod(period);

  const q = usePnl(from, to, yoy, isAdmin);
  const bd = usePnlBreakdown(from, to, groupBy, isAdmin);
  const pnl = q.data;
  const py = pnl?.previousYear;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner dataUpdatedAt={q.dataUpdatedAt || undefined} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => {
              q.refetch();
              bd.refetch();
            }}
            tintColor={colors.brand}
          />
        }
      >
        <PeriodChips value={period} onChange={setPeriod} />
        <Text style={[s.range, numFont]}>
          {from.replace(/-/g, '.')} ~ {to.replace(/-/g, '.')}
        </Text>

        {q.isLoading ? (
          <Spinner />
        ) : q.isError && !pnl ? (
          <ErrorView
            message={q.error instanceof Error ? q.error.message : '손익을 불러오지 못했습니다'}
            onRetry={() => q.refetch()}
          />
        ) : pnl ? (
          <>
            {/* ── 손익계산서 ── */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[s.cardTitle, ft.bold]}>손익계산서</Text>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => setYoy((v) => !v)} style={[s.yoyBtn, yoy && { backgroundColor: colors.brandSoft }]} hitSlop={6}>
                  <Ionicons name={yoy ? 'checkbox' : 'square-outline'} size={15} color={yoy ? colors.brandDeep : colors.inkFaint} />
                  <Text style={[{ fontSize: 12.5, color: yoy ? colors.brandDeep : colors.inkMute }, ft.semibold]}>
                    전년 동기 비교
                  </Text>
                </Pressable>
              </View>

              {ROWS.map((r, i) => {
                const cur = big(pnl[r.key] as string);
                const prev = py ? big(py[r.key] as string) : 0n;
                const diff = cur - prev;
                const rate = py && prev !== 0n ? (Number(diff) / Math.abs(Number(prev))) * 100 : null;
                return (
                  <View key={String(r.key)} style={[s.row, i > 0 && s.rowLine, r.strong && s.rowStrong]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[s.rowLabel, r.indent && s.rowIndent, r.strong && ft.bold]}>
                        {r.minus ? <Text style={{ color: colors.inkFaint }}>(−) </Text> : null}
                        {r.label}
                      </Text>
                      <Text style={[s.rowNum, numFont, r.strong && { ...ft.bold, color: signColor(cur) }]}>
                        {num(cur)}
                      </Text>
                    </View>
                    {py && (
                      <Text style={[s.yoyLine, numFont]}>
                        전년 {num(prev)} · <Text style={{ color: signColor(diff) }}>{diff > 0n ? '+' : ''}{num(diff)}</Text>
                        {rate !== null ? ` (${rate > 0 ? '+' : ''}${rate.toFixed(1)}%)` : ''}
                      </Text>
                    )}
                  </View>
                );
              })}

              <View style={s.marginFoot}>
                <Text style={[s.marginText, numFont]}>
                  이익률 — 매출총 {pct(pnl.grossMarginPct)} · 영업 {pct(pnl.operatingMarginPct)} · 순 {pct(pnl.netMarginPct)}
                </Text>
              </View>
            </View>

            {/* ── 분해 보기 ── */}
            <View style={s.card}>
              <CardTitle>분해 보기</CardTitle>
              <Text style={s.desc}>공통비는 배부하지 않습니다. 축이 없는 라인은 (미지정)으로 모입니다</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {GROUPS.map((g) => (
                  <Chip key={g.key} label={g.label} on={groupBy === g.key} onPress={() => setGroupBy(g.key)} />
                ))}
              </View>

              {bd.isLoading ? (
                <Spinner />
              ) : !bd.data?.rows.length ? (
                <Empty>해당 기간의 데이터가 없습니다</Empty>
              ) : (
                bd.data.rows.map((r, i) => (
                  <View key={r.id ?? r.name} style={[{ paddingVertical: 9, gap: 3 }, i > 0 && s.rowLine]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={[{ flex: 1, fontSize: 14, color: colors.ink }, ft.semibold]} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={[{ fontSize: 13.5, color: signColor(big(r.operatingProfit)) }, ft.bold, numFont]}>
                        {num(r.operatingProfit)}
                      </Text>
                    </View>
                    <Text style={[s.bdSub, numFont]}>
                      매출 {num(r.sales)} · 매출총이익 {num(r.grossProfit)} · 순이익 {num(r.netIncome)}
                    </Text>
                  </View>
                ))
              )}
              {!!bd.data?.rows.length && <Text style={s.bdFoot}>우측 굵은 숫자는 영업이익</Text>}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  range: { fontSize: 12, color: colors.inkFaint, marginTop: -4 },
  card: {
    padding: 16,
    gap: 8,
    ...card,
  },
  cardTitle: { fontSize: 15, color: colors.ink },
  desc: { fontSize: 11.5, color: colors.inkFaint, marginTop: -4 },
  yoyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 32,
    paddingHorizontal: 9,
    borderRadius: 9,
  },
  row: { paddingVertical: 8, gap: 2 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowStrong: { backgroundColor: colors.bgSoft, marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 0 },
  rowLabel: { fontSize: 13.5, color: colors.ink },
  rowIndent: { paddingLeft: 16, color: colors.inkMute },
  rowNum: { fontSize: 13.5, color: colors.ink },
  yoyLine: { fontSize: 11.5, color: colors.inkFaint, textAlign: 'right' },
  marginFoot: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9, marginTop: 2 },
  marginText: { fontSize: 12, color: colors.inkMute },
  bdSub: { fontSize: 11.5, color: colors.inkFaint },
  bdFoot: { fontSize: 10.5, color: colors.inkFaint, textAlign: 'right' },
});
