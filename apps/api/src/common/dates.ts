/** 날짜 유틸 — 사업일자는 Asia/Seoul 기준 'YYYY-MM-DD' */
const TZ = 'Asia/Seoul';
export const todaySeoul = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date()); // YYYY-MM-DD
export const toDateOnly = (s: string): Date => new Date(`${s}T00:00:00.000Z`); // @db.Date 컬럼용 (UTC 자정 = 날짜값)
/** Seoul 기준 하루의 [start,end) UTC 구간 (timestamptz 컬럼용) */
export const seoulDayRange = (ymd: string): { start: Date; end: Date } => {
  const start = new Date(`${ymd}T00:00:00+09:00`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
};
export type Preset = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'last_year' | 'custom';
export const resolveRange = (preset: Preset | undefined, from?: string, to?: string): { from: string; to: string } => {
  const t = todaySeoul(); const [y, m, d] = t.split('-').map(Number);
  const f = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0, 10);
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  switch (preset) {
    case 'today': return { from: t, to: t };
    case 'this_week': { const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); const mon = new Date(Date.UTC(y, m - 1, d - ((dow + 6) % 7))); return { from: mon.toISOString().slice(0, 10), to: t }; }
    case 'last_month': { const mm = m === 1 ? 12 : m - 1; const yy = m === 1 ? y - 1 : y; return { from: f(yy, mm, 1), to: f(yy, mm, lastDay(yy, mm)) }; }
    case 'this_quarter': { const qs = Math.floor((m - 1) / 3) * 3 + 1; return { from: f(y, qs, 1), to: t }; }
    case 'this_year': return { from: f(y, 1, 1), to: t };
    case 'last_year': return { from: f(y - 1, 1, 1), to: f(y - 1, 12, 31) };
    case 'custom': if (from && to) return { from, to };
    // falls through
    case 'this_month': default: return { from: f(y, m, 1), to: t };
  }
};
