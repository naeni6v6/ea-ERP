import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { colors, ft, tight } from '../theme';
import type { MainTabParamList } from '../navigation/types';
import { Text } from './themed';

/**
 * 헤더 타이틀 — 장식 없이 큰 제목 하나. (헤더 면·그림자는 navigation의 headerStyle이 맡는다)
 * 작은 부제가 있으면 제목 아래 한 줄로 조용히 붙인다.
 */
export function HeaderTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View>
      <Text style={[s.title, ft.extrabold, tight]}>{title}</Text>
      {!!sub && <Text style={s.sub}>{sub}</Text>}
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
      <Ionicons name="chevron-back" size={24} color={colors.ink} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  title: { fontSize: 22, color: colors.ink },
  sub: { fontSize: 12, color: colors.inkFaint, marginTop: 1 },
});
