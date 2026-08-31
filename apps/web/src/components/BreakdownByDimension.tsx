'use client';

import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useAsync } from '@/lib/useAsync';
import { PnlCardGrid } from '@/components/PnlCards';
import { CompareBars } from '@/components/charts';
import { ErrorBox, Section, Spinner } from '@/components/ui';
import type { BreakdownRow } from '@/lib/types';

/**
 * 차원별 손익 화면의 공통 뼈대 — 유형별(사업유형)·부서별이 이 컴포넌트를 공유한다.
 * 축(groupBy)과 카드로 펼칠 항목 목록만 다르고 조회·차트·레이아웃은 같다.
 */
export function BreakdownByDimension({
  groupBy,
  title,
  desc,
  compareTitle,
  items,
  variant,
}: {
  groupBy: 'businessType' | 'department';
  title: string;
  desc: string;
  compareTitle: string;
  /** 필터로 하나만 고른 경우 그 항목만 넘어온다 */
  items: { id: string; name: string }[];
  variant?: 'accent' | 'gradient';
}) {
  const q = useFilters().query;

  const res = useAsync(
    () =>
      api.get<{ range: { from: string; to: string }; rows: BreakdownRow[] }>(
        '/metrics/pnl/breakdown',
        { ...q, groupBy },
      ),
    [q.preset, q.from, q.to, q.businessTypeId, q.departmentId, q.projectId],
  );

  if (res.loading && !res.data) return <Spinner />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  if (!res.data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="page-title">
            {title} <span className="badge ml-1 bg-amber-50 text-warn">* 샘플 데이터입니다</span>
          </h1>
          <p className="mt-1 text-xs text-ink-faint">{desc}</p>
        </div>
        <span className="font-num text-xs text-ink-faint">
          {res.data.range.from} ~ {res.data.range.to}
        </span>
      </div>

      {res.data.rows.length > 0 && (
        <Section title={compareTitle} desc="매출 · 영업이익">
          <CompareBars
            rows={res.data.rows.map((r) => ({
              name: r.name,
              sales: r.sales,
              profit: r.operatingProfit,
            }))}
          />
        </Section>
      )}

      <PnlCardGrid rows={res.data.rows} items={items} variant={variant} />
    </div>
  );
}
