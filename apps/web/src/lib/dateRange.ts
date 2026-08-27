import { todaySeoul } from './format';
import type { Preset } from './filters';

/**
 * apps/api/src/common/dates.ts 의 resolveRange 와 동일한 규칙.
 * metrics API는 preset을 직접 받지만 /journal 은 from·to만 받으므로 화면에서 같은 기간을 계산한다.
 * 서버 규칙이 바뀌면 이 함수도 함께 고칠 것.
 */
export const resolveRange = (preset: Preset, from?: string, to?: string): { from: string; to: string } => {
  const t = todaySeoul();
  const [y, m, d] = t.split('-').map(Number);
  const f = (yy: number, mm: number, dd: number) =>
    new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0, 10);
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();

  switch (preset) {
    case 'today':
      return { from: t, to: t };
    case 'this_week': {
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const mon = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7)));
      return { from: mon.toISOString().slice(0, 10), to: t };
    }
    case 'last_month': {
      const mm = m === 1 ? 12 : m - 1;
      const yy = m === 1 ? y - 1 : y;
      return { from: f(yy, mm, 1), to: f(yy, mm, lastDay(yy, mm)) };
    }
    case 'this_quarter': {
      const qs = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: f(y, qs, 1), to: t };
    }
    case 'this_year':
      return { from: f(y, 1, 1), to: t };
    case 'last_year':
      return { from: f(y - 1, 1, 1), to: f(y - 1, 12, 31) };
    case 'custom':
      if (from && to) return { from, to };
      return { from: f(y, m, 1), to: t };
    case 'this_month':
    default:
      return { from: f(y, m, 1), to: t };
  }
};
