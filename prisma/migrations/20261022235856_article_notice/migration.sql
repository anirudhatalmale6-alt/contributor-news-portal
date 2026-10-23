-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "articleNoticeBn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "articleNoticeButtonBn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "articleNoticeButtonEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "articleNoticeEn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "articleNoticeOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "articleNoticeUrl" TEXT NOT NULL DEFAULT '';
