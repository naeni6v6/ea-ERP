'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { compact, num } from '@/lib/format';
import { Empty, ErrorBox, Field, Progress, Section, Spinner, StatusBadge } from '@/components/ui';
import type { Project, Task, UserRow } from '@/lib/types';

export function ProjectDetailClient() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { isAdmin, labelOf, codesOf } = useSession();

  const projRes = useAsync(() => api.get<Project>(`/projects/${id}`), [id]);
  const taskRes = useAsync(() => api.get<Task[]>(`/projects/${id}/tasks`), [id]);
  const userRes = useAsync(
    () => (isAdmin ? api.get<UserRow[]>('/users') : Promise.resolve([] as UserRow[])),
    [isAdmin],
  );

  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDue, setNewDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [taskError, setTaskError] = useState('');

  const p = projRes.data;

  const toggle = async (t: Task) => {
    setTaskError('');
    try {
      await api.patch(`/tasks/${t.id}`, { isDone: !t.isDone });
      taskRes.reload();
      projRes.reload();
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : '업무 상태 변경에 실패했습니다');
    }
  };

  const addTask = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    setTaskError('');
    try {
      await api.post(`/projects/${id}/tasks`, {
        title: newTitle.trim(),
        assigneeId: newAssignee || undefined,
        dueDate: newDue || undefined,
      });
      setNewTitle('');
      setNewAssignee('');
      setNewDue('');
      taskRes.reload();
      projRes.reload();
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : '업무 추가에 실패했습니다');
    } finally {
      setAdding(false);
    }
  };

  const removeTask = async (t: Task) => {
    setTaskError('');
    try {
      await api.del(`/tasks/${t.id}`);
      taskRes.reload();
      projRes.reload();
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : '업무 삭제에 실패했습니다');
    }
  };

  const changeStatus = async (status: string) => {
    try {
      await api.patch(`/projects/${id}`, { status });
      projRes.reload();
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : '상태 변경에 실패했습니다');
    }
  };

  if (projRes.loading && !p) return <Spinner />;
  if (projRes.error) return <ErrorBox message={projRes.error} onRetry={projRes.reload} />;
  if (!p) return null;

  const tasks = taskRes.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/projects" className="text-xs text-ink-mute hover:text-brand-deep hover:underline">
          ← 프로젝트 목록
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="font-num text-sm text-ink-faint">{p.code}</span>
          <h1 className="page-title">{p.name}</h1>
          <StatusBadge status={p.status} label={labelOf('PROJECT_STATUS', p.status)} />
          {p.isDelayed && <span className="badge bg-red-50 text-neg">지연</span>}
          {isAdmin && (
            <select
              className="input ml-auto w-28"
              value={p.status}
              onChange={(e) => changeStatus(e.target.value)}
            >
              {codesOf('PROJECT_STATUS').map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>
        {p.goal && <p className="mt-1 text-sm text-ink-mute">{p.goal}</p>}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Section title="개요">
          <dl className="divide-y divide-line-soft text-sm">
            {(
              [
                ['사업유형', p.businessType?.name ?? '—'],
                ['주관부서', p.leadDepartment?.name ?? '—'],
                ['담당자', p.owner?.name ?? '—'],
                ['기간', `${p.startDate?.slice(0, 10) ?? '—'} ~ ${p.planEndDate?.slice(0, 10) ?? '—'}`],
                ['참여부서', (p.departments ?? []).map((d) => d.department.name).join(', ') || '—'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="shrink-0 text-ink-mute">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="금액" desc="실적 대비 예산은 MVP2">
          <dl className="divide-y divide-line-soft text-sm">
            {(
              [
                ['수주금액', p.contractAmount],
                ['예상매출', p.expectedRevenue],
                ['실행예산', p.budgetAmount],
                ['목표원가', p.targetCost],
                ['목표이익', p.targetProfit],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-ink-mute">{k}</dt>
                <dd className="font-num" title={`${num(v)}원`}>
                  {compact(v)}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="진행">
          <div className="space-y-3 px-4 py-4">
            <div>
              <div className="mb-1.5 text-xs text-ink-mute">진행률 (완료 가중치 기준)</div>
              <Progress value={p.progress} />
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="text-xs text-ink-mute">전체 업무</div>
                <div className="font-num text-xl font-semibold">{p.totalTasks}</div>
              </div>
              <div>
                <div className="text-xs text-ink-mute">완료</div>
                <div className="font-num text-xl font-semibold text-pos">{p.doneTasks}</div>
              </div>
              <div>
                <div className="text-xs text-ink-mute">남음</div>
                <div className="font-num text-xl font-semibold">{p.totalTasks - p.doneTasks}</div>
              </div>
            </div>
            <div className="border-t border-line-soft pt-3">
              <div className="mb-1 text-xs text-ink-mute">참여자</div>
              <div className="text-sm">
                {(p.members ?? []).map((m) => m.user.name).join(', ') || '—'}
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title="업무" desc="체크하면 진행률이 즉시 반영됩니다">
        <div className="border-b border-line-soft px-4 py-3">
          <div className="grid grid-cols-[1fr_150px_150px_auto] gap-2">
            <input
              className="input"
              placeholder="새 업무 제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask();
              }}
            />
            <select
              className="input"
              value={newAssignee}
              onChange={(e) => setNewAssignee(e.target.value)}
            >
              <option value="">담당자 미지정</option>
              {(userRes.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
            />
            <button className="btn-primary" onClick={addTask} disabled={adding || !newTitle.trim()}>
              추가
            </button>
          </div>
          {taskError && <p className="mt-2 text-xs text-neg">{taskError}</p>}
        </div>

        {taskRes.loading && !taskRes.data ? (
          <Spinner />
        ) : !tasks.length ? (
          <Empty>등록된 업무가 없습니다. 위에서 첫 업무를 추가하세요.</Empty>
        ) : (
          <ul className="divide-y divide-line-soft">
            {tasks.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={t.isDone}
                  onChange={() => toggle(t)}
                  className="h-4 w-4 accent-brand"
                  aria-label={`${t.title} 완료`}
                />
                <span className={`flex-1 text-sm ${t.isDone ? 'text-ink-faint line-through' : ''}`}>
                  {t.title}
                </span>
                <StatusBadge status={t.status} label={labelOf('TASK_STATUS', t.status)} />
                <span className="w-20 text-right text-xs text-ink-mute">
                  {t.assignee?.name ?? '—'}
                </span>
                <span className="w-24 text-right font-num text-xs text-ink-faint">
                  {t.dueDate?.slice(0, 10) ?? ''}
                </span>
                <button
                  onClick={() => removeTask(t)}
                  className="rounded px-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-line-soft hover:text-neg group-hover:opacity-100"
                  aria-label="업무 삭제"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
