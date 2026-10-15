-- AlterTable
ALTER TABLE "User" ADD COLUMN     "publicName" TEXT;

-- Everybody who already writes for the paper keeps the byline they have now.
UPDATE "User" SET "publicName" = "name" WHERE "publicName" IS NULL;
