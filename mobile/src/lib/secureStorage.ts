import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * 토큰 저장소.
 * - 실제 앱(iOS/Android): expo-secure-store = Keychain / Keystore
 * - 웹: SecureStore가 없다. PC 모바일뷰어로 화면을 볼 때만 쓰는 경로라
 *   localStorage로 대체한다. 운영 빌드는 웹으로 내보내지 않는다.
 */
const isWeb = Platform.OS === 'web';

const webStore = {
  get(k: string): string | null {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* 사생활 보호 모드 등 — 저장 실패는 무시하고 세션만 유지한다 */
    }
  },
  remove(k: string) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* 위와 동일 */
    }
  },
};

export const storageGet = (key: string): Promise<string | null> =>
  isWeb ? Promise.resolve(webStore.get(key)) : SecureStore.getItemAsync(key);

export const storageSet = (key: string, value: string): Promise<void> =>
  isWeb ? (webStore.set(key, value), Promise.resolve()) : SecureStore.setItemAsync(key, value);

export const storageDelete = (key: string): Promise<void> =>
  isWeb ? (webStore.remove(key), Promise.resolve()) : SecureStore.deleteItemAsync(key);
