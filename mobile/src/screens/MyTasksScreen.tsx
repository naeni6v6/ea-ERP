import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/themed';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useMyTasks, useUsers, useWorkLogsOfDay, useWorkLogsOfRange } from '../api/queries';
import type { Task, WorkLog } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { OfflineBanner } from '../components/OfflineBanner';
import { StatusBadge } from '../components/StatusBadge';
import { Empty, ErrorView, Section, Spinner } from '../components/ui';
import { kstYmd, lastDayOf, shiftMonth, shortDateLabel, todaySeoul } from '../lib/dates';
import { colors, ft, numFont, sh } from '../theme';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const dowOf = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/**
 * 내 업무 — 웹 my/page.tsx와 같은 데이터·규칙을 모바일 폭에 맞춘 화면.
 * 일별 완료 차트(14일) → 업무 일지(작성·수정) → 월 캘린더 → 진행/완료 목록.
 * 대표는 내 업무/전체 직원/개인별로 범위를 바꿔 본다. 완료 체크는 즉시 저장된다.
 */
export function MyTasksScreen() {
  const { state, isCeo } = useAuth();
  const meName = state.status === 'signedIn' ? state.me.name : '';
  const qc = useQueryClient();

  const [scope, setScope] = useState('me');
  const users = useUsers(isCeo);
  const q = useMyTasks(scope);
  const today = todaySeoul();
  const [selectedDate, setSelectedDate] = useState(today);
  const [error, setError] = useState('');

  const tasks = q.data ?? [];
  const open = tasks.filter((t) => !t.isDone);
  const done = tasks.filter((t) => t.isDone);
  const overdue = open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today);
  const showAssignee = scope !== 'me';

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['tasks', 'my'] }),
      qc.invalidateQueries({ queryKey: ['worklogs'] }),
    ]);

  const toggle = async (t: Task) => {
    setError('');
    try {
      await api.patch(`/tasks/${t.id}`, { isDone: !t.isDone });
      await invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경에 실패했습니다');
    }
  };

  const scopeName =
    scope === 'me'
      ? '내 업무'
      : scope === 'all'
        ? '전체 직원'
        : (users.data?.find((u) => u.id === scope)?.name ?? '') + ' 님';

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <OfflineBanner dataUpdatedAt={q.dataUpdatedAt || undefined} />
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor={colors.brand} />
          }
        >
          {/* 범위 전환 (대표 전용) + 요약 */}
          {isCeo && (
            <ScopeField
              scope={scope}
              scopeName={scopeName}
              users={(users.data ?? []).filter((u) => u.isActive)}
              onChange={(s) => setScope(s)}
            />
          )}
          <Text style={s.summary}>
            {scope === 'me' ? `${meName} 님에게 배정된 업무` : `${scopeName} 업무`} · 남은{' '}
            <Text style={[{ color: colors.brandDeep }, ft.bold, numFont]}>{open.length}</Text>건
            {overdue.length > 0 && (
              <Text style={{ color: colors.neg }}>
                {' '}
                · 기한 초과 <Text style={[ft.bold, numFont]}>{overdue.length}</Text>건
              </Text>
            )}
          </Text>

          {!!error && (
            <View style={s.errBox}>
              <Text style={{ color: colors.neg, fontSize: 13 }}>{error}</Text>
            </View>
          )}

          {q.isLoading ? (
            <Spinner />
          ) : q.isError && !q.data ? (
            <ErrorView
              message={q.error instanceof Error ? q.error.message : '업무를 불러오지 못했습니다'}
              onRetry={() => q.refetch()}
            />
          ) : (
            <>
              <Section title="일별 완료 현황">
                <DailyDoneBars tasks={tasks} selected={selectedDate} onSelect={setSelectedDate} />
              </Section>

              <Section title={`업무 일지 · ${shortDateLabel(selectedDate)}`}>
                <WorkLogCard date={selectedDate} scope={scope} tasks={tasks} meName={meName} onSaved={invalidate} />
                <MonthCalendar scope={scope} selected={selectedDate} onSelect={setSelectedDate} />
              </Section>

              <Section title="진행 중">
                <View style={s.card}>
                  {!open.length ? (
                    <Empty>남은 업무가 없습니다</Empty>
                  ) : (
                    open.map((t, i) => (
                      <TaskRow key={t.id} task={t} first={i === 0} today={today} showAssignee={showAssignee} onToggle={() => toggle(t)} />
                    ))
                  )}
                </View>
              </Section>

              {done.length > 0 && (
                <Section title={`완료 ${done.length}건`}>
                  <View style={s.card}>
                    {done.map((t, i) => (
                      <TaskRow key={t.id} task={t} first={i === 0} today={today} showAssignee={showAssignee} onToggle={() => toggle(t)} />
                    ))}
                  </View>
                </Section>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ── 범위 전환 (대표) — 용도 선택과 같은 접이식 필드 ── */
function ScopeField({
  scope,
  scopeName,
  users,
  onChange,
}: {
  scope: string;
  scopeName: string;
  users: { id: string; name: string }[];
  onChange: (s: string) => void;
}) {
  const [openPick, setOpenPick] = useState(false);
  const options: [string, string][] = [['me', '내 업무'], ['all', '전체 직원'], ...users.map((u): [string, string] => [u.id, u.name])];
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => setOpenPick((v) => !v)} style={[s.scopeField, openPick && { backgroundColor: colors.brandSoft }]}>
        <Ionicons name="people-outline" size={15} color={colors.inkMute} />
        <Text style={[{ flex: 1, fontSize: 14, color: colors.ink }, ft.semibold]}>{scopeName}</Text>
        <Ionicons name={openPick ? 'chevron-up' : 'chevron-down'} size={15} color={colors.inkFaint} />
      </Pressable>
      {openPick && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {options.map(([id, name]) => {
            const on = id === scope;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  onChange(id);
                  setOpenPick(false);
                }}
                style={[s.scopeChip, on && { backgroundColor: colors.brandSoft }]}
              >
                <Text style={[{ fontSize: 13.5, color: on ? colors.brandDeep : colors.inkMute }, on ? ft.bold : ft.semibold]}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/* ── 일별 완료 현황 — 최근 7일, 막대를 누르면 아래 일지가 그 날짜로 ── */
function DailyDoneBars({
  tasks,
  selected,
  onSelect,
}: {
  tasks: Task[];
  selected: string;
  onSelect: (ymd: string) => void;
}) {
  const today = todaySeoul();
  const days = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (!t.doneAt) continue;
      const key = kstYmd(t.doneAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const base = new Date(`${today}T12:00:00+09:00`).getTime();
    const out: { key: string; day: number; wd: number; count: number; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const key = kstYmd(new Date(base - i * 86400000).toISOString());
      out.push({ key, day: Number(key.slice(8, 10)), wd: dowOf(key), count: counts.get(key) ?? 0, isToday: key === today });
    }
    return out;
  }, [tasks, today]);

  const max = Math.max(1, ...days.map((d) => d.count));
  const todayCount = days[6].count;
  const total = days.reduce((a, d) => a + d.count, 0);

  return (
    <View style={s.card}>
      <Text style={s.chartDesc}>
        최근 7일 · 오늘 <Text style={[{ color: colors.brandDeep }, ft.bold, numFont]}>{todayCount}</Text>건 · 합계{' '}
        <Text style={[{ color: colors.ink }, ft.bold, numFont]}>{total}</Text>건
      </Text>
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 10 }}>
        {days.map((d) => {
          const sel = selected === d.key;
          return (
            <Pressable key={d.key} onPress={() => onSelect(d.key)} style={[s.dayCol, sel && s.dayColSel]}>
              <Text style={[s.dayCount, numFont, !d.count && { color: 'transparent' }]}>{d.count}</Text>
              <View style={s.barArea}>
                <View
                  style={[
                    s.bar,
                    d.count === 0
                      ? { height: 3, backgroundColor: colors.bgSoft }
                      : { height: Math.max(9, (d.count / max) * 64), backgroundColor: d.isToday ? colors.brand : colors.viz },
                  ]}
                />
              </View>
              <Text style={[s.dayNum, numFont, (sel || d.isToday) && { color: colors.brandDeep, ...ft.bold }]}>{d.day}</Text>
              <Text style={[s.dayWd, d.wd === 0 && { color: '#e58074' }, d.wd === 6 && { color: '#6f9fe0' }]}>{WD[d.wd]}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/* ── 그날 완료 업무 취소선 목록 ── */
function DoneList({ items }: { items: Task[] }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 4 }}>
      {items.map((t, i) => (
        <View key={t.id} style={{ flexDirection: 'row', gap: 7 }}>
          <Text style={[s.doneNum, numFont]}>{i + 1}.</Text>
          <Text style={s.doneItem} numberOfLines={2}>
            {t.title}
            {t.project ? <Text style={{ color: colors.inkFaint, textDecorationLine: 'none' }}>  · {t.project.name}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ── 업무 일지 — 내 것은 작성·수정, 대표의 전체/개인별은 사람별 읽기 전용 ── */
function WorkLogCard({
  date,
  scope,
  tasks,
  meName,
  onSaved,
}: {
  date: string;
  scope: string;
  tasks: Task[];
  meName: string;
  onSaved: () => Promise<unknown>;
}) {
  const logs = useWorkLogsOfDay(date, scope);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dayTasks = tasks.filter((t) => t.doneAt && kstYmd(t.doneAt) === date);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.put('/worklogs', { date, content: text });
      setEditing(false);
      await logs.refetch();
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  if (scope === 'me') {
    const mine = logs.data?.[0] ?? null;
    return (
      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[s.logName, ft.bold]}>{meName}</Text>
          <View style={{ flex: 1 }} />
          {!editing && (
            <Pressable
              onPress={() => {
                setText(mine?.content ?? '');
                setError('');
                setEditing(true);
              }}
              hitSlop={8}
              style={s.editBtn}
            >
              <Ionicons name={mine ? 'pencil' : 'add'} size={13} color={colors.brandDeep} />
              <Text style={[{ fontSize: 12.5, color: colors.brandDeep }, ft.bold]}>{mine ? '수정' : '작성'}</Text>
            </Pressable>
          )}
        </View>

        <DoneList items={dayTasks} />
        {dayTasks.length === 0 && <Text style={s.faint}>이 날짜에 완료 체크한 업무가 없습니다</Text>}

        {editing ? (
          <View style={{ gap: 8 }}>
            <TextInput
              style={s.logInput}
              value={text}
              onChangeText={setText}
              placeholder={'예)\n-> 계약서 초안 회신 완료, 더블체크 필요\n-> 내일 오전 기보 서류 마무리 예정'}
              placeholderTextColor={colors.inkFaint}
              multiline
              autoFocus
              editable={!busy}
            />
            {!!error && <Text style={{ color: colors.neg, fontSize: 12.5 }}>{error}</Text>}
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
              <Pressable onPress={() => setEditing(false)} disabled={busy} style={s.ghostBtn}>
                <Text style={[{ color: colors.inkMute, fontSize: 13.5 }, ft.semibold]}>취소</Text>
              </Pressable>
              <Pressable onPress={save} disabled={busy} style={[s.saveBtn, busy && { opacity: 0.6 }]}>
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[{ color: '#fff', fontSize: 13.5 }, ft.bold]}>저장</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : mine ? (
          <View style={s.logBox}>
            <Text style={s.logText}>{mine.content}</Text>
          </View>
        ) : (
          <Text style={s.faint}>아직 작성한 일지가 없습니다. [+ 작성]으로 남겨보세요</Text>
        )}
      </View>
    );
  }

  // 대표 — 사람별 카드 (일지 + 그날 완료 업무), 읽기 전용
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
    <View style={{ gap: 10 }}>
      {logs.isLoading && !logs.data ? (
        <Spinner />
      ) : people.length === 0 ? (
        <View style={s.card}>
          <Empty>이 날짜의 완료 업무·일지 기록이 없습니다</Empty>
        </View>
      ) : (
        people.map((p) => (
          <View key={p.name} style={s.card}>
            <Text style={[s.logName, ft.bold]}>{p.name}</Text>
            <DoneList items={p.tasks} />
            {p.log ? (
              <View style={s.logBox}>
                <Text style={s.logText}>{p.log.content}</Text>
              </View>
            ) : (
              <Text style={s.faint}>작성한 일지 없음</Text>
            )}
          </View>
        ))
      )}
    </View>
  );
}

/* ── 월 캘린더 — 일지 작성 현황, 날짜를 눌러 그날 기록으로 이동 (월요일 시작) ── */
function MonthCalendar({
  scope,
  selected,
  onSelect,
}: {
  scope: string;
  selected: string;
  onSelect: (ymd: string) => void;
}) {
  const today = todaySeoul();
  const [month, setMonth] = useState(selected.slice(0, 7));
  // 차트 등 바깥에서 다른 달의 날짜를 고른 '순간'에만 캘린더를 그 달로 옮긴다
  // (여기서 ‹›로 달을 넘기는 것까지 되돌리면 안 되므로, selected의 변화만 감지한다)
  const [prevSelected, setPrevSelected] = useState(selected);
  if (selected !== prevSelected) {
    setPrevSelected(selected);
    if (selected.slice(0, 7) !== month) setMonth(selected.slice(0, 7));
  }

  const last = lastDayOf(month);
  const from = `${month}-01`;
  const to = `${month}-${String(last).padStart(2, '0')}`;
  const logs = useWorkLogsOfRange(from, to, scope);

  const byDay = new Map<string, number>();
  for (const l of logs.data ?? []) {
    const k = l.logDate.slice(0, 10);
    byDay.set(k, (byDay.get(k) ?? 0) + 1);
  }

  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const firstDow = (dowOf(from) + 6) % 7;
  const prevLast = lastDayOf(shiftMonth(month, -1));
  const cells: { key?: string; day: number; muted?: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: prevLast - firstDow + 1 + i, muted: true });
  for (let d = 1; d <= last; d++) cells.push({ key: `${month}-${String(d).padStart(2, '0')}`, day: d });
  for (let nd = 1; cells.length % 7 !== 0; nd++) cells.push({ day: nd, muted: true });

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[{ fontSize: 15, color: colors.ink }, ft.bold]}>
          {y}년 {m}월
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={8} style={s.calNav}>
          <Ionicons name="chevron-back" size={15} color={colors.inkMute} />
        </Pressable>
        <Pressable
          onPress={() => {
            setMonth(today.slice(0, 7));
            onSelect(today);
          }}
          style={s.todayBtn}
        >
          <Text style={[{ fontSize: 12, color: colors.inkMute }, ft.semibold]}>오늘</Text>
        </Pressable>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={8} style={s.calNav}>
          <Ionicons name="chevron-forward" size={15} color={colors.inkMute} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {['월', '화', '수', '목', '금', '토', '일'].map((w, i) => (
          <Text
            key={w}
            style={[s.calWd, i === 5 && { color: '#6f9fe0' }, i === 6 && { color: '#e58074' }]}
          >
            {w}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((c, i) => {
          const count = c.key ? (byDay.get(c.key) ?? 0) : 0;
          const isSel = c.key === selected;
          const isToday = c.key === today;
          return (
            <Pressable
              key={i}
              disabled={!c.key}
              onPress={() => c.key && onSelect(c.key)}
              style={[s.calCell, isSel && { backgroundColor: colors.brandSoft, borderRadius: 10 }]}
            >
              <Text
                style={[
                  s.calDay,
                  numFont,
                  c.muted && { color: '#cfc8c0' },
                  isToday && { color: colors.brandDeep, ...ft.bold },
                ]}
              >
                {c.day}
              </Text>
              {count > 0 && (
                <View style={s.calChip}>
                  <Text style={[{ fontSize: 9, color: colors.viz }, ft.bold, numFont]}>
                    {scope === 'all' ? count : '✓'}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <Text style={s.calFoot}>
        {month.replace('-', '.')} 일지 {logs.data?.length ?? 0}건
      </Text>
    </View>
  );
}

/* ── 업무 한 줄 — 체크 즉시 저장 ── */
function TaskRow({
  task: t,
  first,
  today,
  showAssignee,
  onToggle,
}: {
  task: Task;
  first: boolean;
  today: string;
  showAssignee: boolean;
  onToggle: () => void;
}) {
  const late = !t.isDone && t.dueDate && t.dueDate.slice(0, 10) < today;
  return (
    <View style={[s.taskRow, !first && s.taskDivider]}>
      <Pressable onPress={onToggle} hitSlop={10}>
        <View style={[s.checkbox, t.isDone && s.checkboxOn]}>
          {t.isDone && <Text style={{ color: '#fff', fontSize: 12, ...ft.extrabold }}>✓</Text>}
        </View>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.taskTitle, t.isDone && s.taskDone]} numberOfLines={2}>
          {t.title}
        </Text>
        <Text style={s.taskMeta} numberOfLines={1}>
          {[
            showAssignee ? (t.assignee?.name ?? '미배정') : null,
            t.project?.name,
            t.isDone && t.doneAt ? `완료 ${kstYmd(t.doneAt).slice(5).replace('-', '.')}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || ' '}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        {!t.isDone && <StatusBadge kind="TASK_STATUS" code={t.status} />}
        {!!t.dueDate && !t.isDone && (
          <Text style={[{ fontSize: 11.5, color: late ? colors.neg : colors.inkFaint }, late && ft.bold, numFont]}>
            ~{t.dueDate.slice(5, 10).replace('-', '.')}
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  summary: { fontSize: 14, color: colors.inkMute, marginTop: -6 },
  errBox: { backgroundColor: colors.negSoft, borderRadius: 12, padding: 11 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...sh.card,
  },

  // 애플식 — 평평한 회색 대신 흰 면 + 부드러운 그림자
  scopeField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.card,
    ...sh.card,
  },
  scopeChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...sh.card,
  },

  chartDesc: { fontSize: 12.5, color: colors.inkFaint },
  dayCol: { flex: 1, alignItems: 'center', gap: 3, borderRadius: 10, paddingVertical: 4 },
  dayColSel: { backgroundColor: colors.brandSoft },
  dayCount: { fontSize: 11, color: colors.inkMute },
  barArea: { height: 64, justifyContent: 'flex-end', alignSelf: 'stretch', paddingHorizontal: 12 },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  dayNum: { fontSize: 11.5, color: colors.inkFaint },
  dayWd: { fontSize: 10.5, color: colors.inkFaint },

  logName: { fontSize: 14, color: colors.ink },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 32,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: colors.brandSoft,
  },
  doneNum: { width: 16, fontSize: 12, color: colors.inkFaint, textAlign: 'right' },
  doneItem: { flex: 1, fontSize: 13.5, lineHeight: 19, color: colors.inkMute, textDecorationLine: 'line-through' },
  faint: { fontSize: 12.5, color: colors.inkFaint },
  logBox: { backgroundColor: colors.bgSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  logText: { fontSize: 13.5, lineHeight: 21, color: colors.inkMute },
  logInput: {
    minHeight: 96,
    borderRadius: 12,
    backgroundColor: colors.bgSoft,
    padding: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  ghostBtn: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 11 },
  saveBtn: {
    minWidth: 68,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 11,
    backgroundColor: colors.brand,
  },

  calNav: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  todayBtn: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: colors.bgSoft,
    marginHorizontal: 2,
  },
  calWd: { flex: 1, textAlign: 'center', fontSize: 10.5, color: colors.inkFaint, marginBottom: 3, ...ft.semibold },
  calCell: { width: `${100 / 7}%`, height: 42, alignItems: 'center', paddingTop: 4, gap: 2 },
  calDay: { fontSize: 12, color: colors.inkMute },
  calChip: {
    backgroundColor: colors.vizSoft,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  calFoot: { textAlign: 'right', fontSize: 10.5, color: colors.inkFaint, marginTop: 4 },

  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9 },
  taskDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  taskTitle: { fontSize: 14, lineHeight: 19, color: colors.ink },
  taskDone: { color: colors.inkFaint, textDecorationLine: 'line-through' },
  taskMeta: { fontSize: 11.5, color: colors.inkFaint, marginTop: 2 },
});
