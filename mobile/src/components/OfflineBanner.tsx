import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import NetInfo from '@react-native-community/netinfo';
import { colors } from '../theme';
import { clockLabel } from '../lib/dates';

/** 네트워크 상태 훅 — null이면 아직 모름 */
export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    const sub = NetInfo.addEventListener((s) => {
      setOnline(s.isConnected === null ? null : s.isConnected && s.isInternetReachable !== false);
    });
    return () => sub();
  }, []);
  return online;
}

/** "오프라인 · 마지막 조회 8/31 14:05" — 캐시 내용을 보여줄 때 반드시 붙인다 */
export function OfflineBanner({ dataUpdatedAt }: { dataUpdatedAt?: number }) {
  const online = useOnline();
  if (online !== false) return null;
  return (
    <View style={s.banner}>
      <Text style={s.text}>
        오프라인{dataUpdatedAt ? ` · 마지막 조회 ${clockLabel(dataUpdatedAt)}` : ''} — 표시된 내용은 이전에 불러온
        것입니다
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: { color: '#fff', fontSize: 13, textAlign: 'center' },
});
