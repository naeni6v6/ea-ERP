'use client';

import { big } from '@/lib/format';

/** 금액 입력 — 숫자만 받아 천단위 콤마로 보여준다. 값은 항상 콤마 없는 문자열(원). */
export function MoneyInput({
  value,
  onChange,
  disabled,
  placeholder = '0',
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const display = value === '' ? '' : big(value).toLocaleString('ko-KR');
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        className="input pr-7 text-right font-num"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d-]/g, '');
          onChange(raw === '' || raw === '-' ? '' : String(BigInt(raw)));
        }}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint">
        원
      </span>
    </div>
  );
}
