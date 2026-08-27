'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FilterProvider } from '@/lib/filters';
import { SessionProvider, useSession } from '@/lib/session';
import { FilterBar } from '@/components/FilterBar';
import { Logo } from '@/components/Logo';
import { Spinner } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  /** 표시 조건 — 서버 권한과 별개인 '보여주기' 수준. 실제 차단은 API가 한다. */
  show: (s: { isCeo: boolean; isAdmin: boolean }) => boolean;
}

const NAV: NavItem[] = [
  { href: '/', label: '대시보드', show: () => true },
  { href: '/pnl', label: '손익', show: (s) => s.isAdmin },
  { href: '/journal', label: '거래', show: (s) => s.isAdmin },
  { href: '/treasury', label: '자금', show: (s) => s.isCeo },
  { href: '/cards', label: '카드지출', show: () => true },
  { href: '/projects', label: '프로젝트', show: () => true },
  { href: '/my', label: '내 업무', show: () => true },
  { href: '/settings', label: '설정', show: (s) => s.isCeo },
];

/** 분석 뷰 — 같은 손익 데이터를 축(유형/부서/기간)별 카드로 본다 */
const ANALYSIS_NAV: NavItem[] = [
  { href: '/by-type', label: '유형별', show: (s) => s.isAdmin },
  { href: '/by-department', label: '사업부서별', show: (s) => s.isAdmin },
  { href: '/by-period', label: '기간별', show: (s) => s.isAdmin },
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
  const items = NAV.filter((n) => n.show(scope));
  const analysisItems = ANALYSIS_NAV.filter((n) => n.show(scope));
  const roleLabel = isCeo ? '대표' : isAdmin ? '관리자' : '직원';
  const initial = me.name.slice(0, 1);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <div className="min-h-screen">
      {/* ── 좌측 배너 (데스크톱) ── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col bg-shell lg:flex">
        <div className="px-5 pb-4 pt-5">
          <Link href="/" aria-label="모션브릿지 ERP 홈">
            <Logo height={24} />
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          <NavLabel>메뉴</NavLabel>
          {items.map((n) => (
            <Link key={n.href} href={n.href} className={navClass(isActive(n.href), true)}>
              {n.label}
            </Link>
          ))}

          {analysisItems.length > 0 && (
            <>
              {/* 메뉴 ↔ 분석 구분선 */}
              <div className="mx-3 my-3 border-t border-white/10" />
              <NavLabel>분석</NavLabel>
              {analysisItems.map((n) => (
                <Link key={n.href} href={n.href} className={navClass(isActive(n.href), true)}>
                  {n.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* 팀 Slack 바로가기 — 프로필은 우측 상단으로 이동해 하단은 이것만 남긴다 */}
        <div className="border-t border-shell-line px-3 py-3">
          <a
            href={SLACK_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 rounded-lg border border-shell-line px-3 py-2 text-sm text-white/75 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white"
          >
            <SlackMark />
            <span className="flex-1">팀 Slack 열기</span>
            <span className="text-xs text-white/40">↗</span>
          </a>
        </div>
      </aside>

      {/* ── 본문 영역 ── */}
      <div className="flex min-h-screen flex-col lg:pl-56">
        <header className="sticky top-0 z-30">
          {/* 모바일 전용 상단 바 — 좁은 화면에서는 사이드바 대신 가로 메뉴 */}
          <div className="bg-shell lg:hidden">
            <div className="flex items-center gap-4 px-4 py-2.5">
              <Link href="/" className="shrink-0" aria-label="모션브릿지 ERP 홈">
                <Logo height={22} />
              </Link>
              <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
                {[...items, ...analysisItems].map((n) => (
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

        <main className="mx-auto w-full max-w-[1400px] animate-fade-up px-4 py-6 sm:px-6">
          {children}
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
