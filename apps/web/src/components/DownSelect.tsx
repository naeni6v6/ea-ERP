'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { uiZoom } from '@/lib/zoom';

/**
 * 항상 아래로 열리는 선택 상자.
 *
 * 브라우저 기본 <select>는 화면 아래쪽 행에서 목록이 위로 튀어 올라온다(표 하단 행에서 특히 자주).
 * 목록 위치를 브라우저가 정하기 때문에 CSS로는 막을 수 없어서, 버튼 + 포털 목록으로 직접 그린다.
 * 아래 공간이 부족하면 버튼을 화면 가운데로 스크롤한 뒤 열어, 언제나 아래로 펼쳐지게 한다.
 */
export interface DownOption {
  value: string;
  label: string;
}

type Pos = { top: number; left: number; width: number; maxHeight: number };

/** 목록이 최소한 이만큼은 보여야 쓸 만하다 — 부족하면 버튼을 화면 가운데로 옮기고 연다 */
const MIN_SPACE = 220;
const GAP = 4;

export function DownSelect({
  value,
  options,
  onChange,
  placeholder = '선택',
  className,
  disabled,
  title,
  ariaLabel,
}: {
  value: string;
  options: DownOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [active, setActive] = useState(0);

  const selectedIdx = options.findIndex((o) => o.value === value);
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null;

  const measure = useCallback((): Pos | null => {
    const el = btnRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // 측정값은 확대된 화면 px — fixed 목록의 style px 로 쓰려면 배율로 나눈다
    const z = uiZoom();
    return {
      top: r.bottom / z + GAP,
      left: r.left / z,
      width: Math.max(r.width / z, 150),
      maxHeight: Math.max(120, (window.innerHeight - r.bottom) / z - GAP - 12),
    };
  }, []);

  const openMenu = () => {
    if (disabled) return;
    const el = btnRef.current;
    if (!el) return;
    // 아래 공간이 모자라면 먼저 화면 가운데로 스크롤 — 위로 열리는 대신 자리를 만든다.
    // scrollIntoView는 바로 반영되므로 곧장 다시 재서 위치를 잡는다 (스크롤 이벤트가 오면 한 번 더 맞춘다)
    if (window.innerHeight - el.getBoundingClientRect().bottom < MIN_SPACE) {
      el.scrollIntoView({ block: 'center' });
    }
    setPos(measure());
    setActive(selectedIdx >= 0 ? selectedIdx : 0);
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  const pick = (v: string) => {
    close();
    btnRef.current?.focus();
    if (v !== value) onChange(v);
  };

  // 바깥 클릭이면 닫고, 스크롤·리사이즈면 버튼 밑으로 다시 붙인다.
  // (열자마자 스크롤로 닫아버리면 아래 공간을 만들려고 스크롤한 경우 목록이 바로 사라진다)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    const reposition = () => {
      const r = btnRef.current?.getBoundingClientRect();
      // 버튼이 화면 밖으로 밀려나면 목록만 떠 있게 두지 않고 닫는다
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return close();
      setPos(measure());
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, close, measure]);

  // 열릴 때 선택된 항목이 보이게
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector('[data-active="1"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[active];
      if (o) pick(o.value);
    } else if (e.key === 'Tab') {
      close();
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`${className ?? 'input'} flex items-center justify-between gap-1 text-left ${
          open ? 'border-brand ring-4 ring-brand-ring' : ''
        }`}
      >
        <span className={`truncate ${selected ? '' : 'text-ink-faint'}`}>{selected?.label ?? placeholder}</span>
        <span className={`shrink-0 text-[10px] text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="z-50 overflow-y-auto rounded-lg border border-line bg-white py-1 shadow-lg"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
          >
            {options.map((o, i) => (
              <button
                key={o.value || `_empty_${i}`}
                type="button"
                role="option"
                aria-selected={o.value === value}
                data-active={i === active ? '1' : '0'}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={`block w-full truncate px-3 py-1.5 text-left text-sm ${
                  o.value === value ? 'font-semibold text-brand-deep' : 'text-ink'
                } ${i === active ? 'bg-brand-soft' : ''} ${!o.value ? 'text-ink-faint' : ''}`}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
