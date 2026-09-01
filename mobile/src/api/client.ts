import { API_BASE, REQUEST_TIMEOUT_MS } from '../config';

/**
 * HTTP 클라이언트.
 * - 요청 타임아웃 15초 (모바일 데이터 환경 전제)
 * - 401: refresh 회전을 한 번 시도하고 원래 요청을 재시도한다.
 *   (401은 서버가 처리 전에 거절한 것이라 쓰기 요청도 재시도해도 중복이 생기지 않는다)
 * - 네트워크 실패·타임아웃은 status 0 — 쓰기 요청은 자동 재시도하지 않는다(중복 위험).
 * - 토큰은 이 모듈 메모리에만 두고, 영속 저장은 AuthContext(SecureStore)가 맡는다. 로그 금지.
 */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

/** AuthContext가 등록한다: refresh 성공 시 true, 실패(재로그인 필요) 시 false */
let refreshHandler: (() => Promise<boolean>) | null = null;
export const setRefreshHandler = (h: (() => Promise<boolean>) | null) => {
  refreshHandler = h;
};

// refresh는 단일 비행 — 동시 401들이 회전을 중복 실행해 토큰을 서로 폐기하지 않게
let refreshing: Promise<boolean> | null = null;
const tryRefresh = (): Promise<boolean> => {
  if (!refreshHandler) return Promise.resolve(false);
  if (!refreshing) {
    refreshing = refreshHandler().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
};

const messageOf = (data: unknown, fallback: string): string => {
  if (data && typeof data === 'object') {
    const m = (data as { message?: unknown }).message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m) && m.length) return String(m[0]);
  }
  return fallback;
};

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal });
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.', 0);
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(method: string, path: string, body?: unknown, retriedAfterRefresh = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await rawRequest(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 401 && !retriedAfterRefresh && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    const ok = await tryRefresh();
    if (ok) return request<T>(method, path, body, true);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const fallback =
      res.status === 401
        ? '로그인이 필요합니다'
        : res.status === 429
          ? '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.'
          : `요청에 실패했습니다 (${res.status})`;
    throw new ApiError(messageOf(data, fallback), res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};
