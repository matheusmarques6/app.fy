import { sql } from 'drizzle-orm'
import type { Database } from './client.js'
import {
  appUsers,
  devices,
  memberships,
  notificationDeliveries,
  notifications,
  plans,
  tenants,
  users,
} from './schema/index.js'

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

/** Seed a notification */
export async function seedNotification(
  db: Database,
  tenantId: string,
  overrides: {
    title?: string
    body?: string
    type?: 'manual' | 'automated'
    status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'completed' | 'failed'
    createdAt?: Date
  } = {},
) {
  return first(
    await db
      .insert(notifications)
      .values({
        tenantId,
        title: overrides.title ?? 'Test Notification',
        body: overrides.body ?? 'Test notification body',
        type: overrides.type ?? 'manual',
        status: overrides.status ?? 'draft',
        createdAt: overrides.createdAt ?? new Date(),
      })
      .returning(),
  )
}

/** Seed a delivery (creates notification + app user + device if not provided) */
export async function seedDelivery(
  db: Database,
  params: {
    tenantId: string
    status?: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'converted' | 'failed'
    createdAt?: Date
    notificationId?: string
    appUserId?: string
    deviceId?: string
  },
) {
  const notificationId =
    params.notificationId ?? (await seedNotification(db, params.tenantId)).id

  const appUserId = params.appUserId ?? (await seedAppUser(db, params.tenantId)).id

  const deviceId =
    params.deviceId ?? (await seedDevice(db, params.tenantId, appUserId)).id

  return first(
    await db
      .insert(notificationDeliveries)
      .values({
        tenantId: params.tenantId,
        notificationId,
        deviceId,
        appUserId,
        status: params.status ?? 'pending',
        createdAt: params.createdAt ?? new Date(),
      })
      .returning(),
  )
}

/** Bulk insert 10K deliveries for performance testing */
export async function seed10KDeliveries(db: Database, tenantId: string) {
  const notification = await seedNotification(db, tenantId, {
    title: 'Perf Test Notification',
  })

  const userCount = 100
  const deliveriesPerUser = 100

  for (let i = 0; i < userCount; i++) {
    const appUser = await seedAppUser(db, tenantId, {
      email: `perf-${i}@test.com`,
      userIdExternal: `perf-ext-${i}`,
    })
    const device = await seedDevice(db, tenantId, appUser.id)

    const deliveryValues = Array.from({ length: deliveriesPerUser }, () => ({
      tenantId,
      notificationId: notification.id,
      deviceId: device.id,
      appUserId: appUser.id,
      status: 'sent' as const,
      sentAt: new Date(),
    }))

    await db.insert(notificationDeliveries).values(deliveryValues)
  }

  return { notification, totalDeliveries: userCount * deliveriesPerUser }
}
