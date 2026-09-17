'use client';

import { useState } from 'react';
import { big, compact, num, pct, signClass } from '@/lib/format';
import type { MonthlyPnlRow } from '@/lib/monthly';

/** 상세 패널의 손익 항목 — 유형별 카드와 같은 6줄 */
const DETAIL_ROWS: { key: keyof MonthlyPnlRow; label: string; sign?: boolean; minus?: boolean }[] = [
  { key: 'sales', label: '매출' },
  { key: 'cogs', label: '매출원가', minus: true },
  { key: 'grossProfit', label: '매출총이익', sign: true },
  { key: 'sga', label: '판관비', minus: true },
  { key: 'operatingProfit', label: '영업이익', sign: true },
  { key: 'netIncome', label: '당기순이익', sign: true },
];

const hasData = (m: MonthlyPnlRow) =>
  [m.sales, m.cogs, m.sga, m.operatingProfit, m.netIncome].some((v) => big(v) !== 0n);

/** 부호 붙은 축약 금액 — 음수는 유니코드 마이너스 */
const signed = (v: bigint, plus = false) => `${v < 0n ? '−' : plus && v > 0n ? '+' : ''}${compact(v < 0n ? -v : v)}`;

/**
 * 기간별 손익 타임라인 — 달을 왼쪽(과거)에서 오른쪽(이번 달)으로 한 줄에 잇고,
 * 달을 누르면 아래에 그 달의 상세 손익과 전월 대비 증감을 펼친다.
 * rows 는 fetchMonthlyPnl 결과(최신 달이 앞)를 그대로 받는다.
 */
export function MonthTimeline({ rows }: { rows: MonthlyPnlRow[] }) {
  const months = [...rows].reverse();
  const current = months[months.length - 1];
  // 처음엔 기록이 있는 가장 최근 달을 연다 (이번 달이 비어 있으면 지난달)
  const fallback = [...months].reverse().find(hasData) ?? current;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = months.find((m) => m.id === selectedId) ?? fallback;
  const selIdx = months.indexOf(selected);
  const prev = selIdx > 0 ? months[selIdx - 1] : null;
  const maxSales = months.reduce((mx, m) => (big(m.sales) > mx ? big(m.sales) : mx), 0n);

  if (!current) return null;

  return (
    <div>
      {/* ── 타임라인 ── */}
      <div className="overflow-x-auto px-4 pb-4 pt-3">
        <ol
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${months.length}, minmax(96px, 1fr))` }}
        >
          {/* 달을 잇는 가로선 — 연도 라벨(20px) + 점 중심(9px) 높이 */}
          <span className="absolute inset-x-6 top-[29px] h-0.5 rounded-full bg-line" aria-hidden />
          {months.map((m, i) => {
            const on = hasData(m);
            const op = big(m.operatingProfit);
            const isSel = m.id === selected.id;
            const isCurrent = m.id === current.id;
            const year = m.id.slice(0, 4);
            const showYear = i === 0 || m.id.slice(5, 7) === '01';
            const salesPct = maxSales > 0n ? Number((big(m.sales) * 1000n) / maxSales) / 10 : 0;
            return (
              <li key={m.id} className="flex flex-col items-center px-1">
                <span className="h-5 text-[13px] font-semibold text-ink-mute">{showYear ? `${year}년` : ''}</span>
                <span
                  className={`relative z-10 h-[18px] w-[18px] rounded-full border-[3px] border-white shadow-sm transition-all ${
                    !on ? 'bg-line' : op < 0n ? 'bg-neg' : 'bg-pos'
                  } ${isSel ? 'scale-125 ring-4 ring-brand-ring' : ''}`}
                  aria-hidden
                />
                <span className={`mt-1.5 text-sm ${isSel ? 'font-bold text-brand-deep' : isCurrent ? 'font-semibold text-ink' : 'text-ink-mute'}`}>
                  {m.short}
                </span>
                <button
                  onClick={() => setSelectedId(m.id)}
                  aria-pressed={isSel}
                  title={`${m.name} 상세 보기`}
                  className={`mt-2 w-full rounded-xl border px-2.5 py-2.5 text-left transition-all ${
                    isSel
                      ? 'border-brand bg-brand-soft/60 shadow-soft'
                      : on
                        ? 'border-line bg-white hover:border-ink-faint hover:shadow-soft'
                        : 'border-dashed border-line bg-line-soft/40 hover:bg-line-soft'
                  }`}
                >
                  {on ? (
                    <>
                      <div className="text-[12px] text-ink-faint">영업이익</div>
                      <div className={`font-num text-base font-bold leading-tight ${signClass(op)}`}>{signed(op)}</div>
                      <div className="mt-1.5 text-[12px] text-ink-faint">
                        매출 <span className="font-num text-ink-soft">{compact(big(m.sales))}</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-line-soft">
                        <div className="h-full rounded-full bg-brand/70" style={{ width: `${salesPct}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="py-3 text-center text-[12px] text-ink-faint">기록 없음</div>
                  )}
                  {isCurrent && (
                    <div className="mt-1.5 text-center text-[11px] font-semibold text-brand-deep">진행 중</div>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── 선택한 달 상세 ── */}
      <div className="border-t border-line-soft bg-line-page/60 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-base font-bold">
            {selected.name} 손익
            {selected.id === current.id && (
              <span className="badge ml-2 bg-brand-soft align-middle text-brand-deep">오늘까지 집계</span>
            )}
          </h3>
          {prev && (
            <span className="text-xs text-ink-mute">
              전월({prev.short}) 대비 매출{' '}
              <b className={`font-num ${signClass(big(selected.sales) - big(prev.sales))}`}>
                {signed(big(selected.sales) - big(prev.sales), true)}
              </b>
              {' · '}영업이익{' '}
              <b className={`font-num ${signClass(big(selected.operatingProfit) - big(prev.operatingProfit))}`}>
                {signed(big(selected.operatingProfit) - big(prev.operatingProfit), true)}
              </b>
            </span>
          )}
        </div>
        <dl className="mt-3 grid gap-x-12 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {DETAIL_ROWS.map((r) => {
            const v = big(selected[r.key] as string);
            return (
              <div key={r.key} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-1.5 text-sm">
                <dt className="text-ink-mute">
                  {r.minus && <span className="mr-1 text-ink-faint">(−)</span>}
                  {r.label}
                </dt>
                <dd className={`font-num ${r.sign ? `font-medium ${signClass(v)}` : 'text-ink'}`}>
                  {num(v)}
                  <span className="ml-0.5 text-[13px] font-normal text-ink-faint">원</span>
                </dd>
              </div>
            );
          })}
        </dl>
        <div className="mt-2.5 flex gap-6 text-xs text-ink-mute">
          <span>영업이익률 {pct(selected.operatingMarginPct)}</span>
          <span>순이익률 {pct(selected.netMarginPct)}</span>
        </div>
      </div>
    </div>
  );
}
