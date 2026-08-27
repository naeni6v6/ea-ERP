# 관리회계 중심 통합 ERP — Phase 1 설계 초안

> 코드는 아직 작성하지 않았다. 아래는 요구사항 문서 58개 항목을 기준으로 정리한 아키텍처·화면·데이터·권한·개발순서 초안이며, 마지막의 "결정 필요 질문"에 답이 나오면 Phase 2(DB Schema / API 명세)로 넘어간다.

---

## 1. 시스템 Architecture 초안

```
┌──────────────────────────────────────────────────────────────┐
│  Web (Desktop) / Mobile Responsive  — Next.js (App Router)   │
│  Global Filter Bar(전체|사업별|부서별 + 기간) → 모든 화면 공유  │
└───────────────┬──────────────────────────────────────────────┘
                │ REST/JSON (JWT: userId + role + scopes)
┌───────────────▼──────────────────────────────────────────────┐
│  API Server (NestJS)                                         │
│  ├ Auth/Authz Guard  : Role × Scope 검사를 모든 엔드포인트에 강제│
│  ├ Org Module        : 회사·사업유형·부서·사용자·권한          │
│  ├ Project Module    : 프로젝트·참여부서·업무·진행률            │
│  ├ Ledger Module     : 계정과목·분개(거래)·Dimension·발생주의    │
│  ├ Treasury Module   : 계좌·은행거래·유보금·지급예정·가용현금    │
│  ├ Metrics Module    : ★ 모든 Dashboard 숫자를 여기서만 계산    │
│  ├ Budget Module     : 예산 (MVP2)                             │
│  ├ Risk Rule Engine  : 위험 알림 (MVP2, 규칙 테이블 기반)       │
│  ├ Audit Module      : 변경 이력·소프트삭제·리비전               │
│  └ Bank Integration Layer (추상화)                              │
│       ├ ManualEntryProvider   (MVP1)                           │
│       ├ CsvImportProvider     (MVP1)                           │
│       ├ MockProvider          (개발/테스트)                     │
│       └ OpenBankingProvider   (MVP3, 인터페이스만 선언)          │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  PostgreSQL                                                   │
│  ├ 원장/조직/프로젝트 테이블 (정규화)                           │
│  ├ 집계용 SQL View / Materialized View (scope별 손익·자금)      │
│  ├ 은행 원본 테이블 = INSERT ONLY (수정 금지)                   │
│  └ audit_log / soft delete / revision                          │
└──────────────────────────────────────────────────────────────┘
```

핵심 원칙 반영:
- **Dashboard 계산은 Metrics Module 한 곳** (문서 52-10 금지사항 대응). 프론트는 숫자를 계산하지 않고 표시만 한다.
- **손익(Ledger)과 현금(Treasury)은 별도 모듈**이지만 같은 거래 ID로 연결된다 (매출 ≠ 입금).
- **은행 원본과 관리분류 분리**: `bank_transaction`(원본, 불변) ↔ `bank_txn_classification` → `journal_entry`.
- 금액은 **BIGINT 원 단위 정수** (KRW는 소수점이 없음). 비율(%)만 계산 시점에 산출.
- 시간은 `timestamptz` + 사업일자는 `date`(Asia/Seoul 기준).

---

## 2. 화면 Sitemap

