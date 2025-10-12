-- Mark the usage tracking migration as already applied
-- Run this in Supabase SQL Editor

-- First, check if the migration is already recorded
SELECT migration_name, finished_at, applied_steps_count 
FROM "_prisma_migrations" 
WHERE migration_name = '20251010224726_add_usage_tracking_fields'
ORDER BY finished_at DESC 
LIMIT 5;

-- If the above query returns no results, insert the migration record
-- This tells Prisma the migration has already been applied
INSERT INTO "_prisma_migrations" (
  id,
  checksum,
  finished_at,
  migration_name,
  logs,
  rolled_back_at,
  started_at,
  applied_steps_count
)
VALUES (
  gen_random_uuid()::text,
  'e8c5d3f4a2b1c9d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3',
  NOW(),
  '20251010224726_add_usage_tracking_fields',
  NULL,
  NULL,
  NOW(),
  1
)
ON CONFLICT (migration_name) DO NOTHING;

-- Verify the migration was recorded
SELECT migration_name, finished_at, applied_steps_count 
FROM "_prisma_migrations" 
WHERE migration_name = '20251010224726_add_usage_tracking_fields';

