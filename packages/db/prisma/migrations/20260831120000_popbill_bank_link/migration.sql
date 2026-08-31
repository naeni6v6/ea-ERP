-- 팝빌 계좌조회 연동용 필드 (모두 nullable — 기존 데이터 영향 없음)
ALTER TABLE "BankAccount" ADD COLUMN     "popbillAccountNumber" TEXT,
ADD COLUMN     "popbillBankCode" TEXT,
ADD COLUMN     "popbillSyncedAt" TIMESTAMP(3);
