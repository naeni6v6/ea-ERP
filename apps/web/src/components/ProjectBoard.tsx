'use client';

import { forwardRef, Fragment, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { big, num, sdate, sdateShort, signClass, WEEKDAY } from '@/lib/format';
import { Empty, Progress, Spinner } from '@/components/ui';
import type { Project, ProjectFinance, Task } from '@/lib/types';

/**
 * 노션 스타일 프로젝트 보드 — 진행률(상태 점 포함) · 태그(부서·담당자) · 수주금액 · 기간 · 목표 · 할 일.
 * 태그 색은 이름 해시로 고정되므로 같은 부서·사람은 어디서나 같은 색으로 보인다.
 * 수주금액을 클릭하면 해당 행 아래로 수주금액·실행예산·매출채권·누적수금액·누적집행액·미지급채무·현금수지 상세가 펼쳐진다.
 * 지연 프로젝트가 항상 위로 오고, 관리자는 ⠿ 핸들 드래그로 순서를 바꾸고 목표를 그 자리에서 입력한 뒤
 * 상단 [저장] 버튼으로 한 번에 저장한다(save()는 ref로 노출).
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
      className="inline-flex max-w-[88px] items-center truncate rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
      title={name}
    >
      {name}
    </span>
  );
}

/** 상태 색 — 진행률 옆 작은 점으로만 표시한다 (라벨은 툴팁) */
const STATUS_DOT: Record<string, string> = {
  URGENT: '#e60000',
  PLANNED: '#a9a099',
  ACTIVE: '#2a78d6',
  ON_HOLD: '#c9820f',
  DONE: '#2f8f5b',
  CANCELLED: '#c8c2bb',
};

/** 정렬 우선순위 — 긴급 > 지연 > 나머지 */
const projectRank = (p: Project) => (p.status === 'URGENT' ? 0 : p.isDelayed ? 1 : 2);

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
  { key: 'receivable', label: '매출채권', hint: '회수 예정 매출채권', tone: 'in' },
  { key: 'received', label: '누적수금액', hint: '프로젝트 귀속 입금 합계', tone: 'in' },
  { key: 'paid', label: '누적집행액', hint: '프로젝트 귀속 집행 합계', tone: 'out' },
  { key: 'payable', label: '미지급채무', hint: '확정된 미지급 채무', tone: 'out' },
  // 현금수지는 서버 expectedProfit(채권·채무 포함) 대신 순수 현금 기준(수금 − 집행)으로 화면에서 계산한다
  { key: 'expectedProfit', label: '프로젝트 현금수지', hint: '누적수금액 − 누적집행액', tone: 'net' },
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
            {/* 입력창을 맨 위 + 자동 포커스 — 토글 열자마자 바로 타이핑해서 추가 */}
            <div className="flex gap-2 pb-1">
              <input
                autoFocus
                className="input !py-1.5 text-sm"
                placeholder="+ 할 일 입력 후 Enter로 바로 추가"
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
            {tasks.length === 0 && (
              <p className="text-xs text-ink-mute">아직 할 일이 없습니다. 위에서 입력해 추가하세요.</p>
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
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * 프로젝트 목표 — 클릭해서 그 자리에서 입력(Enter/포커스아웃으로 반영, Esc 취소).
 * 바로 서버에 쓰지 않고 초안(draft)으로 들고 있다가 상단 [저장] 버튼으로 확정한다.
 */
function GoalCell({
  p,
  draft,
  editable,
  onDraft,
}: {
  p: Project;
  /** 저장 전 초안 — undefined면 초안 없음(원본 표시) */
  draft?: string;
  editable?: boolean;
  onDraft: (v: string) => void;
}) {
  const value = draft ?? p.goal ?? '';
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const cancelRef = useRef(false);

  if (!editable)
    return (
      <span className="block max-w-[150px] truncate text-sm text-ink-soft" title={value || undefined}>
        {value || '—'}
      </span>
    );

  const commit = () => {
    onDraft(text.trim());
    setEditing(false);
  };

  if (editing)
    return (
      <input
        autoFocus
        className="input min-w-[130px] !py-1 text-sm"
        value={text}
        placeholder="목표 입력 후 Enter"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            cancelRef.current = true;
            setEditing(false);
          }
        }}
        onBlur={() => {
          if (cancelRef.current) {
            cancelRef.current = false;
            return;
          }
          commit();
        }}
      />
    );

  return (
    <button
      onClick={() => {
        setText(value);
        setEditing(true);
      }}
      className="group flex max-w-[108px] items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-ink-soft transition-colors hover:bg-line-soft"
      title="클릭해서 목표 입력·수정 — [저장]을 눌러야 확정됩니다"
    >
      <span className="truncate">{value || <span className="text-ink-faint">+ 목표 입력</span>}</span>
      {draft !== undefined && (
        <span className="shrink-0 rounded bg-amber-50 px-1 text-[11px] font-medium text-warn">저장 전</span>
      )}
      <span className="invisible shrink-0 text-[12px] text-ink-faint group-hover:visible">✎</span>
    </button>
  );
}

