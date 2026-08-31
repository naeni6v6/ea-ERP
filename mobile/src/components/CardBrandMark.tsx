import React from 'react';
import { Text, View } from 'react-native';
import { colors } from '../theme';

/** 발급사별 브랜드 색 — 웹 components/CardBrand.tsx와 동일 규칙 */
type Brand = { key: string; bg: string; short: string; label: string };

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

const FALLBACK: Brand = { key: '', bg: colors.inkFaint, short: '카드', label: '기타' };

export const brandOf = (issuer: string | null | undefined): Brand => {
  const s = (issuer ?? '').toUpperCase();
  for (const [needles, brand] of BRANDS) if (needles.some((n) => s.includes(n.toUpperCase()))) return brand;
  return FALLBACK;
};

export function CardBrandMark({ issuer, size = 36 }: { issuer: string | null | undefined; size?: number }) {
  const b = brandOf(issuer);
  const fontSize = size * (b.short.length >= 3 ? 0.26 : b.short.length === 2 ? 0.32 : 0.44);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: b.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize }}>{b.short}</Text>
    </View>
  );
}
