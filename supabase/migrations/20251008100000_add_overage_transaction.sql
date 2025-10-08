-- Add 'overage' to transaction_type enum for per-generation charges beyond pool limits
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.

-- Ensure enum exists (no-op if already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE transaction_type AS ENUM ('generation', 'extra_credit', 'overage');
  END IF;
END
$$;

-- Add value if not present
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'overage';