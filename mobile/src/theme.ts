import type { TextStyle, ViewStyle } from 'react-native';

/**
 * 웹과 같은 톤 — 따뜻한 중성색 + 주황 브랜드 (docs/모바일앱_개발_프롬프트.md §5).
 * 색값은 웹 tailwind.config.ts와 1:1로 맞춘다 (배경 line.page, 면 line.soft, 선 line.DEFAULT).
 * 카드는 테두리 없이 흰 면 + 그림자로 띄운다.
 */
export const colors = {
  brand: '#f5911e',
  /** 웹 brand.dark — 그라데이션의 끝색 */
  brandDark: '#dd7a0a',
  brandDeep: '#b45f05',
  brandSoft: '#fdeeda',
  ink: '#2a2724',
  inkMute: '#57514b',
  inkFaint: '#857d75',
  /** 웹 line.DEFAULT */
  line: '#eae5e0',
  /** 웹 line.soft — 칩·트랙 등 옅은 면 */
  bgSoft: '#f5f2ef',
  /** 칩 트랙처럼 흰 카드 위에서 한 단계 더 구분돼야 하는 면 */
  fill: '#ece7e1',
  /** 페이지 배경 — 웹 line.page와 동일 */
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

/**
 * 그림자 — 웹 tailwind boxShadow(soft/lift/glow)와 같은 따뜻한 먹색(#2a2724) 기반.
 * iOS는 shadow*, Android는 elevation이 각각 먹는다. 색 있는 면(brand)에는 glow.
 */
export const sh = {
  /** 카드 기본 — 웹 shadow-soft. 테두리 없는 카드를 이것으로 띄운다 */
  card: {
    shadowColor: '#2a2724',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  } as ViewStyle,
  /** 떠 있는 요소(풋터·활성 세그먼트) — 웹 shadow-lift */
  lift: {
    shadowColor: '#2a2724',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  } as ViewStyle,
  /** 주황 버튼·아바타 — 웹 shadow-glow */
  glow: {
    shadowColor: '#f5911e',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  } as ViewStyle,
};

/** 브랜드 그라데이션 — 웹 아바타의 from-brand to-brand-dark와 동일 */
export const brandGradient = [colors.brand, colors.brandDark] as const;

/**
 * 구성비(도넛) 범주 색 — 웹 charts.tsx와 동일한 Apple 시스템 컬러 팔레트.
 * 작은 점(범례)은 원색, 넓은 면(도넛 조각)은 흰색과 45% 섞은 연한 톤.
 */
const CATEGORY_COLORS = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#AF52DE'];
const CATEGORY_SOFT = ['#FF938D', '#FFC573', '#FFE373', '#8FE0A4', '#73B6FF', '#D3A0ED'];
const REST_COLOR = '#8E8E93';
const REST_SOFT = '#C1C1C4';

export const categoryColor = (i: number): string =>
  i < CATEGORY_COLORS.length ? CATEGORY_COLORS[i] : REST_COLOR;
export const categorySoftColor = (i: number): string =>
  i < CATEGORY_SOFT.length ? CATEGORY_SOFT[i] : REST_SOFT;

/** iOS 카드 공통 꼴 — 테두리 없이 큰 라운드 + soft 그림자 */
export const card: ViewStyle = {
  backgroundColor: colors.card,
  borderRadius: 18,
  ...sh.card,
};
