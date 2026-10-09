-- CreateEnum
CREATE TYPE "ReceiptCategory" AS ENUM ('FOOD', 'GROCERIES', 'TRANSPORTATION', 'ENTERTAINMENT', 'HEALTH', 'SHOPPING', 'UTILITIES', 'OTHER');

-- Backfill existing NULL/free-text values before enforcing the enum + NOT NULL
UPDATE "Receipt" SET "category" = 'OTHER' WHERE "category" IS NULL OR "category" NOT IN ('FOOD', 'GROCERIES', 'TRANSPORTATION', 'ENTERTAINMENT', 'HEALTH', 'SHOPPING', 'UTILITIES', 'OTHER');

-- AlterTable
ALTER TABLE "Receipt" ALTER COLUMN "category" DROP DEFAULT,
ALTER COLUMN "category" SET DATA TYPE "ReceiptCategory" USING ("category"::"ReceiptCategory"),
ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "category" SET DEFAULT 'OTHER';
