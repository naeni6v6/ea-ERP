-- 계좌 지출 용도 분류 — 카드 지출과 같은 용도 목록(급여비·프로젝트비 등)을 은행 거래에도 붙인다 (nullable — 기존 데이터 영향 없음)
ALTER TABLE "BankTransaction" ADD COLUMN "purposeText" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "memo" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "purposeById" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "purposeAt" TIMESTAMP(3);
