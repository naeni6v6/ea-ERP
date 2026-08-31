import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { LOCK_AFTER_MS } from '../config';
import { useAuth } from '../auth/AuthContext';
import { PrimaryButton } from '../components/ui';
import { colors } from '../theme';

/**
 * 회사 밖에서 열리는 화면 보호.
 * - Android: FLAG_SECURE로 스크린샷·앱 전환 미리보기를 막는다.
 * - iOS: 앱이 비활성일 때 가림막을 덮어 앱 전환 미리보기에 금액이 남지 않게 한다.
 * - 15분 미사용 시 잠금 → 생체인증(또는 기기 잠금 수단)으로 해제.
 *   생체인증·기기 잠금이 없는 기기는 잠그지 않는다(해제 수단이 없으므로).
 */
export function LockGuard({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [locked, setLocked] = useState(false);
  const [canLock, setCanLock] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const hiddenAt = useRef<number | null>(null);
  const signedIn = state.status === 'signedIn';

  useEffect(() => {
    if (Platform.OS === 'android') {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    }
    (async () => {
      try {
        const has = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const level = await LocalAuthentication.getEnrolledLevelAsync();
        setCanLock((has && enrolled) || level !== LocalAuthentication.SecurityLevel.NONE);
      } catch {
        setCanLock(false);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setAppState(next);
      if (next !== 'active') {
        if (hiddenAt.current === null) hiddenAt.current = Date.now();
      } else {
        const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (away > LOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    setUnlockError('');
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: '잠금 해제',
        cancelLabel: '취소',
      });
      if (r.success) setLocked(false);
      else setUnlockError('인증에 실패했습니다. 다시 시도해주세요.');
    } catch {
      setUnlockError('인증을 시작할 수 없습니다. 다시 시도해주세요.');
    }
  }, []);

  const showLock = signedIn && canLock && locked;
  const showCover = signedIn && appState !== 'active';

  return (
    <View style={{ flex: 1 }}>
      {children}
      {showCover && !showLock && (
        <View style={[StyleSheet.absoluteFill, s.cover]}>
          <View style={s.logoMark}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>M</Text>
          </View>
        </View>
      )}
      {showLock && (
        <View style={[StyleSheet.absoluteFill, s.cover, { gap: 16, padding: 32 }]}>
          <View style={s.logoMark}>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>M</Text>
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>화면이 잠겨 있습니다</Text>
          <Text style={{ fontSize: 14, color: colors.inkMute, textAlign: 'center' }}>
            한동안 사용하지 않아 잠갔습니다.{'\n'}본인 확인 후 이어서 사용할 수 있습니다.
          </Text>
          {!!unlockError && <Text style={{ color: colors.neg, fontSize: 14 }}>{unlockError}</Text>}
          <PrimaryButton title="잠금 해제" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  cover: {
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
