import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Text, TextInput } from '../components/themed';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api/client';
import { PrimaryButton } from '../components/ui';
import { colors } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

/** 비밀번호 변경 — 새 비밀번호 8자 이상. 변경하면 다른 기기의 로그인 유지도 풀린다. */
export function ChangePasswordScreen({ navigation }: Props) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (next.length < 8) return setError('새 비밀번호는 8자 이상이어야 합니다');
    if (next !== next2) return setError('새 비밀번호가 서로 다릅니다');
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setDone(true);
      setTimeout(() => navigation.goBack(), 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        keyboardShouldPersistTaps="handled"
      >
        <TextInput
          style={s.input}
          placeholder="현재 비밀번호"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          value={current}
          onChangeText={setCurrent}
          editable={!busy && !done}
        />
        <TextInput
          style={s.input}
          placeholder="새 비밀번호 (8자 이상)"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          value={next}
          onChangeText={setNext}
          editable={!busy && !done}
        />
        <TextInput
          style={s.input}
          placeholder="새 비밀번호 확인"
          placeholderTextColor={colors.inkFaint}
          secureTextEntry
          value={next2}
          onChangeText={setNext2}
          editable={!busy && !done}
        />
        {!!error && <Text style={{ color: colors.neg, fontSize: 14 }}>{error}</Text>}
        {done && <Text style={{ color: colors.pos, fontSize: 14 }}>비밀번호를 변경했습니다</Text>}
        <PrimaryButton
          title="변경하기"
          onPress={submit}
          busy={busy}
          disabled={done || !current || !next || !next2}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
});