/** 금액 상세 펼침 행 — 수주금액·실행예산 + (권한 시) 매출채권·누적수금액·누적집행액·미지급채무·현금수지 */
function MoneyRow({ p, fin, colSpan }: { p: Project; fin?: ProjectFinance; colSpan: number }) {
  const base: { label: string; v: string; hint: string; cls: string }[] = [
    { label: '수주금액', v: p.contractAmount, hint: '총 계약 수주금액', cls: 'font-semibold text-ink' },
    { label: '실행예산', v: p.budgetAmount, hint: '프로젝트 승인 예산', cls: 'text-ink' },
  ];
  return (
    // 금액 상세 펼침 — 좌측 브랜드 액센트 + 진한 아래 구분선으로 다른 행과 확실히 구분한다
    <tr className="border-y-2 border-brand/30 bg-brand-soft/40">
      <td colSpan={colSpan} className="border-l-4 border-brand px-4 py-4">
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-brand-deep">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {p.name} · 금액 상세
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {base.map((it) => (
            <div key={it.label} className="rounded-lg border border-line bg-white px-3 py-2" title={it.hint}>
              <div className="text-[13px] text-ink-mute">{it.label}</div>
              <div className={`mt-0.5 font-num text-sm ${it.cls}`}>{num(it.v)}원</div>
              <div className="text-[12px] text-ink-faint">{it.hint}</div>
            </div>
          ))}
          {fin ? (
            FIN_ITEMS.map((it) => {
              const v =
                it.key === 'expectedProfit' ? (big(fin.received) - big(fin.paid)).toString() : fin[it.key];
              const cls =
                it.tone === 'net' ? `font-semibold ${signClass(v)}` : it.tone === 'in' ? 'text-pos' : 'text-neg';
              return (
                <div key={it.key} className="rounded-lg border border-line bg-white px-3 py-2" title={it.hint}>
                  <div className="text-[13px] text-ink-mute">{it.label}</div>
                  <div className={`mt-0.5 font-num text-sm ${cls}`}>{num(v)}원</div>
                  <div className="text-[12px] text-ink-faint">{it.hint}</div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 flex items-center rounded-lg border border-dashed border-line px-3 py-2 text-xs text-ink-faint sm:col-span-2 lg:col-span-5">
              매출채권·수금·집행 등 입출금 상세는 손익 열람 권한(대표·관리자)에서 표시됩니다.
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export interface ProjectBoardHandle {
  /** 목표 초안 PATCH + 순서 변경 저장 — 상단 [저장] 버튼이 호출 */
  save: () => Promise<void>;
}

export const ProjectBoard = forwardRef<
  ProjectBoardHandle,
  {
    projects: Project[];
    labelOf: (kind: string, code: string) => string;
    /** projectId → 자금 요약. 없으면(권한 없음/로딩) 금액 펼침에 입출금 상세가 빠진다 */
    finance?: Record<string, ProjectFinance>;
    emptyHint?: string;
    /** 할 일 체크/추가 시 진행률·완수율 갱신용 */
    onTasksChanged?: () => void;
    /** 목표 인라인 편집 + 드래그 정렬 허용 (관리자) */
    editable?: boolean;
    /** 저장할 변경(목표 초안·순서)이 생기거나 사라질 때 알림 — [저장] 버튼 활성화용 */
    onDirtyChange?: (dirty: boolean) => void;
  }
>(function ProjectBoard({ projects, labelOf, finance, emptyHint, onTasksChanged, editable, onDirtyChange }, ref) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [taskOpenId, setTaskOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  // 긴급 > 지연 > 나머지 순으로 항상 위로 — 그 안에서는 서버 저장 순서(sortOrder) 유지
  const initialIds = useMemo(
    () => [...projects].sort((a, b) => projectRank(a) - projectRank(b)).map((p) => p.id),
    [projects],
  );
  const initialKey = initialIds.join('|');
  const [ids, setIds] = useState<string[]>(initialIds);

  // 목록이 새로 로드되면(필터 변경·생성·업로드·저장 후) 로컬 순서·초안을 리셋
  useEffect(() => {
    setIds(initialIds);
    setDrafts({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  const orderDirty = ids.join('|') !== initialKey;
  const dirty = orderDirty || Object.keys(drafts).length > 0;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useImperativeHandle(
    ref,
    () => ({
      async save() {
        for (const [id, goal] of Object.entries(drafts)) await api.patch(`/projects/${id}`, { goal });
        if (orderDirty) await api.post('/projects/reorder', { ids });
      },
    }),
    [drafts, orderDirty, ids],
  );

  const setGoalDraft = (p: Project, v: string) =>
    setDrafts((d) => {
      if (v === (p.goal ?? '').trim()) {
        const { [p.id]: _omit, ...rest } = d;
        return rest;
      }
      return { ...d, [p.id]: v };
    });

  const moveTo = (src: string, dst: string) =>
    setIds((cur) => {
      const from = cur.indexOf(src);
      const to = cur.indexOf(dst);
      if (from < 0 || to < 0 || from === to) return cur;
      const next = [...cur];
      next.splice(from, 1);
      next.splice(to, 0, src);
      return next;
    });

  if (!projects.length) return <Empty>{emptyHint ?? '접근 가능한 프로젝트가 없습니다.'}</Empty>;

  const COLS = 8;
  const rows = ids.map((id) => byId.get(id)).filter((p): p is Project => !!p);

  return (
    <div className="overflow-x-auto">
      <table className="board-table w-full">
        <thead className="border-b border-line-soft">
          <tr>
            <th className="th">진행률</th>
            <th className="th !pl-10">프로젝트 명칭</th>
            <th className="th">담당부서</th>
            <th className="th">담당자</th>
            <th className="th">수주금액</th>
            <th className="th">기간</th>
            <th className="th">프로젝트 목표</th>
            <th className="th w-px">할 일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.map((p) => {
            const fin = finance?.[p.id];
            const open = openId === p.id;
            const taskOpen = taskOpenId === p.id;
            const start = sdateShort(p.startDate);
            const end = sdateShort(p.planEndDate);
            return (
              <Fragment key={p.id}>
                <tr
                  className={`hover:bg-line-soft/60 ${dragId === p.id ? 'opacity-40' : ''}`}
                  onDragOver={
                    editable
                      ? (e) => {
                          e.preventDefault();
                          if (dragId && dragId !== p.id) moveTo(dragId, p.id);
                        }
                      : undefined
                  }
                  onDrop={editable ? (e) => e.preventDefault() : undefined}
                >
                  <td className="td w-[112px]">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {editable && (
                        <span
                          draggable
                          onDragStart={(e) => {
                            setDragId(p.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => setDragId(null)}
                          className="cursor-grab select-none text-sm leading-none text-ink-faint hover:text-ink-mute"
                          title="드래그해서 순서 변경 — [저장]을 눌러야 확정됩니다"
                        >
                          ⠿
                        </span>
                      )}
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: STATUS_DOT[p.status] ?? STATUS_DOT.PLANNED }}
                        title={labelOf('PROJECT_STATUS', p.status)}
                      />
                      {p.totalTasks > 0 ? (
                        <Progress value={p.progress} compact />
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </div>
                  </td>
                  <td className="td min-w-[150px] !pl-10">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium hover:text-brand-deep hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.isDelayed && <span className="badge ml-1.5 bg-red-50 text-neg">지연</span>}
                  </td>
                  <td className="td">{p.leadDepartment ? <Tag name={p.leadDepartment.name} /> : '—'}</td>
                  <td className="td">{p.owner ? <Tag name={p.owner.name} /> : '—'}</td>
                  <td className="td whitespace-nowrap">
                    <button
                      onClick={() => setOpenId(open ? null : p.id)}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 font-num text-sm transition-colors hover:bg-line-soft"
                      title="클릭하면 수주금액·실행예산·매출채권·누적수금액·누적집행액·미지급채무·현금수지 상세가 펼쳐집니다"
                      aria-expanded={open}
                    >
                      <span className="font-medium">{num(p.contractAmount)}</span>
                      <span
                        className={`text-[12px] text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
                      >
                        ▾
                      </span>
                    </button>
                  </td>
                  <td className="td whitespace-nowrap font-num text-xs text-ink-mute" title="시작 ~ 마감">
                    {start || end ? `${start ? `${start} ` : ''}~${end ? ` ${end}` : ''}` : '—'}
                  </td>
                  <td className="td">
                    <GoalCell p={p} draft={drafts[p.id]} editable={editable} onDraft={(v) => setGoalDraft(p, v)} />
                  </td>
                  <td className="td w-px whitespace-nowrap">
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
                </tr>
                {taskOpen && <TaskPanel projectId={p.id} colSpan={COLS} onChanged={onTasksChanged} />}
                {open && <MoneyRow p={p} fin={fin} colSpan={COLS} />}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
