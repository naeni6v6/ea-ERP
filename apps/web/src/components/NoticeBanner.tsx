'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/lib/session';
import type { Notice } from '@/lib/types';

/**
 * 오늘의 공지 — 화면 가로를 꽉 채우는 빨간 띠 배너 (레이아웃의 헤더 바로 아래에 배치).
 * 확인 전에는 선명한 빨강 + 아래 업무 화면 차단(onBlockChange), 확인 후에는 옅은 띠로 남는다.
 * 확인 여부는 브라우저별(localStorage)로 기억하고 내용이 수정되면 재확인해야 한다.
 * CEO/관리자는 ✎로 그 자리에서 등록·수정, 내용을 비워 게시하면 삭제.
 */
const ackKey = (n: Notice) => `ea_notice_ack_${n.id}_${n.updatedAt}`;

export function NoticeBanner({ onBlockChange }: { onBlockChange?: (blocked: boolean) => void }) {
  const { isAdmin } = useSession();
  const res = useAsync(() => api.get<Notice | null>('/notices/today'), []);
  const notice = res.data ?? null;

  const [acked, setAcked] = useState(true); // 로딩 중엔 막지 않는다
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

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

  const save = async () => {
    setBusy(true);
    try {
      await api.put('/notices/today', { content: text });
      setEditing(false);
      res.reload();
    } finally {
      setBusy(false);
    }
  };

  // 공지 없음 — 관리자에게만 얇은 등록 띠
  if (!notice && !editing) {
    if (!isAdmin || res.loading) return null;
    return (
      <button
        onClick={() => {
          setText('');
          setEditing(true);
        }}
        className="flex w-full items-center justify-center gap-1.5 border-b border-dashed border-line bg-white py-1.5 text-xs text-ink-faint transition-colors hover:bg-red-50 hover:text-red-500"
      >
        <span className="text-[13px] leading-none">+</span> 오늘의 공지 등록
      </button>
    );
  }

  // 등록/수정 입력 모드 — 같은 전체 폭 띠
  if (editing) {
    return (
      <div className="flex w-full items-center gap-3 bg-red-600 py-2 pl-5 pr-3">
        <span className="shrink-0 text-xs font-bold text-white/85">📢 오늘의 공지</span>
        <textarea
          autoFocus
          rows={Math.min(4, Math.max(1, text.split('\n').length))}
          className="flex-1 resize-none rounded-md border-0 bg-white/95 px-3 py-1.5 text-sm leading-relaxed text-ink outline-none ring-0 placeholder:text-ink-faint"
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
        <button
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          onClick={() => setEditing(false)}
          disabled={busy}
        >
          취소
        </button>
        <button
          className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:opacity-60"
          onClick={save}
          disabled={busy}
        >
          {busy ? '저장 중…' : '게시'}
        </button>
      </div>
    );
  }

  if (!notice) return null;

  // 확인 후 — 옅은 빨간 띠로 조용히 유지
  if (!blocked)
    return (
      <div className="group flex w-full items-center gap-3 bg-red-50 py-2 pl-5 pr-3" role="alert">
        <span className="shrink-0 text-sm font-bold text-red-400">📢 오늘의 공지</span>
        <p className="flex-1 whitespace-pre-line text-center text-base font-semibold text-red-800/80">{notice.content}</p>
        {isAdmin && (
          <button
            onClick={() => {
              setText(notice.content);
              setEditing(true);
            }}
            className="shrink-0 rounded-full p-1.5 text-red-300 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
            title="공지 수정"
          >
            ✎
          </button>
        )}
        <span className="shrink-0 pr-2 text-xs text-red-300">✓ 확인함</span>
      </div>
    );

  // 미확인 — 선명한 빨강, 가로 꽉 채움
  return (
    <div className="flex w-full items-center gap-3 bg-red-600 py-2.5 pl-5 pr-3 shadow-[0_4px_16px_-6px_rgba(220,38,38,0.5)]" role="alert">
      <span className="flex shrink-0 items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="whitespace-nowrap text-base font-bold text-white/90">📢 오늘의 공지</span>
      </span>
      <p className="flex-1 whitespace-pre-line text-center text-lg font-bold tracking-tight text-white">{notice.content}</p>
      {isAdmin && (
        <button
          onClick={() => {
            setText(notice.content);
            setEditing(true);
          }}
          className="shrink-0 rounded-full p-1.5 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
          title="공지 수정"
        >
          ✎
        </button>
      )}
      <button
        onClick={ack}
        className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-red-600 shadow-sm transition-colors hover:bg-red-50"
        title="확인해야 아래 업무 화면을 사용할 수 있습니다"
      >
        확인했습니다
      </button>
    </div>
  );
}
