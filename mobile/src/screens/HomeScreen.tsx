import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useCards, useUnsubmitted, visibleRows } from '../api/queries';
import type { CorporateCard } from '../api/types';
import { CardBrandMark, brandOf } from '../components/CardBrandMark';
import { OfflineBanner } from '../components/OfflineBanner';
import { Empty, ErrorView, Spinner } from '../components/ui';
import { big, won } from '../lib/money';
import { colors, numFont } from '../theme';
import type { MainTabParamList } from '../navigation/types';

/** 홈 — 내 카드와 이번 달 이용금액. 상단에 미제출 알림 배너. */
export function HomeScreen() {
  const nav = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const cards = useCards();
  const unsub = useUnsubmitted();
  const unsubCount = visibleRows(unsub.data?.rows).length;

  const refreshing = cards.isFetching && !cards.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <OfflineBanner dataUpdatedAt={cards.dataUpdatedAt || undefined} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              cards.refetch();
              unsub.refetch();
            }}
            tintColor={colors.brand}
          />
        }
      >
        {unsubCount > 0 && (
          <Pressable style={s.banner} onPress={() => nav.navigate('Submit')}>
            <View style={{ flex: 1 }}>
              <Text style={s.bannerTitle}>아직 제출하지 않은 지출이 {unsubCount}건 있어요</Text>
              <Text style={s.bannerSub}>용도를 입력하고 제출해주세요</Text>
            </View>
            <View style={s.bannerBtn}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>지금 제출하기</Text>
            </View>
          </Pressable>
        )}

        <Text style={s.sectionTitle}>내 카드</Text>

        {cards.isLoading ? (
          <Spinner />
        ) : cards.isError && !cards.data ? (
          <ErrorView
            message={cards.error instanceof Error ? cards.error.message : '카드를 불러오지 못했습니다'}
            onRetry={() => cards.refetch()}
          />
        ) : !cards.data?.filter((c) => c.isActive).length ? (
          <Empty>등록된 카드가 없습니다</Empty>
        ) : (
          cards.data
            .filter((c) => c.isActive)
            .map((c) => <CardItem key={c.id} card={c} />)
        )}
      </ScrollView>
    </View>
  );
}

function CardItem({ card }: { card: CorporateCard }) {
  const brand = brandOf(card.issuer);
  const used = big(card.monthUsed);
  const limit = card.monthlyLimit === null || card.monthlyLimit === undefined ? null : big(card.monthlyLimit);
  const remain = limit === null ? null : limit - used;

  return (
    <View style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <CardBrandMark issuer={card.issuer} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardName} numberOfLines={1}>
            {brand.label !== '기타' ? brand.label.replace('카드', '') : card.issuer} {card.last4 ?? ''}
          </Text>
          <Text style={s.cardSub} numberOfLines={1}>
            {card.name}
            {card.holder ? ` · ${card.holder.name}` : ''}
          </Text>
        </View>
        {card.pendingCount > 0 && (
          <View style={s.pendingBadge}>
            <Text style={{ color: colors.warn, fontSize: 12, fontWeight: '700' }}>미제출 {card.pendingCount}</Text>
          </View>
        )}
      </View>

      <View style={{ marginTop: 14 }}>
        <Text style={s.usedLabel}>이번 달 이용금액</Text>
        <Text style={[s.usedAmount, numFont]}>{won(used)}</Text>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.brandSoft,
    borderColor: '#f3cf9c',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  bannerTitle: { color: colors.brandDeep, fontWeight: '700', fontSize: 15, lineHeight: 21 },
  bannerSub: { color: colors.inkMute, fontSize: 13, marginTop: 2 },
  bannerBtn: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, marginTop: 6 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
  },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardSub: { fontSize: 13, color: colors.inkFaint, marginTop: 2 },
  pendingBadge: {
    backgroundColor: colors.warnSoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  usedLabel: { fontSize: 13, color: colors.inkFaint },
  usedAmount: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 2 },
  remainText: { fontSize: 13, color: colors.inkMute, marginTop: 4 },
});
