# 모션브릿지 ERP (MotionBridge ERP)

관리회계 · 자금관리 · 사업/부서/프로젝트 손익 · 프로젝트/업무 · 권한(Role×Scope)을 하나의 데이터 구조로 연결하는 ERP.
**DB 스키마 + API 서버(NestJS) + 웹 프론트엔드(Next.js)** 까지 구현되어 있습니다.

## 구조
```
ea-erp/
├ docs/01_Phase1_설계초안.md   설계 문서 (아키텍처·ERD·플로우·권한·질문)
├ packages/db/                 Prisma schema + migration + seed
├ apps/api/                    NestJS API (auth · org · projects · ledger · treasury · metrics · audit)
├ apps/web/                    Next.js 14 App Router 대시보드 (대시보드·손익·거래·자금·프로젝트·설정)
├ scripts/e2e.sh               API 시나리오 테스트 (프로젝트→거래→은행분류→대시보드→권한)
└ docker-compose.yml           PostgreSQL 16
```

## 실행 (Windows 원클릭)
**`실행.bat`** 더블클릭 — DB(포터블 PostgreSQL `%USERPROFILE%\pgportable` 또는 Docker) 시작 → 의존성/마이그레이션/시드 자동 처리 → API(:4000)·Web(:3000) 창 실행 → 브라우저 오픈까지 자동.
**`종료.bat`** — 서버 2개와 DB를 모두 종료.
로직은 `scripts/run.ps1` / `scripts/stop.ps1` 에 있다 (bat은 인코딩 문제를 피하기 위한 ASCII 런처).
> 이전 PC(lsy54) 경로가 하드코딩된 구버전 bat과 개발도구 캐시는 `_archive/` 로 이동했다.

## 실행 (수동)
```bash
pnpm install
cp .env.example .env && cp .env packages/db/.env && cp .env apps/api/.env   # DATABASE_URL, JWT_SECRET 수정
pnpm db:up            # docker postgres
pnpm db:migrate       # 테이블 생성
pnpm db:seed          # 사업유형/부서/계정과목/계좌/상태코드/CEO 계정
pnpm dev              # API(:4000) + Web(:3000) 동시 실행
```
- 웹 화면: http://localhost:3000
- API: http://localhost:4000/api
- 초기 로그인: `ceo@eacompany.kr / changeme123!` (즉시 변경 권장)

API만 / 웹만 띄우려면 `pnpm api:dev`, `pnpm web:dev`.
웹은 `apps/web/.env.local` 의 `NEXT_PUBLIC_API_BASE` 로 API 주소를 잡습니다.

`bash scripts/e2e.sh` 로 API 전체 흐름을 검증할 수 있습니다.
> ⚠️ Windows Git Bash에서 실행하면 스크립트의 한글이 cp949로 전송되어 DB에 깨져 저장됩니다.
> Windows에서는 UTF-8 셸(WSL 또는 `chcp 65001` 적용된 터미널)에서 실행하세요.

## 화면 (apps/web)
| 경로 | 내용 | 권한 |
|---|---|---|
| `/login` | 로그인 | 전체 |
| `/` | 대시보드 — 손익 KPI, 자금 KPI, 계좌잔액, 현금예측, 사업/부서별 손익, 프로젝트 현황 | Role별로 노출 필드 상이 |
| `/pnl` | 손익계산서(전년 동기 비교) + 사업/부서/프로젝트/계정과목별 분해 | CEO·ADMIN |
| `/journal` | 거래 목록·상세(분개 라인)·템플릿 등록 폼·VOID | CEO·ADMIN |
| `/treasury` | 계좌 / 은행거래 분류 큐 / 경영유보금 / 지급예정 | CEO |
| `/projects`, `/projects/:id` | 프로젝트 목록·생성, 상세 + 업무 체크 | 전체(scope 적용) |
| `/my` | 내 업무 | 전체 |
| `/settings` | 사용자·권한(Role×Scope) 편집, 감사 로그 | CEO |

