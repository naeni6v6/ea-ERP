'use client';

import { useState } from 'react';
import { useFilters } from '@/lib/filters';
import { useAsync } from '@/lib/useAsync';
import { fetchMonthlyPnl, recentMonths } from '@/lib/monthly';
import { MonthTimeline } from '@/components/MonthTimeline';
import { TrendChart } from '@/components/charts';
import { ErrorBox, Section, Spinner } from '@/components/ui';

/** 추이를 볼 개월 수 — 6개월은 흐름이 짧아 잘 안 읽혀서 12개월이 기본 */
const SPANS = [6, 12] as const;
type Span = (typeof SPANS)[number];

/** 기간별 — 최근 N개월을 추이 차트 + 월 단위 카드로 본다. 사업유형/부서 필터는 그대로 적용된다. */
export default function ByPeriodPage() {
  const f = useFilters();
  const [span, setSpan] = useState<Span>(12);
  const months = recentMonths(span);

  const res = useAsync(
    () => fetchMonthlyPnl(f, span),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.businessTypeId, f.departmentId, f.projectId, span],
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
            최근 {span}개월 월별 손익 — 상단의 사업유형·부서 필터가 적용됩니다 (기간 필터는 무시)
          </p>
        </div>
        <span className="font-num text-xs text-ink-faint">
          {months[span - 1].from} ~ {months[0].to}
        </span>
      </div>

      <Section
        title="월별 추이"
        desc="매출 막대 · 영업이익 선"
        right={
          <div className="flex rounded-lg border border-line p-0.5 text-xs" role="group" aria-label="조회 기간">
            {SPANS.map((n) => (
              <button
                key={n}
                onClick={() => setSpan(n)}
                aria-pressed={span === n}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  span === n ? 'bg-brand-soft font-semibold text-brand-deep' : 'text-ink-mute hover:bg-line-soft'
                }`}
              >
                {n}개월
              </button>
            ))}
          </div>
        }
      >
        <TrendChart
          points={[...res.data].reverse().map((m, i) => ({
            // 해가 바뀌는 지점을 알 수 있게 첫 달과 1월에는 연도를 붙인다
            label: i === 0 || m.id.slice(5, 7) === '01' ? `${m.id.slice(2, 4)}년 ${m.short}` : m.short,
            sales: m.sales,
            profit: m.operatingProfit,
          }))}
        />
      </Section>

      <Section title="월별 타임라인" desc="달을 누르면 아래에 그 달의 상세 손익이 펼쳐집니다 · 점 색: 흑자 초록 / 적자 빨강 / 기록 없음 회색">
        <MonthTimeline rows={res.data} />
      </Section>
    </div>
  );
}
