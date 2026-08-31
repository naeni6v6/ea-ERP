/** 금액은 API에서 BigInt(원)를 문자열로 내려준다. 절대 float 연산을 하지 않는다. */
export type Money = string | number | bigint | null | undefined;

export const big = (v: Money): bigint => {
  if (v === null || v === undefined || v === '') return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(Math.round(v));
  try {
    return BigInt(String(v).replace(/[, ]/g, ''));
  } catch {
    return 0n;
  }
};

/** 1234567 → "1,234,567" */
export const num = (v: Money): string => big(v).toLocaleString('ko-KR');

/** 1234567 → "1,234,567원" */
export const won = (v: Money): string => `${num(v)}원`;

/**
 * KPI 카드용 축약. 1_2340_0000 → "1.2억", 3450_0000 → "3,450만"
 * 표에서는 쓰지 않는다(정확한 값이 필요하므로).
 */
export const compact = (v: Money): string => {
  const b = big(v);
  const neg = b < 0n;
  const abs = neg ? -b : b;
  const sign = neg ? '-' : '';
  if (abs >= 100000000n) {
    const eok = Number(abs) / 100000000;
    return `${sign}${eok >= 100 ? Math.round(eok).toLocaleString('ko-KR') : eok.toFixed(1)}억`;
  }
  if (abs >= 10000n) return `${sign}${Math.round(Number(abs) / 10000).toLocaleString('ko-KR')}만`;
  return `${sign}${abs.toLocaleString('ko-KR')}`;
};

export const pct = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined ? '—' : `${v.toFixed(digits)}%`;

/** 양수 초록 / 음수 빨강 — 손익·증감 표시용 */
export const signClass = (v: Money): string => {
  const b = big(v);
  return b > 0n ? 'text-pos' : b < 0n ? 'text-neg' : 'text-ink-mute';
};

export const ymd = (d: Date | string | null | undefined): string => {
  if (!d) return '';
  const s = typeof d === 'string' ? d : d.toISOString();
  return s.slice(0, 10);
};

/** Date | ISO문자열 → 서울 기준 "YYYY-MM-DD". 날짜 변환은 전부 이걸 거친다. */
export const seoulYmd = (d: Date | string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(typeof d === 'string' ? new Date(d) : d);

export const todaySeoul = (): string => seoulYmd(new Date());

/** 서울 기준 이번 달 "YYYY-MM" */
export const thisMonthSeoul = (): string => todaySeoul().slice(0, 7);

/** getDay() 인덱스용 요일 라벨 (일요일=0) — 달력 헤더의 월요일 시작 배열과는 다르다 */
export const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-08-28" → "2026.08.28" */
export const sdate = (d: string | null | undefined): string =>
  d ? d.slice(0, 10).replace(/-/g, '.') : '';

export const dateTime = (d: string | null | undefined): string => {
  if (!d) return '';
  const dt = new Date(d);
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dt);
};

/** "2026-08-28" → "26.08.28" — 표·헤더처럼 폭이 아쉬운 곳의 짧은 날짜 */
export const sdateShort = (d: string | null | undefined): string =>
  d ? d.slice(2, 10).replace(/-/g, '.') : '';
