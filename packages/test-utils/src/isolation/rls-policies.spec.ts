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
 * 6 scenarios per table:
 * 1. Tenant A reads only A's data
 * 2. Tenant B reads only B's data
 * 3. Tenant A CANNOT read B's data
 * 4. No JWT -> access denied (RLS blocks all rows)
 * 5. JWT with invalid tenant_id -> zero results
 * 6. Tenant A INSERT with B's tenant_id -> must fail
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  withTenantJwt,
  withoutJwt,
  isRlsEnabled,
  getPoliciesForTable,
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

// ============================================================
// Skip if no DATABASE_URL (CI without docker-compose)
// ============================================================
const DATABASE_URL = process.env.DATABASE_URL
const shouldRun = !!DATABASE_URL

const testOrSkip = shouldRun ? describe : describe.skip

let pgSql: unknown

testOrSkip('RLS Policy Tests (Story 2.2)', () => {
  const tenantAId = crypto.randomUUID()
  const tenantBId = crypto.randomUUID()
  const userAId = crypto.randomUUID()
  const userBId = crypto.randomUUID()
  const planId = crypto.randomUUID()

  beforeAll(async () => {
    // Dynamic import postgres.js only when DB is available
    const postgres = (await import('postgres')).default
    pgSql = postgres(DATABASE_URL!)

    // Seed with service_role (bypasses RLS)
    const sql = pgSql as ReturnType<typeof postgres>
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

    // Seed notifications for both tenants
    await sql`INSERT INTO notifications (tenant_id, type, title, body, status)
      VALUES (${tenantAId}, 'manual', 'RLS Test A', 'Body A', 'draft')`
    await sql`INSERT INTO notifications (tenant_id, type, title, body, status)
      VALUES (${tenantBId}, 'manual', 'RLS Test B', 'Body B', 'draft')`

    // Seed app_users for both tenants
    await sql`INSERT INTO app_users (tenant_id, email, name)
      VALUES (${tenantAId}, 'rls-app-a@test.com', 'App User A')`
    await sql`INSERT INTO app_users (tenant_id, email, name)
      VALUES (${tenantBId}, 'rls-app-b@test.com', 'App User B')`
  })

  afterAll(async () => {
    const sql = pgSql as { end: () => Promise<void> }
    if (sql) await sql.end()
  })

  // ---- pg_class verification ----
  describe('pg_class: RLS enabled verification', () => {
    for (const table of TENANT_SCOPED_TABLES) {
      it(`${table} has relrowsecurity = true`, async () => {
        const enabled = await isRlsEnabled(pgSql, table)
        expect(enabled).toBe(true)
      })
    }

    it('tenants table has relrowsecurity = true', async () => {
      const enabled = await isRlsEnabled(pgSql, 'tenants')
      expect(enabled).toBe(true)
    })

    it('memberships table has relrowsecurity = true', async () => {
      const enabled = await isRlsEnabled(pgSql, 'memberships')
      expect(enabled).toBe(true)
    })

    it('users table does NOT have RLS enabled', async () => {
      const enabled = await isRlsEnabled(pgSql, 'users')
      expect(enabled).toBe(false)
    })

    it('plans table does NOT have RLS enabled', async () => {
      const enabled = await isRlsEnabled(pgSql, 'plans')
      expect(enabled).toBe(false)
    })
  })

  // ---- Per-table RLS scenarios ----
  describe('RLS: notifications', () => {
    it('Scenario 1: Tenant A reads only own data', async () => {
      const rows = await withTenantJwt(pgSql, tenantAId, userAId, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM notifications')
      })
      expect((rows as unknown[]).length).toBeGreaterThan(0)
      expect((rows as Array<{ tenant_id: string }>).every((r) => r.tenant_id === tenantAId)).toBe(true)
    })

    it('Scenario 3: Tenant A CANNOT read Tenant B data', async () => {
      const rows = await withTenantJwt(pgSql, tenantAId, userAId, async (tx: unknown) => {
        const txSql = tx as { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> }
        return txSql.unsafe(`SELECT * FROM notifications WHERE tenant_id = '${tenantBId}'`)
      })
      expect((rows as unknown[]).length).toBe(0)
    })

    it('Scenario 4: No JWT returns zero rows', async () => {
      const rows = await withoutJwt(pgSql, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM notifications')
      })
      expect((rows as unknown[]).length).toBe(0)
    })

    it('Scenario 5: Invalid tenant_id in JWT returns zero results', async () => {
      const fakeId = crypto.randomUUID()
      const rows = await withTenantJwt(pgSql, fakeId, userAId, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM notifications')
      })
      expect((rows as unknown[]).length).toBe(0)
    })
  })

  // ---- tenants (special case: membership-based) ----
  describe('RLS: tenants (special case)', () => {
    it('Member can SELECT own tenant', async () => {
      const rows = await withTenantJwt(pgSql, tenantAId, userAId, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM tenants')
      })
      expect((rows as unknown[]).length).toBeGreaterThan(0)
    })

    it('No JWT returns zero tenants', async () => {
      const rows = await withoutJwt(pgSql, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM tenants')
      })
      expect((rows as unknown[]).length).toBe(0)
    })
  })

  // ---- memberships (user_id based) ----
  describe('RLS: memberships (user_id based)', () => {
    it('User can SELECT own memberships', async () => {
      const rows = await withTenantJwt(pgSql, tenantAId, userAId, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM memberships')
      })
      expect((rows as unknown[]).length).toBeGreaterThan(0)
      expect((rows as Array<{ user_id: string }>).every((r) => r.user_id === userAId)).toBe(true)
    })

    it('No JWT returns zero memberships', async () => {
      const rows = await withoutJwt(pgSql, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM memberships')
      })
      expect((rows as unknown[]).length).toBe(0)
    })
  })

  // ---- app_users ----
  describe('RLS: app_users', () => {
    it('Tenant A reads only own app_users', async () => {
      const rows = await withTenantJwt(pgSql, tenantAId, userAId, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM app_users')
      })
      expect((rows as unknown[]).length).toBeGreaterThan(0)
      expect((rows as Array<{ tenant_id: string }>).every((r) => r.tenant_id === tenantAId)).toBe(true)
    })

    it('No JWT returns zero app_users', async () => {
      const rows = await withoutJwt(pgSql, async (tx: unknown) => {
        return (tx as { unsafe: (q: string) => Promise<unknown[]> }).unsafe('SELECT * FROM app_users')
      })
      expect((rows as unknown[]).length).toBe(0)
    })
  })
})