```
/login

/ (대표 Dashboard)                     ← Global Filter: 전체|사업별|부서별, 기간
 ├ 경영 KPI  (이번달 매출·매출총이익·영업이익·영업이익률)
 ├ 자금 KPI  (총잔액·유보금·지급예정·가용현금)
 ├ 오늘      (입금·출금·순현금흐름)
 ├ 사업별 매출/이익 카드  → 클릭 시 /pnl?scope=business:{id}
 ├ 부서별 매출/비용/이익 → 클릭 시 /pnl?scope=dept:{id}
 └ 프로젝트 (진행/위험/지연/업무완수율)

/treasury (자금)
 ├ 오늘 자금현황 (드릴다운: 숫자 → 계좌별 → 개별 거래)
 ├ 계좌 목록 / 계좌 상세 (은행거래 원본 + 분류 상태)
 ├ 은행거래 가져오기 (수기 / CSV)
 ├ 미분류 거래 → 분류 마법사 (사업·부서·프로젝트·계정·담당자)
 ├ 경영유보금 (목록·설정·해제 이력)
 ├ 지급예정자금 (확정 / 계획)
 └ 현금 예측 7·30·90일 (MVP2)

/pnl (관리회계·손익)
 ├ 손익계산서 (선택 scope: 전사/사업/부서/프로젝트, 기간, 전년동기)
 ├ 사업별 / 부서별 / 프로젝트별 손익 표
 ├ 거래 목록 (필터·검색·드릴다운 종착지)
 └ 거래 등록 (템플릿형 입력: 매출발생·입금·비용발생·출금·선급비용·계약부채 등)

/projects
 ├ 목록 (카드 / 칸반 / 표 뷰, 진행률 Progress Bar)
 └ /projects/{id}   ← 단일 컨텍스트, 탭 전환만
     개요 | 재무(손익·자산·부채) | 자금(입출금·예정) | 업무 | 파일 | 활동기록

/tasks (내 업무 — 직원 기본 진입화면)

/budget (MVP2)   /assets-liabilities (MVP2)   /receivables (MVP2)   /memberships (MVP2, 센터 계약부채)

/settings
 ├ 조직: 사업유형 / 부서 (추가·수정, 하드코딩 없음)
 ├ 사용자 & 권한 (Role + Scope 배정)
 ├ 계정과목 (계층형, 손익구조 매핑)
 ├ 거래처 / 계좌 / 유보금 카테고리 / 상태값
 └ Audit Log
```

모바일(대표): `/`, `/treasury` 오늘현황, `/projects` 목록을 1열 카드로 재배치. 입력 화면은 Desktop 우선.

---

## 3. 핵심 Database Entity 및 관계 (ERD 수준)

### 3-1. 조직 · 권한

| Entity | 주요 컬럼 | 관계 |
|---|---|---|
| company | name, biz_no, timezone | 1:N 모든 엔티티 (scope isolation 최상위) |
| business_type | company_id, code, name, is_active | 독립 축 |
| department | company_id, code, name, kind(본사/사업장), is_active | 독립 축 |
| app_user | company_id, email, pw_hash, name, department_id(소속), is_active | |
| user_role_scope | user_id, role(CEO/ADMIN/EMPLOYEE), scope_type(COMPANY/BUSINESS_TYPE/DEPARTMENT/PROJECT), scope_id | ★ 한 사용자에 여러 행 가능 |

### 3-2. 프로젝트 · 업무

| Entity | 주요 컬럼 | 관계 |
|---|---|---|
| project | company_id, code, name, business_type_id, lead_department_id, owner_user_id, status, priority, start/plan_end/actual_end, goal, description, contract_amount, expected_revenue, budget_amount, target_cost, target_profit | 실제매출·원가·손익은 저장하지 않고 **journal_line 집계** |
| project_department | project_id, department_id, is_lead | N:M |
| project_member | project_id, user_id, role_in_project | N:M |
| task | project_id, title, assignee_id, due_date, priority, status, is_done, weight(default 1), description, sort_order | 진행률 = Σdone·weight / Σweight |
| task_assignee | task_id, user_id | (복수 담당자 대비) |
| project_asset_link / project_liability_link | project_id ↔ asset / liability | 20번 항목 |

### 3-3. 관리회계 원장 (경량 복식부기 — 질문 Q1 참조)

