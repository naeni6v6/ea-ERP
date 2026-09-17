import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, TextInput } from '../components/themed';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/ui';
import { colors, ft, sh, tight } from '../theme';

/** 로그인 — 이메일/비밀번호만. 계정·비밀번호 예시는 절대 표시하지 않는다. */
export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<'email' | 'password' | null>(null);

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
        {/* 로고 — 흰 글자가 있어 어두운 면 위에 얹는다. 단색 대신 살짝 밝아지는 그라데이션으로 깊이를 준다 */}
        <View style={s.logoWrap}>
          <LinearGradient
            colors={[colors.shellSoft, colors.shell]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.logoShell}
          >
            <View style={s.logoGlow} pointerEvents="none" />
            <Image source={require('../../assets/motionbridge-logo.png')} style={s.logoImg} resizeMode="contain" />
          </LinearGradient>
        </View>

        <View style={{ gap: 4, paddingHorizontal: 4 }}>
          <Text style={[s.title, ft.extrabold, tight]}>로그인</Text>
          <Text style={s.subtitle}>모션브릿지 ERP 직원 계정으로 들어갑니다</Text>
        </View>

        <View style={{ gap: 10 }}>
          <TextInput
            style={[s.input, focus === 'email' && s.inputFocus]}
            placeholder="이메일"
            placeholderTextColor={colors.inkFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocus('email')}
            onBlur={() => setFocus(null)}
            editable={!busy}
          />
          <TextInput
            style={[s.input, focus === 'password' && s.inputFocus]}
            placeholder="비밀번호"
            placeholderTextColor={colors.inkFaint}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocus('password')}
            onBlur={() => setFocus(null)}
            onSubmitEditing={submit}
            editable={!busy}
          />
          {!!error && <Text style={s.error}>{error}</Text>}
          <PrimaryButton
            title="로그인"
            onPress={submit}
            busy={busy}
            disabled={!email.trim() || !password}
            style={{ marginTop: 4 }}
          />
        </View>

        <Text style={s.foot}>계정이 필요하면 대표에게 요청해 주세요</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 24 },
  logoWrap: { alignItems: 'center' },
  logoShell: {
    alignSelf: 'stretch',
    borderRadius: 24,
    paddingVertical: 30,
    alignItems: 'center',
    overflow: 'hidden',
    ...sh.lift,
  },
  /* 로고 뒤 은은한 주황 빛 — 검은 면이 밋밋하지 않게 */
  logoGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(245,145,30,0.16)',
  },
  logoImg: { width: 210, height: 76 },
  title: { fontSize: 26, color: colors.ink },
  subtitle: { fontSize: 14, color: colors.inkFaint },
  input: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.ink,
  },
  inputFocus: { borderColor: colors.brand },
  error: {
    color: colors.neg,
    fontSize: 13.5,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  foot: { textAlign: 'center', fontSize: 12.5, color: colors.inkFaint },
});
