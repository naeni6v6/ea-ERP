/**
 * 로그인 무차별 대입 방어 — 외부 패키지 없이 메모리에서 시도 횟수를 센다.
 * 계정(이메일)과 출발지 IP를 각각 세고, 둘 중 하나라도 한계를 넘으면 잠근다.
 * 서버가 1대라 메모리로 충분하다. 다중화하면 Redis 같은 공유 저장소로 옮겨야 한다.
 */
const MAX_FAILS = 5; // 이 횟수만큼 연속 실패하면
const LOCK_MS = 10 * 60_000; // 10분 잠금
const WINDOW_MS = 10 * 60_000; // 실패 기록 유지 시간

interface Entry {
  fails: number;
  first: number;
  lockedUntil?: number;
}

const buckets = new Map<string, Entry>();

/** 오래된 기록 정리 — 메모리가 무한정 늘지 않게 */
function sweep(now: number) {
  if (buckets.size < 1000) return;
  for (const [k, e] of buckets) {
    if ((e.lockedUntil ?? 0) < now && now - e.first > WINDOW_MS) buckets.delete(k);
  }
}

/** 잠겨 있으면 남은 초, 아니면 0 */
export function lockedSeconds(keys: string[], now = Date.now()): number {
  let max = 0;
  for (const k of keys) {
    const e = buckets.get(k);
    if (e?.lockedUntil && e.lockedUntil > now) max = Math.max(max, Math.ceil((e.lockedUntil - now) / 1000));
  }
  return max;
}

export function recordFailure(keys: string[], now = Date.now()) {
  sweep(now);
  for (const k of keys) {
    const e = buckets.get(k);
    if (!e || now - e.first > WINDOW_MS) {
      buckets.set(k, { fails: 1, first: now });
      continue;
    }
    e.fails += 1;
    if (e.fails >= MAX_FAILS) {
      e.lockedUntil = now + LOCK_MS;
      e.fails = 0;
      e.first = now;
    }
  }
}

export function recordSuccess(keys: string[]) {
  for (const k of keys) buckets.delete(k);
}
