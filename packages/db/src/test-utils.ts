import { sql } from 'drizzle-orm'
import type { Database } from './client.js'
import { appUsers, devices, memberships, plans, tenants, users } from './schema/index.js'

/** Truncate all tables in dependency-safe order */
export async function truncateAll(db: Database) {
  await db.execute(sql`
    TRUNCATE TABLE
      notification_deliveries,
      notifications,
      app_events,
      app_user_products,
      app_user_segments,
      devices,
      app_users,
      automation_configs,
      audit_log,
      app_configs,
      memberships,
      users,
      tenants,
      plans
    CASCADE
  `)
}

function first<T>(rows: T[]): T {
  const row = rows[0]
  if (!row) throw new Error('Expected at least one row from INSERT ... RETURNING')
  return row
}

/** Seed a minimal tenant with a plan */
export async function seedTenant(db: Database, overrides: { name?: string; slug?: string } = {}) {
  const plan = first(
    await db
      .insert(plans)
      .values({
        name: 'starter',
        priceMonthly: 12700,
        priceYearly: 127000,
        notificationLimit: 15,
        features: { manual: true, automated: true },
      })
      .returning(),
  )

  const tenant = first(
    await db
      .insert(tenants)
      .values({
        name: overrides.name ?? 'Test Tenant',
        slug: overrides.slug ?? `test-${Date.now()}`,
        platform: 'shopify',
        planId: plan.id,
      })
      .returning(),
  )

  return { plan, tenant }
}

/** Seed a console user with membership */
export async function seedUser(
  db: Database,
  tenantId: string,
  overrides: { email?: string; role?: 'owner' | 'editor' | 'viewer' } = {},
) {
  const user = first(
    await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: overrides.email ?? `user-${Date.now()}@test.com`,
        name: 'Test User',
      })
      .returning(),
  )

  const membership = first(
    await db
      .insert(memberships)
      .values({
        userId: user.id,
        tenantId,
        role: overrides.role ?? 'owner',
      })
      .returning(),
  )

  return { user, membership }
}

/** Seed an app user (end customer) */
export async function seedAppUser(
  db: Database,
  tenantId: string,
  overrides: { email?: string; userIdExternal?: string } = {},
) {
  return first(
    await db
      .insert(appUsers)
      .values({
        tenantId,
        userIdExternal: overrides.userIdExternal ?? `ext-${Date.now()}`,
        email: overrides.email ?? `appuser-${Date.now()}@test.com`,
        name: 'Test App User',
      })
      .returning(),
  )
}

/** Seed a device for an app user */
export async function seedDevice(
  db: Database,
  tenantId: string,
  appUserId: string,
  overrides: { platform?: 'android' | 'ios' } = {},
) {
  return first(
    await db
      .insert(devices)
      .values({
        tenantId,
        appUserId,
        deviceToken: `token-${Date.now()}`,
        platform: overrides.platform ?? 'android',
      })
      .returning(),
  )
}
