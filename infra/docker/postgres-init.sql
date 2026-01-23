-- PostgreSQL initialization script for AppFy
-- This runs on first container creation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create app role for RLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'appfy_app') THEN
    CREATE ROLE appfy_app;
  END IF;
END
$$;

-- Grant usage
GRANT USAGE ON SCHEMA public TO appfy_app;

-- Enable RLS helper function
CREATE OR REPLACE FUNCTION current_store_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.store_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.user_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Log successful initialization
DO $$
BEGIN
  RAISE NOTICE 'AppFy PostgreSQL initialized successfully';
END
$$;
