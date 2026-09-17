'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { big, compact, num, signClass } from '@/lib/format';
import type { Money } from '@/lib/format';

/**
 * 자잘한 차트 — 라이브러리 없이 SVG로 그린다.
 * 색은 검증된 2색 팔레트 — 카드 기준 CVD·명암비 통과:
 *   매출 = 브랜드 진주황, 이익 = 파랑. 시리즈 색은 항상 이 배정을 따른다(순서 고정).
 */
export const SERIES = {
  sales: { color: '#dd7a0a', label: '매출' },
  profit: { color: '#2a78d6', label: '영업이익' },
} as const;

const GRID = '#eae5e0'; // 헤어라인 그리드 (line 토큰)
const BASE = '#a9a099'; // 0 기준선
const TICK_INK = '#857d75'; // 축 라벨 (ink-mute)

/**
 * 구성비용 범주 색 — 매출/이익 2색 팔레트와 별개. Apple 시스템 컬러를 빨강→주황→노랑→초록→파랑→보라 순으로 쓴다.
 * 같은 색을 두 톤으로 나눠 쓴다: 범례의 작은 점은 원색(작아서 채도가 있어야 보인다),
 * 도넛의 넓은 면은 연한 톤(원색으로 크게 칠하면 화면이 시끄러워진다).
 */
export const CATEGORY_COLORS = [
  '#FF3B30', // systemRed
  '#FF9500', // systemOrange
  '#FFCC00', // systemYellow
  '#34C759', // systemGreen
  '#007AFF', // systemBlue
  '#AF52DE', // systemPurple
];
/** 위 원색을 흰색과 45% 섞은 톤 — 넓은 면(도넛 조각)용 */
const CATEGORY_SOFT = ['#FF938D', '#FFC573', '#FFE373', '#8FE0A4', '#73B6FF', '#D3A0ED'];
const REST_COLOR = '#8E8E93'; // systemGray — '기타'
const REST_SOFT = '#C1C1C4';

export const categoryColor = (i: number): string =>
  i < CATEGORY_COLORS.length ? CATEGORY_COLORS[i] : REST_COLOR;
/** 도넛 조각처럼 넓게 칠할 때 쓰는 연한 톤 */
export const categorySoftColor = (i: number): string =>
  i < CATEGORY_SOFT.length ? CATEGORY_SOFT[i] : REST_SOFT;

const toNum = (v: Money): number => Number(big(v));

/** 0을 포함하는 깔끔한 눈금 (1/2/2.5/5 × 10^k) */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (lo > 0) lo = 0;
  if (hi < 0) hi = 0;
  if (lo === hi) hi = 1;
  const span = hi - lo;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  // 양 끝 눈금은 데이터를 반드시 감싸야 한다 — hi 이하에서 멈추면 최댓값이 축 위로 뚫고 나간다
  const first = Math.floor(lo / step);
  const last = Math.ceil(hi / step);
  const ticks: number[] = [];
  for (let k = first; k <= last; k++) ticks.push(k * step);
  return ticks;
}

function Legend({ keys }: { keys: (keyof typeof SERIES)[] }) {
  return (
    <div className="flex items-center gap-4 text-xs text-ink-soft">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[k].color }} />
          {SERIES[k].label}
        </span>
      ))}
    </div>
  );
}

export interface TrendPoint {
  label: string; // 예: "3월"
  sales: Money;
  profit: Money;
}

/**
 * 월별 추이 — 매출 컬럼 + 영업이익 라인(같은 원 단위 축).
 * 컬럼 상단 4px 라운드는 기준선에서 시작, 라인 2px·마커 r4+흰 링.
 *
 * 폭은 컨테이너에 맞추고 높이는 고정한다. viewBox 를 폭에 맞춰 통째로 늘리면
 * 넓은 화면에서 차트 높이와 축 글자까지 같이 커져(1700px 폭 → 높이 600px) 한눈에 안 들어온다.
 */
