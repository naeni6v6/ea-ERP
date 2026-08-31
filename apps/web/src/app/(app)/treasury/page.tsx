'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { big, compact, dateTime, num, seoulYmd, signClass, todaySeoul } from '@/lib/format';
import { EntryFormModal } from '@/components/EntryFormModal';
import { MoneyInput } from '@/components/MoneyInput';
import { PopbillPanel } from '@/components/PopbillPanel';
import { Empty, ErrorBox, Field, Kpi, Modal, Section, Spinner, StatusBadge } from '@/components/ui';
import type {
  BankAccount,
  BankTransaction,
  PlannedIncome,
  PlannedPayment,
  Reserve,
  TreasuryKpi,
} from '@/lib/types';

type Tab = 'accounts' | 'inbox' | 'reserves' | 'planned';

const CLASSIFICATION_LABEL: Record<string, string> = {
  UNCLASSIFIED: '미분류',
  CLASSIFIED: '분류완료',
  IGNORED: '제외',
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'accounts', label: '계좌' },
  { key: 'inbox', label: '은행거래 분류' },
  { key: 'reserves', label: '경영유보금' },
  { key: 'planned', label: '지급예정' },
];

export default function TreasuryPage() {
  const [tab, setTab] = useState<Tab>('accounts');
  const kpiRes = useAsync(() => api.get<TreasuryKpi>('/metrics/treasury'), []);

  return (
    <div className="space-y-5">
      <h1 className="page-title">자금</h1>

      {kpiRes.error ? (
        <ErrorBox message={kpiRes.error} onRetry={kpiRes.reload} />
      ) : kpiRes.data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="총잔액" value={kpiRes.data.totalBalance} />
          <Kpi
            label="가용현금"
            value={kpiRes.data.availableCash}
            tone="brand"
            hint="총잔액 − 유보금 − 확정 지급예정 − 사용제한계좌"
          />
          <Kpi
            label="묶인 돈"
            value={kpiRes.data.unavailable}
            sub={`유보금 ${compact(kpiRes.data.reserveTotal)} · 확정지급 ${compact(kpiRes.data.plannedConfirmed)}`}
          />
          <Kpi
            label="사용제한 계좌"
            value={kpiRes.data.restrictedBalance}
            sub="정부/R&D 전용 — 가용현금 제외"
          />
        </div>
      ) : (
        <Spinner />
      )}

      {/* ── 자금 달력 — 계좌 잔액 위, 들어올 돈(초록)·나갈 돈(빨강)·입금 예정 등록 ── */}
      <CashCalendar onChanged={kpiRes.reload} />

      <div className="flex gap-0.5 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.key
                ? 'border-brand font-medium text-brand-deep'
                : 'border-transparent text-ink-mute hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'accounts' && (
        <>
          <AccountsTab onChanged={kpiRes.reload} />
          <PopbillPanel onChanged={kpiRes.reload} />
        </>
      )}
      {tab === 'inbox' && <InboxTab onChanged={kpiRes.reload} />}
      {tab === 'reserves' && <ReservesTab onChanged={kpiRes.reload} />}
      {tab === 'planned' && <PlannedTab onChanged={kpiRes.reload} />}
    </div>
  );
}

/* ───────────────────────── 자금 달력 ───────────────────────── */

/**
 * 자금 달력 — 실제 입금(초록)·출금(빨강)과 입금 예정(초록 점선)·지급 예정(빨강 점선)을 날짜별로 본다.
 * 날짜를 클릭하면 상세와 함께 "입금 예정(잔금일)" 등록 폼이 열린다 (예: 9/30 +500만 '계약 잔금').
 */
