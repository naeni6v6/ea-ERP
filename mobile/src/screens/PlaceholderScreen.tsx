import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../components/themed';
import { colors, ft } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Placeholder'>;

/**
 * 전체 메뉴에서 열리는 '아직 모바일로 안 옮긴' 웹 화면 자리.
 * 메뉴 구조는 웹과 동일하게 먼저 깔아 두고(v2), 화면은 순서대로 채운다.
 */
export function PlaceholderScreen({ route }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.iconCircle}>
        <Ionicons name="construct-outline" size={30} color={colors.brandDeep} />
      </View>
      <Text style={s.title}>{route.params.title} 화면을 준비하고 있어요</Text>
      <Text style={s.body}>지금은 웹 ERP(PC)에서 이용할 수 있어요.{'\n'}모바일에서도 곧 순서대로 열립니다.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, color: colors.ink, textAlign: 'center', ...ft.bold },
  body: { fontSize: 14, lineHeight: 21, color: colors.inkMute, textAlign: 'center' },
});
