import type { TextStyle } from 'react-native';

/** 웹과 같은 톤 — 따뜻한 중성색 + 주황 브랜드 (docs/모바일앱_개발_프롬프트.md §5) */
export const colors = {
  brand: '#f5911e',
  brandDeep: '#b45f05',
  brandSoft: '#fdeeda',
  ink: '#2a2724',
  inkMute: '#57514b',
  inkFaint: '#857d75',
  line: '#eae5e0',
  bgSoft: '#f5f2ef',
  bg: '#faf8f6',
  card: '#ffffff',
  pos: '#2f8f5b',
  neg: '#cf4b3c',
  warn: '#c9820f',
  negSoft: '#fbeae7',
  posSoft: '#e8f4ee',
  warnSoft: '#faf1de',
  /** 헤더 등 어두운 면 — 로고가 얹히는 곳 (웹 shell) */
  shell: '#1d1a17',
  /** 진행률/미터 전용 — 웹 viz 바이올렛 */
  viz: '#7c6cf0',
  vizSoft: '#efecfd',
  /** URGENT 배지 (웹 red-600) */
  urgent: '#dc2626',
} as const;

/**
 * Pretendard — 웹과 동일한 글꼴 (assets/fonts, App.tsx에서 로드).
 * RN은 커스텀 폰트에서 fontWeight를 흉내내기(faux bold) 때문에,
 * 굵기마다 파일을 나눠 fontFamily로 지정한다. fontWeight를 함께 쓰지 말 것.
 */
export const ft = {
  regular: { fontFamily: 'Pretendard-Regular' } as TextStyle,
  semibold: { fontFamily: 'Pretendard-SemiBold' } as TextStyle,
  bold: { fontFamily: 'Pretendard-Bold' } as TextStyle,
  extrabold: { fontFamily: 'Pretendard-ExtraBold' } as TextStyle,
};

/** 금액 등 숫자는 폭이 일정하게 — Pretendard의 tabular figures 사용 */
export const numFont: TextStyle = { fontVariant: ['tabular-nums'] };
