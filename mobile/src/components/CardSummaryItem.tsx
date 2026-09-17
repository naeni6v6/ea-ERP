import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import type { CorporateCard } from '../api/types';
import { CardBrandMark, brandOf } from './CardBrandMark';
import { big, won } from '../lib/money';
import { card, colors, ft, numFont, tight } from '../theme';

/** 내 카드 1장 — 이번 달 이용금액(크게) + 잔여한도 */
export function CardSummaryItem({ card: c }: { card: CorporateCard }) {
  const brand = brandOf(c.issuer);
  const used = big(c.monthUsed);
  const limit = c.monthlyLimit === null || c.monthlyLimit === undefined ? null : big(c.monthlyLimit);
  const remain = limit === null ? null : limit - used;
  const usedPct = limit !== null && limit > 0n ? Math.min(100, Number((used * 100n) / limit)) : null;

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CardBrandMark issuer={c.issuer} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.cardName, ft.bold]} numberOfLines={1}>
            {brand.label !== '기타' ? brand.label.replace('카드', '') : c.issuer} {c.last4 ?? ''}
          </Text>
          <Text style={s.cardSub} numberOfLines={1}>
            {c.name}
            {c.holder ? ` · ${c.holder.name}` : ''}
          </Text>
        </View>
        {c.pendingCount > 0 && (
          <View style={s.pendingBadge}>
            <Text style={[{ color: colors.warn, fontSize: 12 }, ft.bold]}>미제출 {c.pendingCount}</Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: 14 }}>
        <Text style={s.usedLabel}>이번 달 이용금액</Text>
        <Text style={[s.usedAmount, ft.extrabold, numFont, tight]}>{won(used)}</Text>
        {limit !== null && (
          <>
            {usedPct !== null && (
              <View style={s.track}>
                <View
                  style={[
                    s.fill,
                    { width: `${usedPct}%`, backgroundColor: remain !== null && remain < 0n ? colors.neg : colors.brand },
                  ]}
                />
              </View>
            )}
            <Text style={[s.remainText, numFont, remain !== null && remain < 0n && { color: colors.neg }]}>
              {remain !== null && remain < 0n
                ? `한도 ${won(limit)} 초과 (${won(-remain)})`
                : `잔여한도 ${won(remain)} / ${won(limit)}`}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    padding: 16,
    ...card,
  },
  cardName: { fontSize: 15.5, color: colors.ink },
  cardSub: { fontSize: 13, color: colors.inkFaint, marginTop: 2 },
  pendingBadge: {
    backgroundColor: colors.warnSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  usedLabel: { fontSize: 12.5, color: colors.inkFaint },
  usedAmount: { fontSize: 26, color: colors.ink, marginTop: 4, lineHeight: 32 },
  track: { height: 5, borderRadius: 999, backgroundColor: colors.bgSoft, overflow: 'hidden', marginTop: 10 },
  fill: { height: '100%', borderRadius: 999 },
  remainText: { fontSize: 12.5, color: colors.inkMute, marginTop: 6 },
});
