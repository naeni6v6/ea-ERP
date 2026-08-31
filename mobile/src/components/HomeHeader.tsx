import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './themed';
import { useAuth } from '../auth/AuthContext';
import { useSubmitted } from '../api/queries';
import { colors, ft, numFont } from '../theme';
import type { MainTabParamList } from '../navigation/types';

/** 홈 헤더 좌측 — 실제 로고 (흰 글자가 있어 웹 헤더처럼 어두운 shell 면 위에 얹는다) */
export function LogoTitle() {
  return (
    <View style={s.logoShell}>
      <Image source={require('../../assets/motionbridge-logo.png')} style={s.logoImg} resizeMode="contain" />
    </View>
  );
}

/**
 * 결제 승인 알림 벨 — 웹 헤더의 ApprovalBell과 동일 데이터.
 * 같은 서버의 승인 대기 건수를 60초마다 읽으므로 웹에서 승인하면 앱 배지도 함께 줄어든다.
 * 웹과 동일하게 대표에게만 보이고, 누르면 승인함으로 간다.
 */
export function ApprovalBell() {
  const { isCeo } = useAuth();
  const nav = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const q = useSubmitted(isCeo);
  if (!isCeo) return null;
  const count = q.data?.summary.submitted.count ?? 0;

  return (
    <Pressable
      onPress={() => nav.navigate('Approvals')}
      hitSlop={8}
      style={s.bellWrap}
      accessibilityLabel={`결제 승인 대기 ${count}건`}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.inkMute} />
      {count > 0 && (
        <View style={s.badge}>
          <Text style={[s.badgeText, ft.bold, numFont]}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  logoShell: {
    backgroundColor: colors.shell,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logoImg: { width: 88, height: 26 },
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
