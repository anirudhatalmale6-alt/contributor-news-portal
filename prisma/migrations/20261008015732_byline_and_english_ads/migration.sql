-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "bylineName" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "adArticleHtmlEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "adBannerHtmlEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "adHomeHtmlEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "adSectionHtmlEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "adSquareHtmlEn" TEXT NOT NULL DEFAULT '';
