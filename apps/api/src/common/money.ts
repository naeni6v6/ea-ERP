/** 금액 유틸 — 모든 금액은 BigInt(원). float 연산 금지. */
export const won = (v: string | number | bigint | null | undefined): bigint => {
  if (v === null || v === undefined || v === '') return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') { if (!Number.isInteger(v)) throw new Error('금액은 정수(원)여야 합니다'); return BigInt(v); }
  const s = String(v).replace(/[,\s]/g, '');
  if (!/^-?\d+$/.test(s)) throw new Error(`잘못된 금액: ${v}`);
  return BigInt(s);
};
export const sum = (arr: (bigint | null | undefined)[]) => arr.reduce<bigint>((a, b) => a + (b ?? 0n), 0n);
/** 비율(%) — 소수 둘째자리, 분모 0이면 null */
export const pct = (num: bigint, den: bigint): number | null =>
  den === 0n ? null : Number((num * 10000n) / den) / 100;
