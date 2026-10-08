-- CreateTable
CREATE TABLE "UiText" (
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiText_pkey" PRIMARY KEY ("key","locale")
);
