-- Migration 0003: Add RLS policies for segments and app_user_products
-- These tables were missing from 0001_rls_policies.sql
-- Policies already applied to live DB via Supabase MCP; this migration ensures
-- disaster recovery / fresh environments are consistent.

-- ============================================================
-- segments (tenant-scoped, full CRUD)
-- ============================================================

ALTER TABLE segments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'segments' AND policyname = 'segments_select_policy') THEN
    CREATE POLICY segments_select_policy ON segments
      FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'segments' AND policyname = 'segments_insert_policy') THEN
    CREATE POLICY segments_insert_policy ON segments
      FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'segments' AND policyname = 'segments_update_policy') THEN
    CREATE POLICY segments_update_policy ON segments
      FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'segments' AND policyname = 'segments_delete_policy') THEN
    CREATE POLICY segments_delete_policy ON segments
      FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;

-- ============================================================
-- app_user_products (tenant-scoped, full CRUD)
-- ============================================================

ALTER TABLE app_user_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_user_products' AND policyname = 'app_user_products_select_policy') THEN
    CREATE POLICY app_user_products_select_policy ON app_user_products
      FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_user_products' AND policyname = 'app_user_products_insert_policy') THEN
    CREATE POLICY app_user_products_insert_policy ON app_user_products
      FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_user_products' AND policyname = 'app_user_products_update_policy') THEN
    CREATE POLICY app_user_products_update_policy ON app_user_products
      FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_user_products' AND policyname = 'app_user_products_delete_policy') THEN
    CREATE POLICY app_user_products_delete_policy ON app_user_products
      FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
  END IF;
END $$;
