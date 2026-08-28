'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useFilters } from '@/lib/filters';
import { resolveRange } from '@/lib/dateRange';
import { useAsync } from '@/lib/useAsync';
import { big, num } from '@/lib/format';
import { EntryFormModal } from '@/components/EntryFormModal';
import { Empty, ErrorBox, Modal, Section, Spinner, StatusBadge } from '@/components/ui';
import type { EntryType, JournalEntry } from '@/lib/types';

/** 거래 1건의 대표 금액 = 차변 합계 (균형 분개이므로 대변 합계와 같다) */
const entryAmount = (e: JournalEntry): bigint => e.lines.reduce((a, l) => a + big(l.debit), 0n);

/** 라인들에서 손익 성격 태그를 뽑아 목록에서 한눈에 보이게 */
const plTag = (e: JournalEntry): { label: string; cls: string } | null => {
  const rev = e.lines.find((l) => l.account?.category === 'REVENUE');
  if (rev) return { label: '매출', cls: 'bg-brand-soft text-brand-deep' };
  const exp = e.lines.find((l) => l.account?.category === 'EXPENSE');
  if (exp)
    return exp.account?.plSection === 'COGS'
      ? { label: '매출원가', cls: 'bg-amber-50 text-warn' }
      : { label: '판관비', cls: 'bg-line-soft text-ink-mute' };
  return null;
};

