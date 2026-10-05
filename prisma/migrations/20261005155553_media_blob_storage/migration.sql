-- CreateTable
CREATE TABLE "MediaBlob" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaBlob_pkey" PRIMARY KEY ("id")
);
