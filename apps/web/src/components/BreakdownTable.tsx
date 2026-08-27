'use client';

import { big, num, pct, signClass } from '@/lib/format';
import { Bar, Empty } from '@/components/ui';
import type { BreakdownRow } from '@/lib/types';

/** 사업/부서/프로젝트/계정 별 손익 — 매출 막대 + 영업이익 */
export function BreakdownTable({ rows }: { rows: BreakdownRow[] }) {
  if (!rows.length) return <Empty>해당 기간에 집계된 손익이 없습니다.</Empty>;
  const max = rows.reduce((m, r) => (big(r.sales) > m ? big(r.sales) : m), 0n);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-line-soft">
          <tr>
            <th className="th">구분</th>
            <th className="th text-right">매출</th>
            <th className="th w-28">비중</th>
            <th className="th text-right">매출원가</th>
            <th className="th text-right">판관비</th>
            <th className="th text-right">영업이익</th>
            <th className="th text-right">영업이익률</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((r) => (
            <tr key={r.id ?? '(unassigned)'} className="hover:bg-line-soft/60">
              <td className="td font-medium">
                {r.name}
                {r.id === null && (
                  <span className="ml-1.5 text-[13px] font-normal text-ink-faint">미지정</span>
                )}
              </td>
              <td className="td-num">{num(r.sales)}</td>
              <td className="td">
                <Bar value={big(r.sales)} max={max} />
              </td>
              <td className="td-num text-ink-mute">{num(r.cogs)}</td>
              <td className="td-num text-ink-mute">{num(r.sga)}</td>
              <td className={`td-num font-medium ${signClass(r.operatingProfit)}`}>
                {num(r.operatingProfit)}
              </td>
              <td className="td-num text-ink-mute">{pct(r.operatingMarginPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
