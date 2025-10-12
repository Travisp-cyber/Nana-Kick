-- Add usage tracking columns to User table
-- Run this SQL script directly in your Supabase SQL editor

-- Add currentTier column (nullable TEXT for tier name)
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "currentTier" TEXT;

-- Add generationsUsed column (default 0)
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "generationsUsed" INTEGER DEFAULT 0;

-- Add generationsLimit column (nullable INTEGER)
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "generationsLimit" INTEGER;

-- Add usageResetDate column (nullable TIMESTAMP)
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "usageResetDate" TIMESTAMP(3);

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'User'
AND column_name IN ('currentTier', 'generationsUsed', 'generationsLimit', 'usageResetDate');

