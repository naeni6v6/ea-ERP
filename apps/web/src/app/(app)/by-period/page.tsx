'use client';

import { useFilters } from '@/lib/filters';
import { useAsync } from '@/lib/useAsync';
import { fetchMonthlyPnl, MONTHS_BACK, recentMonths } from '@/lib/monthly';
import { PnlCardGrid } from '@/components/PnlCards';
import { TrendChart } from '@/components/charts';
import { ErrorBox, Section, Spinner } from '@/components/ui';

/** 기간별 — 최근 6개월을 추이 차트 + 월 단위 카드로 본다. 사업유형/부서 필터는 그대로 적용된다. */
export default function ByPeriodPage() {
  const f = useFilters();
  const months = recentMonths();

  const res = useAsync(
    () => fetchMonthlyPnl(f),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.businessTypeId, f.departmentId, f.projectId],
  );

  if (res.loading && !res.data) return <Spinner />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;
  if (!res.data) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="page-title">
            기간별 손익 <span className="badge ml-1 bg-amber-50 text-warn">* 샘플 데이터입니다</span>
          </h1>
          <p className="mt-1 text-xs text-ink-faint">
            최근 {MONTHS_BACK}개월 월별 손익 — 상단의 사업유형·부서 필터가 적용됩니다 (기간 필터는 무시)
          </p>
        </div>
        <span className="font-num text-xs text-ink-faint">
          {months[MONTHS_BACK - 1].from} ~ {months[0].to}
        </span>
      </div>

      <Section title="월별 추이" desc="매출 막대 · 영업이익 선">
        <TrendChart
          points={[...res.data].reverse().map((m) => ({
            label: m.short,
            sales: m.sales,
            profit: m.operatingProfit,
          }))}
        />
      </Section>

      <PnlCardGrid rows={res.data} variant="gradient" />
    </div>
  );
}
