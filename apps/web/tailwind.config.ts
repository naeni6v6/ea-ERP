import type { Config } from 'tailwindcss';

/**
 * MotionBridge 디자인 토큰.
 * 브랜드는 로고의 주황, 중성색은 살짝 따뜻한 회색을 쓴다(순회색보다 부드럽게 읽힌다).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 본문 — 순검정 대신 따뜻한 먹색
        ink: { DEFAULT: '#2a2724', soft: '#57514b', mute: '#857d75', faint: '#a9a099' },
        // 선/면 — 따뜻한 오프화이트 계열
        line: { DEFAULT: '#eae5e0', soft: '#f5f2ef', page: '#faf8f6' },
        // 브랜드 — 로고 주황
        brand: {
          DEFAULT: '#f5911e',
          dark: '#dd7a0a',
          deep: '#b45f05',
          soft: '#fef4e7',
          ring: '#f5911e33',
        },
        // 헤더 등 어두운 면 — 로고가 얹히는 곳
        shell: { DEFAULT: '#1d1a17', soft: '#2b2622', line: '#3a332d' },
        pos: '#2f8f5b',
        neg: '#cf4b3c',
        warn: '#c9820f',
        // 진행률/미터 전용 — 따뜻한 팔레트와 대비되는 차분한 바이올렛
        viz: { DEFAULT: '#7c6cf0', deep: '#5b49d6', light: '#a99cf7', soft: '#efecfd' },
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', 'system-ui', 'sans-serif'],
        num: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
      },
      // 기본 스케일보다 단계별 +2px — 글자만 키우고 여백/레이아웃은 유지
      fontSize: {
        xs: ['0.875rem', { lineHeight: '1.25rem' }], // 12 → 14
        sm: ['1rem', { lineHeight: '1.5rem' }], // 14 → 16
        base: ['1.125rem', { lineHeight: '1.75rem' }], // 16 → 18
        lg: ['1.25rem', { lineHeight: '1.75rem' }], // 18 → 20
        xl: ['1.375rem', { lineHeight: '1.875rem' }], // 20 → 22
        '2xl': ['1.625rem', { lineHeight: '2.125rem' }], // 24 → 26
        '3xl': ['2rem', { lineHeight: '2.375rem' }], // 30 → 32
      },
      borderRadius: {
        // 전반적으로 한 단계씩 더 둥글게
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(42,39,36,0.04), 0 4px 16px -6px rgba(42,39,36,0.10)',
        lift: '0 2px 6px rgba(42,39,36,0.06), 0 12px 32px -10px rgba(42,39,36,0.18)',
        glow: '0 6px 24px -8px rgba(245,145,30,0.55)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
