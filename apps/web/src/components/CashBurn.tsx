'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { big, compact, num } from '@/lib/format';
import { niceTicks } from '@/components/charts';
import { Section } from '@/components/ui';
import type { BurnMonth, BurnScope, BurnStatus, CashBurn } from '@/lib/types';

type Basis = 'available' | 'all';

const BASIS_LABEL: Record<Basis, { tab: string; cash: string }> = {
  available: { tab: '가용현금 기준', cash: '가용현금' },
  all: { tab: '전체 계좌 기준', cash: '총잔액' },
};

const STATUS: Record<BurnStatus, { label: string; chip: string; bar: string; tint: string }> = {
  GOOD: { label: '안정', chip: 'bg-emerald-50 text-pos', bar: 'bg-pos', tint: 'bg-emerald-50/50' },
  WARN: { label: '주의', chip: 'bg-amber-50 text-warn', bar: 'bg-warn', tint: 'bg-amber-50/60' },
  DANGER: { label: '위험', chip: 'bg-red-50 text-neg', bar: 'bg-neg', tint: 'bg-red-50/60' },
  NO_BURN: { label: '소진 없음', chip: 'bg-emerald-50 text-pos', bar: 'bg-pos', tint: 'bg-emerald-50/50' },
  NO_DATA: { label: '데이터 부족', chip: 'bg-line-soft text-ink-mute', bar: 'bg-line', tint: '' },
};

const STATUS_RULE = '6개월 이상 안정 · 3~6개월 주의 · 3개월 미만 위험';

/** Runway 막대의 끝 — 12개월 이상은 꽉 찬 것으로 본다 */
const RUNWAY_FULL = 12;

const ymLabel = (ym: string) => `${ym.slice(0, 4)}.${ym.slice(5, 7)}`;
const monthShort = (ym: string) => `${Number(ym.slice(5, 7))}월`;

/**
 * Burn Rate · Runway 패널 — 대시보드(요약)와 자금 페이지(요약 + 월별 그래프)에서 같이 쓴다.
 * 기준은 가용현금(운영계좌) / 전체 계좌 중 고르고, 처음엔 데이터가 있는 쪽을 보여준다.
 * 결론(Runway)을 맨 앞에 크게, 근거(순소진·총소진)를 뒤에 둔다.
 */