| Entity | 주요 컬럼 | 설명 |
|---|---|---|
| account | code, name, category(자산/부채/자본/수익/비용), pl_section(매출/매출원가/판관비/영업외수익/영업외비용/법인세), parent_id | 계정과목. pl_section으로 손익구조 자동 매핑 |
| journal_entry | company_id, entry_date, type(템플릿: SALES/RECEIPT/EXPENSE/PAYMENT/PREPAID/CONTRACT_LIAB/…), partner_id, memo, source(MANUAL/BANK/IMPORT), source_ref, status(DRAFT/POSTED/VOID), created_by | 거래 헤더 |
| journal_line | entry_id, account_id, debit, credit, **business_type_id, department_id, project_id, owner_user_id, bank_account_id**, memo | ★ Dimension은 라인에 붙는다 → 한 거래를 여러 프로젝트로 나눠 귀속 가능 |
| partner | type(CUSTOMER/VENDOR/BOTH), name, biz_no, contact | 거래처 |
| open_item | type(AR/AP), partner_id, entry_id, due_date, amount, settled_amount, status, project_id | 매출채권·미지급금 등 "열린 항목" 추적 (MVP2) |
| accrual_schedule | entry_id, account_id, total, periods, start, per_period | 선급비용 상각·계약부채 인식 자동 분개 생성 (MVP2) |
| membership_contract | department_id(라곰/DAP), member_name, total_amount, total_sessions, used_sessions, recognized_amount, start/end | 센터 계약부채 (MVP2) |
| asset_register / liability_register | 고정자산·차입금 명세(취득가·감가·원리금 스케줄) | MVP2 |
| attachment | entity_type, entity_id, file_url | 증빙 |

**왜 복식부기 구조인가**: 문서가 요구하는 선급비용(15), 계약부채(18), 매출채권 vs 미수금(17), 매출≠입금(14)은 모두 "한 거래가 두 계정을 동시에 움직이는" 개념이다. 단식 거래목록으로는 반드시 중복 입력·불일치가 생긴다. UI에서는 차변/대변을 숨기고 **템플릿(매출 발생 / 입금 / 비용 발생 / 출금 …)**으로 입력받되, 내부는 균형 잡힌 분개로 저장한다.

### 3-4. 자금 (Treasury)

| Entity | 주요 컬럼 | 설명 |
|---|---|---|
| bank_account | bank, alias, account_no(masked), department_id?, purpose(운영/정부사업/R&D), is_restricted, current_balance_cache | is_restricted → 가용현금 제외 여부 |
| bank_transaction | bank_account_id, txn_at, direction(IN/OUT), amount, counterparty_raw, description_raw, balance_after, import_batch_id, external_id | **INSERT ONLY, 수정·삭제 없음** |
| bank_txn_classification | bank_transaction_id, journal_entry_id, classified_by, classified_at, status(UNCLASSIFIED/CLASSIFIED/IGNORED) | 원본과 분류 분리 |
| cash_reserve | category(리스크대응/투자준비/전략예비/…), purpose, amount, status(ACTIVE/RELEASED/PARTIAL), created_by | 경영유보금 (관리지표, 계정과목 아님) |
| cash_reserve_movement | reserve_id, type(SET/INCREASE/RELEASE), amount, reason, user_id, linked_entry_id | 해제 이력 = Audit |
| planned_payment | kind(CONFIRMED/PLANNED), title, amount, due_date, category, business_type_id, department_id, project_id, status(SCHEDULED/PAID/CANCELLED), linked_open_item_id | 지급예정자금 |
| budget / budget_line | scope_type, scope_id, fiscal_period, approved_amount, account_group | MVP2 |
| audit_log | actor_id, entity, entity_id, action, before_json, after_json, reason, at | 모든 재무 변경 |

### 3-5. 관계 요약도

