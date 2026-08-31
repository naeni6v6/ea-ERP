import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

const ROLE_LABEL: Record<string, string> = { CEO: '대표', ADMIN: '관리자', EMPLOYEE: '직원' };

/** 내 정보 — 이름/이메일/부서/권한, 비밀번호 변경, 로그아웃 */
export function ProfileScreen() {
  const { state, signOut } = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [busy, setBusy] = useState(false);
  if (state.status !== 'signedIn') return null;
  const me = state.me;
  const roles = [...new Set(me.roles.map((r) => ROLE_LABEL[r.role] ?? r.role))].join(' · ');

  const confirmSignOut = () => {
    Alert.alert('로그아웃', '로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          await signOut();
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={s.card}>
        <Text style={s.name}>{me.name}</Text>
        <Text style={s.meta}>{me.email}</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {me.department?.name && (
            <View style={s.tag}>
              <Text style={s.tagText}>{me.department.name}</Text>
            </View>
          )}
          {!!roles && (
            <View style={[s.tag, { backgroundColor: colors.brandSoft }]}>
              <Text style={[s.tagText, { color: colors.brandDeep }]}>{roles}</Text>
            </View>
          )}
        </View>
      </View>

      <Pressable style={s.menuRow} onPress={() => nav.navigate('ChangePassword')}>
        <Text style={s.menuText}>비밀번호 변경</Text>
        <Text style={{ color: colors.inkFaint }}>›</Text>
      </Pressable>

      <Pressable style={s.menuRow} onPress={confirmSignOut} disabled={busy}>
        <Text style={[s.menuText, { color: colors.neg }]}>{busy ? '로그아웃 중…' : '로그아웃'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.ink },
  meta: { fontSize: 14, color: colors.inkMute, marginTop: 2 },
  tag: {
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: { fontSize: 13, color: colors.inkMute, fontWeight: '600' },
  menuRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
  },
  menuText: { fontSize: 16, color: colors.ink, fontWeight: '600' },
});
