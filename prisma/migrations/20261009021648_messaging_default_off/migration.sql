-- AlterTable
ALTER TABLE "SiteSettings" ALTER COLUMN "contributorMessaging" SET DEFAULT false;

-- The row that already exists was created with the old default of true, and
-- nobody has asked for contributor-to-contributor messages yet. Start it off,
-- so the owner switches it on deliberately rather than finding it already on.
UPDATE "SiteSettings" SET "contributorMessaging" = false WHERE id = 1;
