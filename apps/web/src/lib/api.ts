export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'ea_erp_token';

/**
 * 데모 모드 (NEXT_PUBLIC_DEMO=1 빌드) — Netlify 등 정적 호스팅용.
 * API 서버 대신 /demo-fixtures.json 에 담긴 실데이터 스냅샷을 읽고, 저장(POST/PATCH…)은 안내만 띄운다.
 */
const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';
/** 화면에서 데모 배지 노출용 */
export const IS_DEMO = DEMO;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export const getToken = (): string | null =>
  DEMO ? 'demo' : typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => {
  if (!DEMO) window.localStorage.setItem(TOKEN_KEY, t);
};
export const clearToken = () => {
  if (!DEMO) window.localStorage.removeItem(TOKEN_KEY);
};

let demoFixtures: Record<string, unknown> | null = null;
async function demoRequest<T>(pathWithQs: string, init: RequestInit): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const [pathname, rawQs] = pathWithQs.split('?');
  if (method !== 'GET') {
    // 데모 로그인은 항상 성공시켜 화면으로 들여보낸다
    if (pathname === '/auth/login') {
      if (!demoFixtures) demoFixtures = await (await fetch('/demo-fixtures.json')).json();
      return { accessToken: 'demo', user: (demoFixtures!['/auth/me'] as any) ?? {} } as T;
    }
    throw new ApiError('데모 모드입니다 — 화면 확인용이라 조회만 가능하고, 저장·수정은 실제 서버에서만 됩니다.', 403);
  }
  if (!demoFixtures) demoFixtures = await (await fetch('/demo-fixtures.json')).json();
  const sorted = rawQs
    ? `${pathname}?${[...new URLSearchParams(rawQs).entries()]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => `${k}=${v}`)
        .join('&')}`
    : pathname;
  const hit = demoFixtures![sorted] ?? demoFixtures![pathname];
  if (hit === undefined) throw new ApiError('데모 스냅샷에 없는 데이터입니다.', 404);
  // 화면에서 응답을 변형해도 스냅샷 원본이 오염되지 않게 복제해서 준다
  return JSON.parse(JSON.stringify(hit)) as T;
}

/** NestJS 에러 바디({statusCode, message}) → 사람이 읽는 한 줄 */
const messageOf = (body: any, status: number): string => {
  const m = body?.message;
  if (Array.isArray(m)) return m.join(', ');
  if (typeof m === 'string') return m;
  return `요청이 실패했습니다 (HTTP ${status})`;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (DEMO) return demoRequest<T>(path, init);
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError('API 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.', 0);
  }

  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError('로그인이 필요합니다', 401);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(messageOf(body, res.status), res.status);
  return body as T;
}

const qs = (params?: Record<string, unknown>): string => {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>(`${path}${qs(params)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string, params?: Record<string, unknown>) =>
    request<T>(`${path}${qs(params)}`, { method: 'DELETE' }),
};
