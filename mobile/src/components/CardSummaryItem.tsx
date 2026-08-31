import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import type { CorporateCard } from '../api/types';
import { CardBrandMark, brandOf } from './CardBrandMark';
import { big, won } from '../lib/money';
import { colors, ft, numFont } from '../theme';

/** 내 카드 1장 — 이번 달 이용금액(크게) + 잔여한도 */
export function CardSummaryItem({ card }: { card: CorporateCard }) {
  const brand = brandOf(card.issuer);
  const used = big(card.monthUsed);
  const limit = card.monthlyLimit === null || card.monthlyLimit === undefined ? null : big(card.monthlyLimit);
  const remain = limit === null ? null : limit - used;

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CardBrandMark issuer={card.issuer} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.cardName, ft.bold]} numberOfLines={1}>
            {brand.label !== '기타' ? brand.label.replace('카드', '') : card.issuer} {card.last4 ?? ''}
          </Text>
          <Text style={s.cardSub} numberOfLines={1}>
            {card.name}
            {card.holder ? ` · ${card.holder.name}` : ''}
          </Text>
        </View>
        {card.pendingCount > 0 && (
          <View style={s.pendingBadge}>
            <Text style={[{ color: colors.warn, fontSize: 12 }, ft.bold]}>미제출 {card.pendingCount}</Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: 14 }}>
        <Text style={s.usedLabel}>이번 달 이용금액</Text>
        <Text style={[s.usedAmount, ft.extrabold, numFont]}>{won(used)}</Text>
        {limit !== null && (
          <Text style={[s.remainText, numFont, remain !== null && remain < 0n && { color: colors.neg }]}>
            {remain !== null && remain < 0n
              ? `한도 ${won(limit)} 초과 (${won(-remain)})`
              : `잔여한도 ${won(remain)} / ${won(limit)}`}
          </Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  cardName: { fontSize: 16, color: colors.ink },
  cardSub: { fontSize: 13, color: colors.inkFaint, marginTop: 2 },
  pendingBadge: {
    backgroundColor: colors.warnSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  usedLabel: { fontSize: 13, color: colors.inkFaint },
  usedAmount: { fontSize: 28, color: colors.ink, marginTop: 2 },
  remainText: { fontSize: 13, color: colors.inkMute, marginTop: 4 },
});
