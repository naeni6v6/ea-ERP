'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { dateTime, todaySeoul } from '@/lib/format';
import { Empty, ErrorBox, Field, Modal, Section, Spinner, StatusBadge } from '@/components/ui';
import type { AuditLog, Project, Role, Task, UserRow } from '@/lib/types';

type Tab = 'me' | 'users' | 'audit';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('me');
  const { isCeo } = useSession();
  // 내 정보는 누구나, 사용자·직급과 감사 로그는 대표만
  const tabs: [Tab, string][] = isCeo
    ? [
        ['me', '내 정보'],
        ['users', '사용자 · 직급'],
        ['audit', '감사 로그'],
      ]
    : [['me', '내 정보']];
  const active = tabs.some(([k]) => k === tab) ? tab : 'me';
  return (
    <div className="space-y-5">
      <h1 className="page-title">설정</h1>
      <div className="flex gap-0.5 border-b border-line">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              active === key
                ? 'border-brand font-medium text-brand-deep'
                : 'border-transparent text-ink-mute hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {active === 'me' ? <MyAccountTab /> : active === 'users' ? <UsersTab /> : <AuditTab />}
    </div>
  );
}

/** 내 정보 — 본인 계정 확인 + 비밀번호 변경. 대표의 '비밀번호 재설정'과 달리 현재 비밀번호를 확인한다. */
function MyAccountTab() {
  const { me, roles } = useSession();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const close = () => {
    setOpen(false);
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
  };

  const submit = async () => {
    if (next !== confirm) return setError('새 비밀번호가 서로 다릅니다');
    if (next.length < 8) return setError('새 비밀번호는 8자 이상이어야 합니다');
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      close();
      setDone('비밀번호가 변경되었습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '비밀번호 변경에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  if (!me) return <Spinner />;

  return (
    <div className="max-w-xl space-y-4">
      <Section title="내 정보">
        <dl className="divide-y divide-line-soft text-sm">
          {(
            [
              ['이름', me.name],
              ['이메일', me.email],
              ['소속 부서', me.department || '—'],
              ['직급', roles.map((r) => ROLE_LABEL[r]).join(', ') || '—'],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="shrink-0 text-ink-mute">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="비밀번호" desc="본인만 바꿀 수 있습니다. 잊었다면 대표에게 재설정을 요청하세요.">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <p className="text-sm text-ink-mute">
            {done || '주기적으로 바꾸는 것을 권장합니다.'}
          </p>
          <button className="btn-primary shrink-0" onClick={() => setOpen(true)}>
            비밀번호 재설정
          </button>
        </div>
      </Section>

      <Modal open={open} title="비밀번호 재설정" onClose={close}>
        <div className="space-y-3">
          <Field label="현재 비밀번호" required>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </Field>
          <Field label="새 비밀번호" required hint="8자 이상">
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="새 비밀번호 확인" required>
            <input
              type="password"
              className="input"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
            />
          </Field>
          {error && <p className="text-xs text-neg">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={close} disabled={busy}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={submit}
              disabled={busy || !current || next.length < 8 || !confirm}
            >
              {busy ? '변경 중…' : '변경'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const ROLE_LABEL: Record<Role, string> = { CEO: '대표', ADMIN: '관리자', EMPLOYEE: '직원' };

/**
 * 직급은 대표 > 관리자 > 직원 3단계 — 조회 범위는 서버가 직급·소속 부서로 정한다.
 * 배지 색은 파랑 한 계열의 진하기로 서열을 드러낸다: 대표 = 진한 파랑, 관리자 = 연한 파랑, 직원 = 회색.
 */
const ROLES: { role: Role; desc: string; badge: string }[] = [
  { role: 'CEO', desc: '모든 메뉴 · 자금 · 직원/직급 관리', badge: 'bg-blue-600 text-white' },
  { role: 'ADMIN', desc: '회사 전체 손익 · 거래 · 프로젝트 관리 (자금 · 설정 제외)', badge: 'bg-blue-100 text-blue-700' },
  { role: 'EMPLOYEE', desc: '소속 부서 · 참여 프로젝트 업무만', badge: 'bg-line-soft text-ink-mute' },
];
const ROLE_RANK: Record<Role, number> = { CEO: 0, ADMIN: 1, EMPLOYEE: 2 };
const roleOf = (u: UserRow): Role =>
  u.role ??
  (u.roleScopes ?? []).reduce<Role>((top, s) => (ROLE_RANK[s.role] < ROLE_RANK[top] ? s.role : top), 'EMPLOYEE');

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function RoleBadge({ role }: { role: Role }) {
  const r = ROLES.find((x) => x.role === role)!;
  return <span className={`badge font-semibold ${r.badge}`}>{ROLE_LABEL[role]}</span>;
}

/** 직급 3단계 선택 — 높은 직급부터 나열하고 각 단계가 할 수 있는 일을 함께 보여준다 */
function RolePicker({ value, onChange, disabled }: { value: Role; onChange: (r: Role) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="직급">
      {ROLES.map((r) => (
        <button
          key={r.role}
          type="button"
          role="radio"
          aria-checked={value === r.role}
          disabled={disabled}
          onClick={() => onChange(r.role)}
          className={`rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            value === r.role ? 'border-brand bg-brand-soft ring-2 ring-brand-ring' : 'border-line hover:bg-line-soft'
          }`}
        >
          <div className={`text-sm font-semibold ${value === r.role ? 'text-brand-deep' : 'text-ink'}`}>{ROLE_LABEL[r.role]}</div>
          <div className="mt-0.5 text-[13px] leading-snug text-ink-mute">{r.desc}</div>
        </button>
      ))}
    </div>
  );
}

function DepartmentSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { departments } = useSession();
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">미지정</option>
      {departments.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

function ErrorLine({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">{message}</div>;
}

/** 직원 관리 — 대표 > 관리자 > 직원 순 목록, 정보·직급 수정, 업무 배정, 퇴사/복직 */
function UsersTab() {
  const { me } = useSession();
  const res = useAsync(() => api.get<UserRow[]>('/users'), []);
  const [showRetired, setShowRetired] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [taskTarget, setTaskTarget] = useState<UserRow | null>(null);
  const [retireTarget, setRetireTarget] = useState<UserRow | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const all = res.data ?? [];
  const active = all.filter((u) => u.isActive);
  const retired = all.filter((u) => !u.isActive);
  const rows = showRetired ? [...active, ...retired] : active;
  const roleCount = (r: Role) => active.filter((u) => roleOf(u) === r).length;

  const reinstate = async (u: UserRow) => {
    setError('');
    try {
      await api.post(`/users/${u.id}/reinstate`);
      setNotice(`${u.name} 님을 복직 처리했습니다. 필요하면 업무를 다시 배정하세요.`);
      res.reload();
    } catch (e) {
      setError(errMsg(e, '복직 처리에 실패했습니다'));
    }
  };

  return (
    <>
      <Section
        title="직원"
        desc={`재직 ${active.length}명 · 대표 ${roleCount('CEO')} · 관리자 ${roleCount('ADMIN')} · 직원 ${roleCount('EMPLOYEE')}`}
        right={
          <span className="flex items-center gap-3">
            {retired.length > 0 && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  className="accent-brand"
                  checked={showRetired}
                  onChange={(e) => setShowRetired(e.target.checked)}
                />
                퇴사자 보기 ({retired.length})
              </label>
            )}
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              + 직원 추가
            </button>
          </span>
        }
      >
        {(notice || error) && (
          <div
            className={`mx-4 mt-3 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${
              error ? 'border border-red-200 bg-red-50 text-neg' : 'bg-brand-soft text-brand-deep'
            }`}
          >
            <span>{error || notice}</span>
            <button
              className="text-xs opacity-60 hover:opacity-100"
              onClick={() => {
                setNotice('');
                setError('');
              }}
              aria-label="알림 닫기"
            >
              ✕
            </button>
          </div>
        )}
        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : rows.length === 0 ? (
          <Empty>등록된 직원이 없습니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">직급</th>
                  <th className="th">이름</th>
                  <th className="th">이메일</th>
                  <th className="th">소속 부서</th>
                  <th className="th text-right">진행 업무</th>
                  <th className="th">상태</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((u) => {
                  const isMe = u.id === me?.id;
                  const open = u.openTaskCount ?? 0;
                  return (
                    <tr key={u.id} className={`hover:bg-line-soft/60 ${u.isActive ? '' : 'text-ink-faint'}`}>
                      <td className="td">
                        <RoleBadge role={roleOf(u)} />
                      </td>
                      <td className="td font-medium">
                        {u.name}
                        {isMe && <span className="badge ml-1.5 bg-line-soft text-ink-mute">나</span>}
                      </td>
                      <td className="td text-ink-mute">{u.email}</td>
                      <td className="td text-ink-mute">
                        {u.department?.name ?? <span className="text-ink-faint">미지정</span>}
                      </td>
                      <td className="td-num">
                        {u.isActive ? (
                          <button
                            className={`rounded-md px-2 py-0.5 hover:bg-line-soft ${open ? 'font-semibold text-ink' : 'text-ink-faint'}`}
                            onClick={() => setTaskTarget(u)}
                            title="배정된 업무 보기"
                          >
                            {open}건
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="td">
                        {u.isActive ? (
                          <span className="badge bg-emerald-50 text-pos">재직</span>
                        ) : (
                          <span className="badge bg-line-soft text-ink-faint">퇴사</span>
                        )}
                      </td>
                      <td className="td text-right">
                        <span className="flex justify-end gap-1.5">
                          <button className="btn-ghost !py-1 text-xs" onClick={() => setEditTarget(u)}>
                            수정
                          </button>
                          {u.isActive && (
                            <button className="btn-ghost !py-1 text-xs" onClick={() => setTaskTarget(u)}>
                              업무 배정
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <UserCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={res.reload} />
      <UserEditModal
        target={editTarget}
        isMe={editTarget?.id === me?.id}
        onClose={() => setEditTarget(null)}
        onSaved={res.reload}
        onRetire={(u) => {
          setEditTarget(null);
          setRetireTarget(u);
        }}
        onReinstate={async (u) => {
          await reinstate(u);
          setEditTarget(null);
        }}
      />
      <TaskAssignModal target={taskTarget} users={active} onClose={() => setTaskTarget(null)} onChanged={res.reload} />
      <RetireModal
        target={retireTarget}
        onClose={() => setRetireTarget(null)}
        onOpenTasks={(u) => {
          setRetireTarget(null);
          setTaskTarget(u);
        }}
        onDone={(msg) => {
          setNotice(msg);
          res.reload();
        }}
      />
    </>
  );
}

/**
 * 직원 정보 수정 — 이름 · 이메일 · 소속 부서 · 직급 · 비밀번호 재설정 (PATCH /users/:id).
 * 퇴사/복직은 실수로 누르지 않게 목록이 아니라 이 창 맨 아래(회원탈퇴 자리)에 둔다.
 */
function UserEditModal({
  target,
  isMe,
  onClose,
  onSaved,
  onRetire,
  onReinstate,
}: {
  target: UserRow | null;
  isMe: boolean;
  onClose: () => void;
  onSaved: () => void;
  onRetire: (u: UserRow) => void;
  onReinstate: (u: UserRow) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // 모달이 열릴 때 대상 직원의 현재 값으로 폼을 채운다
  if (target && loadedFor !== target.id) {
    setLoadedFor(target.id);
    setName(target.name);
    setEmail(target.email);
    setDepartmentId(target.department?.id ?? '');
    setRole(roleOf(target));
    setPassword('');
    setError('');
  }
  if (!target && loadedFor !== null) setLoadedFor(null);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      await api.patch(`/users/${target.id}`, {
        name,
        email,
        departmentId: departmentId || null,
        role,
        ...(password ? { password } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(errMsg(e, '저장에 실패했습니다'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} wide title={target ? `${target.name} 정보 수정` : ''}>
      <div className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="이름" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="이메일 (로그인 아이디)" required>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <Field label="소속 부서" hint="직급이 직원이면 소속 부서의 데이터만 조회합니다">
          <DepartmentSelect value={departmentId} onChange={setDepartmentId} />
        </Field>
        <Field label="직급" required hint={isMe ? '본인 직급은 바꿀 수 없습니다' : undefined}>
          <RolePicker value={role} onChange={setRole} disabled={isMe} />
        </Field>
        <Field label="비밀번호 재설정" hint="비워두면 기존 비밀번호 유지 · 바꿀 때만 8자 이상 입력 후 직원에게 전달">
          <input
            type="text"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="변경할 때만 입력"
            autoComplete="off"
          />
        </Field>
        <ErrorLine message={error} />
        {/* 퇴사/복직은 왼쪽 끝, 취소·저장은 오른쪽 — 같은 줄에 두되 떨어뜨려 실수로 누르지 않게 */}
        <div className="flex items-center gap-2 border-t border-line pt-3">
          {target &&
            (target.isActive ? (
              <button
                className="btn-danger"
                onClick={() => onRetire(target)}
                disabled={busy || isMe}
                title={isMe ? '본인 계정은 퇴사 처리할 수 없습니다' : undefined}
              >
                퇴사 처리
              </button>
            ) : (
              <button className="btn-ghost text-brand-deep" onClick={() => onReinstate(target)} disabled={busy}>
                복직 처리
              </button>
            ))}
          <span className="flex-1" />
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={busy || !name || !email || (password.length > 0 && password.length < 8)}
          >
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UserCreateModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [role, setRole] = useState<Role>('EMPLOYEE');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/users', { name, email, password, departmentId: departmentId || undefined, role });
      onSaved();
      onClose();
      setName('');
      setEmail('');
      setPassword('');
      setDepartmentId('');
      setRole('EMPLOYEE');
    } catch (e) {
      setError(errMsg(e, '추가에 실패했습니다'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide title="직원 추가">
      <div className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="이름" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="이메일 (로그인 아이디)" required>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="초기 비밀번호" required hint="8자 이상 · 첫 로그인 후 본인이 바꾸도록 안내">
            <input type="text" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="소속 부서">
            <DepartmentSelect value={departmentId} onChange={setDepartmentId} />
          </Field>
        </div>
        <Field label="직급" required>
          <RolePicker value={role} onChange={setRole} />
        </Field>
        <ErrorLine message={error} />
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !name || !email || password.length < 8}>
            {busy ? '추가 중…' : '추가'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * 업무 배정 — 직원에게 걸린 진행 중 업무를 보고, 새 업무를 배정하거나 다른 직원에게 넘긴다.
 * 업무는 항상 프로젝트에 속하므로 배정할 때 프로젝트를 고른다.
 */
function TaskAssignModal({
  target,
  users,
  onClose,
  onChanged,
}: {
  target: UserRow | null;
  users: UserRow[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { labelOf } = useSession();
  const targetId = target?.id;
  const tasks = useAsync(
    () => (targetId ? api.get<Task[]>('/tasks/my', { userId: targetId }) : Promise.resolve([] as Task[])),
    [targetId],
  );
  const projects = useAsync(
    () => (targetId ? api.get<Project[]>('/projects') : Promise.resolve([] as Project[])),
    [targetId],
  );
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const today = todaySeoul();
  const openTasks = (tasks.data ?? []).filter((t) => !t.isDone);
  const doneCount = (tasks.data ?? []).length - openTasks.length;

  const close = () => {
    setTitle('');
    setDueDate('');
    setError('');
    onClose();
  };

  const assign = async () => {
    if (!targetId) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/projects/${projectId}/tasks`, { title: title.trim(), assigneeId: targetId, dueDate: dueDate || undefined });
      setTitle('');
      setDueDate('');
      tasks.reload();
      onChanged();
    } catch (e) {
      setError(errMsg(e, '업무 배정에 실패했습니다'));
    } finally {
      setBusy(false);
    }
  };

  /** 담당자 변경 — 빈 값이면 담당 해제 */
  const reassign = async (t: Task, assigneeId: string) => {
    setError('');
    try {
      await api.patch(`/tasks/${t.id}`, { assigneeId: assigneeId || null });
      tasks.reload();
      onChanged();
    } catch (e) {
      setError(errMsg(e, '담당자 변경에 실패했습니다'));
    }
  };

  return (
    <Modal
      open={!!target}
      onClose={close}
      wide
      title={target ? `${target.name} 업무 배정` : ''}
      desc={`진행 중 ${openTasks.length}건${doneCount ? ` · 완료 ${doneCount}건` : ''}`}
    >
      <div className="space-y-4">
        {/* 새 업무 배정 */}
        <div className="rounded-lg border border-line bg-line-soft/40 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_150px_auto] sm:items-end">
            <Field label="프로젝트" required>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">선택</option>
                {(projects.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="업무 내용" required>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 견적서 작성"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && projectId && title.trim() && !busy) assign();
                }}
              />
            </Field>
            <Field label="마감일">
              <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <button className="btn-primary" onClick={assign} disabled={busy || !projectId || !title.trim()}>
              {busy ? '배정 중…' : '배정'}
            </button>
          </div>
        </div>

        <ErrorLine message={error} />

        {/* 진행 중 업무 */}
        {tasks.loading && !tasks.data ? (
          <Spinner />
        ) : tasks.error ? (
          <ErrorBox message={tasks.error} onRetry={tasks.reload} />
        ) : openTasks.length === 0 ? (
          <Empty>진행 중인 업무가 없습니다.</Empty>
        ) : (
          <ul className="max-h-[calc(50vh/var(--ui-zoom,1))] divide-y divide-line-soft overflow-y-auto rounded-lg border border-line">
            {openTasks.map((t) => {
              const due = t.dueDate?.slice(0, 10);
              const overdue = !!due && due < today;
              return (
                <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="mt-0.5 truncate text-xs text-ink-mute">
                      {t.project ? `${t.project.code} ${t.project.name}` : '—'}
                      {due && (
                        <span className={overdue ? 'font-semibold text-neg' : ''}>
                          {' '}· 마감 {due.replace(/-/g, '.')}
                          {overdue ? ' (지남)' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={t.status} label={labelOf('TASK_STATUS', t.status)} />
                  <select
                    className="input !w-36 !py-1 text-xs"
                    value={t.assigneeId ?? ''}
                    onChange={(e) => reassign(t, e.target.value)}
                    aria-label="담당자 변경"
                  >
                    <option value="">담당 해제</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end border-t border-line pt-3">
          <button className="btn-ghost" onClick={close}>
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** 퇴사 처리 확인 — 계정은 지우지 않고 로그인만 막아 지난 기록을 보존한다 */
function RetireModal({
  target,
  onClose,
  onOpenTasks,
  onDone,
}: {
  target: UserRow | null;
  onClose: () => void;
  onOpenTasks: (u: UserRow) => void;
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = target?.openTaskCount ?? 0;

  const close = () => {
    setError('');
    onClose();
  };

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.post<{ unassignedTasks: number }>(`/users/${target.id}/retire`);
      onDone(
        `${target.name} 님을 퇴사 처리했습니다.${r.unassignedTasks ? ` 진행 중 업무 ${r.unassignedTasks}건은 담당자 없음으로 바뀌었습니다.` : ''}`,
      );
      close();
    } catch (e) {
      setError(errMsg(e, '퇴사 처리에 실패했습니다'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!target} onClose={close} title={target ? `${target.name} 퇴사 처리` : ''} desc={target?.email}>
      <div className="space-y-3.5">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>로그인이 즉시 차단되고, 로그인된 기기에서도 로그아웃됩니다.</li>
          <li>
            진행 중 업무 <b className="font-num">{open}</b>건은 담당자 없음으로 바뀝니다.
          </li>
          <li>지난 업무 일지 · 완료 업무 · 거래 · 감사 로그는 그대로 남습니다.</li>
          <li>목록의 &lsquo;퇴사자 보기&rsquo;에서 언제든 복직할 수 있습니다.</li>
        </ul>
        {open > 0 && target && (
          <div className="flex items-center justify-between gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-warn">
            <span>진행 중 업무를 다른 직원에게 먼저 넘기시겠어요?</span>
            <button className="btn-ghost !py-1 text-xs" onClick={() => onOpenTasks(target)}>
              업무 넘기기
            </button>
          </div>
        )}
        <ErrorLine message={error} />
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={close} disabled={busy}>
            취소
          </button>
          <button className="btn-danger" onClick={submit} disabled={busy}>
            {busy ? '처리 중…' : '퇴사 처리'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AuditTab() {
  const [entity, setEntity] = useState('');
  const res = useAsync(
    () => api.get<AuditLog[]>('/audit-logs', { entity: entity || undefined }),
    [entity],
  );

  return (
    <Section
      title="감사 로그"
      desc="거래 생성·취소, 예산 변경, 유보금, 권한 변경, 계좌 변경, 은행 import"
      right={
        <select className="input w-40" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">전체</option>
          <option value="JournalEntry">거래</option>
          <option value="Project">프로젝트</option>
          <option value="CashReserve">유보금</option>
          <option value="PlannedPayment">지급예정</option>
          <option value="BankAccount">계좌</option>
          <option value="BankImport">은행 import</option>
          <option value="UserRoleScope">권한 변경</option>
          <option value="User">사용자</option>
        </select>
      }
    >
      {res.loading && !res.data ? (
        <Spinner />
      ) : res.error ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : !res.data?.length ? (
        <Empty>기록이 없습니다.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line-soft">
              <tr>
                <th className="th">일시</th>
                <th className="th">대상</th>
                <th className="th">동작</th>
                <th className="th">수행자</th>
                <th className="th">사유</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {res.data.map((l) => (
                <tr key={l.id} className="hover:bg-line-soft/60">
                  <td className="td font-num text-xs">{dateTime(l.createdAt)}</td>
                  <td className="td text-ink-mute">{l.entity}</td>
                  <td className="td">
                    <span className="badge bg-line-soft text-ink-mute">{l.action}</span>
                  </td>
                  <td className="td text-ink-mute">{l.actor?.name ?? '—'}</td>
                  <td className="td max-w-[320px] truncate text-ink-mute">{l.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
