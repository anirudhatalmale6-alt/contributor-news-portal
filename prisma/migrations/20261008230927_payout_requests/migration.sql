-- CreateEnum
CREATE TYPE "PayoutRequestStatus" AS ENUM ('PENDING', 'PAID', 'DECLINED');

-- AlterTable
ALTER TABLE "PaymentSettings" ADD COLUMN     "minPayoutCents" INTEGER NOT NULL DEFAULT 50000;

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PayoutRequestStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "note" TEXT,
    "decidedNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutRequest_status_createdAt_idx" ON "PayoutRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutRequest_userId_createdAt_idx" ON "PayoutRequest"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
