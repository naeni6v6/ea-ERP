'use client';

import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { PnlCardGrid } from '@/components/PnlCards';
import { CompareBars } from '@/components/charts';
import { ErrorBox, Section, Spinner } from '@/components/ui';
import type { BreakdownRow } from '@/lib/types';

/** 사업부서별 — 부서(본사/라곰/DAP …) 하나당 카드 한 장으로 손익 상세를 본다 */
export default function ByDepartmentPage() {
  const f = useFilters();
  const q = f.query;
  const { departments } = useSession();

  const res = useAsync(
    () =>
      api.get<{ range: { from: string; to: string }; rows: BreakdownRow[] }>(
        '/metrics/pnl/breakdown',
        { ...q, groupBy: 'department' },
      ),
    [q.preset, q.from, q.to, q.businessTypeId, q.departmentId, q.projectId],
  );

  if (res.loading && !res.data) return <Spinner />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  if (!res.data) return null;

  // 필터에서 특정 부서를 골랐다면 그 부서만 보여준다
  const items = departments
    .filter((d) => d.isActive && (!f.departmentId || d.id === f.departmentId))
    .map((d) => ({ id: d.id, name: d.name }));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            사업부서별 손익 <span className="badge ml-1 bg-amber-50 text-warn">* 샘플 데이터입니다</span>
          </h1>
          <p className="mt-1 text-xs text-ink-faint">
            부서별 매출·비용·이익 상세 — 공통비는 배부하지 않습니다
          </p>
        </div>
        <span className="font-num text-xs text-ink-faint">
          {res.data.range.from} ~ {res.data.range.to}
        </span>
      </div>

      {res.data.rows.length > 0 && (
        <Section title="부서별 비교" desc="매출 · 영업이익">
          <CompareBars
            rows={res.data.rows.map((r) => ({ name: r.name, sales: r.sales, profit: r.operatingProfit }))}
          />
        </Section>
      )}

      <PnlCardGrid rows={res.data.rows} items={items} variant="accent" />
    </div>
  );
}
