'use client';

import { PRESETS, useFilters, type Preset } from '@/lib/filters';
import { useSession } from '@/lib/session';

/**
 * 전역 필터. 모든 화면(대시보드/손익/거래/프로젝트)이 같은 기간·축을 공유한다.
 * 서버 계산은 metrics.service 한 곳이므로 여기서 고른 값이 그대로 API 쿼리가 된다.
 */
export function FilterBar() {
  const f = useFilters();
  const { businessTypes, departments } = useSession();
  const dirty = !!(f.businessTypeId || f.departmentId || f.projectId) || f.preset !== 'this_month';

  return (
    <div className="flex flex-wrap items-end gap-2.5 border-b border-line bg-white/85 px-4 py-3 backdrop-blur sm:px-6">
      <div>
        <label className="label" htmlFor="f-preset">
          기간
        </label>
        <select
          id="f-preset"
          className="input w-32"
          value={f.preset}
          onChange={(e) => f.set({ preset: e.target.value as Preset })}
        >
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {f.preset === 'custom' && (
        <>
          <div>
            <label className="label" htmlFor="f-from">
              시작
            </label>
            <input
              id="f-from"
              type="date"
              className="input w-36"
              value={f.from}
              onChange={(e) => f.set({ from: e.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="f-to">
              종료
            </label>
            <input
              id="f-to"
              type="date"
              className="input w-36"
              value={f.to}
              onChange={(e) => f.set({ to: e.target.value })}
            />
          </div>
        </>
      )}

      <div>
        <label className="label" htmlFor="f-bt">
          사업유형
        </label>
        <select
          id="f-bt"
          className="input w-40"
          value={f.businessTypeId}
          onChange={(e) => f.set({ businessTypeId: e.target.value })}
        >
          <option value="">전체</option>
          {businessTypes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="f-dept">
          부서
        </label>
        <select
          id="f-dept"
          className="input w-40"
          value={f.departmentId}
          onChange={(e) => f.set({ departmentId: e.target.value })}
        >
          <option value="">전체</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* 필터는 고르는 즉시 반영된다 — [검색]은 같은 조건으로 다시 불러오고 싶을 때 누른다 */}
      <button className="btn-primary mb-0.5" onClick={f.search}>
        검색
      </button>
      {dirty && (
        <button className="btn-ghost mb-0.5" onClick={f.reset}>
          초기화
        </button>
      )}
    </div>
  );
}
