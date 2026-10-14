-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "aiKeyCipher" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "aiKeyHint" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "aiProvider" TEXT NOT NULL DEFAULT '';
