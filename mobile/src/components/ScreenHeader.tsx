import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, ft } from '../theme';
import type { MainTabParamList } from '../navigation/types';
import { Text } from './themed';

/** 화면마다 하나씩 — 서로 나란히 놓이지 않으므로 각 화면의 성격에 맞는 톤을 쓴다 */
export const HEADER_TINT = {
  brand: { bg: colors.brandSoft, fg: colors.brandDeep },
  viz: { bg: colors.vizSoft, fg: colors.viz },
  pos: { bg: colors.posSoft, fg: colors.pos },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  neutral: { bg: colors.bgSoft, fg: colors.inkMute },
} as const;

/**
 * 헤더 타이틀 — 제목만 덩그러니 두지 않고 iOS 내비게이션 바처럼
 * 작은 색 아이콘 타일 + 큰 제목을 나란히 둔다. (헤더 면·그림자는 navigation의 headerStyle이 맡는다)
 */
export function HeaderTitle({
  title,
  icon,
  tint = HEADER_TINT.brand,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint?: { bg: string; fg: string };
}) {
  return (
    <View style={s.row}>
      <View style={[s.tile, { backgroundColor: tint.bg }]}>
        <Ionicons name={icon} size={16} color={tint.fg} />
      </View>
      <Text style={s.title}>{title}</Text>
    </View>
  );
}

/**
 * 탭 화면용 ← 뒤로가기 — 전체 메뉴에서 들어오는 화면(내 업무 등)에 단다.
 * 탭 내비게이션의 방문 기록(backBehavior: 'history')을 따라 이전 탭으로 돌아가고,
 * 기록이 없으면(앱을 이 탭에서 시작) 전체 메뉴로 보낸다.
 */
export function TabBackButton() {
  const nav = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  return (
    <Pressable
      onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Menu'))}
      hitSlop={10}
      style={s.backBtn}
      accessibilityLabel="뒤로가기"
    >
      <Ionicons name="arrow-back" size={22} color={colors.brandDeep} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tile: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // iOS 큰 제목 느낌 — 자간을 살짝 좁혀 또렷하게
  title: { fontSize: 21, color: colors.ink, letterSpacing: -0.3, ...ft.extrabold },
});
