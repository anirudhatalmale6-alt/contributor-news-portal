-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featuredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "siteNameEn" TEXT NOT NULL DEFAULT 'The Document',
    "siteNameBn" TEXT NOT NULL DEFAULT 'দ্য ডকুমেন্ট',
    "taglineEn" TEXT NOT NULL DEFAULT 'news written by its readers, checked by its editors.',
    "taglineBn" TEXT NOT NULL DEFAULT 'পাঠকদের লেখা, সম্পাদকদের যাচাই করা সংবাদ।',
    "footerEn" TEXT NOT NULL DEFAULT '© The Document. All rights reserved.',
    "footerBn" TEXT NOT NULL DEFAULT '© দ্য ডকুমেন্ট। সর্বস্বত্ব সংরক্ষিত।',
    "logoUrl" TEXT,
    "adsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "adHomeHtml" TEXT NOT NULL DEFAULT '',
    "adArticleHtml" TEXT NOT NULL DEFAULT '',
    "adSectionHtml" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Article_status_featured_featuredAt_idx" ON "Article"("status", "featured", "featuredAt");