export default function JournalPage() {
  const f = useFilters();
  const range = resolveRange(f.preset, f.from, f.to);
  const [type, setType] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<JournalEntry | null>(null);
  const [voidTarget, setVoidTarget] = useState<JournalEntry | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState('');

  const typesRes = useAsync(() => api.get<EntryType[]>('/journal/entry-types'), []);
  const listRes = useAsync(
    () =>
      api.get<{ total: number; rows: JournalEntry[] }>('/journal', {
        from: range.from,
        to: range.to,
        type: type || undefined,
        businessTypeId: f.businessTypeId || undefined,
        departmentId: f.departmentId || undefined,
        projectId: f.projectId || undefined,
        take: 100,
      }),
    [range.from, range.to, type, f.businessTypeId, f.departmentId, f.projectId],
  );

  const typeLabel = (t: string) => typesRes.data?.find((x) => x.type === t)?.label ?? t;

  const doVoid = async () => {
    if (!voidTarget) return;
    setVoidBusy(true);
    setVoidError('');
    try {
      await api.post(`/journal/${voidTarget.id}/void`, { reason: voidReason });
      setVoidTarget(null);
      setVoidReason('');
      setDetail(null);
      listRes.reload();
    } catch (e) {
      setVoidError(e instanceof Error ? e.message : '취소에 실패했습니다');
    } finally {
      setVoidBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title">거래</h1>
          <p className="mt-0.5 font-num text-xs text-ink-faint">
            {range.from} ~ {range.to}
            {listRes.data ? ` · ${listRes.data.total}건` : ''}
          </p>
        </div>
        <button className="btn-primary" onClick={() => setFormOpen(true)}>
          + 거래 등록
        </button>
      </div>

      <Section
        title="거래 목록"
        desc="취소는 VOID로만 처리되며 원본은 남습니다"
        right={
          <select className="input w-44" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">모든 유형</option>
            {(typesRes.data ?? []).map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        }
      >
        {listRes.loading && !listRes.data ? (
          <Spinner />
        ) : listRes.error ? (
          <ErrorBox message={listRes.error} onRetry={listRes.reload} />
        ) : !listRes.data?.rows.length ? (
          <Empty>해당 조건의 거래가 없습니다.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-line-soft">
                <tr>
                  <th className="th">번호</th>
                  <th className="th">일자</th>
                  <th className="th">유형</th>
                  <th className="th">구분</th>
                  <th className="th">거래처</th>
                  <th className="th">사업 / 부서 / 프로젝트</th>
                  <th className="th">적요</th>
                  <th className="th text-right">금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {listRes.data.rows.map((e) => {
                  const tag = plTag(e);
                  const dims = e.lines.find(
                    (l) => l.businessType || l.department || l.project,
                  );
                  return (
                    <tr
                      key={e.id}
                      className="cursor-pointer hover:bg-line-soft/60"
                      onClick={() => setDetail(e)}
                    >
                      <td className="td font-num text-xs text-ink-faint">#{e.entryNo}</td>
                      <td className="td font-num text-xs">{e.entryDate.slice(0, 10)}</td>
                      <td className="td">{typeLabel(e.type)}</td>
                      <td className="td">
                        {tag && <span className={`badge ${tag.cls}`}>{tag.label}</span>}
                      </td>
                      <td className="td text-ink-mute">{e.partner?.name ?? '—'}</td>
                      <td className="td text-xs text-ink-mute">
                        {[dims?.businessType?.name, dims?.department?.name, dims?.project?.name]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="td max-w-[220px] truncate text-ink-mute">{e.memo ?? '—'}</td>
                      <td className="td-num font-medium">{num(entryAmount(e))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <EntryFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={listRes.reload} />

      {/* 거래 상세 — 분개 라인 전체 */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        wide
        title={detail ? `거래 #${detail.entryNo} · ${typeLabel(detail.type)}` : ''}
        desc={detail ? `${detail.entryDate.slice(0, 10)} · ${detail.source}` : undefined}
      >
        {detail && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                <span className="text-ink-mute">상태 </span>
                <StatusBadge status={detail.status} />
              </span>
              <span>
                <span className="text-ink-mute">거래처 </span>
                {detail.partner?.name ?? '—'}
              </span>
              <span>
                <span className="text-ink-mute">적요 </span>
                {detail.memo ?? '—'}
              </span>
            </div>

            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full">
                <thead className="border-b border-line bg-line-soft/60">
                  <tr>
                    <th className="th">계정과목</th>
                    <th className="th">구분</th>
                    <th className="th">사업 / 부서 / 프로젝트</th>
                    <th className="th text-right">차변</th>
                    <th className="th text-right">대변</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {detail.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="td">
                        <span className="font-num text-xs text-ink-faint">{l.account?.code}</span>{' '}
                        {l.account?.name}
                      </td>
                      <td className="td text-xs text-ink-mute">
                        {l.account?.plSection !== 'NONE' ? l.account?.plSection : l.account?.category}
                      </td>
                      <td className="td text-xs text-ink-mute">
                        {[l.businessType?.name, l.department?.name, l.project?.name]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                      <td className="td-num">{big(l.debit) ? num(l.debit) : ''}</td>
                      <td className="td-num">{big(l.credit) ? num(l.credit) : ''}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line bg-line-soft/60">
                  <tr>
                    <td className="td font-medium" colSpan={3}>
                      합계
                    </td>
                    <td className="td-num font-semibold">
                      {num(detail.lines.reduce((a, l) => a + big(l.debit), 0n))}
                    </td>
                    <td className="td-num font-semibold">
                      {num(detail.lines.reduce((a, l) => a + big(l.credit), 0n))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-3">
              {detail.status === 'POSTED' && (
                <button className="btn-danger" onClick={() => setVoidTarget(detail)}>
                  거래 취소(VOID)
                </button>
              )}
              <button className="btn-ghost" onClick={() => setDetail(null)}>
                닫기
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 취소 사유 */}
      <Modal
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title="거래 취소"
        desc="삭제가 아니라 VOID 처리됩니다. 수기 은행거래는 반대 거래가 추가되어 잔액이 되돌아갑니다."
      >
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="void-reason">
              취소 사유 <span className="text-neg">*</span>
            </label>
            <input
              id="void-reason"
              className="input"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="예: 금액 오입력"
              autoFocus
            />
          </div>
          {voidError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-neg">
              {voidError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setVoidTarget(null)} disabled={voidBusy}>
              돌아가기
            </button>
            <button className="btn-danger" onClick={doVoid} disabled={!voidReason.trim() || voidBusy}>
              {voidBusy ? '처리 중…' : '취소 확정'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
