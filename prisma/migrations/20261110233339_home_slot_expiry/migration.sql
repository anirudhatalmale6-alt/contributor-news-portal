-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "homeSlotAt" TIMESTAMP(3);

-- Placements made before this existed are dated by when the piece was
-- published, so the month-old ones stop holding the front page at once.
UPDATE "Article" SET "homeSlotAt" = COALESCE("publishedAt", "updatedAt") WHERE "homeSlot" IS NOT NULL;
