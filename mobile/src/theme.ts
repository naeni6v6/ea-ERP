import type { TextStyle, ViewStyle } from 'react-native';

/**
 * 웹과 같은 톤 — 따뜻한 중성색 + 주황 브랜드 (docs/모바일앱_개발_프롬프트.md §5).
 * iOS 그룹 리스트처럼 배경을 살짝 깊게 깔고, 카드는 테두리 없이 흰 면+그림자로 띄운다.
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
  line: '#e9e3dd',
  bgSoft: '#ece8e2',
  /** 페이지 배경 — iOS 설정처럼 카드보다 확실히 깊은 워멀 그레이 */
  bg: '#f4f1ed',
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

/** iOS 카드 공통 꼴 — 테두리 없이 큰 라운드 + soft 그림자 */
export const card: ViewStyle = {
  backgroundColor: colors.card,
  borderRadius: 18,
  ...sh.card,
};
