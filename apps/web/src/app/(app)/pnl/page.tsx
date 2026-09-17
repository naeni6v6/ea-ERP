'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useAsync } from '@/lib/useAsync';
import { big, num, pct, signClass } from '@/lib/format';
import { BreakdownTable } from '@/components/BreakdownTable';
import { ErrorBox, Section, Spinner } from '@/components/ui';
import type { BreakdownRow, Pnl } from '@/lib/types';

type GroupBy = 'businessType' | 'department' | 'project' | 'account';

const TABS: { key: GroupBy; label: string }[] = [
  { key: 'businessType', label: '사업유형별' },
  { key: 'department', label: '부서별' },
  { key: 'project', label: '프로젝트별' },
  { key: 'account', label: '계정과목별' },
];

/** 손익계산서 행 정의 — 서버 buildPnl 구조와 1:1 */
const ROWS: { key: keyof Pnl; label: string; strong?: boolean; indent?: boolean; minus?: boolean }[] = [
  { key: 'sales', label: '매출액', strong: true },
  { key: 'cogs', label: '매출원가', indent: true, minus: true },
  { key: 'grossProfit', label: '매출총이익', strong: true },
  { key: 'sga', label: '판매비와관리비', indent: true, minus: true },
  { key: 'operatingProfit', label: '영업이익', strong: true },
  { key: 'nonOpIncome', label: '영업외수익', indent: true },
  { key: 'nonOpExpense', label: '영업외비용', indent: true, minus: true },
  { key: 'preTaxIncome', label: '법인세차감전순이익' },
  { key: 'incomeTax', label: '법인세비용', indent: true, minus: true },
  { key: 'netIncome', label: '당기순이익', strong: true },
];

export default function PnlPage() {
  const f = useFilters();
  const q = f.query;
  const [groupBy, setGroupBy] = useState<GroupBy>('businessType');
  const [yoy, setYoy] = useState(true); // 전년 동기 비교가 기본

  const pnlRes = useAsync(
    () => api.get<Pnl>('/metrics/pnl', { ...q, yoy: yoy ? '1' : undefined }),
    [q.preset, q.from, q.to, q.businessTypeId, q.departmentId, q.projectId, yoy],
  );
  const bdRes = useAsync(
    () => api.get<{ rows: BreakdownRow[] }>('/metrics/pnl/breakdown', { ...q, groupBy }),
    [q.preset, q.from, q.to, q.businessTypeId, q.departmentId, q.projectId, groupBy],
  );

  if (pnlRes.loading && !pnlRes.data) return <Spinner />;
  if (pnlRes.error) return <ErrorBox message={pnlRes.error} onRetry={pnlRes.reload} />;
  const pnl = pnlRes.data;
  if (!pnl) return null;

  const py = pnl.previousYear;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="page-title">손익</h1>
        <span className="flex items-center gap-3">
          <span className="font-num text-xs text-ink-faint">
            {pnl.range.from} ~ {pnl.range.to}
          </span>
          <button
            className="btn-ghost no-print !px-3 !py-1.5 text-xs"
            onClick={() => window.print()}
            title="브라우저 인쇄 창에서 대상: 'PDF로 저장'을 선택하면 PDF 파일로 저장됩니다"
          >
            🖨 PDF 출력
          </button>
        </span>
      </div>

      <Section
        title="손익계산서"
        right={
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
            <input
              type="checkbox"
              checked={yoy}
              onChange={(e) => setYoy(e.target.checked)}
              className="accent-brand"
            />
            전년 동기 비교
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line-soft">
              <tr>
                <th className="th">과목</th>
                <th className="th text-right">당기</th>
                {py && (
                  <>
                    <th className="th text-right">전년 동기</th>
                    <th className="th text-right">증감</th>
                    <th className="th text-right">증감률</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {ROWS.map((r) => {
                const cur = big(pnl[r.key] as string);
                const prev = py ? big(py[r.key] as string) : 0n;
                const diff = cur - prev;
                const rate = prev !== 0n ? (Number(diff) / Math.abs(Number(prev))) * 100 : null;
                return (
                  <tr key={r.key} className={r.strong ? 'bg-line-soft/40' : ''}>
                    <td className={`td ${r.strong ? 'font-semibold' : ''} ${r.indent ? 'pl-7 text-ink-mute' : ''}`}>
                      {r.minus && <span className="mr-1 text-ink-faint">(−)</span>}
                      {r.label}
                    </td>
                    <td className={`td-num ${r.strong ? `font-semibold ${signClass(cur)}` : ''}`}>
                      {num(cur)}
                    </td>
                    {py && (
                      <>
                        <td className="td-num text-ink-mute">{num(prev)}</td>
                        <td className={`td-num ${signClass(diff)}`}>
                          {diff > 0n ? '+' : ''}
                          {num(diff)}
                        </td>
                        <td className={`td-num ${diff > 0n ? 'text-pos' : diff < 0n ? 'text-neg' : ''}`}>
                          {rate === null ? '—' : `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%`}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-line">
              <tr className="text-xs text-ink-mute">
                <td className="td">이익률</td>
                <td className="td-num">
                  매출총 {pct(pnl.grossMarginPct)} · 영업 {pct(pnl.operatingMarginPct)} · 순{' '}
                  {pct(pnl.netMarginPct)}
                </td>
                {py && <td className="td" colSpan={3} />}
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      <Section
        title="분해 보기"
        desc="공통비는 배부하지 않습니다. 축이 지정되지 않은 라인은 (미지정)으로 모입니다"
        right={
          <div className="flex gap-0.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setGroupBy(t.key)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  groupBy === t.key
                    ? 'bg-brand-soft font-medium text-brand-deep'
                    : 'text-ink-mute hover:bg-line-soft'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {bdRes.loading && !bdRes.data ? (
          <Spinner />
        ) : bdRes.error ? (
          <ErrorBox message={bdRes.error} onRetry={bdRes.reload} />
        ) : (
          <BreakdownTable rows={bdRes.data?.rows ?? []} />
        )}
      </Section>
    </div>
  );
}
