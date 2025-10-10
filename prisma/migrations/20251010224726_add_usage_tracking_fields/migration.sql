-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentTier" TEXT,
ADD COLUMN     "generationsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "generationsLimit" INTEGER,
ADD COLUMN     "usageResetDate" TIMESTAMP(3);
