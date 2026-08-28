'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { useSession } from '@/lib/session';
import type { Notice } from '@/lib/types';

/**
 * 오늘의 공지 현수막 — 옅은 빨간색 전면 배너.
 * [확인했습니다]를 누르기 전까지는 아래 업무 화면이 흐려지고 클릭이 막힌다(onBlockChange).
 * 확인 여부는 브라우저별(localStorage)로 기억하고, 공지 내용이 수정되면 다시 확인해야 한다.
 * CEO/관리자는 ✎로 그 자리에서 등록·수정하고, 내용을 비워 저장하면 삭제된다.
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

  // 공지 없음 — 관리자에게만 등록 스트립 노출
  if (!notice && !editing) {
    if (!isAdmin || res.loading) return null;
    return (
      <button
        onClick={() => {
          setText('');
          setEditing(true);
        }}
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-2 text-xs text-ink-faint transition-colors hover:border-red-300 hover:text-red-500"
      >
        📢 오늘의 공지 등록
      </button>
    );
  }

  // 등록/수정 입력 모드
  if (editing) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <span className="shrink-0 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white">📢 오늘의 공지</span>
        <input
          autoFocus
          className="input flex-1 border-red-200 bg-white text-sm"
          value={text}
          placeholder="전 직원에게 보여줄 금일 공지 — 비우고 저장하면 삭제됩니다"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setEditing(false);
          }}
          disabled={busy}
        />
        <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => setEditing(false)} disabled={busy}>
          취소
        </button>
        <button
          className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          onClick={save}
          disabled={busy}
        >
          {busy ? '저장 중…' : '게시'}
        </button>
      </div>
    );
  }

  if (!notice) return null;

  return (
    <div
      className={`mb-5 flex items-center gap-4 rounded-xl border px-5 py-3 ${
        blocked ? 'border-red-300 bg-red-50 shadow-md ring-2 ring-red-200/70' : 'border-red-200 bg-red-50/70'
      }`}
      role="alert"
    >
      <span className="shrink-0 rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white">📢 오늘의 공지</span>
      <p className="flex-1 text-center text-sm font-semibold leading-relaxed text-red-900">{notice.content}</p>
      {isAdmin && (
        <button
          onClick={() => {
            setText(notice.content);
            setEditing(true);
          }}
          className="shrink-0 rounded p-1 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
          title="공지 수정"
        >
          ✎
        </button>
      )}
      {blocked ? (
        <button
          onClick={ack}
          className="shrink-0 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-red-700"
          title="확인해야 아래 업무 화면을 사용할 수 있습니다"
        >
          확인했습니다
        </button>
      ) : (
        <span className="shrink-0 text-xs text-red-400">✓ 확인함</span>
      )}
    </div>
  );
}
