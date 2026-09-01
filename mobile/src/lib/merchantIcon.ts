import type { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/**
 * 사용처 자동 아이콘 — 토스처럼 상호명을 분석해 카테고리 아이콘/색을 정한다.
 * 실제 브랜드 로고는 외부 로고 API 없이는 불가능하므로, 키워드 → 카테고리 매핑으로 대신한다.
 * 규칙에 안 걸리면 카드/입출금 기본 아이콘.
 */

export interface MerchantVisual {
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
}

type Tint = { bg: string; fg: string };
const T = {
  brand: { bg: colors.brandSoft, fg: colors.brandDeep } as Tint,
  pos: { bg: colors.posSoft, fg: colors.pos } as Tint,
  viz: { bg: colors.vizSoft, fg: colors.viz } as Tint,
  warn: { bg: colors.warnSoft, fg: colors.warn } as Tint,
  neg: { bg: colors.negSoft, fg: colors.neg } as Tint,
  neutral: { bg: colors.bgSoft, fg: colors.inkMute } as Tint,
};

/** [키워드들, 아이콘, 색] — 위에서부터 먼저 걸리는 규칙 우선 */
const RULES: [string[], MerchantVisual['icon'], Tint][] = [
  // 카페·디저트
  [
    ['커피', '카페', 'CAFE', 'COFFEE', '스타벅스', '이디야', '투썸', '커피빈', '할리스', '폴바셋', '메가엠지', '메가커피', '컴포즈', '빽다방', '공차', '베스킨', '배스킨', '파리바게', '뚜레쥬르', '던킨', '설빙', '디저트', '베이커리', '빵'],
    'cafe-outline',
    T.warn,
  ],
  // 식사·배달
  [
    ['식당', '김밥', '국밥', '치킨', '피자', '버거', '맥도날드', '롯데리아', 'KFC', 'BBQ', 'BHC', '족발', '보쌈', '돈까스', '돈가스', '초밥', '스시', '분식', '푸드', '키친', '냉면', '막국수', '쌀국수', '마라', '반점', '중화', '고기', '구이', '갈비', '삼겹', '횟집', '해장', '샐러드', '도시락', '배달의민족', '우아한형제', '요기요', '쿠팡이츠', '식'],
    'restaurant-outline',
    T.brand,
  ],
  // 편의점·마트
  [
    ['GS25', 'CU', '씨유', '세븐일레븐', '이마트24', '이마트', '홈플러스', '롯데마트', '코스트코', '하나로마트', '마트', '슈퍼', '편의점'],
    'cart-outline',
    T.pos,
  ],
  // 쇼핑·잡화
  [
    ['쿠팡', '컬리', '11번가', 'G마켓', '지마켓', '옥션', '네이버', '스마트스토어', '다이소', '올리브영', '무신사', '아이파크몰', '백화점', '아울렛', '몰', '쇼핑'],
    'bag-handle-outline',
    T.viz,
  ],
  // 교통
  [
    ['철도', '코레일', 'KTX', 'SRT', '고속버스', '버스', '택시', '카카오T', '카카오모빌리티', '티머니', '하이패스', '톨게이트', '주차', '지하철', '교통', '항공', '대한항공', '아시아나', '제주항공'],
    'bus-outline',
    T.viz,
  ],
  // 주유·차량
  [['주유', '충전소', '칼텍스', 'SK에너지', 'S-OIL', '에쓰오일', '오일뱅크', '알뜰주유', '세차', '정비', '타이어'], 'car-outline', T.warn],
  // 통신
  [['SKT', 'SK텔레콤', 'KT ', 'LG유플러스', 'LGU', '유플러스', '통신', '알뜰폰'], 'call-outline', T.viz],
  // 숙박·여행
  [['호텔', '모텔', '리조트', '펜션', '야놀자', '여기어때', '에어비앤비', '숙박'], 'bed-outline', T.viz],
  // 병원·약국
  [['병원', '의원', '약국', '치과', '한의원', '메디컬'], 'medkit-outline', T.neg],
  // 구독·IT
  [
    ['AWS', 'GOOGLE', '구글', 'APPLE', '애플', 'MICROSOFT', 'NOTION', '노션', 'SLACK', '슬랙', 'GITHUB', 'OPENAI', 'ADOBE', '어도비', 'FIGMA', '클라우드', '호스팅', '도메인'],
    'cloud-outline',
    T.viz,
  ],
  // 사무·문구
  [['문구', '오피스', '사무', '알파문구', '핫트랙스'], 'document-text-outline', T.neutral],
  // 간편결제 (가맹점명이 결제사로 오는 경우)
  [['토스페이', '토스', '카카오페이', '네이버페이', '페이코', 'PAYCO'], 'card-outline', T.viz],
  // 급여·인건비
  [['급여', '월급', '상여', '인건비'], 'people-outline', T.pos],
  // 이자·금융
  [['이자', '예금', '적금', '증권', '투자'], 'trending-up-outline', T.pos],
  // 세금·공과
  [['세금', '국세', '지방세', '부가세', '홈택스', '세무', '관세', '4대보험', '국민연금', '건강보험', '고용보험'], 'receipt-outline', T.neutral],
  // 보험
  [['보험', '화재해상', '생명', '손해'], 'shield-checkmark-outline', T.pos],
  // 관리비·공과금
  [['한전', '전기', '도시가스', '가스공사', '수도', '관리비', '임대료', '월세'], 'home-outline', T.warn],
];

const findRule = (name: string): MerchantVisual | null => {
  const up = name.toUpperCase();
  for (const [needles, icon, tint] of RULES) {
    if (needles.some((n) => up.includes(n.toUpperCase()))) return { icon, ...tint };
  }
  return null;
};

/** 카드지출용 — 못 알아보면 기본 카드 아이콘 */
export const cardMerchantVisual = (storeName: string | null): MerchantVisual =>
  findRule(storeName ?? '') ?? { icon: 'card-outline', ...T.neutral };

/** 계좌 입출금용 — 못 알아보면 방향 화살표 */
export const bankMerchantVisual = (name: string, direction: 'IN' | 'OUT'): MerchantVisual =>
  findRule(name) ??
  (direction === 'IN' ? { icon: 'arrow-down-outline', ...T.pos } : { icon: 'arrow-up-outline', ...T.neutral });
