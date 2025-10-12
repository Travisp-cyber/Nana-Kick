-- Fresh Database Reset for Supabase
-- Run this in Supabase SQL Editor to completely reset the database

-- Drop all tables and start fresh
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Grant permissions
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Verify the schema is empty
SELECT 
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- The query above should return 0 rows, confirming the database is clean

