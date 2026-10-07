-- CreateTable
CREATE TABLE "EarningAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarningAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EarningAdjustment_userId_createdAt_idx" ON "EarningAdjustment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "EarningAdjustment" ADD CONSTRAINT "EarningAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningAdjustment" ADD CONSTRAINT "EarningAdjustment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
