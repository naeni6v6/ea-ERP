'use client';

import { big, compact, num, pct, signClass } from '@/lib/format';
import { Empty } from '@/components/ui';
import type { BreakdownRow } from '@/lib/types';

/** 카드 안에 보여줄 손익 항목 — "매출: 얼마, 손익: 얼마" 형태의 상세 6줄 */
const CARD_ROWS: { key: keyof BreakdownRow; label: string; sign?: boolean; minus?: boolean }[] = [
  { key: 'sales', label: '매출' },
  { key: 'cogs', label: '매출원가', minus: true },
  { key: 'grossProfit', label: '매출총이익', sign: true },
  { key: 'sga', label: '판관비', minus: true },
  { key: 'operatingProfit', label: '영업이익', sign: true },
  { key: 'netIncome', label: '당기순이익', sign: true },
];

/**
 * 애플 시스템 컬러 기반 팔레트.
 * - gradient: 유형별/기간별 — iOS 위젯풍 대각 그라데이션 헤더
 * - accent: 사업부서별 — 화이트 카드 + 컬러 악센트 (실루엣 자체가 달라 페이지 혼동 방지)
 */
const APPLE: { from: string; to: string; accent: string }[] = [
  // 무지개 순서 (빨→주→노→초→파→남→보), 애플 시스템 컬러 톤
  { from: '#FF453A', to: '#FF7A6E', accent: '#E0362C' }, // 빨강 red
  { from: '#FF9F0A', to: '#FFBE55', accent: '#E68A00' }, // 주황 orange
  { from: '#F0AD0A', to: '#FFD056', accent: '#C7920A' }, // 노랑 yellow(gold)
  { from: '#30C158', to: '#6EDD8F', accent: '#1FA347' }, // 초록 green
  { from: '#0A84FF', to: '#5AB2FF', accent: '#0A84FF' }, // 파랑 blue
  { from: '#5E5CE6', to: '#8D8BF2', accent: '#5E5CE6' }, // 남색 indigo
  { from: '#BF5AF2', to: '#D68DF7', accent: '#AE45E6' }, // 보라 purple
];

export type PnlCardVariant = 'gradient' | 'accent';

function PnlCard({ row, color, variant }: { row: BreakdownRow; color: (typeof APPLE)[number]; variant: PnlCardVariant }) {
  const op = big(row.operatingProfit);
  const opText = `${op < 0n ? '−' : ''}${compact(op < 0n ? -op : op)}`;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white transition-all duration-200 hover:-translate-y-0.5"
      style={{
        boxShadow: `0 1px 2px rgba(20,18,16,0.04), 0 10px 28px -12px ${color.accent}40, 0 2px 8px -2px rgba(20,18,16,0.06)`,
      }}
    >
      {variant === 'gradient' ? (
        /* 유형별/기간별 — 그라데이션 헤더 */
        <div className="px-5 pb-3.5 pt-4" style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-base font-bold text-white drop-shadow-sm">{row.name}</h3>
            <span className="shrink-0 font-num text-xl font-bold text-white drop-shadow-sm">{opText}</span>
          </div>
          <p className="mt-0.5 text-xs font-medium text-white/85">영업이익 기준</p>
        </div>
      ) : (
        /* 사업부서별 — 화이트 헤더 + 컬러 악센트 (색 워시로 존재감 강화) */
        <div
          className="relative px-5 pb-3 pt-4"
          style={{ background: `linear-gradient(135deg, ${color.from}26, ${color.to}0D 55%, transparent)` }}
        >
          <span
            className="absolute inset-y-0 left-0 w-1.5"
            style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }}
          />
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="flex min-w-0 items-center gap-2 truncate text-base font-bold text-ink">
              <span
                className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white"
                style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})`, boxShadow: `0 1px 4px ${color.accent}66` }}
              />
              <span className="truncate">{row.name}</span>
            </h3>
            <span className="shrink-0 font-num text-xl font-bold" style={{ color: color.accent }}>
              {opText}
            </span>
          </div>
          <p className="mt-0.5 pl-5 text-xs font-semibold" style={{ color: `${color.accent}B3` }}>
            영업이익 기준
          </p>
        </div>
      )}

      <dl className={`space-y-2 px-5 ${variant === 'gradient' ? 'pt-4' : 'border-t border-line-soft pt-3.5'}`}>
        {CARD_ROWS.map((r) => {
          const v = big(row[r.key] as string);
          return (
            <div key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
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

      <div className="mx-5 mb-4 mt-3.5 flex items-center justify-between border-t border-line-soft pt-2.5 text-xs text-ink-mute">
        <span>영업이익률 {pct(row.operatingMarginPct)}</span>
        <span>순이익률 {pct(row.netMarginPct)}</span>
      </div>
    </div>
  );
}

/**
 * 손익 분해 카드 그리드 — 유형별·기간별(gradient)/사업부서별(accent) 공용.
 * items(전체 축 목록)를 주면 집계가 없는 축도 0원 카드로 채운다.
 */
export function PnlCardGrid({
  rows,
  items,
  variant = 'gradient',
}: {
  rows: BreakdownRow[];
  items?: { id: string; name: string }[];
  variant?: PnlCardVariant;
}) {
  let merged = rows;
  if (items?.length) {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const zero: Omit<BreakdownRow, 'id' | 'name'> = {
      sales: '0',
      cogs: '0',
      grossProfit: '0',
      sga: '0',
      operatingProfit: '0',
      nonOpIncome: '0',
      nonOpExpense: '0',
      preTaxIncome: '0',
      incomeTax: '0',
      netIncome: '0',
      grossMarginPct: null,
      operatingMarginPct: null,
      netMarginPct: null,
    };
    merged = [
      ...items.map((it) => byId.get(it.id) ?? { id: it.id, name: it.name, ...zero }),
      // 축이 지정되지 않은 라인 등 목록 밖의 행은 뒤에 붙인다 — 예: (미지정)
      ...rows.filter((r) => !r.id || !items.some((it) => it.id === r.id)),
    ];
  }

  if (!merged.length) return <Empty>표시할 데이터가 없습니다.</Empty>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {merged.map((r, i) => (
        <PnlCard key={r.id ?? '(none)'} row={r} color={APPLE[i % APPLE.length]} variant={variant} />
      ))}
    </div>
  );
}
