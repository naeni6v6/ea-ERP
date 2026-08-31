import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/ui';
import { colors } from '../theme';

/** 로그인 — 이메일/비밀번호만. 계정·비밀번호 예시는 절대 표시하지 않는다. */
export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했습니다');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.logoWrap}>
          <View style={s.logoMark}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>M</Text>
          </View>
          <Text style={s.title}>모션브릿지</Text>
          <Text style={s.subtitle}>법인카드 지출 관리</Text>
        </View>

        <View style={{ gap: 10 }}>
          <TextInput
            style={s.input}
            placeholder="이메일"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
          <TextInput
            style={s.input}
            placeholder="비밀번호"
            placeholderTextColor={colors.inkFaint}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
            editable={!busy}
          />
          {!!error && <Text style={s.error}>{error}</Text>}
          <PrimaryButton title="로그인" onPress={submit} busy={busy} disabled={!email.trim() || !password} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 36 },
  logoWrap: { alignItems: 'center', gap: 8 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.inkFaint },
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
  error: {
    color: colors.neg,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
});
