import { api } from './api';
import { todaySeoul } from './format';
import type { BreakdownRow, Pnl } from './types';

export const MONTHS_BACK = 6;

export interface MonthRange {
  name: string; // "2026년 8월"
  short: string; // "8월"
  from: string;
  to: string;
}

/** 최근 N개월 [라벨, from, to] — 최신 달이 앞. 이번 달은 오늘까지로 자른다. */
export function recentMonths(n = MONTHS_BACK): MonthRange[] {
  const today = todaySeoul(); // YYYY-MM-DD (Asia/Seoul)
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const out: MonthRange[] = [];
  for (let i = 0; i < n; i++) {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    const ym = `${yy}-${String(mm).padStart(2, '0')}`;
    const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    out.push({
      name: `${yy}년 ${mm}월`,
      short: `${mm}월`,
      from: `${ym}-01`,
      to: i === 0 ? today : `${ym}-${String(lastDay).padStart(2, '0')}`,
    });
  }
  return out;
}

export interface MonthlyPnlRow extends Omit<Pnl, 'range' | 'previousYear'> {
  id: string;
  name: string;
  short: string;
}

/** 최근 N개월 월별 손익 — 최신 달이 앞. 사업유형/부서/프로젝트 필터를 그대로 적용한다. */
export async function fetchMonthlyPnl(
  filters: { businessTypeId?: string; departmentId?: string; projectId?: string },
  n = MONTHS_BACK,
): Promise<MonthlyPnlRow[]> {
  const months = recentMonths(n);
  const results = await Promise.all(
    months.map((mo) =>
      api.get<Pnl>('/metrics/pnl', {
        preset: 'custom',
        from: mo.from,
        to: mo.to,
        businessTypeId: filters.businessTypeId || undefined,
        departmentId: filters.departmentId || undefined,
        projectId: filters.projectId || undefined,
      }),
    ),
  );
  return results.map((p, i) => {
    const { range: _range, previousYear: _py, ...rest } = p;
    return { id: months[i].from, name: months[i].name, short: months[i].short, ...rest };
  });
}

export type { BreakdownRow };
