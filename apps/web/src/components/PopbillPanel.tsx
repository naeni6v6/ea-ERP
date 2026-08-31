'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { dateTime } from '@/lib/format';
import { Empty, ErrorBox, Field, Modal, Section, Spinner } from '@/components/ui';
import type { BankAccount, PopbillStatus, PopbillSyncResult } from '@/lib/types';

/** 팝빌 기관코드 — 자주 쓰는 은행만. 목록에 없으면 직접 입력한다. */
const BANK_CODES: [string, string][] = [
  ['0002', '산업은행'],
  ['0003', 'IBK기업은행'],
  ['0004', 'KB국민은행'],
  ['0007', '수협은행'],
  ['0011', 'NH농협은행'],
  ['0020', '우리은행'],
  ['0023', 'SC제일은행'],
  ['0027', '한국씨티은행'],
  ['0031', '대구은행'],
  ['0032', '부산은행'],
  ['0034', '광주은행'],
  ['0035', '제주은행'],
  ['0037', '전북은행'],
  ['0039', '경남은행'],
  ['0045', '새마을금고'],
  ['0048', '신협'],
  ['0071', '우체국'],
  ['0081', '하나은행'],
  ['0088', '신한은행'],
  ['0089', '케이뱅크'],
  ['0090', '카카오뱅크'],
  ['0092', '토스뱅크'],
];

/**
 * 팝빌 계좌조회 연동 — 은행 거래내역 자동 수집.
 * 계좌 등록(은행 인증)은 팝빌 화면에서 하고, 여기서는 우리 계좌와 매핑한 뒤 동기화만 돌린다.
 * 팝빌이 주는 거래 고유값(tid)을 그대로 쓰기 때문에 같은 기간을 여러 번 받아도 중복이 생기지 않는다.
 */
