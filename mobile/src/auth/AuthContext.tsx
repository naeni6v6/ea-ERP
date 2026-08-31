import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { storageDelete, storageGet, storageSet } from '../lib/secureStorage';
import { api, ApiError, setAccessToken, setRefreshHandler } from '../api/client';
import type { LoginResult, Me, SessionUser } from '../api/types';

/**
 * 인증 상태.
 * - 토큰은 기기 보안 저장소(iOS Keychain / Android Keystore)에만 보관한다. 평문 저장·로그 금지.
 * - access 만료 시 client.ts가 refresh 회전을 부른다. refresh까지 무효면 로그아웃된다.
 * - 오프라인 부팅: 저장된 세션 정보로 로그인 상태를 유지한다 (조회는 캐시가 맡는다).
 */

const K_ACCESS = 'mb.access';
const K_REFRESH = 'mb.refresh';
const K_ME = 'mb.me';

type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; me: Me };

interface AuthValue {
  state: AuthState;
  isCeo: boolean;
  login: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** 로그인 응답 user → effectiveScope 없이도 화면 분기가 가능하게 보정 */
const meFromSession = (u: SessionUser): Me => ({
  id: u.id,
  name: u.name,
  email: u.email,
  companyId: '',
  department: u.department ? { id: '', name: u.department } : null,
  roles: u.roles,
  effectiveScope: {
    isCeo: u.roles.some((r) => r.role === 'CEO'),
    isAdmin: u.roles.some((r) => r.role === 'ADMIN'),
  },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const stateRef = useRef(state);
  stateRef.current = state;

  const persistMe = async (me: Me) => {
    setState({ status: 'signedIn', me });
    await storageSet(K_ME, JSON.stringify(me));
  };

  const clearSession = async () => {
    setAccessToken(null);
    setState({ status: 'signedOut' });
    await Promise.all([
      storageDelete(K_ACCESS),
      storageDelete(K_REFRESH),
      storageDelete(K_ME),
    ]);
  };

  /** refresh 회전 — 성공 true. 네트워크 문제는 세션을 지우지 않는다(오프라인이 로그아웃이 되면 안 됨) */
  const doRefresh = async (): Promise<boolean> => {
    const refreshToken = await storageGet(K_REFRESH);
    if (!refreshToken) {
      await clearSession();
      return false;
    }
    try {
      const r = await api.post<LoginResult>('/auth/refresh', { refreshToken });
      setAccessToken(r.accessToken);
      await storageSet(K_ACCESS, r.accessToken);
      if (r.refreshToken) await storageSet(K_REFRESH, r.refreshToken);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) await clearSession(); // 토큰 무효 → 재로그인
      return false;
    }
  };

  useEffect(() => {
    setRefreshHandler(doRefresh);
    return () => setRefreshHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 부팅: 저장된 세션 복원 → 백그라운드에서 내 정보 갱신
  useEffect(() => {
    (async () => {
      const [access, refresh, meJson] = await Promise.all([
        storageGet(K_ACCESS),
        storageGet(K_REFRESH),
        storageGet(K_ME),
      ]);
      if (!refresh && !access) {
        setState({ status: 'signedOut' });
        return;
      }
      setAccessToken(access);
      if (meJson) {
        try {
          setState({ status: 'signedIn', me: JSON.parse(meJson) as Me });
        } catch {
          setState({ status: 'loading' });
        }
      }
      try {
        const me = await api.get<Me>('/auth/me'); // 401이면 client가 refresh를 자동 시도한다
        await persistMe(me);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await clearSession();
        else if (!meJson) setState({ status: 'signedOut' }); // 오프라인 + 캐시 없음 → 로그인 화면
        // 오프라인 + 캐시 있음 → 캐시된 me로 유지
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const device = `${Platform.OS === 'ios' ? 'iOS' : 'Android'} · 모션브릿지 앱`;
    const r = await api.post<LoginResult>('/auth/login', { email, password, device });
    setAccessToken(r.accessToken);
    await storageSet(K_ACCESS, r.accessToken);
    if (r.refreshToken) await storageSet(K_REFRESH, r.refreshToken);
    try {
      await persistMe(await api.get<Me>('/auth/me'));
    } catch {
      await persistMe(meFromSession(r.user));
    }
  };

  const signOut = async () => {
    const refreshToken = await storageGet(K_REFRESH);
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refreshToken }); // 서버 쪽 토큰 폐기 — 실패해도 로컬은 지운다
      } catch {
        /* 오프라인이어도 로그아웃은 진행 */
      }
    }
    await clearSession();
  };

  const value = useMemo<AuthValue>(
    () => ({
      state,
      isCeo: state.status === 'signedIn' && state.me.effectiveScope.isCeo,
      login,
      signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthValue => {
  const v = useContext(AuthContext);
  if (!v) throw new Error('AuthProvider 밖에서 useAuth를 호출했습니다');
  return v;
};
