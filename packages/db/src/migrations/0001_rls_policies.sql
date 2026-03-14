-- RLS Policies for Multi-Tenant Isolation
-- Applied as defense-in-depth (Repository Pattern is primary defense)
-- JWT claim: auth.jwt() ->> 'tenant_id'

-- ============================================================
-- Helper: Supabase auth.jwt() function
-- On Supabase this exists natively; for local dev we create it
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
  LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb,
    '{}'::jsonb
  )
$$;

-- Create roles for RLS testing (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END
$$;

-- Grant table access to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- 1. TENANTS — Special case (membership-based access)
-- ============================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- SELECT: any active member can read their tenant
CREATE POLICY tenants_select_policy ON tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = tenants.id
        AND memberships.user_id = (auth.jwt() ->> 'sub')::uuid
    )
  );

-- UPDATE: only owner can update tenant
CREATE POLICY tenants_update_policy ON tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = tenants.id
        AND memberships.user_id = (auth.jwt() ->> 'sub')::uuid
        AND memberships.role = 'owner'
    )
  );

-- INSERT/DELETE: service_role only (no user policy = denied by default)
-- Supabase service_role bypasses RLS automatically

-- ============================================================
-- 2. MEMBERSHIPS — user_id based (not tenant_id claim)
-- ============================================================

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- SELECT: user can see their own memberships
CREATE POLICY memberships_select_policy ON memberships
  FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub')::uuid);

-- INSERT/UPDATE/DELETE: service_role only

-- ============================================================
-- 3. STANDARD TENANT-SCOPED TABLES
-- All use: tenant_id = auth.jwt() ->> 'tenant_id'
-- ============================================================

-- app_configs
ALTER TABLE app_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_configs_select_policy ON app_configs
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_configs_insert_policy ON app_configs
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_configs_update_policy ON app_configs
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_configs_delete_policy ON app_configs
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- app_users
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_users_select_policy ON app_users
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_users_insert_policy ON app_users
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_users_update_policy ON app_users
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_users_delete_policy ON app_users
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- devices
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY devices_select_policy ON devices
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY devices_insert_policy ON devices
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY devices_update_policy ON devices
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY devices_delete_policy ON devices
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- app_user_segments
ALTER TABLE app_user_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_segments_select_policy ON app_user_segments
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_user_segments_insert_policy ON app_user_segments
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_user_segments_update_policy ON app_user_segments
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_user_segments_delete_policy ON app_user_segments
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- app_user_products
ALTER TABLE app_user_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_user_products_select_policy ON app_user_products
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_user_products_insert_policy ON app_user_products
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_user_products_update_policy ON app_user_products
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_user_products_delete_policy ON app_user_products
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- app_events
ALTER TABLE app_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_events_select_policy ON app_events
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY app_events_insert_policy ON app_events
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- app_events are immutable: no UPDATE or DELETE policy (service_role only)

-- notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_policy ON notifications
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY notifications_insert_policy ON notifications
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY notifications_update_policy ON notifications
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY notifications_delete_policy ON notifications
  FOR DELETE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- notification_deliveries
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY notification_deliveries_select_policy ON notification_deliveries
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY notification_deliveries_insert_policy ON notification_deliveries
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY notification_deliveries_update_policy ON notification_deliveries
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- deliveries are never deleted by users (retention job uses service_role)

-- automation_configs
ALTER TABLE automation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY automation_configs_select_policy ON automation_configs
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY automation_configs_insert_policy ON automation_configs
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY automation_configs_update_policy ON automation_configs
  FOR UPDATE USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- automation_configs are never deleted (only disabled)

-- audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_policy ON audit_log
  FOR SELECT USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY audit_log_insert_policy ON audit_log
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- audit_log is immutable: no UPDATE or DELETE policy (service_role only)

-- ============================================================
-- 4. NON-TENANT TABLES (no RLS)
-- ============================================================
-- users: managed by Supabase Auth, no tenant_id
-- plans: global reference data, read by all
