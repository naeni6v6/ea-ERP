'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { compact, num, sdate, todaySeoul } from '@/lib/format';
import { Empty, ErrorBox, PencilButton, Section, Spinner, StatusBadge } from '@/components/ui';
import { ProjectEditModal } from '@/components/ProjectModals';
import type { Project, Task, UserRow } from '@/lib/types';

/* ───────── 날짜 계산 (YYYY-MM-DD 문자열 기준, 시간대 영향 없음) ───────── */

const dayNum = (ymd: string) => {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};
/** b - a (일). 같은 날이면 0 */
const daysBetween = (a: string, b: string) => Math.round(dayNum(b) - dayNum(a));
const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/** 마감일 대비 오늘 — D-3 / D-Day / D+2 */
const dday = (due: string, today: string) => {
  const diff = daysBetween(today, due);
  return diff === 0 ? 'D-Day' : diff > 0 ? `D-${diff}` : `D+${-diff}`;
};

/* ───────── 화면 ───────── */

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

  const [editOpen, setEditOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDue, setNewDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [taskError, setTaskError] = useState('');
  const [showDone, setShowDone] = useState(true);

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

  const today = todaySeoul();
  const tasks = taskRes.data ?? [];
  const closed = p.status === 'DONE' || p.status === 'CANCELLED';
  const isOverdue = (t: Task) => !t.isDone && !!t.dueDate && t.dueDate.slice(0, 10) < today;
  const overdueTasks = tasks.filter(isOverdue).length;

  // 미완료(지연 → 마감 빠른 순 → 마감 없음)를 위로, 완료는 아래로
  const sorted = [...tasks].sort((a, b) => {
    if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
    if (a.isDone) return (b.doneAt ?? '').localeCompare(a.doneAt ?? '');
    const ad = a.dueDate ?? '9999';
    const bd = b.dueDate ?? '9999';
    return ad.localeCompare(bd) || a.sortOrder - b.sortOrder;
  });
  const visible = showDone ? sorted : sorted.filter((t) => !t.isDone);

  return (
    <div className="space-y-5">
      {/* ── 머리말 ── */}
      <div>
        <Link href="/projects" className="text-xs text-ink-mute hover:text-brand-deep hover:underline">
          ← 프로젝트 목록
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {isAdmin && <PencilButton title="프로젝트 수정" onClick={() => setEditOpen(true)} />}
          <span className="font-num text-sm text-ink-faint">{p.code}</span>
          <h1 className="page-title">{p.name}</h1>
          <StatusBadge status={p.status} label={labelOf('PROJECT_STATUS', p.status)} />
          {p.isDelayed && <span className="badge bg-red-50 text-neg">지연</span>}
          {isAdmin && (
            <select className="input ml-auto w-28" value={p.status} onChange={(e) => changeStatus(e.target.value)}>
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

      {/* ── 일정 · 진행 · 사람 — 한 카드에서 한눈에 ── */}
      <section className="card overflow-hidden">
        <div className="grid divide-y divide-line-soft lg:grid-cols-[1.6fr_1fr] lg:divide-x lg:divide-y-0">
          <SchedulePanel p={p} today={today} closed={closed} overdueTasks={overdueTasks} />
          <PeoplePanel p={p} tasks={tasks} isOverdue={isOverdue} />
        </div>
      </section>

      {/* ── 개요 · 금액 ── */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Section title="개요">
          <dl className="divide-y divide-line-soft text-sm">
            {(
              [
                ['사업유형', p.businessType?.name ?? '—'],
                ['주관부서', p.leadDepartment?.name ?? '—'],
                ['참여부서', (p.departments ?? []).map((d) => d.department.name).join(', ') || '—'],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="shrink-0 text-ink-mute">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
            {p.description && (
              <div className="px-4 py-2.5">
                <dt className="text-ink-mute">설명</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-ink-soft">{p.description}</dd>
              </div>
            )}
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
      </div>

      {/* ── 업무 ── */}
      <Section
        title="업무"
        desc="체크하면 진행률이 즉시 반영됩니다 · 지연·마감 임박 순으로 정렬"
        right={
          <div className="flex items-center gap-2 text-xs">
            <Chip tone="plain">전체 {tasks.length}</Chip>
            <Chip tone="pos">완료 {p.doneTasks}</Chip>
            <Chip tone="brand">남음 {tasks.length - p.doneTasks}</Chip>
            {overdueTasks > 0 && <Chip tone="neg">지연 {overdueTasks}</Chip>}
            <label className="ml-2 flex cursor-pointer select-none items-center gap-1.5 text-ink-mute">
              <input type="checkbox" className="accent-brand" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              완료 표시
            </label>
          </div>
        }
      >
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
            <select className="input" value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}>
              <option value="">담당자 미지정</option>
              {(userRes.data ?? [])
                .filter((u) => u.isActive)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <input type="date" className="input" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
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
        ) : !visible.length ? (
          <Empty>남은 업무가 없습니다. 모두 완료했습니다 🎉</Empty>
        ) : (
          <table className="w-full">
            <thead className="bg-line-soft/60">
              <tr>
                <th className="th w-10" />
                <th className="th">업무</th>
                <th className="th w-32">담당</th>
                <th className="th w-24">상태</th>
                <th className="th w-40 text-right">마감</th>
                <th className="th w-28 text-right">완료일</th>
                <th className="th w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {visible.map((t) => {
                const late = isOverdue(t);
                const due = t.dueDate?.slice(0, 10) ?? null;
                const soon = !t.isDone && !late && !!due && daysBetween(today, due) <= 3;
                return (
                  <tr key={t.id} className={`group ${late ? 'bg-red-50/40' : ''}`}>
                    <td className="td pr-0">
                      <input
                        type="checkbox"
                        checked={t.isDone}
                        onChange={() => toggle(t)}
                        className="h-4 w-4 accent-brand"
                        aria-label={`${t.title} 완료`}
                      />
                    </td>
                    <td className={`td whitespace-normal ${t.isDone ? 'text-ink-faint line-through' : 'font-medium'}`}>
                      {t.title}
                    </td>
                    <td className="td">
                      <Person name={t.assignee?.name} />
                    </td>
                    <td className="td">
                      <StatusBadge status={t.status} label={labelOf('TASK_STATUS', t.status)} />
                    </td>
                    <td className="td-num text-xs">
                      {due ? (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <span className={t.isDone ? 'text-ink-faint' : 'text-ink-soft'}>{sdate(due)}</span>
                          {!t.isDone && (
                            <span
                              className={`badge font-num ${
                                late ? 'bg-red-50 text-neg' : soon ? 'bg-amber-50 text-warn' : 'bg-line-soft text-ink-mute'
                              }`}
                            >
                              {late ? `${-daysBetween(today, due)}일 지남` : dday(due, today)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="td-num text-xs text-ink-faint">{t.doneAt ? sdate(t.doneAt.slice(0, 10)) : ''}</td>
                    <td className="td pl-0 text-right">
                      <button
                        onClick={() => removeTask(t)}
                        className="rounded px-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-line-soft hover:text-neg group-hover:opacity-100"
                        aria-label="업무 삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <ProjectEditModal project={editOpen ? p : null} onClose={() => setEditOpen(false)} onSaved={projRes.reload} />
    </div>
  );
}

/* ───────── 일정 · 진행 ───────── */

function SchedulePanel({
  p,
  today,
  closed,
  overdueTasks,
}: {
  p: Project;
  today: string;
  closed: boolean;
  overdueTasks: number;
}) {
  const start = p.startDate?.slice(0, 10) ?? null;
  const end = p.planEndDate?.slice(0, 10) ?? null;
  const actualEnd = p.actualEndDate?.slice(0, 10) ?? null;
  const done = p.status === 'DONE';

  // 기간 경과율 — 시작·마감이 다 있을 때만
  const total = start && end ? Math.max(1, daysBetween(start, end)) : null;
  const elapsedRaw = start ? daysBetween(start, done && actualEnd ? actualEnd : today) : null;
  const timePct = total !== null && elapsedRaw !== null ? clampPct((elapsedRaw / total) * 100) : null;
  const remain = end ? daysBetween(today, end) : null;

  // 마감 상태 칩
  let deadline: { text: string; tone: Tone } = { text: '마감 미정', tone: 'plain' };
  if (done) deadline = { text: actualEnd ? `${sdate(actualEnd)} 완료` : '완료', tone: 'pos' };
  else if (p.status === 'CANCELLED') deadline = { text: '취소됨', tone: 'plain' };
  else if (end && remain !== null) {
    if (remain < 0) deadline = { text: `${-remain}일 지남`, tone: 'neg' };
    else if (remain === 0) deadline = { text: 'D-Day', tone: 'warn' };
    else deadline = { text: `D-${remain}`, tone: remain <= 7 ? 'warn' : 'brand' };
  }

  // 소요 기간
  let spent = '—';
  let spentSub = '';
  if (done && start && actualEnd) {
    const took = daysBetween(start, actualEnd) + 1;
    spent = `${took}일 걸림`;
    if (end) {
      const vs = daysBetween(end, actualEnd);
      spentSub = vs > 0 ? `계획보다 ${vs}일 늦게` : vs < 0 ? `계획보다 ${-vs}일 빨리` : '계획대로 마감';
    }
  } else if (start && elapsedRaw !== null) {
    spent = `${elapsedRaw + 1}일째`;
    spentSub = total !== null ? `전체 ${total + 1}일 중` : '';
  }

  // 일정 대비 진행 평가
  let verdict: { text: string; tone: Tone } | null = null;
  if (done) verdict = { text: '완료된 프로젝트입니다', tone: 'pos' };
  else if (!closed && end && remain !== null && remain < 0) {
    const left = p.totalTasks - p.doneTasks;
    verdict =
      left > 0
        ? { text: `마감이 ${-remain}일 지났고 남은 업무가 ${left}건입니다`, tone: 'neg' }
        : { text: `마감이 ${-remain}일 지났지만 업무는 모두 끝났습니다 · 상태를 '완료'로 바꿔주세요`, tone: 'warn' };
  }
  else if (!closed && timePct !== null) {
    const gap = p.progress - timePct;
    verdict =
      gap < -20
        ? { text: `일정보다 진행이 느립니다 (기간 ${Math.round(timePct)}% 경과, 업무 ${p.progress}% 완료)`, tone: 'warn' }
        : gap < 0
          ? { text: '대체로 일정에 맞게 진행 중입니다', tone: 'plain' }
          : { text: '일정보다 앞서 진행 중입니다', tone: 'pos' };
  }
  if (!done && overdueTasks > 0 && verdict?.tone !== 'neg')
    verdict = { text: `${verdict ? verdict.text + ' · ' : ''}마감 지난 업무 ${overdueTasks}건`, tone: 'warn' };

  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-bold tracking-tight">일정 · 진행</h2>
        {verdict && <Chip tone={verdict.tone}>{verdict.text}</Chip>}
      </div>

      {/* 핵심 4가지 */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="시작일">
          <span className="font-num">{start ? sdate(start) : '—'}</span>
        </Stat>
        <Stat label="마감일">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-num">{end ? sdate(end) : '—'}</span>
            <Chip tone={deadline.tone} small>
              {deadline.text}
            </Chip>
          </span>
        </Stat>
        <Stat label={done ? '소요 기간' : '경과'} sub={spentSub}>
          <span className="font-num">{spent}</span>
        </Stat>
        <Stat label="진행률" sub={`완료 ${p.doneTasks} / 전체 ${p.totalTasks}건`}>
          <span className="font-num">{p.progress}%</span>
        </Stat>
      </div>

      {/* 기간 경과 vs 업무 진행 — 두 막대를 나란히 비교 */}
      <div className="mt-4 space-y-2.5">
        <BarRow
          label="기간 경과"
          pct={timePct}
          color="bg-ink-faint"
          right={
            timePct === null
              ? '시작일·마감일을 입력하면 계산됩니다'
              : `${Math.round(timePct)}%${remain !== null && !done ? (remain >= 0 ? ` · ${remain}일 남음` : ` · ${-remain}일 지남`) : ''}`
          }
          markers={timePct !== null && !done ? [{ pct: timePct, label: '오늘' }] : []}
        />
        <BarRow
          label="업무 진행"
          pct={p.progress}
          color={p.progress >= 100 ? 'bg-pos' : timePct !== null && p.progress < timePct - 20 ? 'bg-warn' : 'bg-viz'}
          right={`${p.progress}% · ${p.doneTasks}/${p.totalTasks}건`}
        />
        {start && end && (
          <div className="flex justify-between font-num text-[12px] text-ink-faint">
            <span>{sdate(start)}</span>
            <span>{sdate(end)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function BarRow({
  label,
  pct,
  color,
  right,
  markers = [],
}: {
  label: string;
  pct: number | null;
  color: string;
  right: string;
  markers?: { pct: number; label: string }[];
}) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-3">
      <span className="text-xs font-medium text-ink-soft">{label}</span>
      <div>
        <div className="relative h-2.5 overflow-visible rounded-full bg-line-soft">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct ?? 0}%` }} />
          {markers.map((m) => (
            <span
              key={m.label}
              className="absolute -top-1 h-[18px] w-0.5 -translate-x-1/2 rounded bg-ink"
              style={{ left: `${m.pct}%` }}
              title={m.label}
            />
          ))}
        </div>
        <div className="mt-1 font-num text-xs text-ink-mute">{right}</div>
      </div>
    </div>
  );
}

/* ───────── 사람 ───────── */

function PeoplePanel({ p, tasks, isOverdue }: { p: Project; tasks: Task[]; isOverdue: (t: Task) => boolean }) {
  // 참여자별 업무 진행 — 프로젝트 멤버 + 업무에만 배정된 사람 + 미배정
  type Row = { key: string; name: string; total: number; done: number; overdue: number; isOwner: boolean };
  const rows = new Map<string, Row>();
  const ensure = (key: string, name: string) => {
    let r = rows.get(key);
    if (!r) {
      r = { key, name, total: 0, done: 0, overdue: 0, isOwner: key === p.ownerUserId };
      rows.set(key, r);
    }
    return r;
  };
  for (const m of p.members ?? []) ensure(m.userId, m.user.name);
  for (const t of tasks) {
    const r = ensure(t.assigneeId ?? '__none', t.assignee?.name ?? '미배정');
    r.total += 1;
    if (t.isDone) r.done += 1;
    if (isOverdue(t)) r.overdue += 1;
  }
  const people = [...rows.values()].sort((a, b) => {
    if (a.key === '__none') return 1;
    if (b.key === '__none') return -1;
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    return b.total - a.total;
  });

  return (
    <div className="px-5 py-4">
      <h2 className="text-lg font-bold tracking-tight">담당 · 참여</h2>

      <div className="mt-3 flex items-center gap-3">
        <Avatar name={p.owner?.name} size="lg" />
        <div className="min-w-0">
          <div className="text-xs text-ink-mute">담당자</div>
          <div className="truncate text-base font-semibold">{p.owner?.name ?? '미지정'}</div>
          <div className="text-xs text-ink-faint">{p.leadDepartment?.name ?? ''}</div>
        </div>
      </div>

      <div className="mt-4 text-xs text-ink-mute">참여자별 업무 진행</div>
      {people.length === 0 ? (
        <p className="mt-1 text-sm text-ink-faint">참여자와 업무가 아직 없습니다.</p>
      ) : (
        <ul className="mt-1.5 space-y-2">
          {people.map((r) => {
            const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
            return (
              <li key={r.key} className="flex items-center gap-2.5">
                <Avatar name={r.key === '__none' ? undefined : r.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className={`truncate ${r.key === '__none' ? 'text-ink-faint' : 'font-medium'}`}>
                      {r.name}
                      {r.isOwner && <span className="ml-1 text-[12px] font-normal text-brand-deep">담당</span>}
                    </span>
                    <span className="shrink-0 font-num text-xs text-ink-mute">
                      {r.total === 0 ? (
                        '업무 없음'
                      ) : (
                        <>
                          <span className={r.done === r.total ? 'text-pos' : 'text-ink'}>{r.done}</span>/{r.total}건
                          {r.overdue > 0 && <span className="ml-1.5 text-neg">지연 {r.overdue}</span>}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft">
                    <div
                      className={`h-full rounded-full ${r.overdue > 0 ? 'bg-neg' : pct >= 100 ? 'bg-pos' : 'bg-viz'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ───────── 작은 부품 ───────── */

type Tone = 'plain' | 'pos' | 'neg' | 'warn' | 'brand';
const TONE: Record<Tone, string> = {
  plain: 'bg-line-soft text-ink-mute',
  pos: 'bg-emerald-50 text-pos',
  neg: 'bg-red-50 text-neg',
  warn: 'bg-amber-50 text-warn',
  brand: 'bg-brand-soft text-brand-deep',
};

function Chip({ tone, small, children }: { tone: Tone; small?: boolean; children: ReactNode }) {
  return (
    <span className={`badge font-medium ${TONE[tone]} ${small ? '!text-[12px]' : ''}`}>{children}</span>
  );
}

function Stat({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-ink-mute">{label}</div>
      <div className="mt-0.5 text-base font-semibold leading-snug text-ink">{children}</div>
      {sub && <div className="mt-0.5 text-[12px] text-ink-faint">{sub}</div>}
    </div>
  );
}

function Avatar({ name, size = 'sm' }: { name?: string | null; size?: 'sm' | 'lg' }) {
  const dim = size === 'lg' ? 'h-11 w-11 text-base' : 'h-7 w-7 text-xs';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${dim} ${
        name ? 'bg-brand-soft text-brand-deep' : 'bg-line-soft text-ink-faint'
      }`}
      aria-hidden
    >
      {name ? name.slice(0, 1) : '?'}
    </span>
  );
}

function Person({ name }: { name?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Avatar name={name} />
      <span className={name ? '' : 'text-ink-faint'}>{name ?? '미배정'}</span>
    </span>
  );
}