export function PopbillPanel({ onChanged }: { onChanged: () => void }) {
  const statusRes = useAsync(() => api.get<PopbillStatus>('/treasury/popbill/status'), []);
  const accRes = useAsync(() => api.get<BankAccount[]>('/treasury/bank-accounts'), []);

  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [bankCode, setBankCode] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const st = statusRes.data;

  const openEditor = (a: BankAccount) => {
    setEditing(a);
    setBankCode(a.popbillBankCode ?? '');
    setAccountNo(a.popbillAccountNumber ?? '');
    setError('');
  };

  const saveMapping = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      await api.patch(`/treasury/bank-accounts/${editing.id}`, {
        popbillBankCode: bankCode || null,
        popbillAccountNumber: accountNo.replace(/\D/g, '') || null,
      });
      setEditing(null);
      accRes.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const openPopbill = async () => {
    setError('');
    setNotice('');
    try {
      const r = await api.get<{ url: string | null }>('/treasury/popbill/manage-url');
      if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer');
      else setError('팝빌 관리 페이지 주소를 받지 못했습니다.');
    } catch (e) {
      setError(e instanceof Error ? e.message : '팝빌 페이지를 열지 못했습니다');
    }
  };

  const syncOne = async (a: BankAccount) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await api.post<PopbillSyncResult>(`/treasury/bank-accounts/${a.id}/popbill-sync`, {});
      setNotice(`${a.alias}: 조회 ${r.total ?? 0}건 · 새로 추가 ${r.inserted ?? 0}건 · 이미 있음 ${r.skipped ?? 0}건`);
      accRes.reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '동기화에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  const syncAll = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await api.post<{ results: PopbillSyncResult[] }>('/treasury/popbill/sync', {});
      const ok = r.results.filter((x) => !x.error);
      const added = ok.reduce((a, x) => a + (x.inserted ?? 0), 0);
      const failed = r.results.filter((x) => x.error);
      setNotice(`계좌 ${ok.length}개 동기화 · 새로 추가 ${added}건${failed.length ? ` · 실패 ${failed.length}건` : ''}`);
      if (failed.length) setError(failed.map((f) => `${f.alias}: ${f.error}`).join(' / '));
      accRes.reload();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : '동기화에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  if (statusRes.loading && !st) return <Spinner />;
  if (statusRes.error) return <ErrorBox message={statusRes.error} onRetry={statusRes.reload} />;

  const accounts = (accRes.data ?? []).filter((a) => a.isActive);
  const linked = accounts.filter((a) => a.popbillBankCode && a.popbillAccountNumber);

  return (
    <Section
      title="팝빌 계좌 자동수집"
      desc="은행 거래내역을 팝빌에서 자동으로 받아옵니다. 같은 기간을 다시 받아도 중복 저장되지 않습니다"
      right={
        <span className="flex items-center gap-2">
          <button className="btn-ghost !py-1.5 text-xs" onClick={openPopbill} disabled={!st?.configured}>
            팝빌에서 계좌 등록 ↗
          </button>
          <button
            className="btn-primary !py-1.5 text-xs"
            onClick={syncAll}
            disabled={busy || !st?.configured || linked.length === 0}
          >
            {busy ? '동기화 중…' : '전체 동기화'}
          </button>
        </span>
      }
    >
      <div className="space-y-3 px-4 py-4">
        {!st?.configured ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-warn">
            팝빌 연동이 설정되지 않았습니다. <code className="font-num text-xs">apps/api/.env</code> 의 POPBILL_* 값을 채운 뒤 API 서버를 다시 시작하세요.
          </div>
        ) : (
          <p className="text-xs text-ink-mute">
            연동 상태: 정상 · 사업자번호 <span className="font-num">{st.corpNum}</span>
            {st.isTest && <span className="badge ml-1.5 bg-amber-50 text-warn">테스트 환경</span>}
          </p>
        )}

        {notice && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-pos">{notice}</div>
        )}
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">{error}</div>}

        {st?.configured && linked.length === 0 && (
          <div className="rounded-lg bg-line-soft/70 px-3 py-2.5 text-xs leading-relaxed text-ink-mute">
            <b className="text-ink-soft">아직 연결된 계좌가 없습니다.</b> 먼저 <b>[팝빌에서 계좌 등록]</b>으로 팝빌 화면에서 은행 계좌를 등록하세요(은행 인증정보는 팝빌에 직접 입력합니다). 그다음 아래 표에서 계좌마다 기관코드·계좌번호를 연결하면 동기화할 수 있습니다.
          </div>
        )}

        {accRes.loading && !accRes.data ? (
          <Spinner />
        ) : !accounts.length ? (
          <Empty>등록된 계좌가 없습니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">계좌</th>
                  <th className="th">팝빌 연결</th>
                  <th className="th">마지막 동기화</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {accounts.map((a) => {
                  const isLinked = !!(a.popbillBankCode && a.popbillAccountNumber);
                  return (
                    <tr key={a.id}>
                      <td className="td">
                        <span className="font-medium">{a.alias}</span>
                        <span className="ml-1.5 text-xs text-ink-mute">{a.bankName}</span>
                      </td>
                      <td className="td">
                        {isLinked ? (
                          <span className="font-num text-xs text-ink-soft">
                            {BANK_CODES.find(([c]) => c === a.popbillBankCode)?.[1] ?? a.popbillBankCode} ·{' '}
                            {a.popbillAccountNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-faint">미연결</span>
                        )}
                      </td>
                      <td className="td text-xs text-ink-mute">
                        {a.popbillSyncedAt ? dateTime(a.popbillSyncedAt) : '—'}
                      </td>
                      <td className="td text-right">
                        <span className="flex justify-end gap-1.5">
                          <button className="btn-ghost !py-1 text-xs" onClick={() => openEditor(a)} disabled={busy}>
                            {isLinked ? '연결 수정' : '연결'}
                          </button>
                          <button
                            className="btn-ghost !py-1 text-xs"
                            onClick={() => syncOne(a)}
                            disabled={busy || !isLinked || !st?.configured}
                          >
                            동기화
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={!!editing}
        title="팝빌 계좌 연결"
        desc={editing ? `${editing.alias} (${editing.bankName})` : undefined}
        onClose={() => setEditing(null)}
      >
        <div className="space-y-3">
          <Field label="기관코드" required hint="팝빌에 등록한 은행과 같아야 합니다">
            <select className="input" value={bankCode} onChange={(e) => setBankCode(e.target.value)} disabled={busy}>
              <option value="">선택하세요</option>
              {BANK_CODES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name} ({code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="계좌번호" required hint="하이픈 없이 숫자만">
            <input
              className="input font-num"
              inputMode="numeric"
              placeholder="12345678901234"
              value={accountNo}
              onChange={(e) => setAccountNo(e.target.value.replace(/\D/g, ''))}
              disabled={busy}
            />
          </Field>
          {error && <p className="text-xs text-neg">{error}</p>}
          <div className="flex justify-between gap-2 pt-1">
            <button
              className="btn-ghost text-xs text-ink-faint"
              onClick={() => {
                setBankCode('');
                setAccountNo('');
              }}
              disabled={busy}
            >
              연결 해제
            </button>
            <span className="flex gap-2">
              <button className="btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
                취소
              </button>
              <button className="btn-primary" onClick={saveMapping} disabled={busy}>
                {busy ? '저장 중…' : '저장'}
              </button>
            </span>
          </div>
        </div>
      </Modal>
    </Section>
  );
}
