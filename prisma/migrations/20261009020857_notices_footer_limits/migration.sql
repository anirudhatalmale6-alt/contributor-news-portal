-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "contributorMessaging" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "footerAboutUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "footerContactUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "footerPrivacyUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "footerShowDate" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxLeftRail" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "maxMoreGrid" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "maxRelated" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "maxRightRail" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "maxUnderLead" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "userId" TEXT,
    "writtenById" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeDismissal" (
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoticeDismissal_pkey" PRIMARY KEY ("noticeId","userId")
);

-- CreateIndex
CREATE INDEX "Notice_userId_retiredAt_idx" ON "Notice"("userId", "retiredAt");

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_writtenById_fkey" FOREIGN KEY ("writtenById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeDismissal" ADD CONSTRAINT "NoticeDismissal_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeDismissal" ADD CONSTRAINT "NoticeDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
