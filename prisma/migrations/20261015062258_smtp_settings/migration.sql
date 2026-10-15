-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "smtpFromName" TEXT NOT NULL DEFAULT 'The Document',
ADD COLUMN     "smtpHost" TEXT NOT NULL DEFAULT 'smtp.ionos.com',
ADD COLUMN     "smtpPassCipher" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "smtpPort" INTEGER NOT NULL DEFAULT 587,
ADD COLUMN     "smtpUser" TEXT NOT NULL DEFAULT '';
