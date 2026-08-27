-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('CREDIT', 'CHECK');

-- CreateEnum
CREATE TYPE "CardSource" AS ENUM ('GOWID', 'BANK', 'MANUAL');

-- CreateEnum
CREATE TYPE "CardExpenseStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'EXCLUDED');

-- CreateTable
CREATE TABLE "CorporateCard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "cardType" "CardType" NOT NULL DEFAULT 'CREDIT',
    "last4" TEXT,
    "holderUserId" TEXT,
    "bankAccountId" TEXT,
    "source" "CardSource" NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardExpense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "storeName" TEXT,
    "approvalNo" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "status" "CardExpenseStatus" NOT NULL DEFAULT 'PENDING',
    "purposeText" TEXT,
    "purposeById" TEXT,
    "purposeAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "source" "CardSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "bankTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CorporateCard_bankAccountId_key" ON "CorporateCard"("bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CardExpense_bankTransactionId_key" ON "CardExpense"("bankTransactionId");

-- CreateIndex
CREATE INDEX "CardExpense_companyId_usedAt_idx" ON "CardExpense"("companyId", "usedAt");

-- CreateIndex
CREATE INDEX "CardExpense_cardId_status_idx" ON "CardExpense"("cardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CardExpense_cardId_externalId_key" ON "CardExpense"("cardId", "externalId");

-- AddForeignKey
ALTER TABLE "CorporateCard" ADD CONSTRAINT "CorporateCard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateCard" ADD CONSTRAINT "CorporateCard_holderUserId_fkey" FOREIGN KEY ("holderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateCard" ADD CONSTRAINT "CorporateCard_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardExpense" ADD CONSTRAINT "CardExpense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardExpense" ADD CONSTRAINT "CardExpense_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CorporateCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardExpense" ADD CONSTRAINT "CardExpense_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
