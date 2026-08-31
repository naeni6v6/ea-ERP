'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/lib/session';
import type { Notice } from '@/lib/types';

/**
 * 오늘의 공지 — 본문 폭에 맞춘 카드 배너 (레이아웃의 본문 최상단에 배치).
 * 확인 전에는 선명한 카드 + 아래 업무 화면 차단(onBlockChange), 확인 후에는 한 줄 요약으로 접힌다.
 * 확인 여부는 브라우저별(localStorage)로 기억하고 내용이 수정되면 재확인해야 한다.
 * CEO/관리자는 ✎로 그 자리에서 등록·수정, 내용을 비워 게시하면 삭제.
 */
const ackKey = (n: Notice) => `ea_notice_ack_${n.id}_${n.updatedAt}`;

function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}

export function NoticeBanner({ onBlockChange }: { onBlockChange?: (blocked: boolean) => void }) {
  const { isAdmin } = useSession();
  const res = useAsync(() => api.get<Notice | null>('/notices/today'), []);
  const notice = res.data ?? null;

  const [acked, setAcked] = useState(true); // 로딩 중엔 막지 않는다
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!notice) {
      setAcked(true);
      return;
    }
    try {
      setAcked(!!localStorage.getItem(ackKey(notice)));
    } catch {
      setAcked(false);
    }
  }, [notice?.id, notice?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = !!notice && !acked;
  useEffect(() => {
    onBlockChange?.(blocked);
  }, [blocked, onBlockChange]);

  const ack = () => {
    if (notice) {
      try {
        localStorage.setItem(ackKey(notice), '1');
      } catch {
        /* 프라이빗 모드 등 — 이번 화면에서만 확인 처리 */
      }
    }
    setAcked(true);
  };

  const openEditor = (initial: string) => {
    setText(initial);
    setError('');
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.put('/notices/today', { content: text });
      setEditing(false);
      res.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '공지 저장에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  // 공지 없음 — 관리자에게만 얇은 등록 띠
  if (!notice && !editing) {
    if (!isAdmin || res.loading) return null;
    return (
      <button
        onClick={() => openEditor('')}
        className="no-print mb-5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line bg-white py-2.5 text-xs text-ink-faint transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
      >
        <span className="text-[15px] leading-none">+</span> 오늘의 공지 등록
      </button>
    );
  }

  // 등록/수정 입력 모드 — 같은 카드 안에서 편집
  if (editing) {
    return (
      <div className="no-print mb-5 overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-r from-[#fff2ee] via-[#fff7f5] to-white p-5 shadow-soft">
        <div className="flex items-center gap-2 text-xs font-bold text-red-600">
          <MegaphoneIcon className="h-4 w-4" />
          오늘의 공지
        </div>
        <textarea
          autoFocus
          rows={Math.min(5, Math.max(2, text.split('\n').length))}
          className="mt-2.5 w-full resize-none rounded-xl border border-red-100 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-red-300"
          value={text}
          placeholder="전 직원에게 보여줄 금일 공지 — Shift+Enter 줄바꿈, Enter 게시, 비우고 게시하면 삭제"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              save();
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          disabled={busy}
        />
        {error && <p className="mt-2 text-xs text-neg">{error}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="rounded-xl px-4 py-2 text-xs font-semibold text-ink-mute transition-colors hover:bg-white hover:text-ink"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            취소
          </button>
          <button
            className="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-60"
            onClick={save}
            disabled={busy}
          >
            {busy ? '저장 중…' : '게시'}
          </button>
        </div>
      </div>
    );
  }

  if (!notice) return null;

  // 확인 후 — 톤을 낮춰 조용히 유지하되 내용은 전부 보여준다
  if (!blocked)
    return (
      <div className="no-print group mb-5 flex items-start gap-3 rounded-2xl border border-red-100/70 bg-red-50/60 px-4 py-3">
        <MegaphoneIcon className="mt-1 h-4 w-4 shrink-0 text-red-400" />
        <span className="mt-0.5 shrink-0 text-xs font-bold text-red-500">오늘의 공지</span>
        <p className="min-w-0 flex-1 whitespace-pre-line text-sm font-semibold leading-relaxed text-ink-soft">
          {notice.content}
        </p>
        {isAdmin && (
          <button
            onClick={() => openEditor(notice.content)}
            className="shrink-0 rounded-full p-1.5 text-red-300 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="공지 수정"
            title="공지 수정"
          >
            ✎
          </button>
        )}
        <span className="mt-0.5 shrink-0 text-xs font-semibold text-red-300">✓ 확인함</span>
      </div>
    );

  // 미확인 — 시선을 끄는 카드, 확인 전까지 아래 화면을 막는다
  return (
    <div
      role="alert"
      className="no-print relative mb-5 overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-r from-[#fff1ec] via-[#fff7f4] to-white p-5 shadow-[0_10px_30px_-18px_rgba(207,75,60,0.55)]"
    >
      {/* 장식 — 점 격자와 은은한 원 */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-40 top-5 hidden h-12 w-20 text-red-200/70 lg:block"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.5px)',
          backgroundSize: '9px 9px',
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-24 right-10 h-52 w-52 rounded-full bg-gradient-to-tr from-red-100/60 to-transparent"
      />

      <div className="relative flex flex-wrap items-center gap-x-5 gap-y-4">
        {/* 아이콘 타일 */}
        <div className="relative hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/25 sm:flex">
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.4),transparent_60%)]"
          />
          <MegaphoneIcon className="relative h-8 w-8 text-white" />
        </div>

        {/* 본문 — 모든 줄을 같은 크기로 크게 */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-red-600">오늘의 공지</p>
          <p className="mt-1 whitespace-pre-line text-lg font-bold leading-snug tracking-tight text-ink">
            {notice.content}
          </p>
        </div>

        {/* 액션 */}
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => openEditor(notice.content)}
              className="rounded-full p-2 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
              aria-label="공지 수정"
              title="공지 수정"
            >
              ✎
            </button>
          )}
          <button
            onClick={ack}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/25 transition-colors hover:bg-red-700"
            title="확인해야 아래 업무 화면을 사용할 수 있습니다"
          >
            확인했습니다 →
          </button>
        </div>
      </div>
    </div>
  );
}
