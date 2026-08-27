'use client';

import { useEffect, type ReactNode } from 'react';
import { compact, num, pct, signClass } from '@/lib/format';
import type { Money } from '@/lib/format';

export function Spinner({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-mute">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-neg">
      <div className="font-medium">문제가 발생했습니다</div>
      <div className="mt-1 text-red-800">{message}</div>
      {onRetry && (
        <button className="btn-ghost mt-3" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-ink-faint">{children}</div>;
}

export function Section({
  title,
  desc,
  right,
  children,
}: {
  title: ReactNode;
  desc?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {desc && <p className="mt-1 text-xs leading-relaxed text-ink-faint">{desc}</p>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

/** KPI 카드 — 축약 금액을 크게, 정확한 원 단위를 아래에 병기 */
export function Kpi({
  label,
  value,
  sub,
  tone = 'plain',
  hint,
}: {
  label: string;
  value: Money;
  sub?: ReactNode;
  tone?: 'plain' | 'sign' | 'brand';
  hint?: string;
}) {
  const toneClass =
    tone === 'sign' ? signClass(value) : tone === 'brand' ? 'text-brand-deep' : 'text-ink';
  return (
    <div className="card-pad transition-shadow hover:shadow-lift" title={hint}>
      <div className="text-xs font-medium text-ink-mute">{label}</div>
      <div className={`mt-2 font-num text-[28px] font-semibold leading-none tracking-tight ${toneClass}`}>
        {compact(value)}
      </div>
      <div className="mt-1.5 font-num text-[13px] text-ink-faint">{num(value)}원</div>
      {sub && (
        <div className="mt-3 border-t border-line-soft pt-2.5 text-xs leading-relaxed text-ink-mute">
          {sub}
        </div>
      )}
    </div>
  );
}

export function Pct({ value }: { value: number | null | undefined }) {
  return <span className="font-num">{pct(value)}</span>;
}

/** 값의 크기를 가로 막대로 — 차트 라이브러리 없이 비교 가능하게 */
export function Bar({ value, max, negative }: { value: bigint; max: bigint; negative?: boolean }) {
  const m = max > 0n ? max : 1n;
  const abs = value < 0n ? -value : value;
  const w = Number((abs * 1000n) / m) / 10;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
      <div
        className={`h-full rounded-full ${negative ? 'bg-neg/60' : 'bg-brand/70'}`}
        style={{ width: `${Math.min(100, Math.max(w, value === 0n ? 0 : 1.5))}%` }}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  desc,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  desc?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div
        className={`card my-auto w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} shadow-xl`}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            {desc && <p className="mt-0.5 text-xs text-ink-faint">{desc}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="-m-1 rounded p-1 text-ink-faint hover:bg-line-soft hover:text-ink"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="ml-0.5 text-neg">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[13px] text-ink-faint">{hint}</p>}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'bg-brand-soft text-brand-deep',
  PLANNED: 'bg-line-soft text-ink-mute',
  ON_HOLD: 'bg-amber-50 text-warn',
  DONE: 'bg-emerald-50 text-pos',
  CANCELLED: 'bg-line-soft text-ink-faint',
  TODO: 'bg-line-soft text-ink-mute',
  IN_PROGRESS: 'bg-brand-soft text-brand-deep',
  REVIEW: 'bg-amber-50 text-warn',
  POSTED: 'bg-emerald-50 text-pos',
  VOID: 'bg-red-50 text-neg',
  UNCLASSIFIED: 'bg-amber-50 text-warn',
  CLASSIFIED: 'bg-emerald-50 text-pos',
  IGNORED: 'bg-line-soft text-ink-faint',
  CONFIRMED: 'bg-red-50 text-neg',
  SCHEDULED: 'bg-line-soft text-ink-mute',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge ${STATUS_TONE[status] ?? 'bg-line-soft text-ink-mute'}`}>
      {label ?? status}
    </span>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-viz-soft">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${value >= 100 ? 'from-viz-deep to-viz' : 'from-viz to-viz-light'}`}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="font-num text-xs text-ink-mute">{value}%</span>
    </div>
  );
}
