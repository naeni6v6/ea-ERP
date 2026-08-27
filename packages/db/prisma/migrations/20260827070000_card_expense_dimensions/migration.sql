-- AlterTable
ALTER TABLE "CardExpense" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "businessTypeId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "journalEntryId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CardExpense_journalEntryId_key" ON "CardExpense"("journalEntryId");

-- AddForeignKey
ALTER TABLE "CardExpense" ADD CONSTRAINT "CardExpense_businessTypeId_fkey" FOREIGN KEY ("businessTypeId") REFERENCES "BusinessType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardExpense" ADD CONSTRAINT "CardExpense_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardExpense" ADD CONSTRAINT "CardExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardExpense" ADD CONSTRAINT "CardExpense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardExpense" ADD CONSTRAINT "CardExpense_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

