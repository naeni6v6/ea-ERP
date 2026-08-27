'use client';

import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { PnlCardGrid } from '@/components/PnlCards';
import { CompareBars } from '@/components/charts';
import { ErrorBox, Section, Spinner } from '@/components/ui';
import type { BreakdownRow } from '@/lib/types';

/** 유형별 — 사업유형(용역/제품/정부사업 …) 하나당 카드 한 장으로 손익 상세를 본다 */
export default function ByTypePage() {
  const f = useFilters();
  const q = f.query;
  const { businessTypes } = useSession();

  const res = useAsync(
    () =>
      api.get<{ range: { from: string; to: string }; rows: BreakdownRow[] }>(
        '/metrics/pnl/breakdown',
        { ...q, groupBy: 'businessType' },
      ),
    [q.preset, q.from, q.to, q.businessTypeId, q.departmentId, q.projectId],
  );

  if (res.loading && !res.data) return <Spinner />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  if (!res.data) return null;

  // 필터에서 특정 유형을 골랐다면 그 유형만 보여준다
  const items = businessTypes
    .filter((b) => b.isActive && (!f.businessTypeId || b.id === f.businessTypeId))
    .map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            유형별 손익 <span className="badge ml-1 bg-amber-50 text-warn">* 샘플 데이터입니다</span>
          </h1>
          <p className="mt-1 text-xs text-ink-faint">
            사업유형별 매출·비용·이익 상세 — 공통비는 배부하지 않습니다
          </p>
        </div>
        <span className="font-num text-xs text-ink-faint">
          {res.data.range.from} ~ {res.data.range.to}
        </span>
      </div>

      {res.data.rows.length > 0 && (
        <Section title="유형별 비교" desc="매출 · 영업이익">
          <CompareBars
            rows={res.data.rows.map((r) => ({ name: r.name, sales: r.sales, profit: r.operatingProfit }))}
          />
        </Section>
      )}

      <PnlCardGrid rows={res.data.rows} items={items} />
    </div>
  );
}
