'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { compact, num } from '@/lib/format';
import { MoneyInput } from '@/components/MoneyInput';
import { Empty, ErrorBox, Field, Modal, Progress, Section, Spinner, StatusBadge } from '@/components/ui';
import type { Project } from '@/lib/types';

export default function ProjectsPage() {
  const f = useFilters();
  const { isAdmin, codesOf, labelOf } = useSession();
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);

  const res = useAsync(
    () =>
      api.get<Project[]>('/projects', {
        businessTypeId: f.businessTypeId || undefined,
        departmentId: f.departmentId || undefined,
        status: status || undefined,
      }),
    [f.businessTypeId, f.departmentId, status],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold tracking-tight">프로젝트</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            + 프로젝트 생성
          </button>
        )}
      </div>

      <Section
        title="목록"
        desc={res.data ? `${res.data.length}건` : undefined}
        right={
          <select className="input w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">모든 상태</option>
            {codesOf('PROJECT_STATUS').map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        }
      >
        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : !res.data?.length ? (
          <Empty>조건에 맞는 프로젝트가 없습니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">코드</th>
                  <th className="th">프로젝트</th>
                  <th className="th">사업유형</th>
                  <th className="th">주관부서</th>
                  <th className="th">담당</th>
                  <th className="th">상태</th>
                  <th className="th">기간</th>
                  <th className="th">진행률</th>
                  <th className="th text-right">계약금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {res.data.map((p) => (
                  <tr key={p.id} className="hover:bg-line-soft/60">
                    <td className="td font-num text-xs text-ink-mute">{p.code}</td>
                    <td className="td">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:text-brand-deep hover:underline">
                        {p.name}
                      </Link>
                      {p.isDelayed && <span className="badge ml-1.5 bg-red-50 text-neg">지연</span>}
                    </td>
                    <td className="td text-ink-mute">{p.businessType?.name ?? '—'}</td>
                    <td className="td text-ink-mute">{p.leadDepartment?.name ?? '—'}</td>
                    <td className="td text-ink-mute">{p.owner?.name ?? '—'}</td>
                    <td className="td">
                      <StatusBadge status={p.status} label={labelOf('PROJECT_STATUS', p.status)} />
                    </td>
                    <td className="td font-num text-xs text-ink-mute">
                      {p.startDate?.slice(0, 10) ?? '—'} ~ {p.planEndDate?.slice(0, 10) ?? '—'}
                    </td>
                    <td className="td">
                      <Progress value={p.progress} />
                    </td>
                    <td className="td-num" title={`${num(p.contractAmount)}원`}>
                      {compact(p.contractAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <ProjectCreateModal open={open} onClose={() => setOpen(false)} onSaved={res.reload} />
    </div>
  );
}

function ProjectCreateModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { businessTypes, departments, codesOf } = useSession();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [businessTypeId, setBusinessTypeId] = useState('');
  const [leadDepartmentId, setLeadDepartmentId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [startDate, setStartDate] = useState('');
  const [planEndDate, setPlanEndDate] = useState('');
  const [contractAmount, setContractAmount] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [goal, setGoal] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/projects', {
        code,
        name,
        businessTypeId,
        leadDepartmentId,
        status,
        startDate: startDate || undefined,
        planEndDate: planEndDate || undefined,
        contractAmount: contractAmount || '0',
        budgetAmount: budgetAmount || '0',
        goal: goal || undefined,
      });
      onSaved();
      onClose();
      setCode('');
      setName('');
      setGoal('');
      setContractAmount('');
      setBudgetAmount('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="프로젝트 생성" wide>
      <div className="space-y-3.5">
        <div className="grid grid-cols-3 gap-3">
          <Field label="코드" required hint="예: P-2026-002">
            <input className="input font-num" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <div className="col-span-2">
            <Field label="프로젝트명" required>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="사업유형" required>
            <select
              className="input"
              value={businessTypeId}
              onChange={(e) => setBusinessTypeId(e.target.value)}
            >
              <option value="">선택</option>
              {businessTypes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="주관부서" required>
            <select
              className="input"
              value={leadDepartmentId}
              onChange={(e) => setLeadDepartmentId(e.target.value)}
            >
              <option value="">선택</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="상태">
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {codesOf('PROJECT_STATUS').map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="시작일">
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="종료예정일">
            <input
              type="date"
              className="input"
              value={planEndDate}
              onChange={(e) => setPlanEndDate(e.target.value)}
            />
          </Field>
          <Field label="계약금액">
            <MoneyInput value={contractAmount} onChange={setContractAmount} />
          </Field>
          <Field label="예산">
            <MoneyInput value={budgetAmount} onChange={setBudgetAmount} />
          </Field>
        </div>

        <Field label="목표">
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} />
        </Field>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={busy || !code || !name || !businessTypeId || !leadDepartmentId}
          >
            {busy ? '생성 중…' : '생성'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