상단 전역 필터(기간 preset · 사업유형 · 부서)는 모든 화면이 공유하며 그대로 API 쿼리로 전달됩니다.
금액은 BigInt(원) 문자열을 그대로 다루고 화면에서만 포맷합니다 — float 연산 없음.

## 디자인 토큰 (apps/web/tailwind.config.ts)
| 토큰 | 값 | 용도 |
|---|---|---|
| `brand` | `#f5911e` | 로고 주황. 버튼·강조·활성 탭 |
| `brand-deep` | `#b45f05` | **밝은 배경 위 주황 글자** (밝은 주황은 흰 배경에서 대비가 부족) |
| `shell` | `#1d1a17` | 상단 헤더·로그인 상단 등 어두운 면 |
| `ink` / `line` | 따뜻한 회색 | 순검정·순회색 대신 사용 |

- 서체: **Pretendard Variable** (`public/fonts/`에 번들 — 오프라인·사내망에서도 동일하게 표시)
- 로고(`public/motionbridge-logo.png`)는 검은 배경 위 글로우 이미지라 **어두운 면에서만** 자연스럽습니다.
  `.logo-blend`(`mix-blend-mode: screen`)가 검은 배경을 지웁니다. 밝은 배경에 올리면 흰 "Motion"이 사라집니다.

## 확정한 설계 결정 (요구사항 질문에 대한 기본값 — 변경 가능)
| # | 결정 | 코드 위치 |
|---|---|---|
| Q1 | **경량 복식부기**. UI는 템플릿(매출발생/입금/비용/출금/선급/계약부채/이체/직접분개), 내부는 균형 분개 | `ledger/journal.service.ts` |
| Q2 | 단일 법인(`Company`) 아래 라곰/DAP는 SITE 부서. 다법인은 Company 행 추가로 확장 | schema `Department.kind` |
| Q3 | 프로젝트 직접비(외주·재료·직접인건비)=매출원가(COGS), 급여 등은 부서 판관비(SGA). 급여의 프로젝트 배부는 미구현 | seed 계정과목 `plSection` |
| Q4 | 공통비 **미배부**. 사업/부서 미지정 라인은 "(미지정)"으로 집계 | `metrics.service.ts` |
| Q5 | 자금(총잔액·유보금·가용현금) **CEO 전용**, 손익 CEO/ADMIN(자기 scope), 직원은 프로젝트·업무만. 프로젝트 단위 `financeVisibleToMembers` 플래그 준비 | `common/scope/scope.service.ts` |
| Q6 | 거래는 **공급가액 + 부가세 분리** 기록 (부가세예수금/대급금 계정) | `journal.service.ts` `vatAmount` |
| Q7 | 정부/R&D 전용계좌 `isRestricted=true` → 가용현금에서 제외 | seed, `metrics.treasuryKpi` |
| Q8 | 계약부채: 선결제(`CONTRACT_PREPAY`)·인식(`CONTRACT_RECOGNIZE`) 템플릿만 제공, 회원권 세션관리는 MVP2 | |
| Q9 | PostgreSQL + NestJS + (Next.js 예정), 금액 BIGINT 원, Asia/Seoul | |
| Q10 | 기초잔액은 계좌별 `openingBalance/openingDate` 로 입력 | `PATCH /treasury/bank-accounts/:id` |
| Q11 | 프로젝트 없는 거래 허용, 프로젝트 지정 시 사업유형·주관부서 자동 보완 | `journal.service.create` |
| Q12 | MVP1은 승인 없이 즉시 POSTED. 취소는 VOID(+사유, Audit). Hard delete 없음 | `journal.void` |