export function TrendChart({ points, height = 260 }: { points: TrendPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // clientWidth 는 zoom(큰 모니터 확대)과 무관한 CSS px — SVG 좌표와 1:1
    const update = () => setW(Math.max(320, el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = height;
  const padL = 64;
  const padR = 12;
  const padT = 14;
  const padB = 28;

  const sales = points.map((p) => toNum(p.sales));
  const profit = points.map((p) => toNum(p.profit));
  const dataLo = Math.min(0, ...profit, ...sales);
  const dataHi = Math.max(0, ...sales, ...profit);
  // 데이터가 전부 0이면 임의의 원 단위 축(0~100만 원)으로 빈 차트를 그린다
  const ticks = niceTicks(dataLo, dataLo === 0 && dataHi === 0 ? 1_000_000 : dataHi);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => padT + ((hi - v) / (hi - lo || 1)) * (H - padT - padB);
  const plotW = W - padL - padR;
  const band = plotW / Math.max(points.length, 1);
  const barW = Math.min(28, band * 0.45);
  const cx = (i: number) => padL + band * (i + 0.5);
  const y0 = y(0);

  const linePath = profit.map((v, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${y(v)}`).join(' ');

  return (
    <div>
      <div className="flex items-center justify-end px-4 pt-3">
        <Legend keys={['sales', 'profit']} />
      </div>
      <div className="px-1 pb-2">
        <div ref={boxRef} className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="block" role="img" aria-label="월별 매출·영업이익 추이">
            {/* 그리드 + 눈금 */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASE : GRID} strokeWidth={1} />
                <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill={TICK_INK} className="font-num">
                  {compact(BigInt(Math.round(t)))}
                </text>
              </g>
            ))}

            {/* 매출 컬럼 — 데이터 쪽만 4px 라운드, 기준선 쪽은 직각 */}
            {sales.map((v, i) => {
              const h = Math.abs(y(v) - y0);
              const top = v >= 0 ? y(v) : y0;
              const r = Math.min(4, h);
              const x = cx(i) - barW / 2;
              const d =
                v >= 0
                  ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`
                  : `M${x},${top} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + barW - r} Q${x + barW},${top + h} ${x + barW},${top + h - r} V${top} Z`;
              return <path key={i} d={h < 0.5 ? '' : d} fill={SERIES.sales.color} opacity={hover === null || hover === i ? 1 : 0.45} />;
            })}

            {/* 영업이익 라인 + 마커(흰 2px 링) */}
            <path d={linePath} fill="none" stroke={SERIES.profit.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {profit.map((v, i) => (
              <circle key={i} cx={cx(i)} cy={y(v)} r={4} fill={SERIES.profit.color} stroke="#ffffff" strokeWidth={2} />
            ))}

            {/* 월 라벨 */}
            {points.map((p, i) => (
              <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" fontSize={12.5} fill={TICK_INK}>
                {p.label}
              </text>
            ))}

            {/* 호버 히트 영역 */}
            {points.map((_, i) => (
              <rect
                key={i}
                x={padL + band * i}
                y={padT}
                width={band}
                height={H - padT - padB}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            ))}
          </svg>

          {hover !== null && (
            <div
              className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lift"
              style={{ left: `${(cx(hover) / W) * 100}%` }}
            >
              <div className="mb-1 font-medium text-ink">{points[hover].label}</div>
              <div className="space-y-0.5 font-num text-ink-soft">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: SERIES.sales.color }} />
                  매출 {num(points[hover].sales)}원
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: SERIES.profit.color }} />
                  영업이익 {num(points[hover].profit)}원
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface CompareRow {
  name: string;
  sales: Money;
  profit: Money;
}

/**
 * 축별 비교 — 카테고리(사업유형/부서)마다 매출·영업이익 가로 막대 두 줄.
 * 막대는 공통한 트랙 위에 얹게 그리고, 값은 우측 고정 열에 정렬해 라벨이 흔들리지 않게 한다.
 * 정확한 원 단위 값은 호버 title로 제공한다.
 */
export function CompareBars({ rows }: { rows: CompareRow[] }) {
  const vals = rows.flatMap((r) => [toNum(r.sales), toNum(r.profit)]);
  const posMax = Math.max(0, ...vals);
  const negMax = Math.max(0, ...vals.map((v) => -v));
  const total = posMax + negMax || 1;
  const zeroPct = (negMax / total) * 100; // 0 기준선 위치
  const wPct = (v: number) => (Math.abs(v) / total) * 100;

  /** 트랙 + 막대 한 줄. 양수는 0에서 오른쪽, 음수는 0에서 왼쪽으로 */
  const lane = (v: number, color: string) => {
    const w = Math.max(wPct(v), v === 0 ? 0 : 1);
    const pos = v >= 0;
    return (
      <div className="relative h-2 overflow-hidden rounded-full bg-line-soft">
        {negMax > 0 && (
          <span className="absolute inset-y-0 z-10 w-px bg-ink-faint/50" style={{ left: `${zeroPct}%` }} />
        )}
        <span
          className="absolute inset-y-0 rounded-full"
          style={{ background: color, width: `${w}%`, left: pos ? `${zeroPct}%` : `${zeroPct - w}%` }}
        />
      </div>
    );
  };

  /** 우측 값 열 — 한 줄에 색점 + 축약 금액 */
  const val = (v: number, color: string, sign: boolean) => (
    <span className="flex items-center justify-end gap-1.5 whitespace-nowrap font-num text-[15px] leading-none">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className={sign ? signClass(BigInt(Math.round(v))) : 'text-ink-soft'}>
        {compact(BigInt(Math.round(v)))}
      </span>
    </span>
  );

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex justify-end">
        <Legend keys={['sales', 'profit']} />
      </div>
      <div className="divide-y divide-line-soft">
        {rows.map((r) => {
          const s = toNum(r.sales);
          const p = toNum(r.profit);
          return (
            <div
              key={r.name}
              className="grid grid-cols-[minmax(96px,150px)_1fr_84px] items-center gap-x-4 rounded-md px-1 py-2.5 transition-colors hover:bg-line-soft/50"
              title={`${r.name} — 매출 ${num(r.sales)}원 · 영업이익 ${num(r.profit)}원`}
            >
              <div className="truncate text-[15px] font-medium text-ink-soft">{r.name}</div>
              <div className="space-y-1.5">
                {lane(s, SERIES.sales.color)}
                {lane(p, SERIES.profit.color)}
              </div>
              <div className="space-y-1.5">
                {val(s, SERIES.sales.color, false)}
                {val(p, SERIES.profit.color, true)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: Money;
}

/**
 * 구성비 도넛 — 값이 큰 순서로 시계방향, 가운데에 합계를 얹는다.
 * 조각 사이는 배경색 간격으로 끊어 인접 색이 붙어 보이지 않게 한다.
 */
export function DonutChart({
  slices,
  centerTop,
  centerBottom,
  size = 220,
}: {
  slices: DonutSlice[];
  /** 가운데 큰 글씨 — 보통 합계 */
  centerTop: string;
  /** 가운데 작은 글씨 — 보통 일평균 */
  centerBottom?: string;
  size?: number;
}) {
  // useId()는 ":r0:" 처럼 콜론을 포함해 url(#...) 참조가 깨질 수 있어 영숫자만 남긴다
  const shadowId = `donut-shadow-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const vals = slices.map((s) => Math.max(0, toNum(s.value)));
  const total = vals.reduce((a, v) => a + v, 0);
  const R = 62;
  const SW = 22;
  const C = 2 * Math.PI * R;
  const GAP = total > 0 && vals.filter((v) => v > 0).length > 1 ? 3 : 0;

  let acc = 0;
  const arcs = vals.map((v, i) => {
    const frac = total > 0 ? v / total : 0;
    const len = Math.max(0, frac * C - GAP);
    const arc = { len, offset: acc, color: categorySoftColor(i), on: v > 0 };
    acc += frac * C;
    return arc;
  });

  /**
   * 가운데 글자는 링 안쪽(지름 = 2×(R−SW/2) = 102)에 들어가야 한다.
   * 한글은 약 1em, 숫자·기호는 약 0.55em 폭이므로 글자 수가 아니라 실제 폭으로 크기를 정한다.
   */
  const emWidth = (s: string) =>
    [...s].reduce((w, ch) => w + (/[ᄀ-ᇿ㄰-㆏가-힯]/.test(ch) ? 1 : 0.55), 0);
  const fitSize = (s: string, max: number, ratio: number) =>
    Math.min(max, Math.max(9, ((2 * (R - SW / 2)) * ratio) / Math.max(emWidth(s), 0.1)));
  const topSize = fitSize(centerTop, 20, 0.72);
  const bottomSize = fitSize(centerBottom ?? '', 10.5, 0.74);

  return (
    <svg
      viewBox="0 0 176 176"
      width={size}
      height={size}
      role="img"
      aria-label={`지출 구성 — 합계 ${centerTop}`}
      className="shrink-0"
    >
      <defs>
        {/* 링 아래로 떨어지는 부드러운 그림자 — 색 위에 얹지 않고 뒤로만 깔린다 */}
        <filter id={shadowId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#1c1c1e" floodOpacity="0.22" />
        </filter>
      </defs>
      <g transform="translate(88,88) rotate(-90)">
        <circle r={R} fill="none" stroke="#f2efec" strokeWidth={SW} />
        <g filter={`url(#${shadowId})`}>
          {arcs.map(
            (a, i) =>
              a.on && (
                <circle
                  key={i}
                  r={R}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={SW}
                  strokeDasharray={`${a.len} ${C - a.len}`}
                  strokeDashoffset={-a.offset}
                />
              ),
          )}
        </g>
      </g>
      <text
        x="88"
        y={centerBottom ? 86 : 93}
        textAnchor="middle"
        className="font-num"
        fontSize={topSize.toFixed(1)}
        fontWeight="700"
        fill="#2a2724"
      >
        {centerTop}
      </text>
      {centerBottom && (
        <text x="88" y="102" textAnchor="middle" fontSize={bottomSize.toFixed(1)} fill="#857d75">
          {centerBottom}
        </text>
      )}
    </svg>
  );
}
