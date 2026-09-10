'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { seoulYmd, todaySeoul, WEEKDAY } from '@/lib/format';
import { Empty, ErrorBox, Section, Spinner, StatusBadge } from '@/components/ui';
import { parseLog, pendingLogItems, serializeLog, withItemDone, type LogItem, type PendingLogItem } from '@/lib/worklog';
import type { Task, UserRow, WorkLog } from '@/lib/types';

const kdateLabel = (ymd: string) => `${ymd.replace(/-/g, '.')} (${WEEKDAY[new Date(`${ymd}T00:00:00+09:00`).getDay()]})`;
/** 'YYYY-MM-DD' 에서 며칠 이동 (KST) */
const shiftDays = (ymd: string, days: number) =>
  seoulYmd(new Date(new Date(`${ymd}T12:00:00+09:00`).getTime() + days * 86400000));
/** 며칠 전인지 — 오늘이면 0 */
const daysAgo = (ymd: string, today: string) =>
  Math.round((new Date(`${today}T12:00:00+09:00`).getTime() - new Date(`${ymd}T12:00:00+09:00`).getTime()) / 86400000);


/**
 * 일별 완료 현황 — 최근 14일 동안 완료 처리(doneAt)한 업무 수를 막대로 보여준다.
 * 오늘은 브랜드색으로 강조, 주말 라벨은 붉은/푸른 톤. 날짜를 클릭하면 아래 업무 일지가 그 날짜로 바뀐다.
 */