## 핵심 원칙 → 구현
- 매출≠입금 / 비용≠출금: 손익은 `JournalLine`(REVENUE/EXPENSE) 집계, 현금은 `BankTransaction` 집계로 완전히 분리
- 은행 원본 불변: `BankTransaction`은 INSERT ONLY, 분류는 `BankTxnClassification` → `JournalEntry` 링크. 수기 거래 취소 시 반대 거래를 INSERT
- 사업/부서 독립축: 라인 단위 dimension(`businessTypeId/departmentId/projectId/ownerUserId/bankAccountId`), 프로젝트–부서 N:M
- Dashboard 계산 단일화: `metrics/metrics.service.ts` 한 곳 (`pnl`, `pnlBreakdown`, `treasuryKpi`, `projectsKpi`, `dashboard`)
- 권한: JWT → 매 요청 DB에서 Role×Scope 재조회 → `ScopeService.lineWhere/projectWhere` 가 모든 쿼리에 주입. 프론트 숨김에 의존하지 않음
- 금액 BigInt(원) / JSON은 문자열로 직렬화 / 비율만 계산 시점에 산출
- Audit: 거래 생성/취소, 예산 변경, 유보금 설정/해제, 지급예정 변경, 권한 변경, 계좌 변경, 은행 import

## API 요약 (모두 `Authorization: Bearer <token>`)
```
POST /api/auth/login                     GET /api/auth/me (effectiveScope 포함)
GET/POST/PATCH /api/business-types  /api/departments  /api/code-values(PUT)
GET/POST/PATCH /api/users            PUT /api/users/:id/role-scopes   [{role, scopeType, departmentId|projectId|businessTypeId}]
GET/POST /api/projects  GET/PATCH/DELETE /api/projects/:id (진행률·지연 계산 포함)
GET/POST /api/projects/:id/tasks   PATCH/DELETE /api/tasks/:id   GET /api/tasks/my
GET /api/accounts  POST/PATCH(CEO)     GET/POST /api/partners
GET /api/journal/entry-types           GET /api/journal?from&to&type&businessTypeId&departmentId&projectId&accountId&plSection
POST /api/journal  {type, entryDate, amount, vatAmount?, accountId?, bankAccountId?, bankTransactionId?, dims:{...}, lines?}
GET /api/journal/:id                    POST /api/journal/:id/void {reason}
[CEO] GET/POST/PATCH /api/treasury/bank-accounts (잔액 계산 포함)
[CEO] GET /api/treasury/bank-transactions?status=UNCLASSIFIED   POST /api/treasury/bank-transactions/import {bankAccountId, rows[]}
[CEO] POST /api/treasury/bank-transactions/:id/ignore
[CEO] GET/POST /api/treasury/reserves   POST /api/treasury/reserves/:id/move {type: INCREASE|RELEASE, amount, reason}
[CEO] GET/POST/PATCH /api/treasury/planned-payments
GET /api/metrics/dashboard?preset=this_month&businessTypeId&departmentId&projectId   (Role별 필드 다름)
GET /api/metrics/pnl?preset|from,to&yoy=1     GET /api/metrics/pnl/breakdown?groupBy=businessType|department|project|account
[CEO] GET /api/metrics/treasury               GET /api/metrics/projects
[CEO] GET /api/audit-logs?entity&entityId
```
기간 preset: today / this_week / this_month / last_month / this_quarter / this_year / last_year / custom(from,to)

## 은행거래 분류 흐름
1. `POST /treasury/bank-transactions/import` (CSV → rows JSON) → UNCLASSIFIED 큐
2. `POST /journal` 에 `bankTransactionId` 를 넣어 템플릿(RECEIPT_AR / CASH_EXPENSE / CONTRACT_PREPAY …)으로 분류 → 금액·방향·계좌 일치 검증 후 CLASSIFIED
3. 원본 행은 수정되지 않음. 잘못 분류 시 `journal/:id/void` → 다시 UNCLASSIFIED

## 다음 단계
- 프론트 보완: 모바일 레이아웃, 프로젝트 수정 폼, 거래처·계정과목 관리 화면, 목록 페이지네이션, 대시보드 차트
- MVP2: 예산 vs 실적, 채권/채무 open item, 회원권 계약부채, 선급비용 자동상각 스케줄, 자산/부채 명세, 현금예측 고도화, 위험 Rule Engine, 증빙 첨부
- MVP3: 오픈뱅킹 Provider, 카드/세금계산서 연동, 자동분류
