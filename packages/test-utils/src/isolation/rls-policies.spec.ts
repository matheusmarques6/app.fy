/**
 * RLS policy verification tests (Story 2.2)
 *
 * These tests verify that PostgreSQL Row-Level Security policies
 * correctly enforce tenant isolation at the database level.
 *
 * Requires:
 *   docker-compose -f docker-compose.test.yml up
 *   RLS migration applied to the test database
 *
 * Scenarios per table:
 * 1. Tenant A reads only A's data
 * 2. Tenant A CANNOT read B's data
 * 3. No JWT -> access denied (RLS blocks all rows)
 * 4. JWT with invalid tenant_id -> zero results
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  withTenantJwt,
  withoutJwt,
  isRlsEnabled,
} from '../helpers/rls-asserter.js'

const TENANT_SCOPED_TABLES = [
  'app_configs',
  'app_users',
  'devices',
  'app_user_segments',
  'app_user_products',
  'app_events',
  'notifications',
  'notification_deliveries',
  'automation_configs',
  'audit_log',
] as const

const DATABASE_URL = process.env.DATABASE_URL
const shouldRun = !!DATABASE_URL
const testOrSkip = shouldRun ? describe : describe.skip

let pgSql: unknown

/** Helper: execute raw SQL in a tenant JWT context */
async function queryAs(tenantId: string, userId: string, query: string): Promise<unknown[]> {
  return withTenantJwt(pgSql, tenantId, userId, async (tx: unknown) => {
    return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe(query)
  })
}

/** Helper: execute raw SQL with no JWT */
async function queryAnon(query: string): Promise<unknown[]> {
  return withoutJwt(pgSql, async (tx: unknown) => {
    return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe(query)
  })
}

/** Generates 4 standard RLS scenarios for any tenant-scoped table */
function rlsScenariosForTable(
  table: string,
  tenantAId: string,
  tenantBId: string,
  userAId: string,
) {
  describe(`RLS: ${table}`, () => {
    it('Tenant A reads only own data', async () => {
      const rows = await queryAs(tenantAId, userAId, `SELECT * FROM ${table}`)
      expect((rows as unknown[]).length).toBeGreaterThan(0)
      expect(
        (rows as Array<{ tenant_id: string }>).every((r) => r.tenant_id === tenantAId),
      ).toBe(true)
    })

    it('Tenant A CANNOT read Tenant B data', async () => {
      const rows = await queryAs(
        tenantAId,
        userAId,
        `SELECT * FROM ${table} WHERE tenant_id = '${tenantBId}'`,
      )
      expect((rows as unknown[]).length).toBe(0)
    })

    it('No JWT returns zero rows', async () => {
      const rows = await queryAnon(`SELECT * FROM ${table}`)
      expect((rows as unknown[]).length).toBe(0)
    })

    it('Invalid tenant_id in JWT returns zero results', async () => {
      const fakeId = crypto.randomUUID()
      const rows = await queryAs(fakeId, userAId, `SELECT * FROM ${table}`)
      expect((rows as unknown[]).length).toBe(0)
    })
  })
}

