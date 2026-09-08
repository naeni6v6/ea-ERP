'use client';

import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useFilters } from '@/lib/filters';
import { resolveRange } from '@/lib/dateRange';
import { useAsync } from '@/lib/useAsync';
import { big, dateTime, num, sdate } from '@/lib/format';
import { AccountSelect, PurposeSelect } from '@/components/PurposeSelect';
import { Empty, ErrorBox, Section, Spinner, StatusBadge } from '@/components/ui';
import type { Account, BankAccount, BankTransaction } from '@/lib/types';

/**
 * 지출 > 계좌 — 은행 계좌 입출금 내역. 기본은 출금(지출)만 보여주고,
 * 계좌·방향 필터로 좁혀 본다. 자금 정보라서 대표 전용.
 * 출금 건은 카드 지출과 같은 용도 목록(식비·급여비·프로젝트비 등)으로 분류할 수 있다 — 고르면 바로 저장.
 */
interface PopbillSyncResult {
  accounts: number;
  results: { alias?: string; total?: number; inserted?: number; skipped?: number; error?: string }[];
}

type PurposePatch = { purposeText: string | null; memo: string | null; accountId: string | null; account: { id: string; name: string } | null };

export default function AccountExpensesPage() {
  const { isCeo } = useSession();
  const [direction, setDirection] = useState<'OUT' | 'IN' | ''>('');
  const [accountId, setAccountId] = useState('');
  const [purposeFilter, setPurposeFilter] = useState<'' | 'NONE' | 'SET'>('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [syncError, setSyncError] = useState('');

  // 용도·메모 저장 결과를 로컬에 덮어써서 목록 전체를 다시 불러오지 않는다
  const [patched, setPatched] = useState<Record<string, PurposePatch>>({});
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');

  // 상단 전역 필터의 기간을 그대로 쓴다 — 고르는 즉시 반영, [검색]은 강제 재조회
  const filters = useFilters();
  const range = resolveRange(filters.preset, filters.from, filters.to);

  const accounts = useAsync(() => (isCeo ? api.get<BankAccount[]>('/treasury/bank-accounts') : Promise.resolve(null)), [isCeo]);
  // 계정과목(비용) — 카드 지출과 같은 목록에서 고른다
  const ledgerAccounts = useAsync(() => (isCeo ? api.get<Account[]>('/accounts') : Promise.resolve([] as Account[])), [isCeo]);
  const expenseAccounts = useMemo(
    () => (ledgerAccounts.data ?? []).filter((a) => a.category === 'EXPENSE' && a.isActive),
    [ledgerAccounts.data],
  );
  const res = useAsync(
    () =>
      isCeo
        ? api.get<BankTransaction[]>('/treasury/bank-transactions', {
            direction: direction || undefined,
            bankAccountId: accountId || undefined,
            from: range.from,
            to: range.to,
            take: 500,
          })
        : Promise.resolve(null),
    [isCeo, direction, accountId, range.from, range.to, filters.tick],
  );

  if (!isCeo)
    return (
      <div className="card-pad mx-auto max-w-sm text-center text-sm">
        <p className="font-medium">계좌 지출은 대표만 볼 수 있습니다</p>
        <p className="mt-1 text-ink-mute">카드 지출은 좌측 메뉴의 지출 → 카드에서 확인하세요.</p>
      </div>
    );

  const allRows: BankTransaction[] = (res.data ?? []).map((t) => (patched[t.id] ? { ...t, ...patched[t.id] } : t));
  const rows = allRows.filter((t) => {
    if (purposeFilter === 'NONE') return t.direction === 'OUT' && !t.purposeText;
    if (purposeFilter === 'SET') return !!t.purposeText;
    return true;
  });
  const outSum = rows.filter((t) => t.direction === 'OUT').reduce((a, t) => a + big(t.amount), 0n);
  const inSum = rows.filter((t) => t.direction === 'IN').reduce((a, t) => a + big(t.amount), 0n);
  const unclassifiedOut = allRows.filter((t) => t.direction === 'OUT' && !t.purposeText).length;

  /** 용도·계정과목·메모 저장 — 원본(일시·금액·내용)은 그대로, 분류만 붙인다 */
  const savePurpose = async (t: BankTransaction, body: { purposeText?: string; memo?: string; accountId?: string }) => {
    setBusyId(t.id);
    setSaveError('');
    try {
      const r = await api.patch<BankTransaction>(`/treasury/bank-transactions/${t.id}/purpose`, body);
      setPatched((prev) => ({
        ...prev,
        [t.id]: { purposeText: r.purposeText ?? null, memo: r.memo ?? null, accountId: r.accountId ?? null, account: r.account ?? null },
      }));
      setMemoDrafts((prev) => {
        const { [t.id]: _drop, ...rest } = prev;
        return rest;
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장에 실패했습니다');
    } finally {
      setBusyId(null);
    }
  };
  const memoOf = (t: BankTransaction) => memoDrafts[t.id] ?? t.memo ?? '';
  const commitMemo = (t: BankTransaction) => {
    const v = memoOf(t);
    if (v.trim() === (t.memo ?? '').trim()) {
      setMemoDrafts((prev) => {
        const { [t.id]: _drop, ...rest } = prev;
        return rest;
      });
      return;
    }
    void savePurpose(t, { memo: v });
  };

  /**
   * 은행에서 최신 입출금을 즉시 당겨온다 (팝빌 계좌조회).
   * 계좌 쪽은 자동 수집이 없어서 이 버튼이 유일한 수집 트리거다.
   * 은행 스크래핑이라 수 초~2분 걸릴 수 있고, 같은 기간을 다시 눌러도 중복은 생기지 않는다.
   */
  const syncNow = async () => {
    setSyncBusy(true);
    setSyncNotice('');
    setSyncError('');
    try {
      const r = await api.post<PopbillSyncResult>('/treasury/popbill/sync', {});
      if (r.accounts === 0) {
        setSyncError('팝빌에 연결된 계좌가 없습니다. 자금 → 계좌 탭에서 팝빌 연동을 먼저 해주세요.');
      } else {
        const ok = r.results.filter((x) => !x.error);
        const failed = r.results.filter((x) => x.error);
        const inserted = ok.reduce((a, x) => a + (x.inserted ?? 0), 0);
        const parts = [`계좌 ${ok.length}개 확인 · 새 거래 ${inserted}건`];
        if (failed.length) parts.push(`실패 ${failed.length}건 (${failed.map((x) => x.alias).join(', ')})`);
        setSyncNotice(parts.join(' · '));
        res.reload();
        accounts.reload();
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : '불러오기에 실패했습니다');
    } finally {
      setSyncBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">계좌 지출</h1>
          <p className="mt-0.5 text-xs text-ink-faint">
            {sdate(range.from)} ~ {sdate(range.to)} · {rows.length}건
            {(filters.businessTypeId || filters.departmentId) && (
              <span className="text-warn"> · 사업유형·부서 필터는 은행 원본 내역에는 적용되지 않습니다</span>
            )}
            {direction !== 'IN' && (
              <span>
                {' '}
                · 출금 합계 <b className="font-num text-neg">{num(outSum)}원</b>
              </span>
            )}
            {direction !== 'OUT' && (
              <span>
                {' '}
                · 입금 합계 <b className="font-num text-pos">{num(inSum)}원</b>
              </span>
            )}
            {unclassifiedOut > 0 && (
              <span className="text-warn"> · 용도 미지정 출금 {unclassifiedOut}건</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <select className="input w-40" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">모든 계좌</option>
            {(accounts.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.alias}
              </option>
            ))}
          </select>
          <select
            className="input w-36"
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'OUT' | 'IN' | '')}
          >
            <option value="">입·출금 전체</option>
            <option value="OUT">출금만</option>
            <option value="IN">입금만</option>
          </select>
          <select
            className="input w-36"
            value={purposeFilter}
            onChange={(e) => setPurposeFilter(e.target.value as '' | 'NONE' | 'SET')}
            title="용도 지정 여부로 좁혀 봅니다"
          >
            <option value="">용도 전체</option>
            <option value="NONE">용도 미지정만</option>
            <option value="SET">용도 지정됨만</option>
          </select>
          <button
            className="btn-primary whitespace-nowrap"
            disabled={syncBusy}
            onClick={syncNow}
            title="은행에서 최신 입출금 내역을 즉시 가져옵니다 (은행 조회라 최대 2분 걸릴 수 있습니다)"
          >
            {syncBusy ? '불러오는 중…' : '⟳ 불러오기'}
          </button>
        </div>
      </div>

      {syncBusy && (
        <div className="rounded-md border border-brand-soft bg-brand-soft/60 px-3 py-2 text-sm text-brand-deep">
          은행에서 내역을 가져오는 중입니다… 계좌 수에 따라 최대 2분 걸릴 수 있어요. 이 화면을 벗어나지 마세요.
        </div>
      )}
      {syncNotice && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-pos">{syncNotice}</div>
      )}
      {syncError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">{syncError}</div>
      )}
      {saveError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">용도 저장 실패: {saveError}</div>
      )}

      <Section
        title="내역"
        desc="출금 건은 용도를 고르면 바로 저장됩니다 (카드 지출과 같은 목록). 장부 반영(분개)은 자금 → 거래 인박스에서 처리합니다"
      >
        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : rows.length === 0 ? (
          <Empty>조건에 맞는 거래가 없습니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">일시</th>
                  <th className="th">계좌</th>
                  <th className="th">내용</th>
                  <th className="th">구분</th>
                  <th className="th text-right">금액</th>
                  <th className="th">용도</th>
                  <th className="th">계정과목</th>
                  <th className="th">메모</th>
                  <th className="th">장부 분류</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((t) => (
                  <tr key={t.id} className="align-middle hover:bg-line-soft/60">
                    <td className="td whitespace-nowrap font-num text-xs text-ink-mute">{dateTime(t.txnAt)}</td>
                    <td className="td whitespace-nowrap text-xs text-ink-mute">
                      {t.bankAccount?.alias ?? '—'}
                      {t.bankAccount?.bankName && (
                        <span className="ml-1 text-ink-faint">· {t.bankAccount.bankName}</span>
                      )}
                    </td>
                    <td className="td max-w-[260px] truncate text-sm" title={t.descriptionRaw ?? undefined}>
                      {t.counterpartyRaw || t.descriptionRaw || '—'}
                    </td>
                    <td className="td">
                      <span className={`badge ${t.direction === 'OUT' ? 'bg-red-50 text-neg' : 'bg-emerald-50 text-pos'}`}>
                        {t.direction === 'OUT' ? '출금' : '입금'}
                      </span>
                    </td>
                    <td className={`td-num whitespace-nowrap font-medium ${t.direction === 'OUT' ? 'text-neg' : 'text-pos'}`}>
                      {t.direction === 'OUT' ? '-' : '+'}
                      {num(t.amount)}
                    </td>
                    <td className="td min-w-[170px]">
                      {t.direction === 'OUT' ? (
                        <PurposeSelect
                          className={`input w-full !py-1.5 text-sm ${!t.purposeText ? 'border-amber-300' : ''}`}
                          value={t.purposeText ?? ''}
                          disabled={busyId === t.id}
                          onChange={(v) => void savePurpose(t, { purposeText: v })}
                        />
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="td min-w-[150px]">
                      {t.direction === 'OUT' ? (
                        <AccountSelect
                          className="input w-full !py-1.5 text-sm"
                          value={t.accountId ?? ''}
                          accounts={expenseAccounts}
                          disabled={busyId === t.id}
                          emptyLabel="계정과목 선택"
                          onChange={(v) => void savePurpose(t, { accountId: v })}
                        />
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="td min-w-[150px]">
                      <input
                        className="input w-full !py-1.5 text-sm"
                        placeholder="메모 입력"
                        value={memoOf(t)}
                        disabled={busyId === t.id}
                        onChange={(ev) => setMemoDrafts((prev) => ({ ...prev, [t.id]: ev.target.value }))}
                        onBlur={() => commitMemo(t)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                        }}
                      />
                    </td>
                    <td className="td">
                      {t.classification ? (
                        <StatusBadge
                          status={t.classification.status}
                          label={
                            t.classification.status === 'CLASSIFIED'
                              ? '분류됨'
                              : t.classification.status === 'IGNORED'
                                ? '제외'
                                : '미분류'
                          }
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
