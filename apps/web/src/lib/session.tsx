'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearToken, getToken } from './api';
import type { BusinessType, CodeValue, Department, Me, Role } from './types';

interface SessionValue {
  me: Me | null;
  loading: boolean;
  isCeo: boolean;
  isAdmin: boolean;
  roles: Role[];
  businessTypes: BusinessType[];
  departments: Department[];
  codes: CodeValue[];
  codesOf: (kind: string) => CodeValue[];
  labelOf: (kind: string, code: string) => string;
  logout: () => void;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessTypes, setBusinessTypes] = useState<BusinessType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [codes, setCodes] = useState<CodeValue[]>([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    let alive = true;
    (async () => {
      try {
        const [meRes, bt, dept, cv] = await Promise.all([
          api.get<Me>('/auth/me'),
          api.get<BusinessType[]>('/business-types'),
          api.get<Department[]>('/departments'),
          api.get<CodeValue[]>('/code-values'),
        ]);
        if (!alive) return;
        setMe(meRes);
        setBusinessTypes(bt);
        setDepartments(dept);
        setCodes(cv);
      } catch {
        // 401은 api 레이어가 /login으로 보낸다. 그 외 오류는 아래 loading 해제 후 화면에서 처리.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const logout = useCallback(() => {
    clearToken();
    window.location.href = '/login';
  }, []);

  const value = useMemo<SessionValue>(() => {
    const roles = (me?.roles ?? []).map((r) => r.role);
    return {
      me,
      loading,
      isCeo: !!me?.effectiveScope?.isCeo,
      isAdmin: !!me?.effectiveScope?.isAdmin,
      roles,
      businessTypes,
      departments,
      codes,
      codesOf: (kind: string) => codes.filter((c) => c.kind === kind && c.isActive),
      labelOf: (kind: string, code: string) =>
        codes.find((c) => c.kind === kind && c.code === code)?.label ?? code,
      logout,
    };
  }, [me, loading, businessTypes, departments, codes, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
