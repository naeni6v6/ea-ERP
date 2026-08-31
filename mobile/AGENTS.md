# 모션브릿지 모바일 앱 — 작업 규칙

- **Expo SDK 54** (RN 0.81). SDK를 올리기 전에 앱스토어 Expo Go가 지원하는지 먼저 확인할 것:
  `https://itunes.apple.com/lookup?id=982107779` 의 version 확인 (2026-08 기준 54.0.2에 멈춰 있어 SDK 57 불가).
  정확한 API 문서: https://docs.expo.dev/versions/v54.0.0/
- 금액은 문자열/BigInt만 — float 연산 금지 (src/lib/money.ts).
- Text/TextInput은 react-native에서 직접 import하지 말고 `src/components/themed.tsx` 것을 쓸 것 (Pretendard 기본 적용).
- 굵기는 fontWeight 숫자 대신 `theme.ts`의 ft.semibold/bold/extrabold.
- .bat은 ASCII만, 한글 메시지는 .ps1에 두고 UTF-8 BOM으로 저장 (PowerShell 5.1 인코딩 문제).
- 실행: 휴대폰 QR은 `앱실행.bat`(8081), PC 뷰어는 `모바일뷰어_실행.bat`(8082) — 동시 사용 가능.
- 자세한 구조·규칙: README.md
