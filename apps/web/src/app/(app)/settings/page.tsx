'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { dateTime } from '@/lib/format';
import { Empty, ErrorBox, Field, Modal, Section, Spinner } from '@/components/ui';
import type { AuditLog, Project, Role, RoleScope, ScopeType, UserRow } from '@/lib/types';

type Tab = 'users' | 'audit';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('users');
  const { isCeo } = useSession();
  // 메뉴는 대표에게만 보이지만, URL 직접 접근도 막는다
  if (!isCeo)
    return (
      <div className="card-pad mx-auto max-w-sm text-center text-sm">
        <p className="font-medium">설정은 대표만 접근할 수 있습니다</p>
        <p className="mt-1 text-ink-mute">권한이 필요하면 대표에게 요청하세요.</p>
      </div>
    );
  return (
    <div className="space-y-5">
      <h1 className="page-title">설정</h1>
      <div className="flex gap-0.5 border-b border-line">
        {(
          [
            ['users', '사용자 · 권한'],
            ['audit', '감사 로그'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === key
                ? 'border-brand font-medium text-brand-deep'
                : 'border-transparent text-ink-mute hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'users' ? <UsersTab /> : <AuditTab />}
    </div>
  );
}

const ROLE_LABEL: Record<Role, string> = { CEO: '대표', ADMIN: '관리자', EMPLOYEE: '직원' };
const SCOPE_LABEL: Record<ScopeType, string> = {
  COMPANY: '회사 전체',
  BUSINESS_TYPE: '사업유형',
  DEPARTMENT: '부서',
  PROJECT: '프로젝트',
};

function UsersTab() {
  const { businessTypes, departments } = useSession();
  const res = useAsync(() => api.get<UserRow[]>('/users'), []);
  const projRes = useAsync(() => api.get<Project[]>('/projects'), []);
  const [target, setTarget] = useState<UserRow | null>(null);
  const [scopes, setScopes] = useState<RoleScope[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);

  const openEditor = (u: UserRow) => {
    setTarget(u);
    setScopes(u.roleScopes ?? []);
    setError('');
  };

  const nameOfScope = (s: RoleScope): string => {
    if (s.scopeType === 'COMPANY') return '회사 전체';
    if (s.scopeType === 'DEPARTMENT')
      return departments.find((d) => d.id === s.departmentId)?.name ?? '(부서 미지정)';
    if (s.scopeType === 'BUSINESS_TYPE')
      return businessTypes.find((b) => b.id === s.businessTypeId)?.name ?? '(사업유형 미지정)';
    return (projRes.data ?? []).find((p) => p.id === s.projectId)?.name ?? '(프로젝트 미지정)';
  };

  const save = async () => {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      await api.put(
        `/users/${target.id}/role-scopes`,
        scopes.map((s) => ({
          role: s.role,
          scopeType: s.scopeType,
          businessTypeId: s.scopeType === 'BUSINESS_TYPE' ? s.businessTypeId : undefined,
          departmentId: s.scopeType === 'DEPARTMENT' ? s.departmentId : undefined,
          projectId: s.scopeType === 'PROJECT' ? s.projectId : undefined,
        })),
      );
      setTarget(null);
      res.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '권한 저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section
        title="사용자"
        desc="권한은 Role × Scope 조합입니다. 화면 숨김이 아니라 모든 조회 쿼리에 적용됩니다"
        right={
          <button className="btn-ghost" onClick={() => setCreateOpen(true)}>
            + 사용자 추가
          </button>
        }
      >
        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">이름</th>
                  <th className="th">이메일</th>
                  <th className="th">소속</th>
                  <th className="th">권한</th>
                  <th className="th">상태</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {(res.data ?? []).map((u) => (
                  <tr key={u.id} className="hover:bg-line-soft/60">
                    <td className="td font-medium">{u.name}</td>
                    <td className="td text-ink-mute">{u.email}</td>
                    <td className="td text-ink-mute">{u.department?.name ?? '—'}</td>
                    <td className="td">
                      <span className="flex flex-wrap gap-1">
                        {(u.roleScopes ?? []).length === 0 ? (
                          <span className="text-xs text-ink-faint">권한 없음</span>
                        ) : (
                          (u.roleScopes ?? []).map((s, i) => (
                            <span
                              key={i}
                              className={`badge ${s.role === 'CEO' ? 'bg-brand-soft text-brand-deep' : 'bg-line-soft text-ink-mute'}`}
                            >
                              {ROLE_LABEL[s.role]} · {nameOfScope(s)}
                            </span>
                          ))
                        )}
                      </span>
                    </td>
                    <td className="td text-xs text-ink-mute">{u.isActive ? '활성' : '비활성'}</td>
                    <td className="td text-right">
                      <span className="flex justify-end gap-1.5">
                        <button className="btn-ghost !py-1 text-xs" onClick={() => setEditTarget(u)}>
                          정보 수정
                        </button>
                        <button className="btn-ghost !py-1 text-xs" onClick={() => openEditor(u)}>
                          권한 편집
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        wide
        title={target ? `${target.name} 권한` : ''}
        desc="여기서 저장하면 해당 사용자의 모든 조회 범위가 즉시 바뀝니다."
      >
        <div className="space-y-3">
          {scopes.length === 0 && (
            <p className="rounded-md bg-line-soft/60 px-3 py-2 text-xs text-ink-mute">
              권한이 없습니다. 아래에서 추가하세요. (소속 부서와 참여 프로젝트는 기본으로 조회
              가능합니다)
            </p>
          )}
          {scopes.map((s, i) => (
            <div key={i} className="grid grid-cols-[130px_140px_1fr_auto] items-end gap-2">
              <Field label="역할">
                <select
                  className="input"
                  value={s.role}
                  onChange={(e) =>
                    setScopes((xs) =>
                      xs.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)),
                    )
                  }
                >
                  {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="범위">
                <select
                  className="input"
                  value={s.scopeType}
                  onChange={(e) =>
                    setScopes((xs) =>
                      xs.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              scopeType: e.target.value as ScopeType,
                              departmentId: null,
                              businessTypeId: null,
                              projectId: null,
                            }
                          : x,
                      ),
                    )
                  }
                >
                  {(Object.keys(SCOPE_LABEL) as ScopeType[]).map((t) => (
                    <option key={t} value={t}>
                      {SCOPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="대상">
                {s.scopeType === 'COMPANY' ? (
                  <input className="input" value="회사 전체" disabled />
                ) : (
                  <select
                    className="input"
                    value={s.departmentId ?? s.businessTypeId ?? s.projectId ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setScopes((xs) =>
                        xs.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                departmentId: x.scopeType === 'DEPARTMENT' ? v : null,
                                businessTypeId: x.scopeType === 'BUSINESS_TYPE' ? v : null,
                                projectId: x.scopeType === 'PROJECT' ? v : null,
                              }
                            : x,
                        ),
                      );
                    }}
                  >
                    <option value="">선택</option>
                    {s.scopeType === 'DEPARTMENT' &&
                      departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    {s.scopeType === 'BUSINESS_TYPE' &&
                      businessTypes.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    {s.scopeType === 'PROJECT' &&
                      (projRes.data ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} {p.name}
                        </option>
                      ))}
                  </select>
                )}
              </Field>
              <button
                className="btn-ghost !px-2 mb-0.5 text-ink-faint"
                onClick={() => setScopes((xs) => xs.filter((_, j) => j !== i))}
                aria-label="권한 삭제"
              >
                ✕
              </button>
            </div>
          ))}

          <button
            className="btn-ghost text-xs"
            onClick={() =>
              setScopes((xs) => [
                ...xs,
                { role: 'EMPLOYEE', scopeType: 'DEPARTMENT', departmentId: null },
              ])
            }
          >
            + 권한 추가
          </button>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button className="btn-ghost" onClick={() => setTarget(null)} disabled={busy}>
              취소
            </button>
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </Modal>

      <UserCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={res.reload} />
      <UserEditModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={res.reload}
      />
    </>
  );
}

/** 계정 정보 수정 — 이름 · 소속 부서 · 활성 여부 · 비밀번호 재설정 (PATCH /users/:id) */
function UserEditModal({
  target,
  onClose,
  onSaved,
}: {
  target: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { departments } = useSession();
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // 모달이 열릴 때 대상 사용자의 현재 값으로 폼을 채운다
  if (target && loadedFor !== target.id) {
    setLoadedFor(target.id);
    setName(target.name);
    setDepartmentId(target.department?.id ?? '');
    setIsActive(target.isActive);
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
        departmentId: departmentId || null,
        isActive,
        ...(password ? { password } : {}),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={target ? `${target.name} 정보 수정` : ''}
      desc={target?.email}
    >
      <div className="space-y-3.5">
        <Field label="이름" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="소속 부서">
          <select
            className="input"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">미지정</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="새 비밀번호" hint="비워두면 기존 비밀번호 유지 · 변경 시 8자 이상">
          <input
            type="text"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="변경할 때만 입력"
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-brand"
          />
          활성 계정 (해제하면 로그인 차단)
        </label>
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
            disabled={busy || !name || (password.length > 0 && password.length < 8)}
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
  const { departments } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/users', { name, email, password, departmentId: departmentId || undefined });
      onSaved();
      onClose();
      setName('');
      setEmail('');
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="사용자 추가">
      <div className="space-y-3.5">
        <Field label="이름" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="이메일" required>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="초기 비밀번호" required hint="8자 이상">
          <input
            type="text"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="소속 부서">
          <select
            className="input"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">미지정</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={busy || !name || !email || password.length < 8}
          >
            추가
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
