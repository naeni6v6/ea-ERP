'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { big, num, todaySeoul } from '@/lib/format';
import { Field, Modal } from '@/components/ui';
import { MoneyInput } from '@/components/MoneyInput';
import type { Account, BankAccount, BankTransaction, EntryType, Partner, Project } from '@/lib/types';

/** 현금이 움직이는 템플릿 → 방향. 서버 journal.service의 CASH_TEMPLATES와 동일하게 유지할 것. */
const CASH_DIR: Record<string, 'IN' | 'OUT'> = {
  CASH_SALES: 'IN',
  RECEIPT_AR: 'IN',
  CONTRACT_PREPAY: 'IN',
  OTHER_INCOME: 'IN',
  CASH_EXPENSE: 'OUT',
  PAYMENT_AP: 'OUT',
  PREPAID: 'OUT',
};
/** 매출/비용 계정과목을 직접 고르는 템플릿 */
const ACCOUNT_KIND: Record<string, 'REVENUE' | 'EXPENSE'> = {
  SALES: 'REVENUE',
  CASH_SALES: 'REVENUE',
  CONTRACT_RECOGNIZE: 'REVENUE',
  OTHER_INCOME: 'REVENUE',
  EXPENSE: 'EXPENSE',
  CASH_EXPENSE: 'EXPENSE',
  PREPAID_AMORTIZE: 'EXPENSE',
};
/** 부가세를 분리 기록하는 템플릿 (Q6) */
const VAT_TYPES = new Set([
  'SALES',
  'CASH_SALES',
  'EXPENSE',
  'CASH_EXPENSE',
  'PREPAID',
  'CONTRACT_RECOGNIZE',
]);

interface ManualLine {
  accountId: string;
  debit: string;
  credit: string;
  memo: string;
}

const emptyLine = (): ManualLine => ({ accountId: '', debit: '', credit: '', memo: '' });