```
company ─┬─ business_type ─────────────┐
         ├─ department ────────────────┤ (독립 축, 트리 아님)
         ├─ app_user ─ user_role_scope ┤
         ├─ project ─┬─ project_department (N:M dept)
         │           ├─ project_member (N:M user)
         │           └─ task ─ task_assignee
         ├─ journal_entry ─ journal_line ─┬─ account
         │        ▲                        ├─ business_type / department / project (dimensions)
         │        │                        └─ bank_account
         ├─ bank_account ─ bank_transaction ─ bank_txn_classification ─┘
         ├─ cash_reserve ─ cash_reserve_movement
         ├─ planned_payment
         └─ audit_log
```

---

## 4. 재무 / 자금 데이터 Flow

### A. 현금 거래 (은행 기준)
```
은행거래 원본 입력 (수기/CSV/향후 API)
   → bank_transaction (불변 저장)
   → 미분류 큐
   → 분류 마법사: 계정과목 + 사업 + 부서 + 프로젝트 + 담당자 (+ 기존 채권/채무 매칭)
   → journal_entry 생성 (예: 차) 보통예금  대) 매출채권 or 대) 매출)
   → bank_txn_classification 링크
   → Metrics View 갱신
   → Dashboard: 전사 → 사업 → 부서 → 프로젝트 → 계정 → 개별 거래 (Drill Down)
```

### B. 발생주의 거래 (현금 없이 손익만)
```
매출 발생 (구축 완료·세금계산서 발행)
   → 차) 매출채권 100  대) 매출 100   [dim: 구축사업/개발팀/Project A]
   → open_item(AR) 생성
나중에 입금 시:
   → 은행거래 → 분류에서 "매출채권 회수" 선택 → 차) 예금 100  대) 매출채권 100
   → open_item 정산
```

### C. 선급비용 (문서 15)
```
1월 지급 1,200만: 차) 선급비용 1,200만  대) 예금 1,200만  (손익 영향 0)
accrual_schedule 12회 → 매월 자동 분개: 차) 임차료 100만  대) 선급비용 100만
```

### D. 계약부채 (문서 18-19, 센터 회원권)
```
회원 결제 1,000만: 차) 예금 1,000만  대) 계약부채 1,000만  (매출 0)
세션 사용/기간 경과 시: 차) 계약부채 100만  대) 매출 100만  [dim: 오프라인매장/라곰]
```

### E. 자금 Dashboard 계산 (Metrics Module)
```
총 계좌잔액      = Σ bank_account.balance (사용제한계좌 포함, 별도 표기)
경영유보금       = Σ cash_reserve(ACTIVE).amount
지급예정자금     = Σ planned_payment(SCHEDULED, kind=CONFIRMED)   [계획분은 별도 표시]
비가용 예정자금  = 유보금 + 지급예정
가용현금         = 총잔액 − 유보금 − 지급예정 − 사용제한계좌 잔액(옵션)
오늘 순현금흐름  = 오늘 IN − 오늘 OUT
```
→ 계산식은 `metrics.config` 테이블 또는 전략 클래스로 두어 조건 추가 시 코드 수정 최소화.

---

## 5. 권한 구조

```
Role × Scope 조합 → 유효 접근 집합(effective scope set) 계산 → 모든 쿼리에 WHERE 조건 주입

CEO      : COMPANY 전체. 재무·자금·유보금·권한 관리 전권.
ADMIN    : user_role_scope에 부여된 DEPARTMENT / BUSINESS_TYPE / PROJECT 목록 안에서
           프로젝트·거래·업무 CRUD. 회사 전체 자금(총잔액·유보금)은 기본 비공개.
EMPLOYEE : 소속 부서 + 배정된 프로젝트의 업무 중심.
           프로젝트 재무 요약 열람 여부는 프로젝트 단위 플래그(Q5)로 결정.
```

