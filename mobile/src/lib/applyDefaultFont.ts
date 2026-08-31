import { Platform } from 'react-native';

/**
 * 웹(PC 뷰어) 전용 — 전역 CSS로 Pretendard를 기본 글꼴로 깐다.
 * (expo-font가 @font-face를 등록해 준다)
 *
 * 네이티브는 여기서 처리하지 않는다: RN 0.81의 Text는 ref-as-prop 방식의
 * 평범한 함수 컴포넌트라 render/defaultProps 패치가 전부 무효다.
 * 대신 components/themed.tsx 의 Text/TextInput 래퍼를 모든 화면이 쓴다.
 */
if (Platform.OS === 'web') {
  try {
    const style = document.createElement('style');
    style.textContent =
      "html, body, #root { font-family: 'Pretendard-Regular', 'Pretendard', -apple-system, 'Apple SD Gothic Neo', sans-serif; }";
    document.head.appendChild(style);
  } catch {
    /* document가 없는 환경이면 건너뜀 */
  }
}

export {};
