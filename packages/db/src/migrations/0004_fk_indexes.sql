-- Migration 0004: Add indexes on tenant_id FK columns for RLS performance
-- Without these, every RLS policy evaluation does a sequential scan.

-- tenant_id indexes (RLS-critical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_tenant_id ON notifications (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_users_tenant_id ON app_users (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_tenant_id ON devices (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_segments_tenant_id ON segments (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_user_products_tenant_id ON app_user_products (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_user_segments_tenant_id ON app_user_segments (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_log_tenant_id ON audit_log (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_automation_configs_tenant_id ON automation_configs (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memberships_tenant_id ON memberships (tenant_id);

-- Query-pattern indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_user_active ON devices (tenant_id, app_user_id) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_app_user_id ON devices (app_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_user_segments_segment_id ON app_user_segments (segment_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_user_products_app_user_id ON app_user_products (app_user_id);
