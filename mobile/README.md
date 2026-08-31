# 모션브릿지 모바일 앱 (직원용)

법인카드 지출의 **용도 입력·제출**(직원)과 **승인·반려**(대표)를 휴대폰에서 처리하는 앱입니다.
백엔드는 기존 ERP API(`apps/api`)를 수정 없이 그대로 사용합니다.
요구사항 원문: [docs/모바일앱_개발_프롬프트.md](../docs/모바일앱_개발_프롬프트.md)

## 개발 실행

```bash
cd mobile
npm install
npx expo start
```

1. 개발 PC에서 ERP API가 떠 있어야 합니다 (루트의 `실행.bat`).
2. 휴대폰에 **Expo Go** 앱을 설치하고, 같은 와이파이에서 터미널의 QR을 스캔합니다.
3. API 주소는 자동으로 `http://<개발PC LAN IP>:4000/api`를 가리킵니다
   (다르게 쓰려면 `app.json` → `expo.extra.apiBaseDev`).

## 운영 빌드 전 필수

- `app.json` → `expo.extra.apiBaseProd`를 실제 **HTTPS** API 주소로 교체
  (현재는 자리표시자 `https://erp-api.example.com/api`. HTTP거나 미설정이면 앱이 부팅 시점에 오류를 냅니다)
- 서버 외부 공개(선행 작업)는 요구사항 문서의 "선행 작업" 절 참고 — 특히 보안 체크리스트

## 구조

```
App.tsx                      진입점 — 쿼리 영속 캐시·인증·잠금 가드
src/config.ts                API 주소(dev 자동/prod extra)·타임아웃·잠금 시간
src/api/client.ts            fetch 래퍼 — 15초 타임아웃, 401→refresh 회전 후 1회 재시도
src/api/queries.ts           조회 훅 (카드/미제출/승인대기/용도 코드값)
src/auth/AuthContext.tsx     로그인·refresh·로그아웃, SecureStore 토큰 보관
src/auth/LockGuard.tsx       캡처 방지·앱전환 가림·15분 자동 잠금(생체인증)
src/screens/                 로그인/홈/일괄제출/지출상세/승인함/내정보/비밀번호변경
src/lib/money.ts             BigInt 금액 (float 금지) · dates.ts KST 유틸
```

## 주요 규칙 (요구사항 문서 §7 반영)

- 금액은 문자열/BigInt만 사용 — float 연산 금지
- 쓰기(제출·승인)는 자동 재시도하지 않음 — 실패 건수·사유를 화면에 명시
- 목록은 AsyncStorage에 영속 캐시 → 오프라인이면 "오프라인 · 마지막 조회 시각" 배너 표시
- 토큰은 SecureStore(iOS Keychain / Android Keystore)에만 저장, 로그 금지
- `EXCLUDED`·취소 건은 목록에서 숨김
- 로그인 유지: access 12시간 + **refresh 토큰 30일 회전** (`POST /api/auth/refresh`, 이번에 백엔드에 추가)
