-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "aiPromptPolish" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "aiPromptSummary" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "aiPromptToBangla" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "aiPromptToEnglish" TEXT NOT NULL DEFAULT '';
