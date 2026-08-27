'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/useAsync';
import { todaySeoul } from '@/lib/format';
import { Empty, ErrorBox, Section, Spinner, StatusBadge } from '@/components/ui';
import type { Task } from '@/lib/types';

export default function MyTasksPage() {
  const { me, labelOf } = useSession();
  const res = useAsync(() => api.get<Task[]>('/tasks/my'), []);
  const [error, setError] = useState('');
  const today = todaySeoul();

  const toggle = async (t: Task) => {
    setError('');
    try {
      await api.patch(`/tasks/${t.id}`, { isDone: !t.isDone });
      res.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경에 실패했습니다');
    }
  };

  const tasks = res.data ?? [];
  const open = tasks.filter((t) => !t.isDone);
  const done = tasks.filter((t) => t.isDone);
  const overdue = open.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < today);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">내 업무</h1>
        <p className="mt-0.5 text-xs text-ink-faint">
          {me?.name} 님에게 배정된 업무 · 남은 {open.length}건
          {overdue.length > 0 && <span className="text-neg"> · 기한 초과 {overdue.length}건</span>}
        </p>
      </div>

      {error && <ErrorBox message={error} />}

      {res.loading && !res.data ? (
        <Spinner />
      ) : res.error ? (
        <ErrorBox message={res.error} onRetry={res.reload} />
      ) : (
        <>
          <Section title="진행 중">
            {!open.length ? (
              <Empty>남은 업무가 없습니다.</Empty>
            ) : (
              <ul className="divide-y divide-line-soft">
                {open.map((t) => {
                  const late = t.dueDate && t.dueDate.slice(0, 10) < today;
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => toggle(t)}
                        className="h-4 w-4 accent-brand"
                        aria-label={`${t.title} 완료`}
                      />
                      <span className="flex-1 text-sm">{t.title}</span>
                      {t.project && (
                        <Link
                          href={`/projects/${t.project.id}`}
                          className="text-xs text-ink-mute hover:text-brand-deep hover:underline"
                        >
                          {t.project.name}
                        </Link>
                      )}
                      <StatusBadge status={t.status} label={labelOf('TASK_STATUS', t.status)} />
                      <span
                        className={`w-24 text-right font-num text-xs ${late ? 'font-medium text-neg' : 'text-ink-faint'}`}
                      >
                        {t.dueDate?.slice(0, 10) ?? ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {done.length > 0 && (
            <Section title={`완료 ${done.length}건`}>
              <ul className="divide-y divide-line-soft">
                {done.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggle(t)}
                      className="h-4 w-4 accent-brand"
                      aria-label={`${t.title} 완료 해제`}
                    />
                    <span className="flex-1 text-sm text-ink-faint line-through">{t.title}</span>
                    {t.project && (
                      <span className="text-xs text-ink-faint">{t.project.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
