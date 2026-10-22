-- CreateTable
CREATE TABLE "Section" (
    "key" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "inMenu" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Section_slug_key" ON "Section"("slug");

-- The sections the paper already runs, in the order the menu shows them.
-- "General" holds pieces filed before the list existed and stays out of the menu.
INSERT INTO "Section" ("key", "slug", "position", "inMenu") VALUES
  ('Politics', 'politics', 0, true),
  ('LawAndOrder', 'law-and-order', 1, true),
  ('Technology', 'technology', 2, true),
  ('Economy', 'economy', 3, true),
  ('World', 'world', 4, true),
  ('Opinion', 'opinion', 5, true),
  ('Culture', 'culture', 6, true),
  ('Literature', 'literature', 7, true),
  ('Philosophy', 'philosophy', 8, true),
  ('Science', 'science', 9, true),
  ('Entertainment', 'entertainment', 10, true),
  ('Lifestyle', 'lifestyle', 11, true),
  ('Career', 'career', 12, true),
  ('General', 'general', 13, false)
ON CONFLICT ("key") DO NOTHING;
