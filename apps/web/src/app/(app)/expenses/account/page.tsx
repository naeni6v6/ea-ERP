'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { big, dateTime, num } from '@/lib/format';
import { Empty, ErrorBox, Section, Spinner, StatusBadge } from '@/components/ui';
import type { BankAccount, BankTransaction } from '@/lib/types';

/**
 * 지출 > 계좌 — 은행 계좌 입출금 내역. 기본은 출금(지출)만 보여주고,
 * 계좌·방향 필터로 좁혀 본다. 자금 정보라서 대표 전용.
 */
export default function AccountExpensesPage() {
  const { isCeo } = useSession();
  const [direction, setDirection] = useState<'OUT' | 'IN' | ''>('OUT');
  const [accountId, setAccountId] = useState('');

  const accounts = useAsync(() => (isCeo ? api.get<BankAccount[]>('/treasury/bank-accounts') : Promise.resolve(null)), [isCeo]);
  const res = useAsync(
    () =>
      isCeo
        ? api.get<BankTransaction[]>('/treasury/bank-transactions', {
            direction: direction || undefined,
            bankAccountId: accountId || undefined,
            take: 200,
          })
        : Promise.resolve(null),
    [isCeo, direction, accountId],
  );

  if (!isCeo)
    return (
      <div className="card-pad mx-auto max-w-sm text-center text-sm">
        <p className="font-medium">계좌 지출은 대표만 볼 수 있습니다</p>
        <p className="mt-1 text-ink-mute">카드 지출은 좌측 메뉴의 지출 → 카드에서 확인하세요.</p>
      </div>
    );

  const rows = res.data ?? [];
  const outSum = rows.filter((t) => t.direction === 'OUT').reduce((a, t) => a + big(t.amount), 0n);
  const inSum = rows.filter((t) => t.direction === 'IN').reduce((a, t) => a + big(t.amount), 0n);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">계좌 지출</h1>
          <p className="mt-0.5 text-xs text-ink-faint">
            은행 계좌 입출금 내역 · 최근 {rows.length}건
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
            className="input w-28"
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'OUT' | 'IN' | '')}
          >
            <option value="OUT">출금만</option>
            <option value="IN">입금만</option>
            <option value="">입·출금 전체</option>
          </select>
        </div>
      </div>

      <Section title="내역" desc="거래 분류(장부 반영)는 자금 → 거래 인박스에서 처리합니다">
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
                  <th className="th">분류</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((t) => (
                  <tr key={t.id} className="hover:bg-line-soft/60">
                    <td className="td font-num text-xs text-ink-mute">{dateTime(t.txnAt)}</td>
                    <td className="td text-xs text-ink-mute">
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
                    <td className={`td-num font-medium ${t.direction === 'OUT' ? 'text-neg' : 'text-pos'}`}>
                      {t.direction === 'OUT' ? '-' : '+'}
                      {num(t.amount)}
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
