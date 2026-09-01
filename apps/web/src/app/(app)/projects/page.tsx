'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { num, sdate } from '@/lib/format';
import { ProjectEditModal, ProjectRegisterModal } from '@/components/ProjectModals';
import { Empty, ErrorBox, PencilButton, Progress, Spinner, StatusBadge } from '@/components/ui';
import type { Project } from '@/lib/types';

/**
 * 프로젝트 목록 — 카드형. 카드를 누르면 상세 페이지(/projects/[id])가 열린다.
 * 등록(직접 입력·파일 업로드)과 카드 연필 버튼 수정은 여기서, 드래그 정렬은 대시보드 보드에서 한다.
 */
export default function ProjectsCardsPage() {
  const f = useFilters();
  const { isAdmin, codesOf, labelOf } = useSession();
  const [status, setStatus] = useState('');
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);

  const res = useAsync(
    () =>
      api.get<Project[]>('/projects', {
        businessTypeId: f.businessTypeId || undefined,
        departmentId: f.departmentId || undefined,
        status: status || undefined,
      }),
    [f.businessTypeId, f.departmentId, status],
  );

  // 긴급 > 지연 > 나머지 순
  const rank = (p: Project) => (p.status === 'URGENT' ? 0 : p.isDelayed ? 1 : 2);
  const rows = [...(res.data ?? [])].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">프로젝트</h1>
          <p className="mt-1.5 text-sm text-ink-mute">카드를 누르면 프로젝트 상세가 열립니다 · {rows.length}건</p>
        </div>
        <span className="flex items-center gap-2">
          <select className="input w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">모든 상태</option>
            {codesOf('PROJECT_STATUS').map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          {isAdmin && (
            <button
              className="btn-primary !px-3.5 !py-1.5 text-xs font-semibold"
              onClick={() => setRegisterOpen(true)}
              title="직접 입력하거나 CSV·TSV·JSON 파일로 여러 프로젝트를 한 번에 등록"
            >
              + 프로젝트 등록
            </button>
          )}
        </span>
      </div>

      {res.loading && !res.data ? (
        <Spinner />
      ) : res.error ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : rows.length === 0 ? (
        <Empty>조건에 맞는 프로젝트가 없습니다.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="card group flex flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <PencilButton
                    title="프로젝트 수정"
                    onClick={(e) => {
                      // 카드 전체가 상세 링크라 — 연필만 눌렀을 땐 이동을 막고 수정창을 연다
                      e.preventDefault();
                      e.stopPropagation();
                      setEditTarget(p);
                    }}
                  />
                )}
                <StatusBadge status={p.status} label={labelOf('PROJECT_STATUS', p.status)} />
                {p.isDelayed && <span className="badge bg-red-50 text-neg">지연</span>}
                <span className="ml-auto font-num text-xs text-ink-faint">{p.code}</span>
              </div>

              <div>
                <p className="text-base font-bold leading-snug group-hover:text-brand-deep">{p.name}</p>
                {p.goal && <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-mute">{p.goal}</p>}
              </div>

              <Progress value={p.progress} />

              <div className="mt-auto space-y-1.5 border-t border-line-soft pt-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-faint">기간</span>
                  <span className="font-num text-xs text-ink-mute">
                    {sdate(p.startDate) || '미정'} ~ {sdate(p.planEndDate) || '미정'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-faint">담당</span>
                  <span className="truncate text-xs text-ink-mute">
                    {p.leadDepartment?.name ?? '—'}
                    {p.owner ? ` · ${p.owner.name}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink-faint">수주금액</span>
                  <span className="font-num font-semibold">{num(p.contractAmount)}원</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <ProjectRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSaved={res.reload}
        existingCodes={(res.data ?? []).map((p) => p.code)}
      />

      <ProjectEditModal
        project={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={res.reload}
      />
    </div>
  );
}
