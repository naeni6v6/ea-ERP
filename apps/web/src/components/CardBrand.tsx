'use client';

import { useState } from 'react';

/**
 * 카드 발급사 표식.
 * public/card-logos/<key>.png 가 있으면 그 로고를, 없으면 브랜드 대표색 + 약칭 마크를 그린다.
 * 카드사 로고는 상표라 저장소에 포함하지 않는다 — 각 사 브랜드 가이드에서 받은 파일을 넣으면 자동으로 바뀐다.
 */
interface Brand {
  /** public/card-logos/<key>.png 파일명 */
  key: string;
  /** 로고가 없을 때 쓰는 마크 배경색 */
  bg: string;
  /** 마크 안 약칭 (1~3자) */
  short: string;
  /** 표시용 정식 명칭 */
  label: string;
}

/** issuer 문자열에 포함되면 해당 브랜드로 본다 — 표기 흔들림("신한", "신한카드", "SHINHAN")을 흡수 */
const BRANDS: [string[], Brand][] = [
  [['신한', 'SHINHAN'], { key: 'shinhan', bg: '#0046ff', short: 'S', label: '신한카드' }],
  [['국민', 'KB'], { key: 'kb', bg: '#ffbc00', short: 'KB', label: 'KB국민카드' }],
  [['하나', 'HANA'], { key: 'hana', bg: '#008485', short: 'H', label: '하나카드' }],
  [['우리', 'WOORI'], { key: 'woori', bg: '#0067ac', short: 'W', label: '우리카드' }],
  [['삼성', 'SAMSUNG'], { key: 'samsung', bg: '#1428a0', short: 'S', label: '삼성카드' }],
  [['현대', 'HYUNDAI'], { key: 'hyundai', bg: '#232323', short: 'H', label: '현대카드' }],
  [['롯데', 'LOTTE'], { key: 'lotte', bg: '#da291c', short: 'L', label: '롯데카드' }],
  [['비씨', 'BC'], { key: 'bc', bg: '#e4002b', short: 'BC', label: 'BC카드' }],
  [['농협', 'NH'], { key: 'nh', bg: '#0a8a3f', short: 'NH', label: 'NH농협카드' }],
  [['기업', 'IBK'], { key: 'ibk', bg: '#00539f', short: 'IBK', label: 'IBK기업은행' }],
  [['고위드', 'GOWID'], { key: 'gowid', bg: '#5b49d6', short: 'G', label: '고위드' }],
];

const FALLBACK: Brand = { key: '', bg: '#857d75', short: '카드', label: '기타' };

export const brandOf = (issuer: string | null | undefined): Brand => {
  const s = (issuer ?? '').toUpperCase();
  for (const [keys, brand] of BRANDS) if (keys.some((k) => s.includes(k.toUpperCase()))) return brand;
  return FALLBACK;
};

/** 발급사 마크 — 목록/상세에서 같은 자리·크기로 쓴다 */
export function CardBrandMark({
  issuer,
  size = 40,
}: {
  issuer: string | null | undefined;
  size?: number;
}) {
  const b = brandOf(issuer);
  // 로고 파일이 없으면(404) 색상 마크로 되돌린다 — 파일을 넣는 순간 자동으로 로고가 뜬다
  const [noLogo, setNoLogo] = useState(false);

  if (b.key && !noLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/card-logos/${b.key}.png`}
        alt=""
        title={issuer || b.label}
        width={size}
        height={size}
        onError={() => setNoLogo(true)}
        className="shrink-0 rounded-full object-contain"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        background: b.bg,
        width: size,
        height: size,
        fontSize: Math.max(10, size * (b.short.length > 2 ? 0.26 : b.short.length > 1 ? 0.32 : 0.44)),
      }}
      title={issuer || b.label}
      aria-hidden
    >
      {b.short}
    </span>
  );
}

/** 뒤 4자리만 아는 카드의 가림 번호 */
export const maskedNumber = (last4: string | null | undefined): string =>
  last4 ? `**** **** **** ${last4}` : '**** **** **** ****';
