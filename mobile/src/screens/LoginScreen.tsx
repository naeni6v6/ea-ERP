import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '../components/themed';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/ui';
import { colors, ft, sh } from '../theme';

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
          {/* 웹과 같은 로고 — 흰 글자가 있어 어두운 shell 면 위에 얹는다 (웹 헤더와 동일) */}
          <View style={s.logoShell}>
            <Image
              source={require('../../assets/motionbridge-logo.png')}
              style={s.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={s.subtitle}>모션브릿지 ERP · 직원용</Text>
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
  logoWrap: { alignItems: 'center', gap: 12 },
  logoShell: {
    alignSelf: 'stretch',
    backgroundColor: colors.shell,
    borderRadius: 24,
    paddingVertical: 26,
    alignItems: 'center',
    ...sh.lift,
  },
  logoImg: { width: 220, height: 80 },
  subtitle: { fontSize: 14, color: colors.inkFaint },
  input: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
    ...sh.card,
  },
  error: {
    color: colors.neg,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
});
