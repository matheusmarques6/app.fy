-- =============================================================================
-- AppFy - Initial Migration with RLS
-- =============================================================================
-- This migration sets up Row-Level Security (RLS) policies for multi-tenancy
-- Run after Prisma generates the base schema
-- =============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE remote_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Force RLS for all users (including table owner)
ALTER TABLE stores FORCE ROW LEVEL SECURITY;
ALTER TABLE integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE devices FORCE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE segments FORCE ROW LEVEL SECURITY;
ALTER TABLE automations FORCE ROW LEVEL SECURITY;
ALTER TABLE campaigns FORCE ROW LEVEL SECURITY;
ALTER TABLE deliveries FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Helper function to get current store_id from session
CREATE OR REPLACE FUNCTION current_store_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.store_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper function to get current user_id from session
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.user_id', TRUE), '')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =============================================================================
-- Stores policies
-- =============================================================================
CREATE POLICY stores_tenant_isolation ON stores
  USING (id = current_store_id());

-- =============================================================================
-- Integrations policies
-- =============================================================================
CREATE POLICY integrations_tenant_isolation ON integrations
  USING (store_id = current_store_id());

CREATE POLICY integration_webhooks_tenant_isolation ON integration_webhooks
  USING (integration_id IN (
    SELECT id FROM integrations WHERE store_id = current_store_id()
  ));

-- =============================================================================
-- Apps policies
-- =============================================================================
CREATE POLICY apps_tenant_isolation ON apps
  USING (store_id = current_store_id());

CREATE POLICY app_versions_tenant_isolation ON app_versions
  USING (app_id IN (
    SELECT id FROM apps WHERE store_id = current_store_id()
  ));

CREATE POLICY app_credentials_tenant_isolation ON app_credentials
  USING (app_id IN (
    SELECT id FROM apps WHERE store_id = current_store_id()
  ));

CREATE POLICY build_jobs_tenant_isolation ON build_jobs
  USING (app_version_id IN (
    SELECT av.id FROM app_versions av
    JOIN apps a ON av.app_id = a.id
    WHERE a.store_id = current_store_id()
  ));

-- =============================================================================
-- Devices policies
-- =============================================================================
CREATE POLICY devices_tenant_isolation ON devices
  USING (store_id = current_store_id());

CREATE POLICY device_sessions_tenant_isolation ON device_sessions
  USING (store_id = current_store_id());

CREATE POLICY push_subscriptions_tenant_isolation ON push_subscriptions
  USING (store_id = current_store_id());

-- =============================================================================
-- Customers policies
-- =============================================================================
CREATE POLICY customers_tenant_isolation ON customers
  USING (store_id = current_store_id());

-- =============================================================================
-- Events policies
-- =============================================================================
CREATE POLICY events_tenant_isolation ON events
  USING (store_id = current_store_id());

CREATE POLICY user_metrics_tenant_isolation ON user_metrics
  USING (store_id = current_store_id());

-- =============================================================================
-- Segments policies
-- =============================================================================
CREATE POLICY segments_tenant_isolation ON segments
  USING (store_id = current_store_id());

CREATE POLICY segment_memberships_tenant_isolation ON segment_memberships
  USING (store_id = current_store_id());

-- =============================================================================
-- Automations policies
-- =============================================================================
CREATE POLICY automations_tenant_isolation ON automations
  USING (store_id = current_store_id());

CREATE POLICY automation_runs_tenant_isolation ON automation_runs
  USING (store_id = current_store_id());

CREATE POLICY scheduled_jobs_tenant_isolation ON scheduled_jobs
  USING (store_id = current_store_id());

-- =============================================================================
-- Campaigns policies
-- =============================================================================
CREATE POLICY campaigns_tenant_isolation ON campaigns
  USING (store_id = current_store_id());

CREATE POLICY push_templates_tenant_isolation ON push_templates
  USING (store_id = current_store_id());

CREATE POLICY deliveries_tenant_isolation ON deliveries
  USING (store_id = current_store_id());

-- =============================================================================
-- Orders policies
-- =============================================================================
CREATE POLICY orders_tenant_isolation ON orders
  USING (store_id = current_store_id());

CREATE POLICY attributions_tenant_isolation ON attributions
  USING (store_id = current_store_id());

-- =============================================================================
-- Remote Config policies
-- =============================================================================
CREATE POLICY remote_configs_tenant_isolation ON remote_configs
  USING (store_id = current_store_id());

-- =============================================================================
-- Audit logs policies
-- =============================================================================
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
  USING (store_id = current_store_id() OR store_id IS NULL);

-- =============================================================================
-- Store memberships policies (cross-check with user)
-- =============================================================================
CREATE POLICY store_memberships_tenant_isolation ON store_memberships
  USING (store_id = current_store_id());

-- =============================================================================
-- Indexes for performance with RLS
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_events_store_ts ON events (store_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_store_status ON deliveries (store_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_automation_runs_store_status ON automation_runs (store_id, status);

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON FUNCTION current_store_id() IS 'Returns the current store_id from session for RLS';
COMMENT ON FUNCTION current_user_id() IS 'Returns the current user_id from session for RLS';
