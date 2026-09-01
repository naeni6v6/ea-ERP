/** 날짜 유틸 — 서버·데이터 모두 Asia/Seoul 기준. KST는 서머타임이 없어 +9시간 고정으로 계산한다. */
const KST_OFFSET_MS = 9 * 3600 * 1000;

const kstParts = (iso: string | Date) => {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : iso.getTime();
  const d = new Date(t + KST_OFFSET_MS); // UTC 게터로 KST 값을 읽는다
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
    dow: d.getUTCDay(),
  };
};

const p2 = (n: number) => String(n).padStart(2, '0');
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** ISO → "YYYY-MM-DD" (KST) — 날짜별 그룹핑 키 */
export const kstYmd = (iso: string): string => {
  const { y, m, d } = kstParts(iso);
  return `${y}-${p2(m)}-${p2(d)}`;
};

/** "YYYY-MM-DD" → "2026.08.11 (화)" */
export const dateLabel = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${y}.${p2(m)}.${p2(d)} (${DOW[dow]})`;
};

/** "YYYY-MM-DD" → "9월 1일 (월)" — 토스식 날짜 그룹 라벨 */
export const shortDateLabel = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}월 ${d}일 (${DOW[dow]})`;
};

/** ISO → "14:05" (KST) */
export const kstTime = (iso: string): string => {
  const { hh, mm } = kstParts(iso);
  return `${p2(hh)}:${p2(mm)}`;
};

/** ISO → "2026.08.11 (화) 14:05" (KST) */
export const kstDateTime = (iso: string): string => `${dateLabel(kstYmd(iso))} ${kstTime(iso)}`;

/** 오늘(KST) "YYYY-MM-DD" */
export const todaySeoul = (): string => kstYmd(new Date().toISOString());

/** 이번 달(KST) [1일, 오늘] — 홈의 "이번 달 이용금액" 조회 구간 */
export const thisMonthSeoul = (): { from: string; to: string } => {
  const t = todaySeoul();
  return { from: `${t.slice(0, 7)}-01`, to: t };
};

/** 최근 N개월 [라벨, from, to] — 웹 lib/monthly.ts와 동일 규칙. 최신 달이 앞, 이번 달은 오늘까지 */
export const recentMonths = (n = 6): { short: string; from: string; to: string }[] => {
  const today = todaySeoul();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const out: { short: string; from: string; to: string }[] = [];
  for (let i = 0; i < n; i++) {
    const total = y * 12 + (m - 1) - i;
    const yy = Math.floor(total / 12);
    const mm = (total % 12) + 1;
    const ym = `${yy}-${p2(mm)}`;
    const lastDay = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    out.push({ short: `${mm}월`, from: `${ym}-01`, to: i === 0 ? today : `${ym}-${p2(lastDay)}` });
  }
  return out;
};

/** "HH:MM" 시각 표시용 — 마지막 조회 시각 */
export const clockLabel = (epochMs: number): string => {
  const { m, d, hh, mm } = kstParts(new Date(epochMs));
  return `${m}/${d} ${p2(hh)}:${p2(mm)}`;
};
