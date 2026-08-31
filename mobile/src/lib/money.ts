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
