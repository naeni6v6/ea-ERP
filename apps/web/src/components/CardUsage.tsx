'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { big, compact, num, thisMonthSeoul } from '@/lib/format';
import { CardBrandMark, maskedNumber } from '@/components/CardBrand';
import { categoryColor } from '@/components/charts';
import { Empty, ErrorBox, Section, Spinner } from '@/components/ui';
import type { CardExpenseList, CorporateCard } from '@/lib/types';

const lastDayOf = (ym: string): number =>
  new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
const monthLabel = (ym: string): string => `${Number(ym.slice(5, 7))}월`;

type Mode = '용도' | '가맹점';

/**
 * 카드별 사용 현황 — 왼쪽 카드 목록(사용액 순)에서 고르면 오른쪽에 그 카드의 이번 달 상세가 열린다.
 * 발급사는 브랜드 마크로 구분한다.
 */
export function CardUsage({ cards }: { cards: CorporateCard[] }) {
  const ym = thisMonthSeoul();
  const from = `${ym}-01`;
  const to = `${ym}-${String(lastDayOf(ym)).padStart(2, '0')}`;

  const res = useAsync(
    () => api.get<CardExpenseList>('/cards/expenses', { from, to, take: 1000 }),
    [from, to],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('용도');

  if (res.loading && !res.data) return <Spinner />;
  if (res.error) return <ErrorBox message={res.error} onRetry={res.reload} />;

  const rows = (res.data?.rows ?? []).filter((e) => !e.isCancelled && e.status !== 'EXCLUDED');

  // 카드별 이번 달 사용액
  const usage = new Map<string, bigint>();
  for (const e of rows) usage.set(e.cardId, (usage.get(e.cardId) ?? 0n) + big(e.amount));
  const total = [...usage.values()].reduce((a, v) => a + v, 0n);

  const ranked = [...cards]
    .filter((c) => c.isActive)
    .sort((a, b) => {
      const d = (usage.get(b.id) ?? 0n) - (usage.get(a.id) ?? 0n);
      return d > 0n ? 1 : d < 0n ? -1 : a.name.localeCompare(b.name);
    });

  if (!ranked.length) return <Empty>등록된 카드가 없습니다.</Empty>;

  const selected = ranked.find((c) => c.id === selectedId) ?? ranked[0];
  const selectedUsed = usage.get(selected.id) ?? 0n;
  const selectedRows = rows.filter((e) => e.cardId === selected.id);

  // 선택 카드의 이번 달 내역 — 용도 또는 가맹점 기준 집계
  const byKey = new Map<string, bigint>();
  for (const e of selectedRows) {
    const k = mode === '용도' ? e.purposeText || '용도 미입력' : e.storeName || '가맹점 미상';
    byKey.set(k, (byKey.get(k) ?? 0n) + big(e.amount));
  }
  const detail = [...byKey.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));
  const detailMax = detail[0]?.[1] ?? 1n;

  const shareOf = (v: bigint) => (total > 0n ? Number((v * 1000n) / total) / 10 : 0);

  return (
    <Section title="카드별 사용 현황" desc={`${monthLabel(ym)} 기준 · 사용액이 많은 카드부터`}>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        {/* ── 왼쪽: 카드 목록 ── */}
        <div className="max-h-[420px] overflow-y-auto rounded-xl border border-line">
          <div className="sticky top-0 border-b border-line bg-line-soft/80 px-3 py-2 text-xs font-semibold text-ink-mute backdrop-blur">
            사용액 상위 카드
          </div>
          <ul className="divide-y divide-line-soft">
            {ranked.map((c) => {
              const used = usage.get(c.id) ?? 0n;
              const active = c.id === selected.id;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    aria-current={active}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      active ? 'border-l-2 border-brand bg-brand-soft/60' : 'border-l-2 border-transparent hover:bg-line-soft/60'
                    }`}
                  >
                    <CardBrandMark issuer={c.issuer} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {c.issuer}
                        {c.last4 ? ` ${c.last4}` : ''}
                        {c.holder ? ` · ${c.holder.name}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-num text-sm font-semibold">{compact(used)}원</span>
                      <span className="block font-num text-xs text-ink-faint">{shareOf(used).toFixed(0)}%</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── 오른쪽: 선택 카드 상세 ── */}
        <div className="rounded-xl border border-line">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
            <CardBrandMark issuer={selected.issuer} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{selected.name}</p>
              <p className="font-num text-xs text-ink-faint">{maskedNumber(selected.last4)}</p>
            </div>
            <span className="badge bg-line-soft text-ink-mute">
              {selected.cardType === 'CHECK' ? '체크' : '신용'}
            </span>
          </div>

          <div className="grid grid-cols-3 divide-x divide-line-soft border-b border-line">
            {(
              [
                [`${monthLabel(ym)} 사용액`, `${num(selectedUsed)}원`],
                ['전체 카드 대비', `${shareOf(selectedUsed).toFixed(0)}%`],
                ['미제출', `${selected.pendingCount}건`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="px-4 py-3">
                <p className="text-xs text-ink-mute">{k}</p>
                <p className="mt-0.5 font-num text-lg font-bold">{v}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <p className="text-sm font-semibold">{monthLabel(ym)} 사용 내역</p>
            <div className="flex gap-0.5 text-xs">
              {(['용도', '가맹점'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-2.5 py-1 transition-colors ${
                    mode === m ? 'bg-brand-soft font-semibold text-brand-deep' : 'text-ink-mute hover:text-ink'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {detail.length === 0 ? (
            <Empty>{monthLabel(ym)} 사용 내역이 없습니다.</Empty>
          ) : (
            <ul className="space-y-2.5 px-4 py-3">
              {detail.slice(0, 6).map(([label, v], i) => (
                <li key={label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: categoryColor(i) }}
                    />
                    <span className="truncate text-sm">{label}</span>
                  </span>
                  <span className="font-num text-sm font-medium" title={`${num(v)}원`}>
                    {compact(v)}원
                  </span>
                  <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${detailMax > 0n ? Number((v * 100n) / detailMax) : 0}%`,
                        background: categoryColor(i),
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
