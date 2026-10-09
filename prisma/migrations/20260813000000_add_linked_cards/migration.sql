-- CreateTable
CREATE TABLE "LinkedCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedCard_stripePaymentMethodId_key" ON "LinkedCard"("stripePaymentMethodId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedCard_fingerprint_key" ON "LinkedCard"("fingerprint");

-- AddForeignKey
ALTER TABLE "LinkedCard" ADD CONSTRAINT "LinkedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
