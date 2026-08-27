'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { todaySeoul } from './format';

export type Preset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

export const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: 'this_week', label: '이번 주' },
  { value: 'this_month', label: '이번 달' },
  { value: 'last_month', label: '지난 달' },
  { value: 'this_quarter', label: '이번 분기' },
  { value: 'this_year', label: '올해' },
  { value: 'last_year', label: '작년' },
  { value: 'custom', label: '직접 지정' },
];

export interface FilterState {
  preset: Preset;
  from: string;
  to: string;
  businessTypeId: string;
  departmentId: string;
  projectId: string;
}

const DEFAULTS: FilterState = {
  preset: 'this_month',
  from: todaySeoul().slice(0, 8) + '01',
  to: todaySeoul(),
  businessTypeId: '',
  departmentId: '',
  projectId: '',
};

const STORAGE_KEY = 'ea_erp_filters';

interface FilterValue extends FilterState {
  set: (patch: Partial<FilterState>) => void;
  reset: () => void;
  /** metrics/journal API에 그대로 넘기는 쿼리 객체 */
  query: Record<string, string | undefined>;
}

const Ctx = createContext<FilterValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FilterState>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* 저장된 필터가 깨졌으면 기본값을 쓴다 */
    }
  }, []);

  const value = useMemo<FilterValue>(() => {
    const set = (patch: Partial<FilterState>) =>
      setState((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* 저장 실패는 무시 — 필터는 화면 상태로만 유지 */
        }
        return next;
      });
    return {
      ...state,
      set,
      reset: () => set(DEFAULTS),
      query: {
        preset: state.preset,
        ...(state.preset === 'custom' ? { from: state.from, to: state.to } : {}),
        businessTypeId: state.businessTypeId || undefined,
        departmentId: state.departmentId || undefined,
        projectId: state.projectId || undefined,
      },
    };
  }, [state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters(): FilterValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFilters must be used inside FilterProvider');
  return v;
}
