'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { big, dateTime, num, thisMonthSeoul } from '@/lib/format';
import { CardBrandMark } from '@/components/CardBrand';
import { CardUsage } from '@/components/CardUsage';
import { MoneyInput } from '@/components/MoneyInput';
import { Empty, ErrorBox, Field, Modal, Section, Spinner } from '@/components/ui';
import type { Account, BankAccount, CardExpense, CardExpenseList, CardExpenseStatus, CorporateCard, Project, UserRow } from '@/lib/types';

/** 고위드 UX를 따른 탭 — 미제출(반려 포함) → 승인 필요 → 완료 */
const TABS = [
  { key: 'ALL', label: '전체', status: 'PENDING,REJECTED,SUBMITTED,CONFIRMED' },
  { key: 'NOT_SUBMITTED', label: '미제출', status: 'PENDING,REJECTED' },
  { key: 'SUBMITTED', label: '승인 필요', status: 'SUBMITTED' },
  { key: 'CONFIRMED', label: '완료', status: 'CONFIRMED' },
  { key: 'EXCLUDED', label: '미승인', status: 'EXCLUDED' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const STATUS_BADGE: Record<CardExpenseStatus, { tone: string; label: string }> = {
  PENDING: { tone: 'UNCLASSIFIED', label: '미제출' },
  SUBMITTED: { tone: 'IN_PROGRESS', label: '승인 필요' },
  CONFIRMED: { tone: 'DONE', label: '완료' },
  REJECTED: { tone: 'VOID', label: '반려' },
  EXCLUDED: { tone: 'CANCELLED', label: '미승인' },
};

/** 고위드식 승인 상태 칩 — 테두리 박스로 강조 */
const STATUS_CHIP: Record<CardExpenseStatus, string> = {
  PENDING: 'border-amber-300 bg-amber-50/50 text-warn',
  SUBMITTED: 'border-brand bg-brand-soft/40 text-brand-deep',
  CONFIRMED: 'border-emerald-300 bg-emerald-50/50 text-pos',
  REJECTED: 'border-red-300 bg-red-50/50 text-neg',
  EXCLUDED: 'border-line bg-line-soft/50 text-ink-faint',
};

function StatusChip({ status }: { status: CardExpenseStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-[15px] font-semibold ${STATUS_CHIP[status]}`}>
      {STATUS_BADGE[status].label}
    </span>
  );
}

/**
 * 지출 용도 고정 목록 — 수기 입력 대신 체크(선택). 설정의 코드값(CARD_PURPOSE)으로 관리하고,
 * 코드값이 아직 없으면 아래 기본 목록을 쓴다.
 */
const DEFAULT_PURPOSES = [
  '식비', '회식비', '업무교통비', '야근교통비', '국내출장비', '국외출장비', '접대비',
  '유류비', '교육훈련비', '도서구입비', '정기구독료', '회의비', '사무용품비', '소모품비',
  'IT솔루션', '서류발급비', '온라인 마케팅', '광고비', '판촉물제작비', '기타비용', '오사용',
];

function PurposeSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { codesOf } = useSession();
  const fromCodes = codesOf('CARD_PURPOSE').map((c) => c.label);
  const options = fromCodes.length ? fromCodes : DEFAULT_PURPOSES;
  return (
    <select className={className ?? 'input'} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">용도 선택</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
      {/* 목록 도입 전에 직접 입력했던 값은 그대로 보이게 유지 */}
      {value && !options.includes(value) && <option value={value}>{value}</option>}
    </select>
  );
}

const SOURCE_LABEL: Record<CorporateCard['source'], string> = {
  GOWID: '고위드 자동',
  BANK: '계좌 파생',
  MANUAL: '수동',
};

/** 'YYYY-MM' 이번 달 (KST) */
const thisMonth = thisMonthSeoul;
const shiftMonth = (m: string, d: number) => {
  const [y, mo] = m.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + d, 1));
  return dt.toISOString().slice(0, 7);
};
const monthRange = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` };
};

export default function CardsPage() {
  const { isCeo, isAdmin } = useSession();
  const cardsRes = useAsync(() => api.get<CorporateCard[]>('/cards'), []);

  const [tab, setTab] = useState<TabKey>('NOT_SUBMITTED');
  const [cardId, setCardId] = useState('');
  const [month, setMonth] = useState<string>(thisMonth());
  const [allPeriod, setAllPeriod] = useState(true); // 초기엔 전체 기간 (과거 이력 백필 중이므로)
  const [search, setSearch] = useState('');
  const tabDef = TABS.find((t) => t.key === tab)!;
  const range = allPeriod ? { from: undefined, to: undefined } : monthRange(month);
  const expRes = useAsync(
    () => api.get<CardExpenseList>('/cards/expenses', { status: tabDef.status, cardId, from: range.from, to: range.to, take: 300 }),
    [tab, cardId, month, allPeriod],
  );

  const reload = () => {
    cardsRes.reload();
    expRes.reload();
  };

  const s = expRes.data?.summary;
  const countOf = (key: TabKey) =>
    !s
      ? null
      : key === 'ALL'
        ? s.all.count
        : key === 'NOT_SUBMITTED'
          ? s.notSubmitted.count
          : key === 'SUBMITTED'
            ? s.submitted.count
            : key === 'CONFIRMED'
              ? s.confirmed.count
              : s.excluded.count;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="page-title">카드지출</h1>
        {s && (
          <div className="text-[17px] text-ink-mute">
            총 이용 금액 <span className="font-num text-base font-bold text-ink">{num(s.all.amount)}원</span>
          </div>
        )}
      </div>

      {/* 탭 + 필터 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line">
        <div className="flex flex-1 gap-0.5 overflow-x-auto">
          {TABS.map((t) => {
            const c = countOf(t.key);
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[17px] transition-colors ${
                  active ? 'border-brand font-semibold text-brand-deep' : 'border-transparent text-ink-mute hover:text-ink'
                }`}
              >
                {t.label}
                {c !== null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-num font-semibold ${
                      t.key === 'NOT_SUBMITTED' && c > 0
                        ? 'bg-amber-100 text-warn'
                        : t.key === 'SUBMITTED' && c > 0
                          ? 'bg-brand-soft text-brand-deep'
                          : 'bg-line-soft text-ink-mute'
                    }`}
                  >
                    {c}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <select className="input !w-auto !py-1.5 text-sm" value={cardId} onChange={(e) => setCardId(e.target.value)}>
          <option value="">전체 카드</option>
          {(cardsRes.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.holder ? ` · ${c.holder.name}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* 기간 + 검색 (고위드식) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-line">
          <button className="px-3 py-2 text-[17px] text-ink-mute hover:text-ink" onClick={() => { setAllPeriod(false); setMonth((m) => shiftMonth(m, -1)); }}>
            ◀
          </button>
          <button
            className={`min-w-[120px] px-2 py-2 text-center font-num text-[17px] ${allPeriod ? 'text-ink-faint' : 'font-semibold'}`}
            onClick={() => setAllPeriod((v) => !v)}
            title="클릭하면 전체 기간 ↔ 월별 전환"
          >
            {allPeriod ? '전체 기간' : `${month.slice(0, 4)}년 ${month.slice(5)}월`}
          </button>
          <button className="px-3 py-2 text-[17px] text-ink-mute hover:text-ink" onClick={() => { setAllPeriod(false); setMonth((m) => shiftMonth(m, 1)); }}>
            ▶
          </button>
        </div>
        <input
          className="input !w-72 max-w-full !py-2 text-[17px]"
          placeholder="가맹점명, 용도, 메모로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ExpenseList res={expRes} isCeo={isCeo} isAdmin={isAdmin} cards={cardsRes.data ?? []} search={search} onChanged={reload} />

      {!!cardsRes.data?.length && <CardUsage cards={cardsRes.data} />}

      {isCeo && <CardMaster res={cardsRes} onChanged={reload} />}
    </div>
  );
}

/* ───────────────────── 지출 목록 (제출/승인/반려) ───────────────────── */

function ExpenseList({
  res,
  isCeo,
  isAdmin,
  cards,
  search,
  onChanged,
}: {
  res: { data: CardExpenseList | null; loading: boolean; error: string; reload: () => void };
  isCeo: boolean;
  isAdmin: boolean;
  cards: CorporateCard[];
  search: string;
  onChanged: () => void;
}) {
  const isManager = isCeo || isAdmin;
  const [drafts, setDrafts] = useState<Record<string, { purpose: string; memo: string }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<CardExpense | null>(null);

  // 분류 지정용 (관리자만 로드)
  const accountsRes = useAsync(
    () => (isManager ? api.get<Account[]>('/accounts') : Promise.resolve([] as Account[])),
    [isManager],
  );
  const projectsRes = useAsync(
    () => (isManager ? api.get<Project[]>('/projects') : Promise.resolve([] as Project[])),
    [isManager],
  );
  const expenseAccounts = useMemo(
    () => (accountsRes.data ?? []).filter((a) => a.category === 'EXPENSE' && a.isActive),
    [accountsRes.data],
  );

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const all = res.data?.rows ?? [];
    if (!q) return all;
    return all.filter((r) =>
      [r.storeName, r.purposeText, r.memo, r.card?.holder?.name, r.card?.name]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [res.data, q]);
  const submittedIds = useMemo(() => rows.filter((r) => r.status === 'SUBMITTED').map((r) => r.id), [rows]);

  // 탭/필터 변경으로 목록이 바뀌면 선택 초기화
  useEffect(() => {
    setSelected(new Set());
  }, [res.data]);

  const draftOf = (e: CardExpense) => drafts[e.id] ?? { purpose: e.purposeText ?? '', memo: e.memo ?? '' };
  const isDirty = (e: CardExpense) => {
    const d = draftOf(e);
    return d.purpose.trim() !== (e.purposeText ?? '').trim() || d.memo.trim() !== (e.memo ?? '').trim();
  };

  const clearDraft = (id: string) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[id];
      return next;
    });

  const setDims = async (e: CardExpense, patch: { accountId?: string; projectId?: string }) => {
    setError('');
    try {
      await api.patch(`/cards/expenses/${e.id}/dims`, patch);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '분류 지정에 실패했습니다');
    }
  };

  const submit = async (e: CardExpense) => {
    const d = draftOf(e);
    if (!d.purpose.trim()) return;
    setBusyId(e.id);
    setError('');
    try {
      await api.patch(`/cards/expenses/${e.id}/purpose`, { purposeText: d.purpose, memo: d.memo });
      clearDraft(e.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '제출에 실패했습니다');
    } finally {
      setBusyId('');
    }
  };

  const act = async (e: CardExpense, path: 'confirm' | 'exclude' | 'restore') => {
    setBusyId(e.id);
    setError('');
    try {
      await api.post(`/cards/expenses/${e.id}/${path}`, path === 'exclude' ? { reason: '미승인 처리' } : {});
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '처리에 실패했습니다');
    } finally {
      setBusyId('');
    }
  };

  /** 대표 원클릭 승인 — 용도 저장(제출)과 승인을 한 번에 */
  const approveDirect = async (e: CardExpense) => {
    const d = draftOf(e);
    if (!d.purpose.trim()) return;
    setBusyId(e.id);
    setError('');
    try {
      await api.patch(`/cards/expenses/${e.id}/purpose`, { purposeText: d.purpose, memo: d.memo });
      await api.post(`/cards/expenses/${e.id}/confirm`, {});
      clearDraft(e.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '승인에 실패했습니다');
    } finally {
      setBusyId('');
    }
  };

  const syncNow = async () => {
    setBusyId('sync');
    setError('');
    setNotice('');
    try {
      const r = await api.post<{ fetched: number; created: number }>('/cards/sync-gowid', {});
      setNotice(r.created > 0 ? `고위드에서 새 지출 ${r.created}건을 가져왔습니다` : '새 지출이 없습니다 (최신 상태)');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '동기화에 실패했습니다');
    } finally {
      setBusyId('');
    }
  };

  const confirmBulk = async () => {
    setBusyId('bulk');
    setError('');
    setNotice('');
    try {
      const r = await api.post<{ confirmed: number; skipped: number }>('/cards/expenses/confirm-bulk', {
        ids: [...selected],
      });
      setNotice(`${r.confirmed}건 승인 완료${r.skipped ? ` (${r.skipped}건 건너뜀)` : ''}`);
      setSelected(new Set());
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : '일괄 승인에 실패했습니다');
    } finally {
      setBusyId('');
    }
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allChecked = submittedIds.length > 0 && submittedIds.every((id) => selected.has(id));

  return (
    <>
      <Section
        title={<span className="text-base font-bold">이용내역</span>}
        desc="수집된 원본(일시·금액·가맹점)은 수정하지 않습니다. 용도·메모를 적어 제출하면 대표 승인으로 넘어갑니다"
        right={
          <div className="flex items-center gap-2">
            {isCeo && selected.size > 0 && (
              <button className="btn-primary !py-1.5 text-xs" disabled={busyId === 'bulk'} onClick={confirmBulk}>
                {busyId === 'bulk' ? '승인 중…' : `선택 ${selected.size}건 승인`}
              </button>
            )}
            {isCeo && (
              <button
                className="btn-primary"
                disabled={busyId === 'sync'}
                onClick={syncNow}
                title="고위드에서 최신 지출을 즉시 가져옵니다 (평소에도 1분마다 자동 수집됩니다)"
              >
                {busyId === 'sync' ? '불러오는 중…' : '⟳ 불러오기'}
              </button>
            )}
            <button className="btn-ghost" onClick={() => setAddOpen(true)}>
              + 수동 등록
            </button>
          </div>
        }
      >
        {notice && <div className="mx-4 mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-pos">{notice}</div>}
        {error && <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">{error}</div>}

        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : !rows.length ? (
          <Empty>해당 조건의 이용내역이 없습니다.</Empty>
        ) : (
          <>
            {/* 세로 높이를 화면 안으로 제한 → 가로 스크롤바가 항상 보인다. 헤더는 고정 */}
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.line.soft)]">
                  <tr>
                    {isCeo && (
                      <th className="th w-8">
                        <input
                          type="checkbox"
                          className="accent-brand"
                          checked={allChecked}
                          disabled={!submittedIds.length}
                          onChange={() => setSelected(allChecked ? new Set() : new Set(submittedIds))}
                          title="승인 대기 전체 선택"
                        />
                      </th>
                    )}
                    <th className="th">승인 상태</th>
                    <th className="th">일시</th>
                    <th className="th">카드 별칭</th>
                    <th className="th">가맹점명</th>
                    <th className="th text-right">이용금액</th>
                    <th className="th">거래 상태</th>
                    <th className="th">사용자</th>
                    <th className="th">용도</th>
                    <th className="th">메모</th>
                    {isManager && <th className="th">계정과목</th>}
                    {isManager && <th className="th">프로젝트</th>}
                    <th className="th text-right">승인</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((e) => {
                    const d = draftOf(e);
                    const dirty = isDirty(e);
                    const canEdit = e.status === 'PENDING' || e.status === 'REJECTED' || e.status === 'SUBMITTED';
                    return (
                      <tr key={e.id} className="align-middle even:bg-line-soft/30 hover:bg-line-soft/60">
                        {isCeo && (
                          <td className="td">
                            <input
                              type="checkbox"
                              className="accent-brand"
                              checked={selected.has(e.id)}
                              disabled={e.status !== 'SUBMITTED'}
                              onChange={() => toggle(e.id)}
                              title={e.status === 'SUBMITTED' ? '선택' : '승인 대기 건만 선택할 수 있습니다'}
                            />
                          </td>
                        )}
                        <td className="td whitespace-nowrap">
                          <StatusChip status={e.status} />
                        </td>
                        <td className="td whitespace-nowrap font-num">{dateTime(e.usedAt)}</td>
                        <td className="td whitespace-nowrap text-ink-mute">
                          {e.card?.name ?? '—'}
                          {e.card?.last4 && !e.card.name?.includes(e.card.last4) && (
                            <span className="ml-1 font-num text-xs text-ink-faint">{e.card.last4}</span>
                          )}
                        </td>
                        <td className="td max-w-[220px] truncate font-medium" title={e.storeName ?? undefined}>
                          {e.storeName ?? <span className="text-ink-faint">—</span>}
                        </td>
                        <td className="td-num whitespace-nowrap font-medium">{num(e.amount)}원</td>
                        <td className="td whitespace-nowrap text-ink-mute">{e.isCancelled ? <span className="text-neg">취소</span> : '매입'}</td>
                        <td className="td whitespace-nowrap text-ink-mute">{e.card?.holder?.name ?? '—'}</td>
                        <td className="td min-w-[200px]">
                          {canEdit ? (
                            <>
                              <PurposeSelect
                                className="input w-full !py-1.5 text-sm"
                                value={d.purpose}
                                onChange={(v) => setDrafts((prev) => ({ ...prev, [e.id]: { ...d, purpose: v } }))}
                              />
                              {e.status === 'REJECTED' && e.rejectReason && (
                                <div className="mt-0.5 text-xs text-neg">반려: {e.rejectReason}</div>
                              )}
                            </>
                          ) : (
                            <span>{e.purposeText ?? '—'}</span>
                          )}
                        </td>
                        <td className="td min-w-[150px]">
                          {canEdit ? (
                            <input
                              className="input w-full !py-1.5 text-sm"
                              placeholder="메모 입력"
                              value={d.memo}
                              onChange={(ev) => setDrafts((prev) => ({ ...prev, [e.id]: { ...d, memo: ev.target.value } }))}
                            />
                          ) : (
                            <span className="text-ink-mute">{e.memo ?? '—'}</span>
                          )}
                        </td>
                        {isManager && (
                          <td className="td">
                            {canEdit ? (
                              <select
                                className="input w-full min-w-[130px] !py-1.5 text-sm"
                                value={e.accountId ?? ''}
                                onChange={(ev) => setDims(e, { accountId: ev.target.value })}
                              >
                                <option value="">자동</option>
                                {expenseAccounts.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-ink-mute">{e.account?.name ?? '—'}</span>
                            )}
                          </td>
                        )}
                        {isManager && (
                          <td className="td">
                            {canEdit ? (
                              <select
                                className="input w-full min-w-[150px] !py-1.5 text-sm"
                                value={e.projectId ?? ''}
                                onChange={(ev) => setDims(e, { projectId: ev.target.value })}
                              >
                                <option value="">없음</option>
                                {(projectsRes.data ?? []).map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.code} {p.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-ink-mute">{e.project?.name ?? '—'}</span>
                            )}
                          </td>
                        )}
                        <td className="td whitespace-nowrap text-right">
                          <span className="flex justify-end gap-1.5">
                            {/* 대표: 용도 적고 바로 원클릭 승인 (제출 단계 생략) */}
                            {isCeo && (e.status === 'PENDING' || e.status === 'REJECTED') && (
                              <button
                                className="btn-primary !bg-brand-dark !py-1 px-3.5 text-sm font-bold hover:!bg-brand-deep disabled:!bg-line disabled:text-ink-faint"
                                disabled={busyId === e.id || !d.purpose.trim()}
                                onClick={() => approveDirect(e)}
                                title={d.purpose.trim() ? '용도 저장과 함께 승인합니다' : '용도를 선택하면 승인할 수 있습니다'}
                              >
                                승인
                              </button>
                            )}
                            {/* 직원: 제출 → 대표 승인 대기 */}
                            {!isCeo && canEdit && (dirty || e.status !== 'SUBMITTED') && (
                              <button
                                className="btn-primary !py-1 text-sm"
                                disabled={busyId === e.id || !d.purpose.trim()}
                                onClick={() => submit(e)}
                              >
                                {e.status === 'REJECTED' ? '재제출' : e.status === 'SUBMITTED' ? '수정' : '제출'}
                              </button>
                            )}
                            {isCeo && e.status === 'SUBMITTED' && (
                              <>
                                <button
                                  className="btn-primary !bg-brand-dark !py-1 px-3.5 text-sm font-bold hover:!bg-brand-deep"
                                  disabled={busyId === e.id}
                                  onClick={() => (dirty ? approveDirect(e) : act(e, 'confirm'))}
                                >
                                  승인
                                </button>
                                <button className="btn-danger !py-1 text-sm font-semibold" disabled={busyId === e.id} onClick={() => setRejectTarget(e)}>
                                  반려
                                </button>
                              </>
                            )}
                            {(isCeo || isAdmin) && (e.status === 'PENDING' || e.status === 'REJECTED') && (
                              <button
                                className="btn-danger !py-1 text-sm font-semibold"
                                disabled={busyId === e.id}
                                onClick={() => act(e, 'exclude')}
                                title="업무 지출로 인정하지 않음 (손익에 반영 안 됨)"
                              >
                                미승인
                              </button>
                            )}
                            {(isCeo || isAdmin) && e.status === 'EXCLUDED' && (
                              <button className="btn-ghost !py-1 text-sm" disabled={busyId === e.id} onClick={() => act(e, 'restore')}>
                                복원
                              </button>
                            )}
                            {e.status === 'CONFIRMED' && (
                              <span className="font-num text-xs text-ink-faint" title="자동 생성된 분개">
                                {e.journalEntry ? `분개 #${e.journalEntry.entryNo}` : '—'}
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-1 border-t border-line-soft px-4 py-2.5 text-xs text-ink-mute">
              1 - {rows.length} (합계{' '}
              <span className="font-num font-medium text-ink">
                {num(rows.reduce((a, r) => a + big(r.amount), 0n))}원
              </span>
              ) / 총 {rows.length}개
            </div>
          </>
        )}
      </Section>

      <RejectModal
        target={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onDone={() => {
          setRejectTarget(null);
          onChanged();
        }}
      />

      <AddExpenseModal
        open={addOpen}
        cards={cards}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          onChanged();
        }}
      />
    </>
  );
}

function RejectModal({
  target,
  onClose,
  onDone,
}: {
  target: CardExpense | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (target) {
      setReason('');
      setError('');
    }
  }, [target]);

  const submit = async () => {
    if (!target) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/cards/expenses/${target.id}/reject`, { reason });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : '반려에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!target} onClose={onClose} title="반려" desc="반려하면 직원이 용도를 수정해 재제출합니다">
      <div className="space-y-3.5">
        {target && (
          <div className="rounded-md bg-line-soft/60 px-3 py-2 text-xs">
            <span className="text-ink-mute">{target.storeName ?? '가맹점 미상'} · </span>
            <span className="font-num font-medium">{num(target.amount)}원</span>
            {target.purposeText && <span className="text-ink-mute"> · {target.purposeText}</span>}
          </div>
        )}
        <Field label="반려 사유" required>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 용도를 구체적으로 적어주세요"
          />
        </Field>
        {error && <div className="text-sm text-neg">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? '처리 중…' : '반려'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddExpenseModal({
  open,
  cards,
  onClose,
  onSaved,
}: {
  open: boolean;
  cards: CorporateCard[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cardId, setCardId] = useState('');
  const [usedAt, setUsedAt] = useState('');
  const [amount, setAmount] = useState('');
  const [storeName, setStoreName] = useState('');
  const [purposeText, setPurposeText] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/cards/expenses', {
        cardId,
        usedAt,
        amount,
        storeName: storeName || undefined,
        purposeText: purposeText || undefined,
        memo: memo || undefined,
      });
      setUsedAt('');
      setAmount('');
      setStoreName('');
      setPurposeText('');
      setMemo('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="카드지출 수동 등록"
      desc="자동 수집 전이거나 수집에서 빠진 건을 직접 기록합니다"
    >
      <div className="space-y-3.5">
        <Field label="카드" required>
          <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
            <option value="">선택하세요</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.holder ? ` · ${c.holder.name}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="사용일" required>
            <input type="date" className="input" value={usedAt} onChange={(e) => setUsedAt(e.target.value)} />
          </Field>
          <Field label="금액" required>
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
        </div>
        <Field label="사용처">
          <input className="input" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="가맹점명" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="용도">
            <PurposeSelect value={purposeText} onChange={setPurposeText} />
          </Field>
          <Field label="메모">
            <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
        </div>
        {error && <div className="text-sm text-neg">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !cardId || !usedAt || !amount}>
            {busy ? '저장 중…' : '등록'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────── 카드 관리 (CEO) ───────────────────── */

function CardMaster({
  res,
  onChanged,
}: {
  res: { data: CorporateCard[] | null; loading: boolean; error: string; reload: () => void };
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CorporateCard | null>(null);
  const [deriveBusy, setDeriveBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const derive = async (c: CorporateCard) => {
    setDeriveBusy(c.id);
    setNotice('');
    setError('');
    try {
      const r = await api.post<{ scanned: number; created: number; skipped: number }>(
        `/cards/${c.id}/derive-from-bank`,
        {},
      );
      setNotice(`${c.name}: 출금 ${r.scanned}건 중 ${r.created}건을 카드지출로 가져왔습니다 (중복 ${r.skipped}건 제외)`);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '가져오기에 실패했습니다');
    } finally {
      setDeriveBusy('');
    }
  };

  return (
    <>
      <Section
        title="카드 관리"
        desc="카드 ↔ 소지자 매핑이 '누가 썼는지'를 결정합니다. 체크카드는 결제계좌를 연결하세요"
        right={
          <button className="btn-ghost" onClick={() => setOpen(true)}>
            + 카드 등록
          </button>
        }
      >
        {notice && <div className="mx-4 mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-pos">{notice}</div>}
        {error && <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">{error}</div>}
        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : !res.data?.length ? (
          <Empty>등록된 카드가 없습니다. 법인카드를 등록하면 지출 수집이 시작됩니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">카드</th>
                  <th className="th">발급사</th>
                  <th className="th">구분</th>
                  <th className="th">소지자</th>
                  <th className="th">결제계좌</th>
                  <th className="th">수집</th>
                  <th className="th text-right">월 한도</th>
                  <th className="th text-right">미제출</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {res.data.map((c) => (
                  <tr key={c.id} className={`hover:bg-line-soft/60 ${c.isActive ? '' : 'opacity-50'}`}>
                    <td className="td font-medium">
                      <span className="flex items-center gap-2.5">
                        <CardBrandMark issuer={c.issuer} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate">{c.name}</span>
                          {c.last4 && !c.name.includes(c.last4) && (
                            <span className="block font-num text-xs text-ink-faint">…{c.last4}</span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="td text-ink-mute">{c.issuer}</td>
                    <td className="td">
                      <span className="badge bg-line-soft text-ink-mute">{c.cardType === 'CREDIT' ? '신용' : '체크'}</span>
                    </td>
                    <td className="td">{c.holder?.name ?? <span className="text-ink-faint">미지정</span>}</td>
                    <td className="td text-ink-mute">{c.bankAccount ? `${c.bankAccount.alias} (${c.bankAccount.bankName})` : '—'}</td>
                    <td className="td text-xs text-ink-mute">{SOURCE_LABEL[c.source]}</td>
                    <td className="td-num text-ink-mute">{c.monthlyLimit ? `${num(c.monthlyLimit)}원` : '—'}</td>
                    <td className="td-num">
                      {c.pendingCount > 0 ? <span className="font-medium text-warn">{c.pendingCount}건</span> : '0건'}
                    </td>
                    <td className="td text-right">
                      <span className="flex justify-end gap-1.5">
                        {c.bankAccountId && (
                          <button
                            className="btn-ghost !py-1 text-sm"
                            disabled={deriveBusy === c.id}
                            onClick={() => derive(c)}
                          >
                            {deriveBusy === c.id ? '가져오는 중…' : '계좌출금 가져오기'}
                          </button>
                        )}
                        <button className="btn-ghost !py-1 text-sm" onClick={() => setEditing(c)}>
                          수정
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

      <CardFormModal
        open={open || !!editing}
        card={editing}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          setOpen(false);
          setEditing(null);
          onChanged();
        }}
      />
    </>
  );
}

function CardFormModal({
  open,
  card,
  onClose,
  onSaved,
}: {
  open: boolean;
  card: CorporateCard | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const usersRes = useAsync(() => (open ? api.get<UserRow[]>('/users') : Promise.resolve([] as UserRow[])), [open]);
  const accRes = useAsync(
    () => (open ? api.get<BankAccount[]>('/treasury/bank-accounts') : Promise.resolve([] as BankAccount[])),
    [open],
  );

  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [cardType, setCardType] = useState<'CREDIT' | 'CHECK'>('CREDIT');
  const [last4, setLast4] = useState('');
  const [holderUserId, setHolderUserId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 열릴 때 폼 초기화 (신규/수정 공통)
  useEffect(() => {
    if (!open) return;
    setName(card?.name ?? '');
    setIssuer(card?.issuer ?? '');
    setCardType(card?.cardType ?? 'CREDIT');
    setLast4(card?.last4 ?? '');
    setHolderUserId(card?.holderUserId ?? '');
    setBankAccountId(card?.bankAccountId ?? '');
    setMonthlyLimit(card?.monthlyLimit ?? '');
    setIsActive(card?.isActive ?? true);
    setError('');
  }, [open, card]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const body = {
        name,
        issuer,
        cardType,
        last4: last4 || undefined,
        holderUserId: holderUserId || null,
        bankAccountId: cardType === 'CHECK' ? bankAccountId || null : null,
        monthlyLimit: monthlyLimit || null,
        isActive,
      };
      if (card) await api.patch(`/cards/${card.id}`, body);
      else await api.post('/cards', body);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={card ? '카드 수정' : '카드 등록'} wide>
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="카드명" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="신한 법인 1234" />
          </Field>
          <Field label="발급사" required>
            <input className="input" value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="신한카드" />
          </Field>
          <Field label="구분" required>
            <select className="input" value={cardType} onChange={(e) => setCardType(e.target.value as 'CREDIT' | 'CHECK')}>
              <option value="CREDIT">신용카드</option>
              <option value="CHECK">체크카드</option>
            </select>
          </Field>
          <Field label="끝 4자리">
            <input className="input font-num" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="소지자" hint="'누가 썼는지'는 이 매핑으로 결정됩니다">
            <select className="input" value={holderUserId} onChange={(e) => setHolderUserId(e.target.value)}>
              <option value="">미지정</option>
              {(usersRes.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.department ? ` (${u.department.name})` : ''}
                </option>
              ))}
            </select>
          </Field>
          {cardType === 'CHECK' && (
            <Field label="결제계좌" hint="이 계좌의 출금을 카드지출로 가져옵니다">
              <select className="input" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
                <option value="">선택하세요</option>
                {(accRes.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.alias} ({a.bankName})
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="월 한도" hint="비워두면 한도 미설정 — 앱의 잔여한도 계산에 쓰입니다">
            <MoneyInput value={monthlyLimit} onChange={setMonthlyLimit} />
          </Field>
        </div>
        {card && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-brand" />
            사용 중인 카드
          </label>
        )}
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !name || !issuer}>
            {busy ? '저장 중…' : card ? '저장' : '등록'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
