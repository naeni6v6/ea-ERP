'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { big, num, seoulYmd, thisMonthSeoul } from '@/lib/format';
import { MoneyInput } from '@/components/MoneyInput';
import { ErrorBox, PencilButton, Section, Spinner } from '@/components/ui';
import type { CardExpenseList } from '@/lib/types';

/**
 * 이번 달 항목별 지출 한도 — 항목(식비·접대비…)마다 한도와 남은 금액을 본다.
 * 한도 금액은 아직 확정 전이라 화면(브라우저)에 저장하고, [한도 수정]에서 언제든 바꿀 수 있다.
 * 사용액은 이번 달 카드지출(취소·제외 건 제외)을 용도별로 합산한 값이다.
 */

const STORAGE_KEY = 'ea_erp_category_limits';

/** 카드지출 용도 기본 목록 — 설정의 코드값(CARD_PURPOSE)이 없을 때 사용 (카드지출 화면과 동일) */
const DEFAULT_PURPOSES = [
  '식비', '회식비', '업무교통비', '야근교통비', '국내출장비', '국외출장비', '접대비',
  '유류비', '교육훈련비', '도서구입비', '정기구독료', '회의비', '사무용품비', '소모품비',
  'IT솔루션', '서류발급비', '온라인 마케팅', '광고비', '판촉물제작비', '기타비용', '오사용',
];

const loadLimits = (): Record<string, string> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const j = raw ? JSON.parse(raw) : null;
    return j && typeof j === 'object' ? j : {};
  } catch {
    return {};
  }
};

const saveLimits = (limits: Record<string, string>) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
  } catch {
    /* 저장 실패는 무시 — 다음 방문에 다시 입력하면 된다 */
  }
};

/** 한도 대비 사용률 막대 — 80% 미만 브랜드, 100% 미만 주황, 초과 빨강 */
function UsageBar({ spent, limit }: { spent: bigint; limit: bigint }) {
  if (limit <= 0n) return <div className="h-1.5 w-full rounded-full bg-line-soft" />;
  const pct = Number((spent * 1000n) / limit) / 10;
  const color = pct >= 100 ? 'bg-neg' : pct >= 80 ? 'bg-amber-400' : 'bg-brand/70';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

/** 'YYYY-MM' 에서 offset 개월 이동 */
const shiftMonth = (ym: string, offset: number): string => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
};
const monthRange = (ym: string) => {
  const last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};
const hasMonth = (list: CardExpenseList | null, ym: string) =>
  (list?.rows ?? []).some((e) => seoulYmd(e.usedAt).slice(0, 7) === ym);