export function EntryFormModal({
  open,
  onClose,
  onSaved,
  bankTxn,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** 은행거래 분류 모드 — 금액·계좌·방향이 원본에 고정된다 */
  bankTxn?: BankTransaction | null;
}) {
  const { businessTypes, departments } = useSession();

  const [types, setTypes] = useState<EntryType[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [banksDenied, setBanksDenied] = useState(false);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [type, setType] = useState('SALES');
  const [entryDate, setEntryDate] = useState(todaySeoul());
  const [amount, setAmount] = useState('');
  const [vatAmount, setVatAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [toBankAccountId, setToBankAccountId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [businessTypeId, setBusinessTypeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<ManualLine[]>([emptyLine(), emptyLine()]);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 참조 데이터
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [t, a, p, pj] = await Promise.all([
        api.get<EntryType[]>('/journal/entry-types'),
        api.get<Account[]>('/accounts'),
        api.get<Partner[]>('/partners'),
        api.get<Project[]>('/projects'),
      ]);
      setTypes(t);
      setAccounts(a);
      setPartners(p);
      setProjects(pj);
      try {
        setBanks(await api.get<BankAccount[]>('/treasury/bank-accounts'));
        setBanksDenied(false);
      } catch (e) {
        // 계좌 목록은 CEO 전용 — ADMIN이면 현금 템플릿을 막고 안내한다
        setBanksDenied(e instanceof ApiError && e.status === 403);
      }
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : '기준정보 조회 실패'));
  }, [open]);

  // 은행거래 분류 모드 초기값
  useEffect(() => {
    if (!open) return;
    setError('');
    if (bankTxn) {
      setBankAccountId(bankTxn.bankAccountId);
      setEntryDate(bankTxn.txnAt.slice(0, 10));
      setType(bankTxn.direction === 'IN' ? 'RECEIPT_AR' : 'CASH_EXPENSE');
      setAmount(bankTxn.amount);
      setVatAmount('');
      setMemo(bankTxn.descriptionRaw ?? '');
    }
  }, [open, bankTxn]);

  const cashDir = CASH_DIR[type];
  const accountKind = ACCOUNT_KIND[type];
  const isManual = type === 'MANUAL';
  const isTransfer = type === 'TRANSFER';
  const showVat = VAT_TYPES.has(type);
  const classifying = !!bankTxn;

  /** 분류 모드에서는 입출금 총액이 고정 → 공급가액 = 총액 − 부가세 */
  const gross = classifying ? big(bankTxn!.amount) : big(amount) + big(vatAmount);
  const supply = classifying ? gross - big(vatAmount) : big(amount);

  const typeOptions = useMemo(() => {
    if (!classifying) return types;
    const dir = bankTxn!.direction;
    return types.filter((t) => CASH_DIR[t.type] === dir);
  }, [types, classifying, bankTxn]);

  const accountOptions = useMemo(
    () => accounts.filter((a) => a.isActive && a.category === accountKind),
    [accounts, accountKind],
  );

  useEffect(() => {
    // 유형이 바뀌면 그 유형에 맞지 않는 계정 선택을 비운다
    setAccountId((prev) => (accountOptions.some((a) => a.id === prev) ? prev : ''));
  }, [accountOptions]);

  const manualBalance = useMemo(() => {
    const dr = lines.reduce((a, l) => a + big(l.debit), 0n);
    const cr = lines.reduce((a, l) => a + big(l.credit), 0n);
    return { dr, cr, ok: dr === cr && dr > 0n };
  }, [lines]);

  const reset = () => {
    setType('SALES');
    setEntryDate(todaySeoul());
    setAmount('');
    setVatAmount('');
    setAccountId('');
    setBankAccountId('');
    setToBankAccountId('');
    setPartnerId('');
    setBusinessTypeId('');
    setDepartmentId('');
    setProjectId('');
    setMemo('');
    setLines([emptyLine(), emptyLine()]);
    setError('');
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        type,
        entryDate,
        memo: memo || undefined,
        partnerId: partnerId || undefined,
        dims: {
          businessTypeId: businessTypeId || undefined,
          departmentId: departmentId || undefined,
          projectId: projectId || undefined,
        },
      };
      if (isManual) {
        body.lines = lines
          .filter((l) => l.accountId && (big(l.debit) > 0n || big(l.credit) > 0n))
          .map((l) => ({
            accountId: l.accountId,
            debit: l.debit || '0',
            credit: l.credit || '0',
            memo: l.memo || undefined,
          }));
      } else {
        body.amount = String(supply);
        if (showVat && big(vatAmount) > 0n) body.vatAmount = vatAmount;
        if (accountKind && accountId) body.accountId = accountId;
        if (cashDir || isTransfer) body.bankAccountId = bankAccountId;
        if (isTransfer) body.toBankAccountId = toBankAccountId;
      }
      if (bankTxn) body.bankTransactionId = bankTxn.id;

      await api.post('/journal', body);
      reset();
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const cashBlocked = !!cashDir && banksDenied && !classifying;
  const canSubmit =
    !busy &&
    !!entryDate &&
    (isManual
      ? manualBalance.ok
      : supply > 0n &&
        (!accountKind || !!accountId) &&
        (!cashDir || !!bankAccountId) &&
        (!isTransfer || (!!bankAccountId && !!toBankAccountId && big(amount) > 0n)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide={isManual}
      title={classifying ? '은행거래 분류' : '거래 등록'}
      desc={
        classifying
          ? '원본 은행거래는 수정되지 않습니다. 분개를 만들어 연결합니다.'
          : '템플릿을 고르면 내부적으로 균형 잡힌 분개가 생성됩니다.'
      }
    >
      <div className="space-y-3.5">
        {classifying && (
          <div className="rounded-md border border-line bg-line-soft/60 px-3 py-2 text-xs">
            <div className="flex justify-between">
              <span className="text-ink-mute">원본</span>
              <span className="font-num">
                {bankTxn!.txnAt.slice(0, 10)} · {bankTxn!.direction === 'IN' ? '입금' : '출금'}{' '}
                {num(bankTxn!.amount)}원
              </span>
            </div>
            {bankTxn!.descriptionRaw && (
              <div className="mt-1 truncate text-ink-faint">{bankTxn!.descriptionRaw}</div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="거래 유형" required>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {typeOptions.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="거래일자" required>
            <input
              type="date"
              className="input"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              disabled={classifying}
            />
          </Field>
        </div>

        {!isManual && (
          <div className="grid grid-cols-2 gap-3">
            {classifying ? (
              <Field label="입출금 총액" hint="원본 은행거래 금액으로 고정">
                <input className="input text-right font-num" value={num(gross)} disabled />
              </Field>
            ) : (
              <Field label={isTransfer ? '이체금액' : '공급가액'} required>
                <MoneyInput value={amount} onChange={setAmount} />
              </Field>
            )}

            {showVat ? (
              <Field label="부가세" hint="없으면 비워두세요">
                <MoneyInput value={vatAmount} onChange={setVatAmount} />
              </Field>
            ) : (
              <div />
            )}
          </div>
        )}

        {!isManual && !isTransfer && (showVat || classifying) && (
          <div className="flex justify-between rounded-md bg-line-soft/60 px-3 py-2 text-xs">
            <span className="text-ink-mute">
              {classifying ? '공급가액 (총액 − 부가세)' : '합계 (공급가액 + 부가세)'}
            </span>
            <span className={`font-num font-medium ${supply <= 0n ? 'text-neg' : ''}`}>
              {num(classifying ? supply : gross)}원
            </span>
          </div>
        )}

        {accountKind && (
          <Field
            label={accountKind === 'REVENUE' ? '매출 계정과목' : '비용 계정과목'}
            required
            hint={
              accountKind === 'EXPENSE'
                ? '프로젝트 직접비(외주·재료·직접인건비)는 매출원가, 그 외는 판관비로 집계됩니다'
                : undefined
            }
          >
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">선택하세요</option>
              {accountOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {(cashDir || isTransfer) && (
          <div className={isTransfer ? 'grid grid-cols-2 gap-3' : ''}>
            <Field label={isTransfer ? '출금 계좌' : cashDir === 'IN' ? '입금 계좌' : '출금 계좌'} required>
              <select
                className="input"
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                disabled={classifying}
              >
                <option value="">선택하세요</option>
                {(classifying && banks.length === 0
                  ? [{ id: bankTxn!.bankAccountId, alias: bankTxn!.bankAccount?.alias ?? '원본 계좌', bankName: '' }]
                  : banks
                ).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.alias} {b.bankName && `(${b.bankName})`}
                  </option>
                ))}
              </select>
            </Field>
            {isTransfer && (
              <Field label="입금 계좌" required>
                <select
                  className="input"
                  value={toBankAccountId}
                  onChange={(e) => setToBankAccountId(e.target.value)}
                >
                  <option value="">선택하세요</option>
                  {banks
                    .filter((b) => b.id !== bankAccountId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.alias} ({b.bankName})
                      </option>
                    ))}
                </select>
              </Field>
            )}
          </div>
        )}

        {cashBlocked && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-warn">
            계좌 목록은 대표 권한에서만 조회할 수 있습니다. 현금이 오가는 템플릿 대신 “매출
            발생(미수)” · “비용 발생(미지급)”을 사용하세요.
          </div>
        )}

        {isManual && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">분개 라인</span>
              <button className="btn-ghost !py-1 text-xs" onClick={() => setLines((l) => [...l, emptyLine()])}>
                + 줄 추가
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_120px_auto] gap-2">
                  <select
                    className="input"
                    value={l.accountId}
                    onChange={(e) =>
                      setLines((ls) => ls.map((x, j) => (j === i ? { ...x, accountId: e.target.value } : x)))
                    }
                  >
                    <option value="">계정과목</option>
                    {accounts
                      .filter((a) => a.isActive)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} {a.name}
                        </option>
                      ))}
                  </select>
                  <MoneyInput
                    value={l.debit}
                    placeholder="차변"
                    onChange={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, debit: v } : x)))}
                  />
                  <MoneyInput
                    value={l.credit}
                    placeholder="대변"
                    onChange={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, credit: v } : x)))}
                  />
                  <button
                    className="btn-ghost !px-2 text-ink-faint"
                    onClick={() => setLines((ls) => (ls.length > 2 ? ls.filter((_, j) => j !== i) : ls))}
                    aria-label="줄 삭제"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div
              className={`mt-2 flex justify-between rounded-md px-3 py-2 text-xs ${
                manualBalance.ok ? 'bg-emerald-50 text-pos' : 'bg-amber-50 text-warn'
              }`}
            >
              <span>차변 {num(manualBalance.dr)} / 대변 {num(manualBalance.cr)}</span>
              <span className="font-medium">{manualBalance.ok ? '균형' : '불일치 — 저장할 수 없습니다'}</span>
            </div>
          </div>
        )}

        <details className="rounded-md border border-line px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-ink-soft">
            분류 축 · 거래처 · 메모
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Field label="사업유형">
                <select
                  className="input"
                  value={businessTypeId}
                  onChange={(e) => setBusinessTypeId(e.target.value)}
                >
                  <option value="">미지정</option>
                  {businessTypes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="부서">
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
              <Field label="프로젝트" hint="지정하면 사업유형·주관부서가 자동 보완됩니다">
                <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">미지정</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="거래처">
                <select className="input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                  <option value="">미지정</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="메모">
                <input className="input" value={memo} onChange={(e) => setMemo(e.target.value)} />
              </Field>
            </div>
          </div>
        </details>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>
            취소
          </button>
          <button className="btn-primary" onClick={submit} disabled={!canSubmit}>
            {busy ? '저장 중…' : classifying ? '분류하기' : '등록'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
