'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { compact, num, signClass } from '@/lib/format';
import { Empty, Progress, Spinner } from '@/components/ui';
import type { Project, ProjectFinance, Task } from '@/lib/types';

/**
 * 노션 스타일 프로젝트 보드 — 상태 필 · 태그(부서·담당자) · 진행률 · 기간 · 목표 · 할 일 · 예상손익.
 * 태그 색은 이름 해시로 고정되므로 같은 부서·사람은 어디서나 같은 색으로 보인다.
 * 예상손익 칩을 클릭하면 해당 행 아래로 받을돈·받은돈·나간돈·나갈돈 상세가 펼쳐진다.
 */

/** 노션 태그 팔레트 — 밝은 카드 위에서 잘 읽히는 연한 배경 + 진한 글자 */
const TAG_COLORS = [
  { bg: '#f1f0ee', fg: '#57514b' }, // gray
  { bg: '#f3eee8', fg: '#7a5b3c' }, // brown
  { bg: '#fdeede', fg: '#b45f05' }, // orange
  { bg: '#fbf3d8', fg: '#8f6c00' }, // yellow
  { bg: '#e7f3ea', fg: '#1f7a3f' }, // green
  { bg: '#e7f0fa', fg: '#1c5cab' }, // blue
  { bg: '#f0ecf9', fg: '#6940a5' }, // purple
  { bg: '#faecf2', fg: '#ad3a6c' }, // pink
  { bg: '#fdeceb', fg: '#b0342c' }, // red
] as const;

const hashTag = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
};

function Tag({ name }: { name: string }) {
  const c = hashTag(name);
  return (
    <span
      className="inline-flex max-w-[140px] items-center truncate rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
      title={name}
    >
      {name}
    </span>
  );
}

/** 상태 필 — 노션처럼 점 + 라벨. 색은 상태 의미로 고정 */
const STATUS_PILL: Record<string, { bg: string; fg: string; dot: string }> = {
  PLANNED: { bg: '#f1f0ee', fg: '#57514b', dot: '#a9a099' },
  ACTIVE: { bg: '#e7f0fa', fg: '#1c5cab', dot: '#2a78d6' },
  ON_HOLD: { bg: '#fbf3d8', fg: '#8f6c00', dot: '#c9820f' },
  DONE: { bg: '#e7f3ea', fg: '#1f7a3f', dot: '#2f8f5b' },
  CANCELLED: { bg: '#f1f0ee', fg: '#a9a099', dot: '#c8c2bb' },
};

function StatusPill({ status, label }: { status: string; label: string }) {
  const c = STATUS_PILL[status] ?? STATUS_PILL.PLANNED;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {label}
    </span>
  );
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-08-26" → "26.08.26 (수)" */
const kdate = (d: string | null | undefined): string => {
  if (!d) return '';
  const s = d.slice(0, 10);
  const [y, m, day] = s.split('-').map(Number);
  if (!y || !m || !day) return '';
  const wd = WEEKDAY[new Date(`${s}T00:00:00Z`).getUTCDay()];
  return `${String(y).slice(2)}.${String(m).padStart(2, '0')}.${String(day).padStart(2, '0')} (${wd})`;
};

/** 펼침 행의 자금 상세 항목 — 회계 용어 기준 */
const FIN_ITEMS: { key: keyof ProjectFinance; label: string; hint: string; tone: 'in' | 'out' | 'net' }[] = [
  { key: 'receivable', label: '매출채권', hint: '회수 예정 채권 잔액', tone: 'in' },
  { key: 'received', label: '현금유입', hint: '프로젝트 귀속 입금 합계', tone: 'in' },
  { key: 'paid', label: '현금유출', hint: '프로젝트 귀속 출금 합계', tone: 'out' },
  { key: 'payable', label: '미지급채무', hint: '미지급금 + 지급예정액', tone: 'out' },
  { key: 'expectedProfit', label: '예상손익', hint: '유입+채권 − 유출·채무', tone: 'net' },
];

