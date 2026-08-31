import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './themed';
import { useNotice } from '../api/queries';
import { colors, ft } from '../theme';

/** 오늘의 공지 — 웹 NoticeBanner(확인 후 톤)와 동일한 빨간 계열. 읽기 전용(작성·수정은 웹에서) */
export function NoticeBanner() {
  const q = useNotice();
  if (!q.data?.content) return null;
  return (
    <View style={s.banner}>
      <View style={s.head}>
        <Text style={s.icon}>📣</Text>
        <Text style={[s.tag, ft.bold]}>오늘의 공지</Text>
      </View>
      <Text style={[s.content, ft.semibold]}>{q.data.content}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    backgroundColor: '#fdf2f1', // 웹 bg-red-50/60
    borderWidth: 1,
    borderColor: '#f6d5d0', // 웹 border-red-100
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 13 },
  tag: { fontSize: 12, color: '#e0442e' }, // 웹 text-red-500 톤
  content: { fontSize: 14, lineHeight: 21, color: colors.inkMute },
});
