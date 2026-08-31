/** 금액은 API에서 BigInt(원)를 문자열로 내려준다. 절대 float 연산을 하지 않는다. (웹 lib/format.ts와 동일 규칙) */
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

/** 1234567 → "1,234,567" (Hermes Intl 의존 없이 문자열로 콤마를 찍는다) */
export const num = (v: Money): string => {
  const s = big(v).toString();
  const neg = s.startsWith('-');
  const digits = neg ? s.slice(1) : s;
  return (neg ? '-' : '') + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/** 1234567 → "1,234,567원" */
export const won = (v: Money): string => `${num(v)}원`;

/**
 * KPI 카드용 축약 — 웹 lib/format.ts의 compact와 동일 규칙.
 * 1_2340_0000 → "1.2억", 3450_0000 → "3,450만". 표에는 쓰지 않는다(정확값 필요).
 */
export const compact = (v: Money): string => {
  const b = big(v);
  const neg = b < 0n;
  const abs = neg ? -b : b;
  const sign = neg ? '-' : '';
  if (abs >= 100000000n) {
    const eok = Number(abs) / 100000000;
    return `${sign}${eok >= 100 ? num(Math.round(eok)) : eok.toFixed(1)}억`;
  }
  if (abs >= 10000n) return `${sign}${num(Math.round(Number(abs) / 10000))}만`;
  return `${sign}${num(abs)}`;
};
