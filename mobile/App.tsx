import './src/lib/applyDefaultFont';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { AuthProvider } from './src/auth/AuthContext';
import { LockGuard } from './src/auth/LockGuard';
import { RootNavigator } from './src/navigation';

/**
 * 모션브릿지 직원용 앱.
 * - 조회 결과는 AsyncStorage에 영속 캐시 → 오프라인에서도 마지막 조회 내용을 보여준다.
 *   (쓰기는 캐시·자동 재시도 없음 — 중복 제출 방지)
 * - 토큰은 SecureStore(AuthContext), 화면 보호는 LockGuard가 맡는다.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 7 * 24 * 3600 * 1000, // 영속 캐시 보관 기간과 맞춘다
      retry: 1, // 조회만 1회 재시도 — 쓰기는 useMutation을 쓰지 않고 화면에서 직접 호출한다
    },
  },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'mb.query-cache' });

export default function App() {
  // 웹과 같은 글꼴 — 로드 전에는 잠깐 빈 화면 (번들 내 파일이라 순간이다)
  const [fontsLoaded] = useFonts({
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.otf'),
    'Pretendard-SemiBold': require('./assets/fonts/Pretendard-SemiBold.otf'),
    'Pretendard-Bold': require('./assets/fonts/Pretendard-Bold.otf'),
    'Pretendard-ExtraBold': require('./assets/fonts/Pretendard-ExtraBold.otf'),
  });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 7 * 24 * 3600 * 1000 }}
      >
        <AuthProvider>
          <LockGuard>
            <RootNavigator />
          </LockGuard>
        </AuthProvider>
      </PersistQueryClientProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
