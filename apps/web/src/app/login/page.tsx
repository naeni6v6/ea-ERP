'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, IS_DEMO, setToken } from '@/lib/api';
import { Logo } from '@/components/Logo';
import type { LoginResult } from '@/lib/types';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post<LoginResult>('/auth/login', { email, password });
      setToken(res.accessToken);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다');
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-shell">
      {/* 로고가 놓이는 어두운 상단 */}
      <div className="flex min-h-[240px] flex-col items-center justify-center px-4 py-12">
        <Logo height={68} />
        <p className="mt-6 text-sm tracking-wide text-white/45">관리회계 · 자금 · 프로젝트 손익</p>
      </div>

      {/* 밝은 카드 영역 — 어두운 면 위로 살짝 올라오게 */}
      <div className="flex-1 rounded-t-[28px] bg-line-page px-4 pb-12 pt-9">
        <div className="mx-auto w-full max-w-sm animate-fade-up">
          <h1 className="mb-3 text-center text-base font-semibold">모션브릿지 ERP 로그인</h1>

          {IS_DEMO && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
              <p className="text-sm font-bold text-warn">[읽기 전용 데모 모드]</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                내부 확인용 데모입니다. 아무 이메일·비밀번호로 로그인되며,
                <br />
                조회만 가능하고 저장·수정은 되지 않습니다.
              </p>
            </div>
          )}

          <form onSubmit={submit} className="card-pad space-y-4">
            <div>
              <label className="label" htmlFor="email">
                이메일
              </label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="name@eacompany.kr"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-neg">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
              {busy ? '확인 중…' : '로그인'}
            </button>
          </form>

          {/* 로그인 화면은 인증 전에 누구나 볼 수 있다 — 계정·비밀번호 안내를 두지 않는다 */}
          <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
            계정이 필요하면 대표에게 요청하세요
          </p>
        </div>
      </div>
    </main>
  );
}
