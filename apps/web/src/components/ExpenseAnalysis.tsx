'use client';

import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { big, compact, num, seoulYmd, thisMonthSeoul, todaySeoul } from '@/lib/format';
import { categoryColor, DonutChart } from '@/components/charts';
import { Empty, ErrorBox, Section, Spinner } from '@/components/ui';
import type { BankTransaction, CardExpenseList } from '@/lib/types';

/** 'YYYY-MM' 에서 offset 개월 이동 */
const shiftMonth = (ym: string, offset: number): string => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
};
const lastDayOf = (ym: string): number =>
  new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
const monthLabel = (ym: string): string => `${Number(ym.slice(5, 7))}월`;

const TOP_N = 5;

/**
 * 계좌 출금의 표시용 이름.
 * 수기 분개로 만들어진 거래는 적요가 "[수기] CASH_EXPENSE 8월 급여" 형태라 앞의 계정 키를 떼어낸다.
 */
const bankLabel = (counterparty: string | null, description: string | null): string => {
  const raw = (counterparty || description || '').trim();
  const cleaned = raw
    .replace(/^\[수기\]\s*[A-Z][A-Z0-9_]*\s*/, '')
    // "8월 급여 — 임직원" → "8월 급여 (임직원)"
    .replace(/\s*[—–]\s*(.+)$/, ' ($1)')
    .trim();
  return cleaned || '계좌 출금';
};

/**
 * 이번 달 지출 분석 — 용도별 구성비를 도넛 + 상위 5개 표로 본다.
 * 카드 지출은 권한 범위대로, 계좌(은행) 출금은 대표에게만 합산된다.
 */
export function ExpenseAnalysis() {
  const { isCeo } = useSession();
  const thisMonth = thisMonthSeoul();
  const prevMonth = shiftMonth(thisMonth, -1);
  const from = `${prevMonth}-01`;
  const to = todaySeoul();

  const cards = useAsync(
    () => api.get<CardExpenseList>('/cards/expenses', { from, to, take: 1000 }),
    [from, to],
  );
  const bank = useAsync(
    () =>
      isCeo
        ? api.get<BankTransaction[]>('/treasury/bank-transactions', {
            from,
            to,
            direction: 'OUT',
            take: 1000,
          })
        : Promise.resolve(null),
    [isCeo, from, to],
  );

  if (cards.loading && !cards.data) return <Spinner />;
  if (cards.error) return <ErrorBox message={cards.error} onRetry={cards.reload} />;

  const cardRows = (cards.data?.rows ?? []).filter((e) => !e.isCancelled && e.status !== 'EXCLUDED');
  const bankRows = bank.data ?? [];

  // [YYYY-MM, 분류명, 금액] 통합 지출 스트림 — 계좌 출금은 적요를 분류명으로 쓴다
  const flows: [string, string, bigint][] = [
    ...cardRows.map((e): [string, string, bigint] => [
      seoulYmd(e.usedAt).slice(0, 7),
      e.purposeText || '용도 미입력',
      big(e.amount),
    ]),
    ...bankRows.map((t): [string, string, bigint] => [
      seoulYmd(t.txnAt).slice(0, 7),
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
  /** 전월 대비 증감률 — 지난달 데이터가 없으면 '—' */
  const delta = (label: string, v: bigint) => {
    const p = prev.m.get(label);
    if (p === undefined || p === 0n) return null;
    return Number(((v - p) * 1000n) / p) / 10;
  };

  return (
    <Section
      title={`${monthLabel(thisMonth)} 지출 분석`}
      desc={isCeo ? '카드 + 계좌 출금 · 용도별 구성' : '내 카드 지출 · 용도별 구성'}
      right={
        <Link href="/expenses" className="btn-ghost">
          지출 상세 →
        </Link>
      }
    >
      {cur.total === 0n ? (
        <Empty>이번 달 지출 내역이 없습니다.</Empty>
      ) : (
        <div className="flex flex-col items-center gap-4 py-4 pl-4 pr-0 lg:flex-row lg:items-center lg:gap-2">
          <div className="flex shrink-0 justify-center lg:pl-6 lg:pr-2">
            <DonutChart
              slices={slices}
              centerTop={`${compact(cur.total)}원`}
              centerBottom={`일평균 ${compact(dailyAvg)}원`}
            />
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">상위 {TOP_N}개 {isCeo ? '항목' : '용도'}</th>
                  <th className="th text-right">금액</th>
                  <th className="th text-right">비중</th>
                  <th className="th text-right">전월 대비</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {slices.map((s, i) => {
                  const d = delta(s.label, big(s.value));
                  return (
                    <tr key={s.label}>
                      <td className="td">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: categoryColor(i) }}
                          />
                          <span className="truncate">{s.label}</span>
                        </span>
                      </td>
                      <td className="td text-right font-num font-medium" title={`${num(s.value)}원`}>
                        {compact(s.value)}원
                      </td>
                      <td className="td text-right font-num text-ink-mute">{share(big(s.value)).toFixed(0)}%</td>
                      <td
                        className={`td text-right font-num ${
                          d === null ? 'text-ink-faint' : d > 0 ? 'text-neg' : d < 0 ? 'text-pos' : 'text-ink-mute'
                        }`}
                      >
                        {d === null ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(0)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <p className="mt-3 rounded-lg bg-line-soft/70 px-3 py-2 text-xs text-ink-mute">
              가장 큰 항목은 <b className="text-ink-soft">{slices[0].label}</b> — 전체의{' '}
              {share(big(slices[0].value)).toFixed(0)}%.{' '}
              {prev.total === 0n
                ? '전월 비교 데이터 없음.'
                : `지난달 같은 기간 합계 ${compact(prev.total)}원.`}
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}
