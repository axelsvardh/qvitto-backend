-- AlterTable
ALTER TABLE "Transaction" RENAME COLUMN "bankTxId" TO "paymentReferenceId";

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_paymentReferenceId_key" ON "Transaction"("paymentReferenceId");

-- AlterTable
ALTER TABLE "Receipt" ALTER COLUMN "transactionId" DROP NOT NULL,
ADD COLUMN     "merchant" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "timestamp" TIMESTAMP(3),
ADD COLUMN     "posReferenceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_posReferenceId_key" ON "Receipt"("posReferenceId");