function CashCalendar({ onChanged }: { onChanged: () => void }) {
  const today = todaySeoul();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  /** 더블클릭으로 연 등록 팝업의 대상 날짜 */
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${month}-01`;
  const to = `${month}-${String(last).padStart(2, '0')}`;

  const txns = useAsync(
    () => api.get<BankTransaction[]>('/treasury/bank-transactions', { from, to, take: 500 }),
    [from, to],
  );
  const incomes = useAsync(() => api.get<PlannedIncome[]>('/treasury/planned-incomes', { from, to }), [from, to]);
  const payments = useAsync(() => api.get<PlannedPayment[]>('/treasury/planned-payments', { from, to }), [from, to]);

  const reloadAll = () => {
    txns.reload();
    incomes.reload();
    payments.reload();
    onChanged();
  };

  // 날짜별 개별 항목 — 금액 + 사유(프로젝트·거래처)를 한 줄 칩으로 보여준다
  type CalItem = { amt: bigint; dir: 'in' | 'out'; planned: boolean; label: string };
  const cleanLabel = (s: string) => s.replace(/\[수기\]\s*/g, '').replace(/^[A-Z_]{4,}\s*/, '').trim();
  const itemsByDay = new Map<string, CalItem[]>();
  const push = (k: string, it: CalItem) => {
    if (!itemsByDay.has(k)) itemsByDay.set(k, []);
    itemsByDay.get(k)!.push(it);
  };
  for (const t of txns.data ?? []) {
    push(seoulYmd(t.txnAt), {
      amt: big(t.amount),
      dir: t.direction === 'IN' ? 'in' : 'out',
      planned: false,
      label: cleanLabel(t.counterpartyRaw || t.descriptionRaw || t.bankAccount?.alias || ''),
    });
  }
  for (const p of incomes.data ?? [])
    push(p.dueDate.slice(0, 10), { amt: big(p.amount), dir: 'in', planned: true, label: p.title });
  for (const p of payments.data ?? [])
    push(p.dueDate.slice(0, 10), { amt: big(p.amount), dir: 'out', planned: true, label: p.title });
  for (const list of itemsByDay.values()) list.sort((a, b) => (b.amt > a.amt ? 1 : -1));

  const shift = (d: number) => {
    setMonth(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7));
    setSelected(null);
  };

  // 월요일 시작 그리드
  const firstDow = (new Date(`${from}T00:00:00+09:00`).getDay() + 6) % 7;
  const prevLast = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  const cells: { key?: string; day: number; muted?: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: prevLast - firstDow + 1 + i, muted: true });
  for (let d = 1; d <= last; d++) cells.push({ key: `${month}-${String(d).padStart(2, '0')}`, day: d });
  for (let nd = 1; cells.length % 7 !== 0; nd++) cells.push({ day: nd, muted: true });

  /** 들어올 예정 등록 — 날짜는 인라인 폼(selected)이나 더블클릭 팝업(modalDate)에서 온다 */
  const addIncome = async (date: string | null, closeModal = false) => {
    if (!date || !title.trim() || !amount) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/treasury/planned-incomes', { title: title.trim(), amount, dueDate: date });
      setTitle('');
      setAmount('');
      if (closeModal) setModalDate(null);
      reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  /** 더블클릭 — 그 날짜를 선택하고 등록 팝업을 연다 */
  const openRegister = (date: string) => {
    setSelected(date);
    setTitle('');
    setAmount('');
    setError('');
    setModalDate(date);
  };

  const cancelIncome = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/treasury/planned-incomes/${id}`, { status: 'CANCELLED' });
      reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '취소에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const dayIncomes = (incomes.data ?? []).filter((p) => p.dueDate.slice(0, 10) === selected);
  const dayPayments = (payments.data ?? []).filter((p) => p.dueDate.slice(0, 10) === selected);
  const dayTxns = (txns.data ?? []).filter((t) => seoulYmd(t.txnAt) === selected);

  return (
    <Section
      title="자금 달력"
      desc="들어올 돈은 초록, 나갈 돈은 빨강 · 점선은 예정 금액입니다. 날짜를 한 번 누르면 상세가 열리고, 더블클릭하면 입금 예정(잔금일) 등록창이 뜹니다."
      right={
        <span className="flex items-center gap-1.5">
          <button className="rounded-md px-2.5 py-1 text-lg leading-none text-ink-mute hover:bg-line-soft" onClick={() => shift(-1)} aria-label="이전 달">
            ‹
          </button>
          <span className="min-w-[132px] text-center text-xl font-bold tracking-tight">
            {y}년 {m}월
          </span>
          <button className="rounded-md px-2.5 py-1 text-lg leading-none text-ink-mute hover:bg-line-soft" onClick={() => shift(1)} aria-label="다음 달">
            ›
          </button>
          <button
            className="ml-1 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-line-soft"
            onClick={() => {
              setMonth(today.slice(0, 7));
              setSelected(today);
            }}
          >
            오늘
          </button>
        </span>
      }
    >
      <div className="px-4 pb-2 pt-3">
        <div className="mb-1.5 grid grid-cols-7 text-center">
          {['월', '화', '수', '목', '금', '토', '일'].map((w, i) => (
            <span key={w} className={`text-xs font-semibold ${i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-ink-mute'}`}>
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((c, i) => {
            const items = c.key ? (itemsByDay.get(c.key) ?? []) : [];
            const isSel = c.key === selected;
            const isToday = c.key === today;
            return (
              <button
                key={i}
                disabled={!c.key}
                onClick={() => c.key && setSelected(isSel ? null : c.key)}
                onDoubleClick={() => c.key && openRegister(c.key)}
                title={c.key ? '더블클릭하면 입금 예정 등록창이 열립니다' : undefined}
                className={`flex min-h-[108px] flex-col items-stretch gap-1 rounded-lg border-2 p-2 text-left transition-colors ${
                  isSel
                    ? 'border-brand bg-brand-soft shadow-sm'
                    : c.key
                      ? 'border-line bg-white hover:border-brand/60 hover:shadow-sm'
                      : 'border-line-soft/60 bg-line-soft/30'
                }`}
              >
                <span
                  className={`font-num text-sm font-semibold leading-none ${
                    c.muted
                      ? 'text-ink-faint/40'
                      : isToday
                        ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white'
                        : 'text-ink-soft'
                  }`}
                >
                  {c.day}
                </span>
                {items.length > 0 && (
                  <span className="flex flex-col gap-1">
                    {items.slice(0, 3).map((it, j) => (
                      <span
                        key={j}
                        className={`flex items-center gap-1 overflow-hidden whitespace-nowrap rounded-md px-1.5 py-0.5 leading-tight ${
                          it.planned
                            ? it.dir === 'in'
                              ? 'border-2 border-dashed border-emerald-400 bg-emerald-50/50'
                              : 'border-2 border-dashed border-red-300 bg-red-50/50'
                            : it.dir === 'in'
                              ? 'bg-emerald-100'
                              : 'bg-red-100'
                        }`}
                        title={`${it.dir === 'in' ? '+' : '-'}${num(it.amt)}원 · ${it.label}${it.planned ? ' (예정)' : ''}`}
                      >
                        <span
                          className={`shrink-0 font-num text-[13px] font-bold ${
                            it.dir === 'in' ? (it.planned ? 'text-emerald-600' : 'text-emerald-700') : it.planned ? 'text-red-500' : 'text-red-600'
                          }`}
                        >
                          {it.dir === 'in' ? '+' : '-'}
                          {compact(it.amt)}
                        </span>
                        <span className="truncate text-[11px] font-medium text-ink-soft">{it.label || '—'}</span>
                      </span>
                    ))}
                    {items.length > 3 && (
                      <span className="px-1 text-[11px] font-medium text-ink-faint">+{items.length - 3}건 더</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="mt-3 rounded-xl border border-line bg-line-soft/30 p-4">
            <p className="mb-2.5 text-sm font-semibold">
              {selected.replace(/-/g, '.')} <span className="font-normal text-ink-mute">상세</span>
            </p>
            <div className="space-y-1.5">
              {dayTxns.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink-soft">
                    {t.direction === 'IN' ? '입금' : '출금'} · {t.counterpartyRaw || t.descriptionRaw || t.bankAccount?.alias || '—'}
                  </span>
                  <span className={`font-num font-semibold ${t.direction === 'IN' ? 'text-pos' : 'text-neg'}`}>
                    {t.direction === 'IN' ? '+' : '-'}
                    {num(t.amount)}원
                  </span>
                </div>
              ))}
              {dayPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink-soft">
                    지급 예정 · {p.title}
                    <span className="ml-1 text-xs text-ink-faint">({p.kind === 'CONFIRMED' ? '확정' : '계획'})</span>
                  </span>
                  <span className="font-num text-neg/80">-{num(p.amount)}원</span>
                </div>
              ))}
              {dayIncomes.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-ink-soft">
                    들어올 예정 · {p.title}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-num font-medium text-emerald-600">+{num(p.amount)}원</span>
                    <button
                      className="text-xs text-ink-faint hover:text-neg"
                      onClick={() => cancelIncome(p.id)}
                      disabled={busy}
                      title="입금 예정 취소"
                    >
                      취소
                    </button>
                  </span>
                </div>
              ))}
              {dayTxns.length === 0 && dayPayments.length === 0 && dayIncomes.length === 0 && (
                <p className="text-xs text-ink-faint">이 날짜의 입출금·예정 내역이 없습니다.</p>
              )}
            </div>

            {/* 입금 예정 등록 — 잔금일에 +금액 */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="text-xs font-semibold text-emerald-700">+ 들어올 예정 등록</span>
              <input
                className="input w-44 !py-1.5 text-sm"
                placeholder="예: 계약 잔금"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
              />
              <div className="w-40">
                <MoneyInput value={amount} onChange={setAmount} disabled={busy} />
              </div>
              <button
                className="btn-primary !py-1.5 text-xs"
                onClick={() => addIncome(selected)}
                disabled={busy || !title.trim() || !amount}
              >
                {busy ? '등록 중…' : '등록'}
              </button>
              {error && !modalDate && <span className="text-xs text-neg">{error}</span>}
            </div>
          </div>
        )}
      </div>

      {/* 날짜 더블클릭 — 입금 예정 등록 팝업 */}
      <Modal
        open={!!modalDate}
        title="입금 예정 등록"
        desc={modalDate ? `${modalDate.replace(/-/g, '.')} 에 들어올 돈을 등록합니다` : undefined}
        onClose={() => setModalDate(null)}
      >
        <div className="space-y-3">
          <Field label="내용" required hint="예: 계약 잔금, 정부지원금 2차">
            <input
              className="input"
              autoFocus
              placeholder="예: 계약 잔금"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="금액" required>
            <MoneyInput value={amount} onChange={setAmount} disabled={busy} />
          </Field>
          {error && <p className="text-xs text-neg">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setModalDate(null)} disabled={busy}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={() => addIncome(modalDate, true)}
              disabled={busy || !title.trim() || !amount}
            >
              {busy ? '등록 중…' : '등록'}
            </button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

/* ───────────────────────── 계좌 ───────────────────────── */

function AccountsTab({ onChanged }: { onChanged: () => void }) {
  const { departments } = useSession();
  const res = useAsync(() => api.get<BankAccount[]>('/treasury/bank-accounts'), []);
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [alias, setAlias] = useState('');
  const [accountNoMasked, setAccountNoMasked] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isRestricted, setIsRestricted] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/treasury/bank-accounts', {
        bankName,
        alias,
        accountNoMasked: accountNoMasked || undefined,
        departmentId: departmentId || undefined,
        isRestricted,
        openingBalance: openingBalance || '0',
        openingDate: openingDate || undefined,
      });
      setOpen(false);
      setBankName('');
      setAlias('');
      setAccountNoMasked('');
      setOpeningBalance('');
      res.reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '계좌 등록에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section
        title="계좌 잔액"
        desc="잔액 = 기초잔액 + 입금 − 출금 (은행거래 원본 기준)"
        right={
          <button className="btn-ghost" onClick={() => setOpen(true)}>
            + 계좌 추가
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
                  <th className="th">계좌명</th>
                  <th className="th">은행</th>
                  <th className="th">계좌번호</th>
                  <th className="th">귀속부서</th>
                  <th className="th">용도</th>
                  <th className="th text-right">기초잔액</th>
                  <th className="th text-right">현재잔액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {(res.data ?? []).map((a) => (
                  <tr key={a.id} className="hover:bg-line-soft/60">
                    <td className="td font-medium">
                      {a.alias}
                      {a.isRestricted && <span className="badge ml-1.5 bg-amber-50 text-warn">제한</span>}
                    </td>
                    <td className="td text-ink-mute">{a.bankName}</td>
                    <td className="td font-num text-xs text-ink-mute">{a.accountNoMasked ?? '—'}</td>
                    <td className="td text-ink-mute">{a.department?.name ?? '—'}</td>
                    <td className="td text-xs text-ink-mute">{a.purpose}</td>
                    <td className="td-num text-ink-mute">{num(a.openingBalance)}</td>
                    <td className="td-num font-medium">{num(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal open={open} onClose={() => setOpen(false)} title="계좌 추가" wide>
        <div className="space-y-3.5">
          <div className="grid grid-cols-3 gap-3">
            <Field label="은행" required>
              <input className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </Field>
            <Field label="계좌명" required>
              <input className="input" value={alias} onChange={(e) => setAlias(e.target.value)} />
            </Field>
            <Field label="계좌번호(마스킹)">
              <input
                className="input font-num"
                value={accountNoMasked}
                onChange={(e) => setAccountNoMasked(e.target.value)}
                placeholder="***-**-1234"
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="귀속부서">
              <select
                className="input"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">공통</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="기초잔액" hint="이 날짜 이후 거래만 반영됩니다">
              <MoneyInput value={openingBalance} onChange={setOpeningBalance} />
            </Field>
            <Field label="기초일자">
              <input
                type="date"
                className="input"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isRestricted}
              onChange={(e) => setIsRestricted(e.target.checked)}
              className="accent-brand"
            />
            사용제한 계좌 (정부지원금·R&D 전용 → 가용현금에서 제외)
          </label>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              취소
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy || !bankName || !alias}>
              {busy ? '저장 중…' : '추가'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ───────────────── 은행거래 분류 (미분류 큐) ───────────────── */

function InboxTab({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState('UNCLASSIFIED');
  const res = useAsync(
    () => api.get<BankTransaction[]>('/treasury/bank-transactions', { status, take: 200 }),
    [status],
  );
  const [target, setTarget] = useState<BankTransaction | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [error, setError] = useState('');

  const ignore = async (t: BankTransaction) => {
    setError('');
    try {
      await api.post(`/treasury/bank-transactions/${t.id}/ignore`, { reason: '분류 제외' });
      res.reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다');
    }
  };

  return (
    <>
      <Section
        title="은행거래"
        desc="원본은 수정하지 않습니다. 분개를 만들어 연결하면 CLASSIFIED가 됩니다"
        right={
          <div className="flex gap-2">
            <select className="input w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="UNCLASSIFIED">미분류</option>
              <option value="CLASSIFIED">분류완료</option>
              <option value="IGNORED">제외</option>
              <option value="">전체</option>
            </select>
            <button className="btn-ghost" onClick={() => setImportOpen(true)}>
              거래 가져오기
            </button>
          </div>
        }
      >
        {error && <div className="px-4 pt-3 text-sm text-neg">{error}</div>}
        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : !res.data?.length ? (
          <Empty>
            {status === 'UNCLASSIFIED'
              ? '미분류 거래가 없습니다. 모두 정리되었습니다.'
              : '해당 상태의 거래가 없습니다.'}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">일시</th>
                  <th className="th">계좌</th>
                  <th className="th">구분</th>
                  <th className="th text-right">금액</th>
                  <th className="th">적요</th>
                  <th className="th">상태</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {res.data.map((t) => (
                  <tr key={t.id} className="hover:bg-line-soft/60">
                    <td className="td font-num text-xs">{dateTime(t.txnAt)}</td>
                    <td className="td text-ink-mute">{t.bankAccount?.alias ?? '—'}</td>
                    <td className="td">
                      <span className={`badge ${t.direction === 'IN' ? 'bg-emerald-50 text-pos' : 'bg-red-50 text-neg'}`}>
                        {t.direction === 'IN' ? '입금' : '출금'}
                      </span>
                    </td>
                    <td className={`td-num font-medium ${t.direction === 'IN' ? 'text-pos' : 'text-neg'}`}>
                      {num(t.amount)}
                    </td>
                    <td className="td max-w-[280px] truncate text-ink-mute">
                      {t.counterpartyRaw ? `${t.counterpartyRaw} · ` : ''}
                      {t.descriptionRaw ?? '—'}
                    </td>
                    <td className="td">
                      <StatusBadge
                        status={t.classification?.status ?? 'UNCLASSIFIED'}
                        label={CLASSIFICATION_LABEL[t.classification?.status ?? 'UNCLASSIFIED']}
                      />
                      {t.classification?.journalEntry && (
                        <span className="ml-1.5 font-num text-xs text-ink-faint">
                          #{t.classification.journalEntry.entryNo}
                        </span>
                      )}
                    </td>
                    <td className="td text-right">
                      {t.classification?.status === 'UNCLASSIFIED' && (
                        <span className="flex justify-end gap-1.5">
                          <button className="btn-primary !py-1 text-xs" onClick={() => setTarget(t)}>
                            분류
                          </button>
                          <button className="btn-ghost !py-1 text-xs" onClick={() => ignore(t)}>
                            제외
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <EntryFormModal
        open={!!target}
        bankTxn={target}
        onClose={() => setTarget(null)}
        onSaved={() => {
          res.reload();
          onChanged();
        }}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSaved={() => {
          res.reload();
          onChanged();
        }}
      />
    </>
  );
}

function ImportModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const accRes = useAsync(() => api.get<BankAccount[]>('/treasury/bank-accounts'), []);
  const [bankAccountId, setBankAccountId] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  /** 한 줄 = 일시,방향,금액,거래처,적요 */
  const parse = () => {
    const rows: Record<string, string>[] = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const c = line.split(',').map((s) => s.trim());
      if (c.length < 3) throw new Error(`형식 오류: "${line}"`);
      const dir = c[1].toUpperCase();
      if (dir !== 'IN' && dir !== 'OUT') throw new Error(`방향은 IN 또는 OUT: "${line}"`);
      const amount = c[2].replace(/[,\s]/g, '');
      if (!/^\d+$/.test(amount)) throw new Error(`금액은 양의 정수: "${line}"`);
      rows.push({
        txnAt: c[0].includes('T') ? c[0] : `${c[0]}T12:00:00+09:00`,
        direction: dir,
        amount,
        counterpartyRaw: c[3] ?? '',
        descriptionRaw: c[4] ?? '',
      });
    }
    if (!rows.length) throw new Error('가져올 행이 없습니다');
    return rows;
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    setResult('');
    try {
      const rows = parse();
      const r = await api.post<{ inserted: number; skipped: number }>(
        '/treasury/bank-transactions/import',
        { bankAccountId, rows },
      );
      setResult(`${r.inserted}건 추가 · ${r.skipped}건 중복 제외`);
      setText('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '가져오기에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="은행거래 가져오기"
      desc="한 줄에 한 건씩 붙여넣으세요. 원본은 이후 수정되지 않습니다."
    >
      <div className="space-y-3.5">
        <Field label="계좌" required>
          <select
            className="input"
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
          >
            <option value="">선택하세요</option>
            {(accRes.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.alias} ({a.bankName})
              </option>
            ))}
          </select>
        </Field>

        <Field label="거래 내역" hint="일시,방향(IN/OUT),금액,거래처,적요">
          <textarea
            className="input h-40 font-num text-xs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'2026-08-01,IN,5500000,A고객사,계약금 입금\n2026-08-03,OUT,1200000,B업체,외주비'}
          />
        </Field>

        {result && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-pos">
            {result}
          </div>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={onClose}>
            닫기
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy || !bankAccountId || !text.trim()}>
            {busy ? '가져오는 중…' : '가져오기'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────── 경영유보금 ───────────────────── */

function ReservesTab({ onChanged }: { onChanged: () => void }) {
  const { codesOf, labelOf } = useSession();
  const res = useAsync(() => api.get<Reserve[]>('/treasury/reserves'), []);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('RISK');
  const [purpose, setPurpose] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [move, setMove] = useState<{ r: Reserve; type: 'INCREASE' | 'RELEASE' } | null>(null);
  const [moveAmount, setMoveAmount] = useState('');
  const [moveReason, setMoveReason] = useState('');

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/treasury/reserves', { category, purpose, amount, reason: reason || undefined });
      setOpen(false);
      setPurpose('');
      setAmount('');
      setReason('');
      res.reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const doMove = async () => {
    if (!move) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/treasury/reserves/${move.r.id}/move`, {
        type: move.type,
        amount: moveAmount,
        reason: moveReason,
      });
      setMove(null);
      setMoveAmount('');
      setMoveReason('');
      res.reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section
        title="경영유보금"
        desc="회계 계정이 아니라 관리지표입니다. 설정하면 가용현금에서 빠집니다"
        right={
          <button className="btn-ghost" onClick={() => setOpen(true)}>
            + 유보금 설정
          </button>
        }
      >
        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : !res.data?.length ? (
          <Empty>설정된 유보금이 없습니다.</Empty>
        ) : (
          <ul className="divide-y divide-line-soft">
            {res.data.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge bg-brand-soft text-brand-deep">
                    {labelOf('RESERVE_CATEGORY', r.category)}
                  </span>
                  <span className="text-sm font-medium">{r.purpose}</span>
                  <StatusBadge status={r.status === 'ACTIVE' ? 'ACTIVE' : 'CANCELLED'} label={r.status === 'ACTIVE' ? '활성' : '해제됨'} />
                  <span className="ml-auto font-num text-sm font-semibold">{num(r.amount)}원</span>
                  {r.status === 'ACTIVE' && (
                    <span className="flex gap-1.5">
                      <button
                        className="btn-ghost !py-1 text-xs"
                        onClick={() => setMove({ r, type: 'INCREASE' })}
                      >
                        증액
                      </button>
                      <button
                        className="btn-ghost !py-1 text-xs"
                        onClick={() => setMove({ r, type: 'RELEASE' })}
                      >
                        해제
                      </button>
                    </span>
                  )}
                </div>
                {r.movements.length > 0 && (
                  <ul className="mt-2 space-y-0.5 border-l-2 border-line pl-3 text-xs text-ink-faint">
                    {r.movements.slice(0, 4).map((m) => (
                      <li key={m.id}>
                        <span className="font-num">{m.createdAt.slice(0, 10)}</span> · {m.type} {num(m.amount)}
                        {m.reason ? ` · ${m.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Modal open={open} onClose={() => setOpen(false)} title="유보금 설정">
        <div className="space-y-3.5">
          <Field label="분류" required>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {codesOf('RESERVE_CATEGORY').map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="목적" required>
            <input
              className="input"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="예: 2026 상반기 리스크 대응"
            />
          </Field>
          <Field label="금액" required>
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="사유">
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <div className="text-sm text-neg">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              취소
            </button>
            <button className="btn-primary" onClick={create} disabled={busy || !purpose || !amount}>
              설정
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!move}
        onClose={() => setMove(null)}
        title={move?.type === 'RELEASE' ? '유보금 해제' : '유보금 증액'}
        desc={
          move?.type === 'RELEASE'
            ? '해제하면 가용현금이 늘어납니다. 실제 지급은 별도 거래로 기록하세요.'
            : undefined
        }
      >
        <div className="space-y-3.5">
          {move && (
            <div className="rounded-md bg-line-soft/60 px-3 py-2 text-xs">
              <span className="text-ink-mute">{move.r.purpose} · 현재 </span>
              <span className="font-num font-medium">{num(move.r.amount)}원</span>
            </div>
          )}
          <Field label="금액" required>
            <MoneyInput value={moveAmount} onChange={setMoveAmount} />
          </Field>
          <Field label="사유" required>
            <input className="input" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
          </Field>
          {error && <div className="text-sm text-neg">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button className="btn-ghost" onClick={() => setMove(null)}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={doMove}
              disabled={busy || !moveAmount || !moveReason.trim()}
            >
              확인
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ───────────────────── 지급예정자금 ───────────────────── */

function PlannedTab({ onChanged }: { onChanged: () => void }) {
  const { codesOf, labelOf, departments } = useSession();
  const res = useAsync(() => api.get<PlannedPayment[]>('/treasury/planned-payments'), []);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'CONFIRMED' | 'PLANNED'>('CONFIRMED');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/treasury/planned-payments', {
        kind,
        title,
        category: category || undefined,
        amount,
        dueDate,
        departmentId: departmentId || undefined,
      });
      setOpen(false);
      setTitle('');
      setAmount('');
      setDueDate('');
      res.reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (p: PlannedPayment) => {
    try {
      await api.patch(`/treasury/planned-payments/${p.id}`, { status: 'PAID' });
      res.reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리에 실패했습니다');
    }
  };

  return (
    <>
      <Section
        title="지급예정자금"
        desc="확정(CONFIRMED)만 가용현금에서 차감됩니다. 계획(PLANNED)은 예측에만 반영됩니다"
        right={
          <button className="btn-ghost" onClick={() => setOpen(true)}>
            + 지급예정 등록
          </button>
        }
      >
        {error && <div className="px-4 pt-3 text-sm text-neg">{error}</div>}
        {res.loading && !res.data ? (
          <Spinner />
        ) : res.error ? (
          <ErrorBox message={res.error} onRetry={res.reload} />
        ) : !res.data?.length ? (
          <Empty>예정된 지급이 없습니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">지급일</th>
                  <th className="th">구분</th>
                  <th className="th">항목</th>
                  <th className="th">분류</th>
                  <th className="th">부서 / 프로젝트</th>
                  <th className="th text-right">금액</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {res.data.map((p) => (
                  <tr key={p.id} className="hover:bg-line-soft/60">
                    <td className="td font-num text-xs">{p.dueDate.slice(0, 10)}</td>
                    <td className="td">
                      <StatusBadge
                        status={p.kind}
                        label={p.kind === 'CONFIRMED' ? '확정' : '계획'}
                      />
                    </td>
                    <td className="td font-medium">{p.title}</td>
                    <td className="td text-ink-mute">
                      {p.category ? labelOf('PLANNED_CATEGORY', p.category) : '—'}
                    </td>
                    <td className="td text-ink-mute">
                      {[p.department?.name, p.project?.name].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className={`td-num font-medium ${signClass(`-${p.amount}`)}`}>{num(p.amount)}</td>
                    <td className="td text-right">
                      <button className="btn-ghost !py-1 text-xs" onClick={() => markPaid(p)}>
                        지급완료
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Modal open={open} onClose={() => setOpen(false)} title="지급예정 등록" wide>
        <div className="space-y-3.5">
          <div className="grid grid-cols-3 gap-3">
            <Field label="구분" required>
              <select
                className="input"
                value={kind}
                onChange={(e) => setKind(e.target.value as 'CONFIRMED' | 'PLANNED')}
              >
                <option value="CONFIRMED">확정 — 가용현금 차감</option>
                <option value="PLANNED">계획 — 예측만</option>
              </select>
            </Field>
            <Field label="지급일" required>
              <input
                type="date"
                className="input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
            <Field label="금액" required>
              <MoneyInput value={amount} onChange={setAmount} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Field label="항목" required>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
            </div>
            <Field label="분류">
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">미지정</option>
                {codesOf('PLANNED_CATEGORY').map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
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
          </div>
          {error && <div className="text-sm text-neg">{error}</div>}
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button className="btn-ghost" onClick={() => setOpen(false)}>
              취소
            </button>
            <button
              className="btn-primary"
              onClick={create}
              disabled={busy || !title || !amount || !dueDate}
            >
              등록
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