export function CashBurnPanel({ data, withChart }: { data: CashBurn; withChart?: boolean }) {
  const [picked, setPicked] = useState<Basis | null>(null);
  const basis: Basis = picked ?? (data.available.status === 'NO_DATA' && data.all.status !== 'NO_DATA' ? 'all' : 'available');
  const s = data[basis];
  const basisN = s.basisMonths.length;
  const cashLabel = BASIS_LABEL[basis].cash;

  return (
    <Section
      title="Burn Rate · Runway"
      desc="은행 입출금 기준 월 현금 소진 속도와, 지금 현금으로 버틸 수 있는 기간"
      right={
        <div className="flex shrink-0 rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="계산 기준">
          {(Object.keys(BASIS_LABEL) as Basis[]).map((b) => (
            <button
              key={b}
              onClick={() => setPicked(b)}
              aria-pressed={basis === b}
              className={`rounded-md px-2.5 py-1 transition-colors ${
                basis === b ? 'bg-brand-soft font-semibold text-brand-deep' : 'text-ink-mute hover:bg-line-soft'
              }`}
            >
              {BASIS_LABEL[b].tab}
            </button>
          ))}
        </div>
      }
    >
      {s.status === 'NO_DATA' ? (
        <div className="px-5 py-6 text-sm text-ink-mute">
          <p className="font-medium text-ink">계산할 입출금 기록이 아직 부족합니다.</p>
          <p className="mt-1">
            {basis === 'available'
              ? '운영계좌(사용제한 제외)에 은행거래가 없습니다. 팝빌 계좌 연동이나 거래 가져오기 후 한 달이 지나면 계산됩니다.'
              : '한 달 이상 온전히 기록된 은행거래가 필요합니다. 거래가 쌓이면 자동으로 계산됩니다.'}
          </p>
          {basis === 'available' && data.all.status !== 'NO_DATA' && (
            <button className="btn-ghost mt-3 text-xs" onClick={() => setPicked('all')}>
              전체 계좌 기준으로 보기
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid divide-y divide-line-soft lg:grid-cols-[1.3fr_1fr_1fr] lg:divide-x lg:divide-y-0">
            <RunwayTile s={s} cashLabel={cashLabel} />
            <NetBurnTile s={s} />
            <GrossBurnTile s={s} />
          </div>
          <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line-soft bg-line-page px-5 py-3 text-xs">
            <Meta label="평균 기간">
              {s.basisMonths.map(ymLabel).join(', ')} <span className="font-normal text-ink-faint">({basisN}개월)</span>
            </Meta>
            <Meta label={cashLabel}>{compact(big(s.cash))}</Meta>
            {s.excludedTransfers.count > 0 && (
              <Meta label="우리 계좌끼리 이체 제외">
                {s.excludedTransfers.count}건 · {compact(big(s.excludedTransfers.amount))}
              </Meta>
            )}
            {basisN < 3 && (
              <span className="badge bg-amber-50 text-warn">기록 {basisN}개월 · 거래가 쌓일수록 정확해집니다</span>
            )}
            {!withChart && (
              <Link href="/treasury" className="ml-auto font-medium text-brand-deep hover:underline">
                월별 추이 보기 →
              </Link>
            )}
          </footer>
        </>
      )}
      {withChart && s.monthly.some((m) => !m.noData) && (
        <div className="border-t border-line-soft">
          <BurnChart months={s.monthly} />
        </div>
      )}
    </Section>
  );
}

/** 하단 메타 정보 한 항목 — 라벨은 연하게, 값은 또렷하게 */
function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-ink-faint">{label}</span>
      <span className="font-num font-medium text-ink-soft">{children}</span>
    </span>
  );
}

function Tile({ label, en, className, children }: { label: string; en: string; className?: string; children: ReactNode }) {
  return (
    <div className={`px-5 py-4 ${className ?? ''}`}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-xs text-ink-faint">{en}</span>
      </div>
      {children}
    </div>
  );
}

/** 타일의 핵심 숫자 — 한눈에 읽히도록 크게, 단위는 작게 */
function Value({ unit, className, children }: { unit?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`font-num text-[30px] font-bold leading-none tracking-tight ${className ?? 'text-ink'}`}>
      {children}
      {unit && <span className="ml-1.5 text-sm font-medium text-ink-mute">{unit}</span>}
    </div>
  );
}

