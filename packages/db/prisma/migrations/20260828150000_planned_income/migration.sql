-- 입금 예정(들어올 돈) — 자금 달력용
CREATE TABLE "PlannedIncome" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "dueDate" DATE NOT NULL,
    "memo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedIncome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlannedIncome_companyId_dueDate_idx" ON "PlannedIncome"("companyId", "dueDate");

ALTER TABLE "PlannedIncome" ADD CONSTRAINT "PlannedIncome_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
