-- AlterEnum
ALTER TYPE "CardExpenseStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "CardExpense" ADD COLUMN     "memo" TEXT,
ADD COLUMN     "rejectReason" TEXT;
