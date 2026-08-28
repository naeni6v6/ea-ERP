'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';
import { num } from '@/lib/format';
import { FilterProvider } from '@/lib/filters';
import { SessionProvider, useSession } from '@/lib/session';
import { FilterBar } from '@/components/FilterBar';
import { Logo } from '@/components/Logo';
import { NoticeBanner } from '@/components/NoticeBanner';
import { Spinner } from '@/components/ui';
import type { CardExpenseList } from '@/lib/types';

interface NavShow {
  (s: { isCeo: boolean; isAdmin: boolean }): boolean;
}
interface NavChild {
  href: string;
  label: string;
  /** 모바일 가로 메뉴에서는 하위 구조 없이 풀네임으로 편다 */
  mobileLabel: string;
  show: NavShow;
}
interface NavItem {
  href?: string;
  label: string;
  /** 표시 조건 — 서버 권한과 별개인 '보여주기' 수준. 실제 차단은 API가 한다. */
  show: NavShow;
  /** 있으면 소갈래 그룹 — 클릭 시 하위 메뉴가 접히고 펼쳐진다 */
  children?: NavChild[];
}

const NAV: NavItem[] = [
  { href: '/', label: '대시보드', show: () => true },
  { href: '/pnl', label: '손익', show: (s) => s.isAdmin },
  { href: '/journal', label: '거래', show: (s) => s.isAdmin },
  { href: '/treasury', label: '자금', show: (s) => s.isCeo },
  {
    label: '지출',
    show: () => true,
    children: [
      { href: '/expenses/account', label: '계좌', mobileLabel: '계좌지출', show: (s) => s.isCeo },
      { href: '/cards', label: '카드', mobileLabel: '카드지출', show: () => true },
    ],
  },
  { href: '/my', label: '내 업무', show: () => true },
  {
    // 분석 뷰 — 같은 손익 데이터를 축(유형/부서/기간)별 카드로 본다. 기본은 접힘
    label: '분석',
    show: (s) => s.isAdmin,
    children: [
      { href: '/by-type', label: '유형별', mobileLabel: '유형별', show: (s) => s.isAdmin },
      { href: '/by-department', label: '사업부서별', mobileLabel: '사업부서별', show: (s) => s.isAdmin },
      { href: '/by-period', label: '기간별', mobileLabel: '기간별', show: (s) => s.isAdmin },
    ],
  },
  { href: '/settings', label: '설정', show: (s) => s.isCeo },
];

/** 팀 Slack 바로가기 — 주소는 NEXT_PUBLIC_SLACK_URL (기본값은 내 워크스페이스로 리다이렉트되는 app.slack.com) */
const SLACK_URL = process.env.NEXT_PUBLIC_SLACK_URL ?? 'https://app.slack.com';

function SlackMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 122.8 122.8" aria-hidden>
      <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
      <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
      <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
      <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
    </svg>
  );
}

/**
 * 결제 승인 알림 벨 — 대표 프로필 왼쪽. 승인 대기(SUBMITTED) 카드지출 건수를 빨간 배지로 띄우고
 * 클릭하면 최근 요청 목록이 펼쳐진다. 1분마다 자동 갱신.
 */
