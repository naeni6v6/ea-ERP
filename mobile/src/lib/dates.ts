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

/** "HH:MM" 시각 표시용 — 마지막 조회 시각 */
export const clockLabel = (epochMs: number): string => {
  const { m, d, hh, mm } = kstParts(new Date(epochMs));
  return `${m}/${d} ${p2(hh)}:${p2(mm)}`;
};
