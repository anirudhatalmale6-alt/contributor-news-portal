-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('EN', 'BN');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('BKASH', 'NAGAD', 'ROCKET', 'BANK', 'PAYPAL', 'WISE');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "language" "Locale" NOT NULL DEFAULT 'EN';

-- CreateTable
CREATE TABLE "PayoutProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" "PayoutMethod" NOT NULL,
    "accountName" TEXT NOT NULL,
    "walletNumber" TEXT,
    "bankName" TEXT,
    "branch" TEXT,
    "accountNumber" TEXT,
    "routingNumber" TEXT,
    "email" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Bangladesh',
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleTranslation" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "title" TEXT NOT NULL,
    "dek" TEXT,
    "body" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "translatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutProfile_userId_key" ON "PayoutProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTranslation_slug_key" ON "ArticleTranslation"("slug");

-- CreateIndex
CREATE INDEX "ArticleTranslation_locale_idx" ON "ArticleTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleTranslation_articleId_locale_key" ON "ArticleTranslation"("articleId", "locale");

-- AddForeignKey
ALTER TABLE "PayoutProfile" ADD CONSTRAINT "PayoutProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTranslation" ADD CONSTRAINT "ArticleTranslation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleTranslation" ADD CONSTRAINT "ArticleTranslation_translatorId_fkey" FOREIGN KEY ("translatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
