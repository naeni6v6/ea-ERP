import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './themed';
import { useAuth } from '../auth/AuthContext';
import { useOpenExpenses, useUnsubmitted, visibleRows } from '../api/queries';
import { ft, numFont } from '../theme';
import type { MainTabParamList } from '../navigation/types';

/**
 * 홈 헤더 좌측 — 실제 로고. 헤더 전체가 검은 띠(shell)라 배경 없이 얹는다.
 * 원본 PNG는 위아래 여백이 3분의 2라 글자가 작게 보였다 —
 * 여백을 잘라낸 wordmark(511×79)를 쓰고 비율(6.47:1) 그대로 키운다.
 */
export function LogoTitle() {
  return <Image source={require('../../assets/motionbridge-wordmark.png')} style={s.logoImg} resizeMode="contain" />;
}

/**
 * 알림 벨 — 내가 지금 처리해야 할 건수를 배지로 띄우고, 누르면 그 화면으로 간다.
 * 대표: 미승인 지출 전체(미제출·승인 대기·반려) → 승인함. 배지 수 = 승인함 목록 수.
 * 직원: 아직 제출하지 않은 내 지출 → 지출 탭.
 * 60초 갱신이라 웹에서 처리하면 앱 배지도 함께 줄어든다.
 */
export function ApprovalBell() {
  const { isCeo } = useAuth();
  const nav = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const open = useOpenExpenses(isCeo);
  const unsub = useUnsubmitted();

  const count = isCeo ? visibleRows(open.data?.rows).length : visibleRows(unsub.data?.rows).length;

  const go = () => {
    if (isCeo) nav.navigate('Approvals');
    else nav.navigate('Submit', { seg: 'card' });
  };

  return (
    <Pressable
      onPress={go}
      hitSlop={8}
      style={s.bellWrap}
      accessibilityLabel={count > 0 ? `처리할 지출 ${count}건` : '알림 없음'}
    >
      <Ionicons name="notifications-outline" size={22} color="rgba(255,255,255,0.85)" />
      {count > 0 && (
        <View style={s.badge}>
          <Text style={[s.badgeText, ft.bold, numFont]}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  // 511:79 비율 유지 — 검은 바 높이는 그대로 두고 글자만 키운다
  logoImg: { width: 130, height: 20 },
  bellWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#dc2626', // 웹 bg-red-600
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, color: '#fff', lineHeight: 12 },
});