testOrSkip('RLS Policy Tests (Story 2.2)', () => {
  const tenantAId = crypto.randomUUID()
  const tenantBId = crypto.randomUUID()
  const userAId = crypto.randomUUID()
  const userBId = crypto.randomUUID()
  const planId = crypto.randomUUID()
  const appUserAId = crypto.randomUUID()
  const appUserBId = crypto.randomUUID()
  const deviceAId = crypto.randomUUID()
  const deviceBId = crypto.randomUUID()
  const notifAId = crypto.randomUUID()
  const notifBId = crypto.randomUUID()
  const segmentAId = crypto.randomUUID()
  const segmentBId = crypto.randomUUID()

  beforeAll(async () => {
    const postgres = (await import('postgres')).default
    pgSql = postgres(DATABASE_URL!)
    const sql = pgSql as ReturnType<typeof postgres>

    // ---- Seed base data (service_role bypasses RLS) ----
    await sql`INSERT INTO plans (id, name, price_monthly, price_yearly, notification_limit, features)
      VALUES (${planId}, 'starter', 12700, 127000, 15, '{"manual": true}'::jsonb)
      ON CONFLICT DO NOTHING`

    await sql`INSERT INTO tenants (id, name, slug, platform, plan_id)
      VALUES (${tenantAId}, 'Tenant A', ${`rls-a-${Date.now()}`}, 'shopify', ${planId})`
    await sql`INSERT INTO tenants (id, name, slug, platform, plan_id)
      VALUES (${tenantBId}, 'Tenant B', ${`rls-b-${Date.now()}`}, 'shopify', ${planId})`

    await sql`INSERT INTO users (id, email, name)
      VALUES (${userAId}, ${`rls-a-${Date.now()}@test.com`}, 'User A')`
    await sql`INSERT INTO users (id, email, name)
      VALUES (${userBId}, ${`rls-b-${Date.now()}@test.com`}, 'User B')`

    await sql`INSERT INTO memberships (user_id, tenant_id, role)
      VALUES (${userAId}, ${tenantAId}, 'owner')`
    await sql`INSERT INTO memberships (user_id, tenant_id, role)
      VALUES (${userBId}, ${tenantBId}, 'owner')`

    // ---- Seed tenant-scoped data for all tables ----

    // notifications
    await sql`INSERT INTO notifications (id, tenant_id, type, title, body, status)
      VALUES (${notifAId}, ${tenantAId}, 'manual', 'RLS A', 'Body A', 'draft')`
    await sql`INSERT INTO notifications (id, tenant_id, type, title, body, status)
      VALUES (${notifBId}, ${tenantBId}, 'manual', 'RLS B', 'Body B', 'draft')`

    // app_users
    await sql`INSERT INTO app_users (id, tenant_id, email, name)
      VALUES (${appUserAId}, ${tenantAId}, 'rls-a@test.com', 'App A')`
    await sql`INSERT INTO app_users (id, tenant_id, email, name)
      VALUES (${appUserBId}, ${tenantBId}, 'rls-b@test.com', 'App B')`

    // devices
    await sql`INSERT INTO devices (id, tenant_id, app_user_id, platform, device_token)
      VALUES (${deviceAId}, ${tenantAId}, ${appUserAId}, 'android', 'tok-a')`
    await sql`INSERT INTO devices (id, tenant_id, app_user_id, platform, device_token)
      VALUES (${deviceBId}, ${tenantBId}, ${appUserBId}, 'ios', 'tok-b')`

    // app_events
    await sql`INSERT INTO app_events (tenant_id, app_user_id, event_type)
      VALUES (${tenantAId}, ${appUserAId}, 'app_opened')`
    await sql`INSERT INTO app_events (tenant_id, app_user_id, event_type)
      VALUES (${tenantBId}, ${appUserBId}, 'app_opened')`

    // notification_deliveries
    await sql`INSERT INTO notification_deliveries (tenant_id, notification_id, device_id, app_user_id, status)
      VALUES (${tenantAId}, ${notifAId}, ${deviceAId}, ${appUserAId}, 'pending')`
    await sql`INSERT INTO notification_deliveries (tenant_id, notification_id, device_id, app_user_id, status)
      VALUES (${tenantBId}, ${notifBId}, ${deviceBId}, ${appUserBId}, 'pending')`

    // automation_configs
    await sql`INSERT INTO automation_configs (tenant_id, flow_type, is_enabled, delay_seconds, template_title, template_body)
      VALUES (${tenantAId}, 'cart_abandoned', true, 3600, 'A Cart', 'Body A')`
    await sql`INSERT INTO automation_configs (tenant_id, flow_type, is_enabled, delay_seconds, template_title, template_body)
      VALUES (${tenantBId}, 'cart_abandoned', true, 3600, 'B Cart', 'Body B')`

    // audit_log
    await sql`INSERT INTO audit_log (tenant_id, action, resource)
      VALUES (${tenantAId}, 'rls_test', 'test')`
    await sql`INSERT INTO audit_log (tenant_id, action, resource)
      VALUES (${tenantBId}, 'rls_test', 'test')`

    // app_configs
    await sql`INSERT INTO app_configs (tenant_id, app_name)
      VALUES (${tenantAId}, 'App A')`
    await sql`INSERT INTO app_configs (tenant_id, app_name)
      VALUES (${tenantBId}, 'App B')`

    // segments
    await sql`INSERT INTO segments (id, tenant_id, name, rules)
      VALUES (${segmentAId}, ${tenantAId}, 'Seg A', '{"operator":"AND","conditions":[]}'::jsonb)`
    await sql`INSERT INTO segments (id, tenant_id, name, rules)
      VALUES (${segmentBId}, ${tenantBId}, 'Seg B', '{"operator":"AND","conditions":[]}'::jsonb)`

    // app_user_segments
    await sql`INSERT INTO app_user_segments (tenant_id, segment_id, app_user_id)
      VALUES (${tenantAId}, ${segmentAId}, ${appUserAId})`
    await sql`INSERT INTO app_user_segments (tenant_id, segment_id, app_user_id)
      VALUES (${tenantBId}, ${segmentBId}, ${appUserBId})`
  })

  afterAll(async () => {
    const sql = pgSql as { end: () => Promise<void> }
    if (sql) await sql.end()
  })

  // ---- pg_class verification (14 checks) ----
  describe('pg_class: RLS enabled verification', () => {
    for (const table of TENANT_SCOPED_TABLES) {
      it(`${table} has relrowsecurity = true`, async () => {
        const enabled = await isRlsEnabled(pgSql, table)
        expect(enabled).toBe(true)
      })
    }

    it('tenants table has relrowsecurity = true', async () => {
      expect(await isRlsEnabled(pgSql, 'tenants')).toBe(true)
    })

    it('memberships table has relrowsecurity = true', async () => {
      expect(await isRlsEnabled(pgSql, 'memberships')).toBe(true)
    })

    it('users table does NOT have RLS enabled', async () => {
      expect(await isRlsEnabled(pgSql, 'users')).toBe(false)
    })

    it('plans table does NOT have RLS enabled', async () => {
      expect(await isRlsEnabled(pgSql, 'plans')).toBe(false)
    })
  })

  // ---- 4 scenarios per tenant-scoped table (40 tests) ----
  rlsScenariosForTable('notifications', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('app_users', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('devices', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('app_events', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('notification_deliveries', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('automation_configs', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('audit_log', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('app_configs', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('segments', tenantAId, tenantBId, userAId)
  rlsScenariosForTable('app_user_segments', tenantAId, tenantBId, userAId)

  // ---- tenants (special case: membership-based) ----
  describe('RLS: tenants (special case)', () => {
    it('Member can SELECT own tenant', async () => {
      const rows = await queryAs(tenantAId, userAId, 'SELECT * FROM tenants')
      expect((rows as unknown[]).length).toBeGreaterThan(0)
    })

    it('Non-member CANNOT SELECT other tenant', async () => {
      const rows = await queryAs(
        tenantAId,
        userAId,
        `SELECT * FROM tenants WHERE id = '${tenantBId}'`,
      )
      expect((rows as unknown[]).length).toBe(0)
    })

    it('No JWT returns zero tenants', async () => {
      const rows = await queryAnon('SELECT * FROM tenants')
      expect((rows as unknown[]).length).toBe(0)
    })
  })

  // ---- memberships (user_id based) ----
  describe('RLS: memberships (user_id based)', () => {
    it('User can SELECT own memberships', async () => {
      const rows = await queryAs(tenantAId, userAId, 'SELECT * FROM memberships')
      expect((rows as unknown[]).length).toBeGreaterThan(0)
      expect(
        (rows as Array<{ user_id: string }>).every((r) => r.user_id === userAId),
      ).toBe(true)
    })

    it('User CANNOT SELECT other user memberships', async () => {
      const rows = await queryAs(
        tenantAId,
        userAId,
        `SELECT * FROM memberships WHERE user_id = '${userBId}'`,
      )
      expect((rows as unknown[]).length).toBe(0)
    })

    it('No JWT returns zero memberships', async () => {
      const rows = await queryAnon('SELECT * FROM memberships')
      expect((rows as unknown[]).length).toBe(0)
    })
  })
})
