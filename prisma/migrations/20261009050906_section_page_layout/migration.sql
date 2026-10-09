-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "sectionLead" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "maxSectionGrid" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "maxSectionRail" INTEGER NOT NULL DEFAULT 4;