function ApprovalBell() {
  const [open, setOpen] = useState(false);
  const res = useAsync(() => api.get<CardExpenseList>('/cards/expenses', { status: 'SUBMITTED', take: 8 }), []);
  const { reload } = res;
  useEffect(() => {
    const t = setInterval(reload, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  const count = res.data?.summary.submitted.count ?? 0;
  const rows = res.data?.rows ?? [];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-ink-mute transition-colors hover:bg-line-soft hover:text-ink"
        title="결제 승인 알림"
        aria-label={`결제 승인 대기 ${count}건`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 font-num text-[11px] font-bold leading-none text-white shadow-sm">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="card absolute right-0 top-full z-50 mt-1.5 w-80 overflow-hidden shadow-xl">
            <div className="border-b border-line px-4 py-2.5 text-sm font-semibold">
              결제 승인 대기 <span className="font-num text-red-600">{count}</span>건
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-ink-faint">대기 중인 승인 요청이 없습니다.</p>
            ) : (
              <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto">
                {rows.map((e) => (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{e.storeName || '가맹점 미상'}</span>
                      <span className="shrink-0 font-num text-sm font-semibold text-red-600">{num(e.amount)}원</span>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-mute">
                      {e.card?.holder?.name ?? e.card?.name ?? '—'} · {e.usedAt?.slice(0, 10).replace(/-/g, '.')}
                      {e.purposeText ? ` · ${e.purposeText}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/cards"
              onClick={() => setOpen(false)}
              className="block border-t border-line bg-line-soft/40 px-4 py-2.5 text-center text-xs font-semibold text-brand-deep hover:bg-line-soft"
            >
              카드지출에서 승인하기 →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function navClass(active: boolean, vertical: boolean) {
  const base = vertical
    ? 'flex items-center rounded-lg px-3 py-2 text-sm transition-colors'
    : 'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors';
  return `${base} ${
    active ? 'bg-brand/15 font-medium text-brand' : 'text-white/65 hover:bg-white/10 hover:text-white'
  }`;
}

/** 사이드바 섹션 라벨 — 브랜드 색으로 또렷하게 */
function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-2 text-[13px] font-bold uppercase tracking-wider text-brand">
      {children}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading, isCeo, isAdmin, logout } = useSession();
  const pathname = usePathname();
  // 오늘의 공지를 확인하기 전에는 업무 화면을 흐리게 막는다
  const [noticeBlocked, setNoticeBlocked] = useState(false);
  // 소갈래 그룹(지출 등) 접기/펼치기 — 명시 토글이 없으면 하위 경로 활성 시 자동으로 펼친다
  const [openGroup, setOpenGroup] = useState<Record<string, boolean>>({});

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card-pad max-w-sm text-center text-sm">
          <p className="font-medium">세션을 확인할 수 없습니다</p>
          <p className="mt-1 text-ink-mute">API 서버가 실행 중인지 확인한 뒤 다시 로그인하세요.</p>
          <Link href="/login" className="btn-primary mt-4">
            로그인으로
          </Link>
        </div>
      </div>
    );
  }

  const scope = { isCeo, isAdmin };
  const items = NAV.map((n) =>
    n.children ? { ...n, children: n.children.filter((c) => c.show(scope)) } : n,
  ).filter((n) => (n.children ? n.show(scope) && n.children.length > 0 : n.show(scope)));
  /** 모바일 가로 메뉴용 — 그룹은 하위 항목 풀네임으로 편다 */
  const flatItems = items.flatMap((n) =>
    n.children ? n.children.map((c) => ({ href: c.href, label: c.mobileLabel })) : [{ href: n.href!, label: n.label }],
  );
  const roleLabel = isCeo ? '대표' : isAdmin ? '관리자' : '직원';
  const initial = me.name.slice(0, 1);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      {/* ── 좌측 배너 (데스크톱) ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[184px] flex-col bg-shell lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Link href="/" aria-label="모션브릿지 ERP 홈">
            <Logo height={24} />
          </Link>
        </div>

        <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto px-3">
          <NavLabel>메뉴</NavLabel>
          {items.map((n) => {
            if (!n.children)
              return (
                <Link key={n.href} href={n.href!} className={navClass(isActive(n.href!), true)}>
                  {n.label}
                </Link>
              );
            const childActive = n.children.some((c) => isActive(c.href));
            const opened = openGroup[n.label] ?? childActive;
            return (
              <div key={n.label}>
                <button
                  onClick={() => setOpenGroup((g) => ({ ...g, [n.label]: !opened }))}
                  className={`${navClass(childActive, true)} w-full`}
                  aria-expanded={opened}
                >
                  <span className="flex-1 text-left">{n.label}</span>
                  <span className={`text-[11px] text-white/40 transition-transform ${opened ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </button>
                {opened && (
                  <div className="ml-3.5 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                    {n.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`${navClass(isActive(c.href), true)} !py-1.5 text-[13px]`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

        </nav>

        {/* 팀 Slack 바로가기 — 프로필은 우측 상단으로 이동해 하단은 이것만 남긴다 */}
        <div className="border-t border-shell-line px-3 py-3">
          <a
            href={SLACK_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-shell-line px-2.5 py-2 text-xs text-white/75 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white"
          >
            <SlackMark size={13} />
            <span className="flex-1 truncate">팀 Slack 열기</span>
            <span className="text-[11px] text-white/40">↗</span>
          </a>
        </div>
      </aside>

      {/* ── 본문 영역 ── */}
      <div className="flex min-h-screen flex-col lg:pl-[184px]">
        <header className="sticky top-0 z-30">
          {/* 모바일 전용 상단 바 — 좁은 화면에서는 사이드바 대신 가로 메뉴 */}
          <div className="bg-shell lg:hidden">
            <div className="flex items-center gap-4 px-4 py-2.5">
              <Link href="/" className="shrink-0" aria-label="모션브릿지 ERP 홈">
                <Logo height={22} />
              </Link>
              <nav className="no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
                {flatItems.map((n) => (
                  <Link key={n.href} href={n.href} className={navClass(isActive(n.href), false)}>
                    {n.label}
                  </Link>
                ))}
              </nav>
              <button
                onClick={logout}
                className="shrink-0 rounded-lg border border-shell-line px-3 py-1.5 text-sm text-white/70 transition-colors hover:border-white/30 hover:text-white"
              >
                로그아웃
              </button>
            </div>
          </div>
          <div className="flex items-stretch">
            <div className="min-w-0 flex-1">
              <FilterBar />
            </div>
            {/* 대표 프로필 — 우측 상단 (데스크톱), 눈에 띄게 */}
            <div className="hidden shrink-0 items-center gap-3 border-b border-line bg-white/85 pl-4 pr-5 backdrop-blur lg:flex">
              {isCeo && <ApprovalBell />}
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-lg font-bold text-white shadow-glow">
                {initial}
              </span>
              <div className="min-w-0">
                <div className="max-w-[140px] truncate text-sm font-bold">{me.name}</div>
                <span className="badge mt-0.5 bg-brand-soft !px-2 font-semibold text-brand-deep">{roleLabel}</span>
              </div>
              <button onClick={logout} className="btn-ghost !px-3 !py-1.5 text-xs">
                로그아웃
              </button>
            </div>
          </div>
        </header>

        {/* 오늘의 공지 — 헤더 바로 아래, 화면 가로 전체를 채우는 띠 */}
        <NoticeBanner onBlockChange={setNoticeBlocked} />
        <main className="mx-auto w-full max-w-[1400px] animate-fade-up px-4 py-6 sm:px-6">
          <div
            className={noticeBlocked ? 'pointer-events-none select-none opacity-60 blur-[3px]' : ''}
            aria-hidden={noticeBlocked || undefined}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <FilterProvider>
        <Shell>{children}</Shell>
      </FilterProvider>
    </SessionProvider>
  );
}