/** 할 일 패널 — 보드에서 바로 체크/추가한다. 체크하면 진행률·완수율이 즉시 갱신된다. */
function TaskPanel({
  projectId,
  colSpan,
  onChanged,
}: {
  projectId: string;
  colSpan: number;
  onChanged?: () => void;
}) {
  const res = useAsync(() => api.get<Task[]>(`/projects/${projectId}/tasks`), [projectId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const toggle = async (t: Task) => {
    setBusyId(t.id);
    try {
      await api.patch(`/tasks/${t.id}`, { isDone: !t.isDone });
      res.reload();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const add = async () => {
    const v = title.trim();
    if (!v) return;
    setAdding(true);
    try {
      await api.post(`/projects/${projectId}/tasks`, { title: v });
      setTitle('');
      res.reload();
      onChanged?.();
    } finally {
      setAdding(false);
    }
  };

  const tasks = res.data ?? [];
  return (
    <tr className="bg-brand-soft/40">
      <td colSpan={colSpan} className="px-5 py-3">
        {res.loading && !res.data ? (
          <Spinner label="할 일 불러오는 중…" />
        ) : (
          <div className="space-y-1.5">
            {tasks.length === 0 && (
              <p className="text-xs text-ink-mute">아직 할 일이 없습니다. 아래에서 추가하세요.</p>
            )}
            {tasks.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-white px-3 py-2 transition-colors hover:border-brand/50 ${busyId === t.id ? 'opacity-50' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={t.isDone}
                  disabled={busyId === t.id}
                  onChange={() => toggle(t)}
                  className="h-4 w-4 accent-brand"
                />
                <span className={`flex-1 text-sm ${t.isDone ? 'text-ink-faint line-through' : 'text-ink'}`}>
                  {t.title}
                </span>
                {t.assignee && <span className="text-[13px] text-ink-mute">{t.assignee.name}</span>}
                {t.dueDate && (
                  <span className="font-num text-[13px] text-ink-faint">{kdate(t.dueDate)}</span>
                )}
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <input
                className="input !py-1.5 text-sm"
                placeholder="+ 할 일 추가 — Enter"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add();
                }}
                disabled={adding}
              />
              <button className="btn-primary !py-1.5 text-xs" onClick={add} disabled={adding || !title.trim()}>
                추가
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

function FinanceRow({ fin, colSpan }: { fin: ProjectFinance; colSpan: number }) {
  return (
    <tr className="bg-line-soft/50">
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {FIN_ITEMS.map((it) => {
            const v = fin[it.key];
            const cls =
              it.tone === 'net' ? `font-semibold ${signClass(v)}` : it.tone === 'in' ? 'text-pos' : 'text-neg';
            return (
              <div key={it.key} className="rounded-lg border border-line bg-white px-3 py-2" title={it.hint}>
                <div className="text-[13px] text-ink-mute">{it.label}</div>
                <div className={`mt-0.5 font-num text-sm ${cls}`}>{num(v)}원</div>
                <div className="text-[12px] text-ink-faint">{it.hint}</div>
              </div>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

export function ProjectBoard({
  projects,
  labelOf,
  finance,
  emptyHint,
  onTasksChanged,
}: {
  projects: Project[];
  labelOf: (kind: string, code: string) => string;
  /** projectId → 자금 요약. 없으면(권한 없음/로딩) 예상손익 칸은 —로 표시 */
  finance?: Record<string, ProjectFinance>;
  emptyHint?: string;
  /** 할 일 체크/추가 시 진행률·완수율 갱신용 */
  onTasksChanged?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [taskOpenId, setTaskOpenId] = useState<string | null>(null);

  if (!projects.length) return <Empty>{emptyHint ?? '접근 가능한 프로젝트가 없습니다.'}</Empty>;

  const COLS = 10;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-line-soft">
          <tr>
            <th className="th">진행현황</th>
            <th className="th">프로젝트 명칭</th>
            <th className="th">진행률</th>
            <th className="th">담당부서</th>
            <th className="th">담당자</th>
            <th className="th">시작 날짜</th>
            <th className="th">마감 날짜</th>
            <th className="th">프로젝트 목표</th>
            <th className="th">할 일</th>
            <th className="th text-right">예상손익</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {projects.map((p) => {
            const fin = finance?.[p.id];
            const open = openId === p.id;
            const taskOpen = taskOpenId === p.id;
            return (
              <Fragment key={p.id}>
                <tr className="hover:bg-line-soft/60">
                  <td className="td">
                    <StatusPill status={p.status} label={labelOf('PROJECT_STATUS', p.status)} />
                  </td>
                  <td className="td min-w-[180px]">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium hover:text-brand-deep hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.isDelayed && <span className="badge ml-1.5 bg-red-50 text-neg">지연</span>}
                  </td>
                  <td className="td w-[130px]">
                    {p.totalTasks > 0 ? <Progress value={p.progress} /> : <span className="text-xs text-ink-faint">—</span>}
                  </td>
                  <td className="td">{p.leadDepartment ? <Tag name={p.leadDepartment.name} /> : '—'}</td>
                  <td className="td">{p.owner ? <Tag name={p.owner.name} /> : '—'}</td>
                  <td className="td whitespace-nowrap font-num text-xs text-ink-mute">
                    {kdate(p.startDate) || '—'}
                  </td>
                  <td className="td whitespace-nowrap font-num text-xs text-ink-mute">
                    {kdate(p.planEndDate) || '—'}
                  </td>
                  <td className="td max-w-[180px] truncate text-xs text-ink-soft" title={p.goal ?? undefined}>
                    {p.goal || '—'}
                  </td>
                  <td className="td whitespace-nowrap">
                    <button
                      onClick={() => setTaskOpenId(taskOpen ? null : p.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        taskOpen
                          ? 'border-brand bg-brand text-white'
                          : 'border-brand/40 bg-brand-soft text-brand-deep hover:bg-brand/15'
                      }`}
                      title="클릭하면 할 일 목록이 펼쳐집니다. 체크박스로 바로 완료 처리"
                      aria-expanded={taskOpen}
                    >
                      <span className="text-[15px] leading-none">☑</span>
                      {p.totalTasks > 0 ? (
                        <span className="font-num">
                          {p.doneTasks}/{p.totalTasks}
                        </span>
                      ) : (
                        '할 일'
                      )}
                      <span className={`text-[11px] transition-transform ${taskOpen ? 'rotate-180' : ''}`}>▾</span>
                    </button>
                  </td>
                  <td className="td text-right">
                    {fin ? (
                      <button
                        onClick={() => setOpenId(open ? null : p.id)}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-num text-sm transition-colors hover:bg-line-soft"
                        title="클릭하면 매출채권/현금유입/현금유출/미지급채무 상세가 펼쳐집니다"
                        aria-expanded={open}
                      >
                        <span className={`font-medium ${signClass(fin.expectedProfit)}`}>
                          {compact(fin.expectedProfit)}
                        </span>
                        <span
                          className={`text-[12px] text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
                        >
                          ▾
                        </span>
                      </button>
                    ) : (
                      <span className="text-xs text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
                {taskOpen && <TaskPanel projectId={p.id} colSpan={COLS} onChanged={onTasksChanged} />}
                {open && fin && <FinanceRow fin={fin} colSpan={COLS} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