구현 방식:
1. JWT에 `role`, `scopes[]` 포함 → API Guard가 엔드포인트별 필요 권한과 대조.
2. **Repository 레이어에서 scope filter 강제** (dept_id IN (...), project_id IN (...)) — 프론트 숨김만으로 끝내지 않는다.
3. 재무 필드 마스킹 정책: 응답 DTO에서 role별로 금액 필드 제거(직원에게 회사 총잔액 등 미노출).
4. 권한 변경은 audit_log 필수 기록.
5. 향후 승인/결재(Approval) 확장 시 `permission` 테이블로 세분화 가능하도록 role은 enum이 아닌 테이블로.

---

## 6. MVP 개발 순서

**Sprint 0 — 기반 (1주)**  모노레포 셋업, DB 스키마 마이그레이션, 인증, Audit/SoftDelete 공통 모듈, 금액·날짜 유틸.

**Sprint 1 — 조직·권한**  회사/사업유형/부서 CRUD, 사용자, Role×Scope 배정, Guard 테스트.

**Sprint 2 — 프로젝트·업무**  프로젝트 CRUD(참여부서 N:M), 업무 CRUD, 진행률 계산, 카드/표 뷰.

**Sprint 3 — 관리회계 원장**  계정과목 시드(손익구조 매핑), 거래 템플릿 입력, journal_line dimension, 손익 집계 View, 손익계산서 화면.

**Sprint 4 — 자금**  계좌, 은행거래 수기/CSV import, 분류 마법사, 유보금·지급예정, 가용현금 계산.

**Sprint 5 — Dashboard**  대표 Dashboard, Global Filter Bar, 기간 필터, Drill Down, 프로젝트 상세 재무 탭, 모바일 반응형.  → **MVP1 완료**

MVP2: 예산, 채권/채무(open_item), 계약부채·회원권, 선급비용 자동상각, 자산/부채 명세, 현금예측, 위험 Rule Engine, 증빙 파일.
MVP3: 오픈뱅킹 Provider, 카드·세금계산서 연동, 자동분류, 외부 회계프로그램 export.

---

## 7. 기술스택 추천 (이유 포함)

| 영역 | 선택 | 이유 |
|---|---|---|
| DB | **PostgreSQL 16** | 복식부기 집계·윈도우 함수·Materialized View·JSONB(audit before/after)·강한 정합성. 은행 원본 INSERT-ONLY 정책을 권한/트리거로 강제 가능. |
| ORM | **Prisma** (또는 Drizzle) | 타입 안전 스키마 → 프론트/백 공유 타입. 마이그레이션 관리 용이. |
| Backend | **NestJS + TypeScript** | 모듈 단위 구조(Ledger/Treasury/Metrics)가 요구사항과 1:1. Guard/Interceptor로 권한·Audit을 횡단 적용. 은행 API 연동 등 장기 확장에 유리. |
| Frontend | **Next.js 15 (App Router) + TypeScript** | 이미 웰니어 등에서 사용 중인 스택이라 학습비용 없음. SSR로 Dashboard 초기 로딩 빠름. 반응형으로 모바일 대응. |
| UI | Tailwind + shadcn/ui + TanStack Table + Recharts | 정보밀도 높은 SaaS Dashboard 구현에 표준적. 폰트는 Pretendard로 통일. |
| 상태/데이터 | TanStack Query | Global Filter 변경 시 하위 위젯 일괄 refetch·캐시. |
| 인증 | Auth.js(자체 계정) + JWT, 세션에 role/scopes | 외부 IdP 불필요, 권한 클레임 서버 검증. |
| 금액 | DB BIGINT(원), 프론트 `BigInt`/문자열 → 표시 시 포맷 | JS float 오류 원천 차단. |
| 배포 | Docker Compose → (Vercel FE + Railway/Fly BE + Supabase/RDS Postgres) | 소규모 팀 운영 부담 최소. |
| 테스트 | Vitest + Supertest, 회계 계산식은 스냅샷 테스트 | 손익·가용현금 계산 회귀 방지. |