function RunwayTile({ s, cashLabel }: { s: BurnScope; cashLabel: string }) {
  const st = STATUS[s.status];
  const months = s.runwayMonths;
  const net = big(s.netBurn ?? 0);
  const fill = months === null ? 100 : Math.min(100, (months / RUNWAY_FULL) * 100);
  return (
    <Tile label="버틸 수 있는 기간" en="Runway" className={st.tint}>
      <div className="mt-2 flex items-center gap-2.5">
        <Value unit={months === null ? undefined : '개월'}>{months === null ? '∞' : months.toFixed(1)}</Value>
        <span className={`badge font-semibold ${st.chip}`} title={STATUS_RULE}>
          {st.label}
        </span>
      </div>
      <p className="mt-2.5 text-xs leading-snug text-ink-soft">
        {months === null
          ? '지금 추세면 현금이 줄지 않습니다'
          : `지금 추세면 ${s.depletionDate?.slice(0, 4)}년 ${Number(s.depletionDate?.slice(5, 7))}월쯤 현금이 바닥납니다`}
      </p>

      {/* 0~3 위험 / 3~6 주의 / 6~ 안정 구간을 바탕에 깔고, 현재 Runway 를 상태색으로 채운다 */}
      <div className="mt-3" title={STATUS_RULE}>
        <div className="relative h-2 overflow-hidden rounded-full bg-[linear-gradient(to_right,#fee2e2_0_25%,#fef3c7_25%_50%,#d1fae5_50%)] ring-1 ring-inset ring-black/5">
          <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${fill}%` }} />
          {[25, 50].map((p) => (
            <span key={p} className="absolute inset-y-0 w-px bg-white/90" style={{ left: `${p}%` }} />
          ))}
        </div>
        <div className="relative mt-1 h-4 font-num text-[12px] text-ink-faint">
          <span className="absolute left-0">0</span>
          <span className="absolute -translate-x-1/2" style={{ left: '25%' }}>
            3개월
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: '50%' }}>
            6개월
          </span>
          <span className="absolute right-0">12개월+</span>
        </div>
      </div>

      <p className="mt-1.5 font-num text-xs text-ink-faint">
        {cashLabel} {compact(big(s.cash))} ÷ 월 순소진 {net > 0n ? compact(net) : '없음'}
      </p>
    </Tile>
  );
}

function NetBurnTile({ s }: { s: BurnScope }) {
  const net = big(s.netBurn ?? 0);
  const burning = net > 0n;
  return (
    <Tile label="월 순소진" en="Net Burn">
      <div className="mt-2">
        <Value unit="/ 월" className={burning ? 'text-neg' : 'text-pos'}>
          {burning ? '−' : '+'}
          {compact(burning ? net : -net)}
        </Value>
      </div>
      <p className="mt-2.5 text-xs leading-snug text-ink-soft">
        {burning ? '통장 잔액이 매달 이만큼 줄어듭니다' : '입금이 출금보다 많아 현금이 늘고 있습니다'}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-num text-xs">
        <span className="text-ink-faint">월 평균</span>
        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-pos">입금 {compact(big(s.avgIn ?? 0))}</span>
        <span className="text-ink-faint">−</span>
        <span className="rounded-md bg-red-50 px-1.5 py-0.5 font-medium text-neg">출금 {compact(big(s.grossBurn ?? 0))}</span>
      </div>
    </Tile>
  );
}

function GrossBurnTile({ s }: { s: BurnScope }) {
  const gross = big(s.grossBurn ?? 0);
  return (
    <Tile label="월 총소진" en="Gross Burn">
      <div className="mt-2">
        <Value unit="/ 월">{compact(gross)}</Value>
      </div>
      <p className="mt-2.5 text-xs leading-snug text-ink-soft">입금과 상관없이 매달 나가는 돈의 평균</p>
      <p className="mt-2.5 font-num text-xs text-ink-faint">{num(gross)}원</p>
    </Tile>
  );
}

const C_IN = '#2f8f5b';
const C_OUT = '#cf4b3c';
const C_NET = '#2a78d6';
const GRID = '#eae5e0';
const BASE = '#a9a099';
const TICK_INK = '#857d75';

/**
 * 월별 입금·출금 막대 + 순현금흐름 선. 월말 잔액은 축 크기가 달라 막대 아래 숫자로 보여준다.
 * 기록 시작 전 달은 비우고, 첫 달(일부)·이번 달(진행 중)은 흐리게 그린다.
 */
function BurnChart({ months }: { months: BurnMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setW(Math.max(360, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 250;
  const padL = 64;
  const padR = 12;
  const padT = 14;
  const padB = 46; // 월 라벨 + 잔액 줄

  const ins = months.map((m) => Number(big(m.in)));
  const outs = months.map((m) => Number(big(m.out)));
  const nets = months.map((m) => Number(big(m.net)));
  const ticks = niceTicks(Math.min(0, ...nets), Math.max(1_000_000, ...ins, ...outs));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => padT + ((hi - v) / (hi - lo || 1)) * (H - padT - padB);
  const band = (W - padL - padR) / months.length;
  const barW = Math.min(18, band * 0.28);
  const cx = (i: number) => padL + band * (i + 0.5);
  const y0 = y(0);
  const faded = (m: BurnMonth) => m.current || m.firstPartial;

  const netPath = months
    .map((m, i) => (m.noData ? null : `${cx(i)},${y(nets[i])}`))
    .reduce<string[]>((acc, p, i, arr) => {
      if (p) acc.push(`${i === 0 || arr[i - 1] === null ? 'M' : 'L'}${p}`);
      return acc;
    }, [])
    .join(' ');

  const bar = (i: number, v: number, x: number, color: string, m: BurnMonth) => {
    const h = Math.abs(y(v) - y0);
    if (h < 0.5) return null;
    const top = y(v);
    const r = Math.min(3, h);
    return (
      <path
        d={`M${x},${y0} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y0} Z`}
        fill={color}
        opacity={(faded(m) ? 0.45 : 1) * (hover === null || hover === i ? 1 : 0.5)}
      />
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <span className="text-sm font-semibold text-ink">월별 입출금</span>
        <div className="flex items-center gap-4 text-xs text-ink-soft">
          {(
            [
              [C_IN, '입금'],
              [C_OUT, '출금'],
              [C_NET, '순현금흐름'],
            ] as const
          ).map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="px-1 pb-2">
        <div ref={boxRef} className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block" role="img" aria-label="월별 입금·출금·순현금흐름">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASE : GRID} strokeWidth={1} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={TICK_INK} className="font-num">
                  {compact(BigInt(Math.round(t)))}
                </text>
              </g>
            ))}

            {months.map((m, i) =>
              m.noData ? null : (
                <g key={m.month}>
                  {bar(i, ins[i], cx(i) - barW - 1, C_IN, m)}
                  {bar(i, outs[i], cx(i) + 1, C_OUT, m)}
                </g>
              ),
            )}

            <path d={netPath} fill="none" stroke={C_NET} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {months.map((m, i) =>
              m.noData ? null : (
                <circle key={m.month} cx={cx(i)} cy={y(nets[i])} r={3.5} fill={C_NET} stroke="#fff" strokeWidth={2} />
              ),
            )}

            {months.map((m, i) => (
              <g key={m.month}>
                <text x={cx(i)} y={H - 26} textAnchor="middle" fontSize={12.5} fill={TICK_INK}>
                  {m.month.endsWith('-01') || i === 0 ? `${m.month.slice(2, 4)}년 ${monthShort(m.month)}` : monthShort(m.month)}
                </text>
                <text x={cx(i)} y={H - 9} textAnchor="middle" fontSize={11} fill={m.noData ? '#c9c1ba' : TICK_INK} className="font-num">
                  {m.noData ? '기록 없음' : m.current ? '진행 중' : m.firstPartial ? '일부 기록' : compact(big(m.endBalance))}
                </text>
              </g>
            ))}

            {months.map((m, i) => (
              <rect
                key={m.month}
                x={padL + band * i}
                y={padT}
                width={band}
                height={H - padT - padB}
                fill="transparent"
                onMouseEnter={() => setHover(m.noData ? null : i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>

          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift"
              style={{ left: `${(cx(hover) / W) * 100}%` }}
            >
              <div className="mb-1 font-medium text-ink">
                {ymLabel(months[hover].month)}
                {months[hover].current ? ' (진행 중)' : months[hover].firstPartial ? ' (일부 기록)' : ''}
              </div>
              <div className="space-y-0.5 font-num text-ink-soft">
                <div style={{ color: C_IN }}>입금 {num(big(months[hover].in))}원</div>
                <div style={{ color: C_OUT }}>출금 {num(big(months[hover].out))}원</div>
                <div style={{ color: C_NET }}>순현금흐름 {num(big(months[hover].net))}원</div>
                <div>월말 잔액 {num(big(months[hover].endBalance))}원</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
