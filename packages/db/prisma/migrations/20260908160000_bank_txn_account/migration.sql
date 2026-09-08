-- 계좌 지출 계정과목 — 카드 지출과 같이 비용 계정을 직접 지정한다 (nullable — 기존 데이터 영향 없음)
ALTER TABLE "BankTransaction" ADD COLUMN "accountId" TEXT;

CREATE INDEX "BankTransaction_accountId_idx" ON "BankTransaction"("accountId");

ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
