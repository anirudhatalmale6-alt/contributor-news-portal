-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "isEvidence" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "banglaFont" TEXT NOT NULL DEFAULT 'hind-siliguri';

-- CreateIndex
CREATE INDEX "Media_articleId_isEvidence_sortOrder_idx" ON "Media"("articleId", "isEvidence", "sortOrder");
