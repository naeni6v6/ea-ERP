import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import { useNotice } from '../api/queries';
import { colors, ft } from '../theme';

/** 오늘의 공지 — 전 직원 읽기 (작성·수정은 웹에서) */
export function NoticeBanner() {
  const q = useNotice();
  if (!q.data?.content) return null;
  return (
    <View style={s.banner}>
      <Text style={[s.tag, ft.bold]}>📢 오늘의 공지</Text>
      <Text style={s.content}>{q.data.content}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: colors.shell,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  tag: { fontSize: 12, color: colors.brand },
  content: { fontSize: 14, lineHeight: 21, color: '#f5f2ef' },
});