**대안(더 가벼운 안)**: Next.js 단일 앱 + Server Actions + Supabase(Postgres+Auth+RLS). 초기 속도는 빠르지만 Role×Scope·복식부기·Metrics 단일화 로직이 두꺼워질수록 API 계층이 없는 것이 부담이 된다. 팀 규모·운영 인력을 듣고 최종 결정 (Q9).

---

## 8. 반드시 추가 결정해야 하는 질문 (우선순위 순)

**Q1. 원장 방식 — 경량 복식부기로 갈까요?**
선급비용·계약부채·매출채권을 정확히 다루려면 복식부기가 필요합니다. UI는 템플릿형(매출발생/입금/비용/출금 등)으로 단순화합니다. 반대로 "거래 한 줄 = 한 계정" 단식 구조를 원하면 위 항목 일부는 별도 표로 우회 처리해야 합니다.

**Q2. 법인/사업자 구조** — 이에이컴퍼니 단일 법인 아래 라곰·DAP가 있습니까, 아니면 별도 사업자(법인)입니까? Company 축을 1개로 둘지, 다법인 통합 뷰가 필요한지 결정됩니다. 계좌 5개(국민·신한·기업·라곰·DAP)의 소속도 같이 확인 필요.

**Q3. 매출원가 vs 판관비 기준** — 프로젝트에 직접 귀속되는 비용(외주비·재료비·프로젝트 인건비)을 매출원가로, 나머지를 판관비로 볼까요? 특히 **직원 급여를 프로젝트에 배부**할 것인지(시간 비율 등), 아니면 급여는 부서 판관비로만 둘지 결정 필요.

**Q4. 공통비 배부** — 본사 임대료·마케팅 등 공통비를 사업/부서/프로젝트에 배부합니까? 권장은 "직접 귀속만 하고 공통비는 미배부(본사)로 표시" 후 MVP2에서 배부 규칙 추가. 동의 여부.

**Q5. 직원·관리자의 재무 열람 범위** — 직원이 자기 프로젝트의 매출·원가·손익을 볼 수 있습니까? 부서 관리자는 부서 손익까지만인지, 회사 총잔액·유보금도 볼 수 있는지.

**Q6. 부가세 처리** — 거래는 공급가액 기준(부가세 별도 계정)으로 기록할까요? 매출 100 + VAT 10 입금 110 → 매출 100, 예수부가세 10. 관리회계 손익 정확도를 위해 권장.

**Q7. 정부지원사업·R&D 전용계좌** — 사용제한 자금으로 보고 가용현금에서 제외할까요? (bank_account.is_restricted)

**Q8. 센터 계약부채 인식 기준** — PT는 세션 소진 시, 기간제 회원권은 기간 경과 시 인식으로 나눌까요? MVP1에서는 계약부채 없이 입금=미분류로 두고 MVP2에서 도입해도 되는지.

**Q9. 팀·운영 환경** — 개발/운영 인원, 동시 사용자 수(현재 직원 수), 배포 선호(클라우드/사내). NestJS 분리 vs Next.js 단일 스택 결정에 필요. 기존 ERP(매출·매입·현금흐름·VAT·재고)의 데이터를 이관할지, 병행할지도 확인.

**Q10. 기초잔액 시점** — 어느 날짜 기준으로 계좌잔액·채권·채무 기초값을 넣고 시작합니까?

**Q11. 프로젝트 없는 거래 허용** — 본사 임대료처럼 프로젝트가 없는 거래는 사업/부서만 태그하고 프로젝트는 비워두는 것으로 진행해도 됩니까? (권장: 허용, 단 프로젝트형 사업유형은 프로젝트 필수)

**Q12. 거래 등록 승인** — MVP1에서 관리자·직원이 등록한 거래를 대표 승인 없이 바로 확정(POSTED)합니까, 아니면 DRAFT→승인 흐름을 처음부터 넣습니까?

Q1~Q5가 확정되면 Phase 2(DB DDL·API 명세·화면 와이어프레임)를 바로 진행합니다.
