import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import { DonutChart } from './DonutChart';
import { Empty, Spinner } from './ui';
import { useAuth } from '../auth/AuthContext';
import { useExpenseFlows } from '../api/queries';
import { big, compact } from '../lib/money';
import { kstYmd, lastDayOf, shiftMonth, todaySeoul } from '../lib/dates';
import { categoryColor, colors, ft, numFont, sh } from '../theme';

const TOP_N = 5;

/**
 * 계좌 출금의 표시용 이름 — 웹 ExpenseAnalysis의 bankLabel과 동일 규칙.
 * 수기 분개 적요는 "[수기] CASH_EXPENSE 8월 급여" 형태라 앞의 계정 키를 떼어낸다.
 */
const bankLabel = (counterparty: string | null, description: string | null): string => {
  const raw = (counterparty || description || '').trim();
  const cleaned = raw
    .replace(/^\[수기\]\s*[A-Z][A-Z0-9_]*\s*/, '')
    .replace(/\s*[—–]\s*(.+)$/, ' ($1)')
    .trim();
  return cleaned || '계좌 출금';
};

/**
 * 이번 달 지출 분석 — 웹 홈의 같은 카드를 모바일 폭에 맞춘 것.
 * 용도별 구성비를 도넛 + 상위 5개 목록으로 본다.
 * 카드 지출은 권한 범위대로, 계좌 출금은 대표에게만 합산된다(웹과 동일).
 */
export function ExpenseAnalysis() {
  const { isCeo } = useAuth();
  const to = todaySeoul();
  const thisMonth = to.slice(0, 7);
  const prevMonth = shiftMonth(thisMonth, -1);
  const from = `${prevMonth}-01`;
  const q = useExpenseFlows(from, to, isCeo);

  if (q.isLoading && !q.data) return <Spinner />;
  if (!q.data) return null;

  const cardRows = q.data.cards.filter((e) => !e.isCancelled && e.status !== 'EXCLUDED');

  // [YYYY-MM, 분류명, 금액] 통합 지출 스트림 — 계좌 출금은 적요를 분류명으로 쓴다
  const flows: [string, string, bigint][] = [
    ...cardRows.map((e): [string, string, bigint] => [
      kstYmd(e.usedAt).slice(0, 7),
      e.purposeText || '용도 미입력',
      big(e.amount),
    ]),
    ...q.data.bank.map((t): [string, string, bigint] => [
      kstYmd(t.txnAt).slice(0, 7),
      bankLabel(t.counterpartyRaw, t.descriptionRaw),
      big(t.amount),
    ]),
  ];

  const sumBy = (ym: string) => {
    const m = new Map<string, bigint>();
    let total = 0n;
    for (const [k, label, amt] of flows) {
      if (k !== ym) continue;
      m.set(label, (m.get(label) ?? 0n) + amt);
      total += amt;
    }
    return { m, total };
  };
  const cur = sumBy(thisMonth);
  const prev = sumBy(prevMonth);

  if (cur.total === 0n) return <Empty>이번 달 지출 내역이 없습니다</Empty>;

  const sorted = [...cur.m.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
  const top = sorted.slice(0, TOP_N);
  const restTotal = sorted.slice(TOP_N).reduce((a, [, v]) => a + v, 0n);
  const slices = [
    ...top.map(([label, value]) => ({ label, value })),
    ...(restTotal > 0n ? [{ label: '기타', value: restTotal }] : []),
  ];

  // 일평균 — 이번 달은 오늘까지의 경과일로 나눈다
  const elapsed = thisMonth === to.slice(0, 7) ? Number(to.slice(8, 10)) : lastDayOf(thisMonth);
  const dailyAvg = elapsed > 0 ? cur.total / BigInt(elapsed) : 0n;

  const share = (v: bigint) => (cur.total > 0n ? Number((v * 1000n) / cur.total) / 10 : 0);
  /** 전월 대비 증감률 — 지난달 데이터가 없으면 null */
  const delta = (label: string, v: bigint) => {
    const p = prev.m.get(label);
    if (p === undefined || p === 0n) return null;
    return Number(((v - p) * 1000n) / p) / 10;
  };

  return (
    <View style={s.card}>
      <Text style={s.desc}>{isCeo ? '카드 + 계좌 출금 · 용도별 구성' : '내 카드 지출 · 용도별 구성'}</Text>

      <View style={{ alignItems: 'center', paddingVertical: 4 }}>
        <DonutChart
          slices={slices}
          centerTop={`${compact(cur.total)}원`}
          centerBottom={`일평균 ${compact(dailyAvg)}원`}
        />
      </View>

      <View style={{ gap: 2 }}>
        <View style={[s.row, { paddingBottom: 4 }]}>
          <Text style={[s.th, { flex: 1 }]}>상위 {TOP_N}개 {isCeo ? '항목' : '용도'}</Text>
          <Text style={[s.th, { width: 68, textAlign: 'right' }]}>금액</Text>
          <Text style={[s.th, { width: 38, textAlign: 'right' }]}>비중</Text>
          <Text style={[s.th, { width: 52, textAlign: 'right' }]}>전월</Text>
        </View>
        {slices.map((sl, i) => {
          const d = delta(sl.label, big(sl.value));
          return (
            <View key={sl.label} style={[s.row, s.rowLine]}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <View style={[s.dot, { backgroundColor: categoryColor(i) }]} />
                <Text style={s.label} numberOfLines={1}>
                  {sl.label}
                </Text>
              </View>
              <Text style={[s.value, ft.semibold, numFont, { width: 68 }]}>{compact(sl.value)}원</Text>
              <Text style={[s.muted, numFont, { width: 38 }]}>{share(big(sl.value)).toFixed(0)}%</Text>
              <Text
                style={[
                  s.muted,
                  numFont,
                  { width: 52 },
                  d !== null && d > 0 ? { color: colors.neg } : d !== null && d < 0 ? { color: colors.pos } : null,
                ]}
              >
                {d === null ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(0)}%`}
              </Text>
            </View>
          );
        })}
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 10,
    ...sh.card,
  },
  desc: { fontSize: 12.5, color: colors.inkFaint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  th: { fontSize: 11.5, color: colors.inkFaint, ...ft.semibold },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 13, color: colors.inkMute },
  value: { fontSize: 13, color: colors.ink, textAlign: 'right' },
  muted: { fontSize: 12.5, color: colors.inkFaint, textAlign: 'right' },
});
