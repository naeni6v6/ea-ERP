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
} as const;

/** 금액 등 숫자는 폭이 일정하게 — 시스템 폰트의 tabular-nums 사용 */
export const numFont: TextStyle = { fontVariant: ['tabular-nums'] };
