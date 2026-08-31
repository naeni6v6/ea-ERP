# 모션브릿지 모바일 앱 (직원용)

법인카드 지출의 **용도 입력·제출**(직원)과 **승인·반려**(대표)를 휴대폰에서 처리하는 앱입니다.
백엔드는 기존 ERP API(`apps/api`)를 수정 없이 그대로 사용합니다.
요구사항 원문: [docs/모바일앱_개발_프롬프트.md](../docs/모바일앱_개발_프롬프트.md)

## 개발 실행 (가장 쉬운 방법)

1. 루트의 **`실행.bat`** — ERP 서버를 켭니다 (앱이 데이터를 가져올 곳)
2. 이 폴더의 **`앱실행.bat`** — 휴대폰 연결용 QR이 뜹니다
3. 휴대폰에 **Expo Go** 설치 → PC와 같은 와이파이 → QR 스캔
   - 아이폰은 기본 카메라 앱으로, 안드로이드는 Expo Go 안에서 스캔합니다

처음 실행하면 Windows 방화벽 창이 뜹니다. **반드시 "액세스 허용"** 을 눌러야
휴대폰에서 PC로 접속할 수 있습니다 (거부하면 QR을 찍어도 연결되지 않습니다).

터미널로 직접 실행하려면:

```bash
cd mobile
npm install
npx expo start
```

API 주소는 자동으로 `http://<개발PC LAN IP>:4000/api`를 가리킵니다
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