export function CategoryLimitsSection() {
  const { codesOf } = useSession();
  const thisMonth = thisMonthSeoul();

  // 이번 달 지출이 아직 없으면(월초 등) 지난달 사용액을 대신 보여준다
  const res = useAsync(async () => {
    const cur = await api.get<CardExpenseList>('/cards/expenses', monthRange(thisMonth));
    if (hasMonth(cur, thisMonth)) return { ym: thisMonth, rows: cur.rows };
    const prevYm = shiftMonth(thisMonth, -1);
    const prev = await api
      .get<CardExpenseList>('/cards/expenses', monthRange(prevYm))
      .catch(() => null);
    if (hasMonth(prev, prevYm)) return { ym: prevYm, rows: prev!.rows };
    return { ym: thisMonth, rows: cur.rows };
  }, [thisMonth]);

  const [limits, setLimits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => setLimits(loadLimits()), []);

  const fromCodes = codesOf('CARD_PURPOSE').map((c) => c.label);
  const purposes = fromCodes.length ? fromCodes : DEFAULT_PURPOSES;

  const showYm = res.data?.ym ?? thisMonth;

  // 표시 월의 용도별 사용액 — 취소·제외 건은 빼고 합산
  const spentBy = useMemo(() => {
    const m = new Map<string, bigint>();
    for (const e of res.data?.rows ?? []) {
      if (e.isCancelled || e.status === 'EXCLUDED') continue;
      if (seoulYmd(e.usedAt).slice(0, 7) !== showYm) continue;
      const k = e.purposeText || '용도 미입력';
      m.set(k, (m.get(k) ?? 0n) + big(e.amount));
    }
    return m;
  }, [res.data, showYm]);

  // 목록에 없는 용도(과거 수기 입력 등)에 지출이 있으면 그 항목도 보여준다
  const allCategories = [...new Set([...purposes, ...spentBy.keys()])];
  const viewRows = allCategories
    .map((label) => ({
      label,
      limit: big(limits[label] ?? '0'),
      spent: spentBy.get(label) ?? 0n,
    }))
    .filter((r) => r.limit > 0n || r.spent > 0n)
    .sort((a, b) => (a.limit > 0n === (b.limit > 0n) ? (b.spent > a.spent ? 1 : -1) : a.limit > 0n ? -1 : 1));

  const startEdit = () => {
    setDraft({ ...limits });
    setEditing(true);
  };
  const saveEdit = () => {
    // 0·빈값은 '한도 미설정'으로 정리해 저장한다
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) if (v && big(v) > 0n) cleaned[k] = `${big(v)}`;
    setLimits(cleaned);
    saveLimits(cleaned);
    setEditing(false);
  };

  const month = Number(showYm.slice(5, 7));

  return (
    <Section
      title={
        <span className="flex items-center gap-1.5">
          {!editing && <PencilButton title="한도 수정" onClick={startEdit} />}
          {month}월 항목별 지출 한도
        </span>
      }
      desc={`항목별 한도 대비 ${month}월 카드지출 사용액과 남은 금액입니다. 한도 금액은 좌측 연필 버튼으로 언제든 바꿀 수 있습니다.${
        showYm !== thisMonth ? ' (이번 달 지출이 아직 없어 지난달 사용액을 보여줍니다)' : ''
      }`}
    >
      {editing ? (
        <div className="p-4">
          <p className="mb-3 text-xs text-ink-faint">
            항목별 월 한도를 입력하세요. 비워두면 한도 미설정으로 표시됩니다.
          </p>
          <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {allCategories.map((label) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-sm text-ink-soft" title={label}>
                  {label}
                </span>
                <div className="flex-1">
                  <MoneyInput
                    value={draft[label] ?? ''}
                    onChange={(v) => setDraft((d) => ({ ...d, [label]: v }))}
                    placeholder="미설정"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-line pt-3">
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              취소
            </button>
            <button className="btn-primary" onClick={saveEdit}>
              저장
            </button>
          </div>
        </div>
      ) : res.loading && !res.data ? (
        <Spinner />
      ) : res.error ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : viewRows.length === 0 ? (
        <div className="py-10 text-center text-sm text-ink-faint">
          아직 이번 달 지출과 설정된 한도가 없습니다. 제목 왼쪽 연필 버튼으로 항목별 한도를 넣어보세요.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line-soft">
              <tr>
                <th className="th">항목</th>
                <th className="th text-right">한도</th>
                <th className="th text-right">사용액</th>
                <th className="th text-right">남은 금액</th>
                <th className="th w-40">사용률</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {viewRows.map((r) => {
                const remain = r.limit - r.spent;
                const over = r.limit > 0n && remain < 0n;
                return (
                  <tr key={r.label} className="hover:bg-line-soft/60">
                    <td className="td font-medium">{r.label}</td>
                    <td className="td-num text-ink-mute">
                      {r.limit > 0n ? num(r.limit) : <span className="text-xs text-ink-faint">미설정</span>}
                    </td>
                    <td className="td-num">{num(r.spent)}</td>
                    <td className={`td-num font-semibold ${over ? 'text-neg' : r.limit > 0n ? 'text-pos' : 'text-ink-faint'}`}>
                      {r.limit > 0n ? (over ? `${num(-remain)} 초과` : num(remain)) : '—'}
                    </td>
                    <td className="td">
                      <UsageBar spent={r.spent} limit={r.limit} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
