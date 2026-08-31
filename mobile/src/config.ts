import Constants from 'expo-constants';

/**
 * API 주소 — 빌드 설정으로 분리한다. 코드에 하드코딩 금지.
 * - 운영 빌드: app.json → expo.extra.apiBaseProd (반드시 HTTPS)
 * - 개발: Metro 호스트(개발 PC)의 4000 포트를 자동으로 가리킨다.
 *   다른 주소를 쓰려면 app.json extra.apiBaseDev 로 지정.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseProd?: string; apiBaseDev?: string };

const devDefault = () => {
  // hostUri 예: "192.168.0.12:8081" — Expo 개발 서버를 띄운 PC의 LAN 주소
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:4000/api` : 'http://localhost:4000/api';
};

export const API_BASE: string = __DEV__ ? extra.apiBaseDev ?? devDefault() : extra.apiBaseProd ?? '';

if (!__DEV__ && !API_BASE.startsWith('https://')) {
  // 운영 빌드에 평문 HTTP·미설정 주소가 들어가는 실수를 부팅 시점에 잡는다
  throw new Error('운영 빌드에는 HTTPS API 주소(expo.extra.apiBaseProd)가 필요합니다');
}

export const REQUEST_TIMEOUT_MS = 15000;
/** 미사용 자동 잠금 시간 */
export const LOCK_AFTER_MS = 15 * 60 * 1000;
