-- AlterTable
ALTER TABLE "User" ADD COLUMN     "location" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "publicEmail" TEXT,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedById" TEXT,
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "website" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