function DailyDoneChart({
  tasks,
  selected,
  onSelect,
}: {
  tasks: Task[];
  selected: string;
  onSelect: (ymd: string) => void;
}) {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.doneAt) continue;
    const key = seoulYmd(new Date(t.doneAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = todaySeoul();
  const days: { key: string; day: number; wd: number; count: number; isToday: boolean }[] = [];
  const base = new Date(`${today}T12:00:00+09:00`);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 86400000);
    const key = seoulYmd(d);
    days.push({
      key,
      day: Number(key.slice(8, 10)),
      wd: new Date(`${key}T00:00:00+09:00`).getDay(),
      count: counts.get(key) ?? 0,
      isToday: key === today,
    });
  }

  const max = Math.max(1, ...days.map((d) => d.count));
  const todayCount = days[13].count;
  const week = days.slice(7).reduce((a, d) => a + d.count, 0);
  const total = days.reduce((a, d) => a + d.count, 0);

  return (
    <Section
      title="일별 완료 현황"
      desc="최근 14일 · 완료 체크한 날 기준"
      right={
        <span className="text-xs text-ink-mute">
          오늘 <b className="font-num text-brand-deep">{todayCount}</b>건 · 최근 7일{' '}
          <b className="font-num text-ink">{week}</b>건 · 14일 합계 <b className="font-num text-ink">{total}</b>건
        </span>
      }
    >
      <div className="flex items-end gap-1 px-4 pb-2 pt-5 sm:gap-1.5">
        {days.map((d) => (
          <button
            key={d.key}
            onClick={() => onSelect(d.key)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-lg pb-1.5 pt-1 transition-colors ${
              selected === d.key ? 'bg-brand-soft ring-1 ring-brand/30' : 'hover:bg-line-soft/70'
            }`}
            title={`${d.key} · 완료 ${d.count}건 — 클릭하면 이 날짜의 업무 일지를 봅니다`}
          >
            <span className={`font-num text-[11px] leading-none ${d.count ? 'text-ink-mute' : 'text-transparent'}`}>
              {d.count}
            </span>
            <div className="flex h-20 w-full items-end px-1">
              <div
                className={`w-full rounded-t ${
                  d.count === 0
                    ? 'h-[3px] bg-line-soft'
                    : d.isToday
                      ? 'bg-gradient-to-t from-brand to-brand/60'
                      : 'bg-gradient-to-t from-viz to-viz-light'
                }`}
                style={d.count > 0 ? { height: `${Math.max(12, (d.count / max) * 100)}%` } : undefined}
              />
            </div>
            <span
              className={`font-num text-[11px] leading-none ${
                selected === d.key ? 'font-bold text-brand-deep' : d.isToday ? 'font-bold text-brand-deep' : 'text-ink-faint'
              }`}
            >
              {d.day}
            </span>
            <span
              className={`text-[10px] leading-none ${
                d.wd === 0 ? 'text-red-400' : d.wd === 6 ? 'text-blue-400' : 'text-ink-faint'
              }`}
            >
              {WEEKDAY[d.wd]}
            </span>
          </button>
        ))}
      </div>
    </Section>
  );
}

/**
 * 업무 일지 캘린더 — 월 단위로 일지 작성 현황을 한눈에 보고, 날짜를 클릭해 그날 기록으로 이동한다.
 * 월요일 시작, 토=파랑·일=빨강. 일지가 있는 날은 건수 칩으로 표시.
 */
function WorkLogCalendar({
  scope,
  selected,
  onSelect,
}: {
  scope: string;
  selected: string;
  onSelect: (ymd: string) => void;
}) {
  const today = todaySeoul();
  const [month, setMonth] = useState(selected.slice(0, 7)); // 'YYYY-MM'
  // 차트 등 바깥에서 다른 달의 날짜를 고르면 캘린더도 그 달로 이동
  useEffect(() => {
    if (selected.slice(0, 7) !== month) setMonth(selected.slice(0, 7));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(last).padStart(2, '0')}`;

  const logs = useAsync(
    () =>
      api.get<WorkLog[]>(
        '/worklogs',
        scope === 'me' ? { from, to } : scope === 'all' ? { from, to, scope: 'all' } : { from, to, userId: scope },
      ),
    [from, to, scope],
  );
  const byDay = new Map<string, number>();
  for (const l of logs.data ?? []) {
    const k = l.logDate.slice(0, 10);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }

  const shift = (delta: number) => setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7));

  // 월요일 시작 6주 그리드 — 앞뒤는 이웃 달 날짜를 흐리게
  const firstDow = (new Date(`${from}T00:00:00+09:00`).getDay() + 6) % 7;
  const prevLast = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const cells: { key?: string; day: number; muted?: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: prevLast - firstDow + 1 + i, muted: true });
  for (let d = 1; d <= last; d++) cells.push({ key: `${month}-${String(d).padStart(2, '0')}`, day: d });
  for (let nd = 1; cells.length % 7 !== 0; nd++) cells.push({ day: nd, muted: true });

  return (
    <div className="h-fit rounded-xl border border-line bg-white p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-base font-bold">
          {y}년 {m}월
        </span>
        <span className="flex items-center gap-1">
          <button className="rounded-md px-1.5 py-0.5 text-ink-mute hover:bg-line-soft" onClick={() => shift(-1)} aria-label="이전 달">
            ‹
          </button>
          <button
            className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-line-soft"
            onClick={() => {
              setMonth(today.slice(0, 7));
              onSelect(today);
            }}
          >
            오늘
          </button>
          <button className="rounded-md px-1.5 py-0.5 text-ink-mute hover:bg-line-soft" onClick={() => shift(1)} aria-label="다음 달">
            ›
          </button>
        </span>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center">
        {['월', '화', '수', '목', '금', '토', '일'].map((w, i) => (
          <span key={w} className={`text-[11px] font-medium ${i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-ink-faint'}`}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c, i) => {
          const count = c.key ? (byDay.get(c.key) ?? 0) : 0;
          const isSel = c.key === selected;
          const isToday = c.key === today;
          return (
            <button
              key={i}
              disabled={!c.key}
              onClick={() => c.key && onSelect(c.key)}
              className={`flex h-12 flex-col items-center gap-0.5 rounded-lg pt-1 transition-colors ${
                isSel ? 'bg-brand-soft ring-1 ring-brand/40' : c.key ? 'hover:bg-line-soft/80' : ''
              }`}
              title={c.key ? `${c.key}${count ? ` · 일지 ${count}건` : ''}` : undefined}
            >
              <span
                className={`font-num text-xs leading-none ${
                  c.muted ? 'text-ink-faint/50' : isToday ? 'font-bold text-brand-deep' : 'text-ink-soft'
                }`}
              >
                {c.day}
              </span>
              {count > 0 && (
                <span className="rounded border border-viz/40 bg-viz-soft px-1 font-num text-[10px] font-semibold leading-tight text-viz-deep">
                  {scope === 'all' ? count : '✓'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-right text-[11px] text-ink-faint">
        {month.replace('-', '.')} 일지 {logs.data?.length ?? 0}건
      </p>
    </div>
  );
}

/** 그날 완료 체크한 업무 — 자동으로 붙는 목록 (취소선) */
function DoneList({ items }: { items: Task[] }) {
  if (items.length === 0) return null;
  return (
    <ol className="space-y-1">
      {items.map((t, i) => (
        <li key={t.id} className="flex items-baseline gap-2 text-sm">
          <span className="font-num w-4 shrink-0 text-right text-xs text-ink-faint">{i + 1}.</span>
          <span className="text-ink-mute line-through decoration-ink-faint/60">{t.title}</span>
          {t.project && <span className="text-xs text-ink-faint">· {t.project.name}</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * 본인 업무 일지 — 체크리스트.
 * [작성] 버튼 없이 맨 아래 칸에 바로 쳐서 Enter로 항목을 추가하고, 항목 글자도 눌러서 바로 고친다.
 * 체크 안 된 항목은 (진행중)으로 남는다. 바뀔 때마다 하루치를 통째로 저장한다.
 * 날짜별로 새로 마운트되도록 부모가 key={date}를 준다.
 */
function DailyChecklist({
  date,
  log,
  loading,
  onSaved,
  meName,
  dayTasks,
  calendar,
}: {
  date: string;
  log: WorkLog | null;
  loading: boolean;
  onSaved: () => void;
  meName: string;
  dayTasks: Task[];
  calendar: ReactNode;
}) {
  const [items, setItems] = useState<LogItem[]>(() => parseLog(log?.content ?? ''));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 서버 내용이 새로 오면(첫 로딩·저장 후 재조회) 그것으로 맞춘다
  const serverKey = loading ? null : (log?.updatedAt ?? 'none');
  const [syncedKey, setSyncedKey] = useState<string | null>(serverKey);
  if (serverKey !== null && serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setItems(parseLog(log?.content ?? ''));
  }

  // 연달아 체크하면 렌더 전 상태로 계산돼 하나가 묻힐 수 있어, 최신 목록은 ref로 들고 간다.
  // 저장도 순서대로 이어 붙여 늦게 도착한 응답이 앞선 변경을 덮지 않게 한다.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /** 항목 목록을 통째로 저장 — 화면은 먼저 바꾸고, 실패하면 되돌린다 */
  const commit = (next: LogItem[]) => {
    const prev = itemsRef.current;
    itemsRef.current = next;
    setItems(next);
    setBusy(true);
    setError('');
    queue.current = queue.current
      .then(() => api.put('/worklogs', { date, content: serializeLog(next) }))
      .then(() => onSaved())
      .catch((e: unknown) => {
        itemsRef.current = prev;
        setItems(prev);
        setError(e instanceof Error ? e.message : '저장에 실패했습니다');
      })
      .finally(() => setBusy(false));
  };

  const addItem = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    commit([...itemsRef.current, { done: false, text: t }]);
  };
  const toggleItem = (i: number) =>
    commit(itemsRef.current.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it)));
  /** 글자를 비우면 그 항목은 지운다 */
  const editItem = (i: number, text: string) => {
    const cur = itemsRef.current;
    const v = text.trim();
    if (!cur[i] || v === cur[i].text) return;
    commit(v ? cur.map((it, idx) => (idx === i ? { ...it, text: v } : it)) : cur.filter((_, idx) => idx !== i));
  };
  const removeItem = (i: number) => commit(itemsRef.current.filter((_, idx) => idx !== i));

  const openCount = items.filter((i) => !i.done).length;
  const doneCount = items.length - openCount;

  return (
    <Section
      title={`업무 일지 · ${kdateLabel(date)}`}
      right={
        <span className="text-xs text-ink-mute">
          {busy ? (
            '저장 중…'
          ) : (
            <>
              진행중 <b className="font-num text-brand-deep">{openCount}</b>건 · 완료{' '}
              <b className="font-num text-ink">{doneCount}</b>건
            </>
          )}
        </span>
      }
    >
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr),330px]">
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-mute">{meName}</p>
            <DoneList items={dayTasks} />
            {dayTasks.length === 0 && <p className="text-xs text-ink-faint">이 날짜에 완료 체크한 업무가 없습니다.</p>}
          </div>

          {/* 체크리스트 — 항목을 바로 고쳐 쓰고, 체크 안 된 항목은 (진행중)으로 남는다 */}
          <div className="rounded-lg border border-line-soft bg-line-soft/30 px-2 py-1.5">
            <ul className="divide-y divide-line-soft/70">
              {items.map((it, i) => (
                <li key={`${i}-${it.text}`} className="group flex items-center gap-2 px-1 py-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-brand"
                    checked={it.done}
                    onChange={() => toggleItem(i)}
                    aria-label={`${it.text} 완료`}
                  />
                  <input
                    defaultValue={it.text}
                    onBlur={(e) => editItem(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                    className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-line focus:border-brand focus:bg-white ${
                      it.done ? 'text-ink-faint line-through' : 'text-ink'
                    }`}
                    aria-label="일지 항목"
                  />
                  {!it.done && <span className="shrink-0 text-xs text-warn">(진행중)</span>}
                  <button
                    className="shrink-0 px-1 text-xs text-ink-faint opacity-0 transition-opacity hover:text-neg group-hover:opacity-100"
                    onClick={() => removeItem(i)}
                    title="항목 삭제"
                    aria-label="항목 삭제"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {/* 바로 타이핑 — 버튼 없이 여기에 쓰고 Enter 치면 항목이 추가된다 */}
            <div className="flex items-center gap-2 border-t border-line-soft px-1 py-1">
              <span className="w-4 shrink-0 text-center text-sm text-ink-faint">+</span>
              <input
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-ink-faint hover:border-line focus:border-brand focus:bg-white"
                placeholder={items.length ? '항목을 입력하고 Enter' : '오늘 한 일을 입력하고 Enter (예: 계약서 초안 회신)'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={addItem}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
                aria-label="새 일지 항목"
              />
            </div>
          </div>
          {error && <p className="text-xs text-neg">{error}</p>}
        </div>
        {calendar}
      </div>
    </Section>
  );
}

/**
 * 일일 업무 일지 — 슬랙 데일리 로그처럼 "그날 뭐 했는지"를 기록한다.
 * 그날 완료 체크한 업무는 취소선 목록으로 자동으로 붙고, 자유 메모를 직접 작성·수정한다.
 * 대표가 전체/개인별로 볼 때는 사람별 카드로 읽기 전용 표시.
 */
function WorkLogSection({
  date,
  scope,
  tasks,
  meName,
  onSelectDate,
  tick,
  onChanged,
}: {
  date: string;
  /** 'me' | 'all' | userId */
  scope: string;
  tasks: Task[];
  meName: string;
  /** 우측 캘린더에서 날짜 클릭 시 */
  onSelectDate: (ymd: string) => void;
  /** 아래 [진행 중]에서 항목을 체크하면 올라가는 값 — 여기도 다시 읽는다 */
  tick: number;
  /** 여기서 일지를 고치면 [진행 중] 목록도 다시 읽게 알린다 */
  onChanged: () => void;
}) {
  const logs = useAsync(
    () =>
      api.get<WorkLog[]>(
        '/worklogs',
        scope === 'me' ? { date } : scope === 'all' ? { date, scope: 'all' } : { date, userId: scope },
      ),
    [date, scope, tick],
  );
  // 선택한 날짜에 완료 체크된 업무 (현재 스코프 기준)
  const dayTasks = tasks.filter((t) => t.doneAt && seoulYmd(new Date(t.doneAt)) === date);

  if (scope === 'me') {
    return (
      <DailyChecklist
        // 날짜가 바뀌면 새로 시작 — 이전 날짜 항목이 잠깐 남지 않는다
        key={date}
        date={date}
        log={logs.data?.[0] ?? null}
        loading={logs.loading}
        onSaved={onChanged}
        meName={meName}
        dayTasks={dayTasks}
        calendar={<WorkLogCalendar scope={scope} selected={date} onSelect={onSelectDate} />}
      />
    );
  }

  // 대표 — 전체/개인별 읽기 전용: 사람별 카드 (일지 + 그날 완료 업무)
  const byUser = new Map<string, { name: string; log?: WorkLog; tasks: Task[] }>();
  for (const l of logs.data ?? []) if (l.user) byUser.set(l.user.id, { name: l.user.name, log: l, tasks: [] });
  for (const t of dayTasks) {
    const id = t.assignee?.id ?? '_none';
    const name = t.assignee?.name ?? '미배정';
    if (!byUser.has(id)) byUser.set(id, { name, tasks: [] });
    byUser.get(id)!.tasks.push(t);
  }
  const people = [...byUser.values()];

  return (
    <Section title={`업무 일지 · ${kdateLabel(date)}`}>
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr),330px]">
        <div>
          {logs.loading && !logs.data ? (
            <Spinner />
          ) : people.length === 0 ? (
            <Empty>이 날짜의 완료 업무·일지 기록이 없습니다.</Empty>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {people.map((p) => (
                <div key={p.name} className="h-fit rounded-xl border border-line bg-white p-4">
                  <p className="mb-2 text-sm font-bold">{p.name}</p>
                  <DoneList items={p.tasks} />
                  {p.log ? (
                    <ul className="mt-2 space-y-1 rounded-lg bg-line-soft/50 px-3 py-2">
                      {parseLog(p.log.content).map((it, i) => (
                        <li key={i} className="flex items-baseline gap-2 text-sm leading-relaxed">
                          <span className={`shrink-0 text-xs ${it.done ? 'text-pos' : 'text-ink-faint'}`}>
                            {it.done ? '☑' : '☐'}
                          </span>
                          <span className={it.done ? 'text-ink-faint line-through' : 'text-ink-soft'}>{it.text}</span>
                          {!it.done && <span className="shrink-0 text-xs text-warn">(진행중)</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-ink-faint">작성한 일지 없음</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <WorkLogCalendar scope={scope} selected={date} onSelect={onSelectDate} />
      </div>
    </Section>
  );
}

export default function MyTasksPage() {
  const { me, isCeo, labelOf } = useSession();
  // 대표는 전체/개인별로 볼 수 있다: 'me' | 'all' | <userId>
  const [scope, setScope] = useState('me');
  const users = useAsync(() => (isCeo ? api.get<UserRow[]>('/users') : Promise.resolve(null)), [isCeo]);
  const res = useAsync(
    () =>
      api.get<Task[]>(
        '/tasks/my',
        scope === 'me' ? {} : scope === 'all' ? { scope: 'all' } : { userId: scope },
      ),
    [scope],
  );
  const [error, setError] = useState('');
  const today = todaySeoul();
  const [selectedDate, setSelectedDate] = useState(today);

  // 업무 일지가 바뀔 때마다 올린다 — 일지 섹션과 아래 [진행 중] 목록이 같은 값을 본다
  const [logTick, setLogTick] = useState(0);
  const bumpLogs = () => setLogTick((t) => t + 1);

  /**
   * 지난 일지에서 아직 체크 안 한 항목 — 날짜가 지나도 [진행 중]에 계속 남는다.
   * 하루 한 건짜리 기록이라 1년치를 읽어도 가볍다.
   */
  const carryFrom = shiftDays(today, -365);
  const pastLogs = useAsync(
    () =>
      api.get<WorkLog[]>('/worklogs', {
        from: carryFrom,
        to: today,
        ...(scope === 'me' ? {} : scope === 'all' ? { scope: 'all' } : { userId: scope }),
      }),
    [scope, carryFrom, today, logTick],
  );
  const pending = pendingLogItems(pastLogs.data, me?.id);

  const toggle = async (t: Task) => {
    setError('');
    try {
      await api.patch(`/tasks/${t.id}`, { isDone: !t.isDone });
      res.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경에 실패했습니다');
    }
  };

  /** [진행 중]에서 일지 항목 완료 — 그 날짜의 일지를 다시 저장한다 (본인 일지만) */
  const [logBusy, setLogBusy] = useState('');
  const completeLogItem = async (p: PendingLogItem) => {
    setError('');
    setLogBusy(p.key);
    try {
      await api.put('/worklogs', { date: p.date, content: withItemDone(p.log.content, p.index) });
      bumpLogs();
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경에 실패했습니다');
    } finally {
      setLogBusy('');
    }
  };

  const tasks = res.data ?? [];
  const open = tasks.filter((t) => !t.isDone);
  const done = tasks.filter((t) => t.isDone);
  const overdue = open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today);
  const showAssignee = scope !== 'me';
  const scopeName =
    scope === 'me'
      ? `${me?.name} 님에게 배정된 업무`
      : scope === 'all'
        ? '전체 직원 업무'
        : `${users.data?.find((u) => u.id === scope)?.name ?? ''} 님 업무`;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">내 업무</h1>
          <p className="mt-1.5 text-base font-medium text-ink-soft">
            {scopeName} · 남은 <b className="font-num text-brand-deep">{open.length + pending.length}</b>건
            {overdue.length > 0 && (
              <span className="text-neg">
                {' '}
                · 기한 초과 <b className="font-num">{overdue.length}</b>건
              </span>
            )}
          </p>
        </div>
        {isCeo && (
          <select className="input w-40" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="me">내 업무</option>
            <option value="all">전체 직원</option>
            {(users.data ?? [])
              .filter((u) => u.isActive)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {error && <ErrorBox message={error} />}

      {res.loading && !res.data ? (
        <Spinner />
      ) : res.error ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : (
        <>
          <DailyDoneChart tasks={tasks} selected={selectedDate} onSelect={setSelectedDate} />

          <WorkLogSection
            date={selectedDate}
            scope={scope}
            tasks={tasks}
            meName={me?.name ?? ''}
            onSelectDate={setSelectedDate}
            tick={logTick}
            onChanged={bumpLogs}
          />

          <Section
            title="진행 중"
            desc={pending.length > 0 ? '업무 일지에서 체크하지 않은 항목은 날짜가 지나도 여기에 계속 남습니다' : undefined}
          >
            {!open.length && !pending.length ? (
              <Empty>남은 업무가 없습니다.</Empty>
            ) : (
              <ul className="divide-y divide-line-soft">
                {/* 지난 일지에서 넘어온 미체크 항목 — 오래된 것부터 */}
                {pending.map((p) => {
                  const ago = daysAgo(p.date, today);
                  return (
                    <li key={p.key} className="flex items-center gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={false}
                        disabled={!p.mine || logBusy === p.key}
                        onChange={() => completeLogItem(p)}
                        className="h-4 w-4 accent-brand"
                        title={p.mine ? '완료로 체크합니다' : '본인 일지만 체크할 수 있습니다'}
                        aria-label={`${p.text} 완료`}
                      />
                      <span className="flex-1 text-sm">{p.text}</span>
                      <span className="badge bg-line-soft text-ink-mute">일지</span>
                      {showAssignee && p.log.user && (
                        <span className="badge bg-brand-soft text-brand-deep">{p.log.user.name}</span>
                      )}
                      <button
                        className={`w-24 text-right font-num text-xs hover:underline ${ago > 0 ? 'font-medium text-warn' : 'text-ink-faint'}`}
                        onClick={() => setSelectedDate(p.date)}
                        title={`${p.date} 일지로 이동`}
                      >
                        {ago === 0 ? '오늘' : `${ago}일 전`}
                      </button>
                    </li>
                  );
                })}
                {open.map((t) => {
                  const late = t.dueDate && t.dueDate.slice(0, 10) < today;
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggle(t)}
                        className="h-4 w-4 accent-brand"
                        aria-label={`${t.title} 완료`}
                      />
                      <span className="flex-1 text-sm">{t.title}</span>
                      {showAssignee && (
                        <span className="badge bg-brand-soft text-brand-deep">{t.assignee?.name ?? '미배정'}</span>
                      )}
                      {t.project && (
                        <Link
                          href={`/projects/${t.project.id}`}
                          className="text-xs text-ink-mute hover:text-brand-deep hover:underline"
                        >
                          {t.project.name}
                        </Link>
                      )}
                      <StatusBadge status={t.status} label={labelOf('TASK_STATUS', t.status)} />
                      <span
                        className={`w-24 text-right font-num text-xs ${late ? 'font-medium text-neg' : 'text-ink-faint'}`}
                      >
                        {t.dueDate?.slice(0, 10) ?? ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {done.length > 0 && (
            <Section title={`완료 ${done.length}건`}>
              <ul className="divide-y divide-line-soft">
                {done.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggle(t)}
                      className="h-4 w-4 accent-brand"
                      aria-label={`${t.title} 완료 해제`}
                    />
                    <span className="flex-1 text-sm text-ink-faint line-through">{t.title}</span>
                    {showAssignee && <span className="badge bg-line-soft text-ink-mute">{t.assignee?.name ?? '미배정'}</span>}
                    {t.doneAt && (
                      <span className="font-num text-xs text-ink-faint">{seoulYmd(new Date(t.doneAt)).replace(/-/g, '.')}</span>
                    )}
                    {t.project && <span className="text-xs text-ink-faint">{t.project.name}</span>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
