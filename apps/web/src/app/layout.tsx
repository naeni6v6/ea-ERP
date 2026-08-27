import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '모션브릿지 ERP',
  description: '관리회계 · 자금관리 · 사업/부서/프로젝트 손익 — MotionBridge ERP',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#1d1a17',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
