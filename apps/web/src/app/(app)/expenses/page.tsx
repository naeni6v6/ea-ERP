'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { big, compact, num, seoulYmd } from '@/lib/format';
import { Empty, ErrorBox, Kpi, Section, Spinner } from '@/components/ui';
import type { BankTransaction, CardExpenseList } from '@/lib/types';

/**
 * 지출 대시보드 — 카드 + 계좌 지출을 한 화면에서 통계로 본다 (고위드 홈 스타일).
 * 월별 사용 추이(축·눈금 있는 막대) · 사용 페이스(이번달 vs 지난달 누적 라인) · 용도별 TOP.
 * 계좌(은행) 지출은 대표에게만 보이고, 카드 지출은 권한 범위대로(직원은 본인 카드) 집계된다.
 */

const monthKey = (ymd: string) => ymd.slice(0, 7);
const monthLabel = (ym: string) => `${ym.slice(2, 4)}.${Number(ym.slice(5, 7))}월`;
const daysOf = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();

/** 축 눈금용 — 값보다 큰 '깔끔한' 최대값 (1/2/2.5/5 × 10^n) */
const niceCeil = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
};
const fmtTick = (v: number) => compact(BigInt(Math.round(v)));

/* ── 월별 사용 추이 — y축 눈금 + 스택 막대 (카드 주황 / 계좌 회색) ── */
function MonthlyChart({
  labels,
  series,
  highlight,
}: {
  labels: string[];
  series: { card: number; bank: number }[];
  highlight: number;
}) {
  const W = 600;
  const H = 235;
  const L = 54;
  const R = 10;
  const T = 12;
  const B = 26;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const max = niceCeil(Math.max(1, ...series.map((s) => s.card + s.bank)));
  const y = (v: number) => T + plotH - (v / max) * plotH;
  const slot = plotW / labels.length;
  const barW = Math.min(42, slot * 0.52);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = f * max;
        return (
          <g key={f}>
            <line
              x1={L}
              x2={W - R}
              y1={y(v)}
              y2={y(v)}
              stroke="#eae5e0"
              strokeWidth={f === 0 ? 1.5 : 1}
              strokeDasharray={f === 0 ? undefined : '3 4'}
            />
            <text x={L - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#a9a099">
              {fmtTick(v)}
            </text>
          </g>
        );
      })}
      {series.map((s, i) => {
        const x = L + i * slot + (slot - barW) / 2;
        const total = s.card + s.bank;
        return (
          <g key={i}>
            {s.bank > 0 && (
              <rect x={x} y={y(s.bank)} width={barW} height={(s.bank / max) * plotH} fill="#c8c2bb" rx="3" />
            )}
            {s.card > 0 && (
              <rect
                x={x}
                y={y(total)}
                width={barW}
                height={(s.card / max) * plotH}
                fill={i === highlight ? '#f5911e' : '#f5911e7d'}
                rx="3"
              />
            )}
            {total > 0 && (
              <text x={x + barW / 2} y={y(total) - 6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#857d75">
                {fmtTick(total)}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight={i === highlight ? 700 : 400}
              fill={i === highlight ? '#b45f05' : '#a9a099'}
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── 사용 페이스 — 이번 달 누적(주황) vs 지난달 누적(회색) 라인 ── */
function PaceChart({ cur, prev, todayDay }: { cur: number[]; prev: number[]; todayDay: number }) {
  const W = 600;
  const H = 235;
  const L = 54;
  const R = 14;
  const T = 12;
  const B = 26;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const days = Math.max(cur.length, prev.length, 28);
  const max = niceCeil(Math.max(1, cur[Math.min(todayDay, cur.length) - 1] ?? 0, prev[prev.length - 1] ?? 0));
  const x = (d: number) => L + ((d - 1) / (days - 1)) * plotW;
  const y = (v: number) => T + plotH - (v / max) * plotH;

  const prevPts = prev.map((v, i) => `${x(i + 1)},${y(v)}`).join(' ');
  const curSlice = cur.slice(0, todayDay);
  const curPts = curSlice.map((v, i) => `${x(i + 1)},${y(v)}`).join(' ');
  const lastV = curSlice[curSlice.length - 1] ?? 0;
  const area = `${curPts} ${x(todayDay)},${y(0)} ${x(1)},${y(0)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const v = f * max;
        return (
          <g key={f}>
            <line
              x1={L}
              x2={W - R}
              y1={y(v)}
              y2={y(v)}
              stroke="#eae5e0"
              strokeWidth={f === 0 ? 1.5 : 1}
              strokeDasharray={f === 0 ? undefined : '3 4'}
            />
            <text x={L - 8} y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill="#a9a099">
              {fmtTick(v)}
            </text>
          </g>
        );
      })}
      {Array.from({ length: days }, (_, i) => i + 1)
        .filter((d) => d === 1 || d % 5 === 0)
        .map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#a9a099">
            {d}일
          </text>
        ))}
      {/* 오늘 위치 가이드 */}
      <line x1={x(todayDay)} x2={x(todayDay)} y1={T} y2={T + plotH} stroke="#c8c2bb" strokeDasharray="3 4" />
      {/* 지난달 누적 */}
      {prev.length > 1 && <polyline points={prevPts} fill="none" stroke="#a9a099" strokeWidth="1.8" />}
      {/* 이번 달 누적 (면 + 선 + 끝점) */}
      {curSlice.length > 1 && <polygon points={area} fill="rgba(245,145,30,0.12)" />}
      {curSlice.length > 1 && (
        <polyline points={curPts} fill="none" stroke="#f5911e" strokeWidth="2.6" strokeLinejoin="round" />
      )}
      <circle cx={x(todayDay)} cy={y(lastV)} r="4.5" fill="#fff" stroke="#f5911e" strokeWidth="2.5" />
    </svg>
  );
}

export default function ExpensesDashboardPage() {
  const { isCeo } = useSession();
  const today = seoulYmd(new Date());
  const thisMonth = monthKey(today);
  const todayDay = Number(today.slice(8, 10));
  // 월별 이용 현황 히어로 — 최근 6개월 안에서 월 이동
  const [heroMonth, setHeroMonth] = useState(thisMonth);

  // 최근 6개월 범위
  const months: string[] = [];
  {
    const [y, m] = [Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7))];
    for (let i = 5; i >= 0; i--) months.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  }
  const prevMonth = months[4];
  const from = `${months[0]}-01`;
  const to = today;

  const cards = useAsync(() => api.get<CardExpenseList>('/cards/expenses', { from, to, take: 1000 }), [from, to]);
  const bank = useAsync(
    () =>
      isCeo
        ? api.get<BankTransaction[]>('/treasury/bank-transactions', { from, to, direction: 'OUT', take: 1000 })
        : Promise.resolve(null),
    [isCeo, from, to],
  );

  if (cards.loading && !cards.data) return <Spinner />;
  if (cards.error) return <ErrorBox message={cards.error} onRetry={cards.reload} />;

  const cardRows = (cards.data?.rows ?? []).filter((e) => !e.isCancelled && e.status !== 'EXCLUDED');
  const bankRows = bank.data ?? [];
  // [ymd, 금액] 통합 지출 스트림
  const flows: [string, bigint][] = [
    ...cardRows.map((e): [string, bigint] => [seoulYmd(e.usedAt), big(e.amount)]),
    ...bankRows.map((t): [string, bigint] => [seoulYmd(t.txnAt), big(t.amount)]),
  ];

  // 월별 합계 (카드/계좌 분리 — 스택 막대용)
  const byMonth = new Map<string, { card: bigint; bank: bigint }>(months.map((m) => [m, { card: 0n, bank: 0n }]));
  for (const e of cardRows) {
    const k = monthKey(seoulYmd(e.usedAt));
    if (byMonth.has(k)) byMonth.get(k)!.card += big(e.amount);
  }
  for (const t of bankRows) {
    const k = monthKey(seoulYmd(t.txnAt));
    if (byMonth.has(k)) byMonth.get(k)!.bank += big(t.amount);
  }

  // 사용 페이스 — 이번 달·지난달 일별 누적
  const cumOf = (ym: string, upto: number) => {
    const daily = Array.from({ length: daysOf(ym) }, () => 0n);
    for (const [d, v] of flows) if (monthKey(d) === ym) daily[Number(d.slice(8, 10)) - 1] += v;
    const cum: number[] = [];
    let acc = 0n;
    for (let i = 0; i < Math.min(daily.length, upto); i++) {
      acc += daily[i];
      cum.push(Number(acc));
    }
    return cum;
  };
  const curCum = cumOf(thisMonth, daysOf(thisMonth));
  const prevCum = cumOf(prevMonth, daysOf(prevMonth));

  // 이번 달 용도별 TOP (카드)
  const byPurpose = new Map<string, bigint>();
  for (const e of cardRows) {
    if (monthKey(seoulYmd(e.usedAt)) !== thisMonth) continue;
    const k = e.purposeText || '용도 미입력';
    byPurpose.set(k, (byPurpose.get(k) ?? 0n) + big(e.amount));
  }
  const purposeTop = [...byPurpose.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1)).slice(0, 7);
  const purposeMax = purposeTop[0]?.[1] ?? 1n;

  const cur = byMonth.get(thisMonth)!;
  const totalThisMonth = cur.card + cur.bank;
  const pendingCount = cards.data?.summary.submitted.count ?? 0;

  // 페이스 통계
  const curAtToday = curCum[todayDay - 1] ?? 0;
  const prevAtSameDay = prevCum[Math.min(todayDay, prevCum.length) - 1] ?? 0;
  const paceDiffPct = prevAtSameDay > 0 ? Math.round(((curAtToday - prevAtSameDay) / prevAtSameDay) * 100) : null;
  const dailyAvg = Math.round(curAtToday / todayDay);
  const projected = dailyAvg * daysOf(thisMonth);

  const widthPct = (v: bigint, max: bigint) => Math.max(2, Number((v * 100n) / (max > 0n ? max : 1n)));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">지출</h1>
          <p className="mt-1.5 text-sm text-ink-mute">카드 + 계좌 지출 통합 현황 · {monthLabel(thisMonth)} 기준</p>
        </div>
        <span className="flex gap-2">
          <Link href="/expenses/account" className="btn-ghost !px-3 !py-1.5 text-xs">
            계좌 내역 →
          </Link>
          <Link href="/cards" className="btn-primary !px-3 !py-1.5 text-xs">
            카드 내역 →
          </Link>
        </span>
      </div>

      {/* ── 월별 이용 현황 — 총 이용금액을 크게 (월 이동 가능) ── */}
      {(() => {
        const idx = months.indexOf(heroMonth);
        const hero = byMonth.get(heroMonth) ?? { card: 0n, bank: 0n };
        const heroTotal = hero.card + hero.bank;
        const [hy, hm] = [heroMonth.slice(0, 4), Number(heroMonth.slice(5, 7))];
        return (
          <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold">월별 이용 현황</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  className="rounded-md px-2.5 py-1 text-lg leading-none text-ink-mute hover:bg-line-soft disabled:opacity-30"
                  onClick={() => idx > 0 && setHeroMonth(months[idx - 1])}
                  disabled={idx <= 0}
                  aria-label="이전 달"
                >
                  ‹
                </button>
                <span className="min-w-[130px] text-center text-xl font-bold tracking-tight">
                  {hy}년 {hm}월
                </span>
                <button
                  className="rounded-md px-2.5 py-1 text-lg leading-none text-ink-mute hover:bg-line-soft disabled:opacity-30"
                  onClick={() => idx < months.length - 1 && setHeroMonth(months[idx + 1])}
                  disabled={idx >= months.length - 1}
                  aria-label="다음 달"
                >
                  ›
                </button>
              </div>
            </div>
            <div className="sm:text-right">
              <p className="font-num text-[34px] font-bold leading-none tracking-tight">
                {num(heroTotal)}
                <span className="ml-1 text-lg font-semibold text-ink-mute">원</span>
              </p>
              <p className="mt-1.5 font-num text-xs text-ink-faint">
                카드 {num(hero.card)}원{isCeo ? ` · 계좌 출금 ${num(hero.bank)}원` : ''}
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── 이번 달 KPI ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          label="이번 달 카드 사용액"
          value={cur.card}
          sub={<Link href="/cards" className="text-brand-deep hover:underline">카드 지출 관리 →</Link>}
        />
        {isCeo && (
          <Kpi
            label="이번 달 계좌 출금액"
            value={cur.bank}
            sub={<Link href="/expenses/account" className="text-brand-deep hover:underline">계좌 내역 →</Link>}
          />
        )}
        <Kpi
          label="승인 대기"
          value={cards.data?.summary.submitted.amount ?? '0'}
          sub={<span>{pendingCount}건 대기 중</span>}
          tone={pendingCount > 0 ? 'sign' : 'plain'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* ── 월별 사용 추이 ── */}
        <Section
          title="월별 사용 추이"
          desc="최근 6개월 지출 합계"
          right={
            <span className="flex items-center gap-3 text-xs text-ink-mute">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand" /> 카드
              </span>
              {isCeo && (
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#c8c2bb]" /> 계좌
                </span>
              )}
            </span>
          }
        >
          <div className="px-3 pb-2 pt-3">
            <MonthlyChart
              labels={months.map(monthLabel)}
              series={months.map((m) => {
                const s = byMonth.get(m)!;
                return { card: Number(s.card), bank: Number(s.bank) };
              })}
              highlight={5}
            />
          </div>
        </Section>

        {/* ── 사용 페이스 ── */}
        <Section
          title="사용 페이스"
          right={
            <span className="flex items-center gap-3 text-xs text-ink-mute">
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-4 rounded bg-brand" /> {monthLabel(thisMonth)} 누적
              </span>
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-4 rounded bg-ink-faint" /> {monthLabel(prevMonth)} 누적
              </span>
            </span>
          }
        >
          <div className="px-3 pb-1 pt-3">
            <PaceChart cur={curCum} prev={prevCum} todayDay={todayDay} />
          </div>
          <div className="grid grid-cols-3 divide-x divide-line-soft border-t border-line-soft">
            <div className="px-4 py-3">
              <p className="text-xs text-ink-mute">지난달 동기간 대비</p>
              <p className={`mt-1 font-num text-lg font-bold ${paceDiffPct !== null && paceDiffPct > 0 ? 'text-neg' : 'text-pos'}`}>
                {paceDiffPct === null ? '—' : `${paceDiffPct > 0 ? '+' : ''}${paceDiffPct}%`}
              </p>
              <p className="font-num text-[11px] text-ink-faint">
                {compact(BigInt(curAtToday))} vs {compact(BigInt(prevAtSameDay))}
              </p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink-mute">일평균 사용</p>
              <p className="mt-1 font-num text-lg font-bold">{compact(BigInt(dailyAvg))}원</p>
              <p className="font-num text-[11px] text-ink-faint">{todayDay}일 기준</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-ink-mute">월말 예상</p>
              <p className="mt-1 font-num text-lg font-bold text-brand-deep">{compact(BigInt(projected))}원</p>
              <p className="font-num text-[11px] text-ink-faint">현재 페이스 유지 시</p>
            </div>
          </div>
        </Section>
      </div>

      {/* ── 이번 달 용도별 TOP ── */}
      <Section title="용도별 사용 TOP" desc={`${monthLabel(thisMonth)} 카드 지출 기준`}>
        {purposeTop.length === 0 ? (
          <Empty>이번 달 카드 지출이 없습니다.</Empty>
        ) : (
          <ul className="space-y-2.5 px-5 py-4">
            {purposeTop.map(([label, v]) => (
              <li key={label}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm">{label}</span>
                  <span className="font-num text-sm font-semibold">{num(v)}원</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-line-soft">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark"
                    style={{ width: `${widthPct(v, purposeMax)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
