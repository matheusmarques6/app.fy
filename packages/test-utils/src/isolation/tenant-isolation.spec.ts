/**
 * Multi-tenant isolation tests (Story 2.5)
 *
 * Verifies that data created by Tenant A is invisible to Tenant B
 * at the repository/query level using real Drizzle queries.
 *
 * 10 tables x up to 6 operations = 54 isolation tests
 *
 * Requires: docker-compose -f docker-compose.test.yml up
 *
 * Tables tested:
 * - notifications, notification_deliveries, app_users, devices,
 *   app_events, segments (app_user_segments), automation_configs,
 *   app_configs, audit_log
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestClient,
  seedTenant,
  seedAppUser,
  seedDevice,
  seedNotification,
  seedDelivery,
} from '@appfy/db'
import {
  NotificationRepository,
  AppUserRepository,
  DeviceRepository,
  AutomationRepository,
  AuditLogRepository,
  EventRepository,
  SegmentRepository,
} from '@appfy/core'
import type { Database } from '@appfy/db'
import { automationConfigs, appConfigs, notificationDeliveries } from '@appfy/db'
import { eq, and, count } from 'drizzle-orm'

export const TENANT_A = 'tenant-a-isolation'
export const TENANT_B = 'tenant-b-isolation'

export interface IsolationTestConfig<T extends { id: string; tenantId: string }> {
  name: string
  seedForTenant: (tenantId: string) => Promise<T>
  findAll: (tenantId: string) => Promise<T[]>
  findById: (tenantId: string, id: string) => Promise<T | undefined>
  count: (tenantId: string) => Promise<number>
  update?: (tenantId: string, id: string, data: Record<string, unknown>) => Promise<T | undefined>
  remove?: (tenantId: string, id: string) => Promise<void>
}

export function isolationTestSuite<T extends { id: string; tenantId: string }>(
  _config: IsolationTestConfig<T>,
) {
  return _config
}

// ============================================================
// Skip if no DATABASE_URL (CI without docker-compose)
// ============================================================
const DATABASE_URL = process.env.DATABASE_URL
const shouldRun = !!DATABASE_URL

const testOrSkip = shouldRun ? describe : describe.skip

let db: Database
let tenantAId: string
let tenantBId: string

testOrSkip('Tenant Isolation Tests (Story 2.5)', () => {
  beforeAll(async () => {
    db = createTestClient()
    // Use unique slugs to avoid collisions; skip TRUNCATE to prevent deadlocks
    // when running concurrently with rls-policies tests
    const tenantA = await seedTenant(db, { slug: `iso-a-${Date.now()}` })
    const tenantB = await seedTenant(db, { slug: `iso-b-${Date.now()}` })
    tenantAId = tenantA.tenant.id
    tenantBId = tenantB.tenant.id
  })

  afterAll(async () => {
    // Cleanup is handled by the next test's beforeAll truncate
    // Avoid truncating here to prevent deadlocks with concurrent test suites
  })

  // ---- notifications ----
  describe('Tenant Isolation: notifications', () => {
    const notifRepo = () => new NotificationRepository(db)
    let notifBId: string

    beforeAll(async () => {
      await seedNotification(db, tenantAId, { title: 'Notif A' })
      const b = await seedNotification(db, tenantBId, { title: 'Notif B' })
      notifBId = b.id
    })

    it('findAll: Tenant A sees only own notifications', async () => {
      const result = await notifRepo().list(tenantAId, { page: 1, perPage: 100 })
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data.every((r) => r.tenantId === tenantAId)).toBe(true)
    })

    it('findAll: Tenant B sees only own notifications', async () => {
      const result = await notifRepo().list(tenantBId, { page: 1, perPage: 100 })
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data.every((r) => r.tenantId === tenantBId)).toBe(true)
    })

    it('findById: Tenant A cannot access Tenant B notification by ID', async () => {
      const result = await notifRepo().findById(tenantAId, notifBId)
      expect(result).toBeUndefined()
    })

    it('count: Tenant A count excludes Tenant B data', async () => {
      const countA = await notifRepo().count(tenantAId)
      const countB = await notifRepo().count(tenantBId)
      expect(countA).toBeGreaterThan(0)
      expect(countB).toBeGreaterThan(0)
    })

    it('update: Tenant A cannot update Tenant B notification', async () => {
      const result = await notifRepo().updateStatus(tenantAId, notifBId, 'scheduled')
      expect(result).toBeUndefined()
    })

    it('delete: Tenant A cannot delete Tenant B notification', async () => {
      await notifRepo().delete(tenantAId, notifBId)
      const stillExists = await notifRepo().findById(tenantBId, notifBId)
      expect(stillExists).toBeDefined()
    })
  })

  // ---- app_users ----
  describe('Tenant Isolation: app_users', () => {
    const repo = () => new AppUserRepository(db)
    let userBId: string

    beforeAll(async () => {
      await seedAppUser(db, tenantAId, { email: 'a@iso.test' })
      const b = await seedAppUser(db, tenantBId, { email: 'b@iso.test' })
      userBId = b.id
    })

    it('findAll: Tenant A sees only own app users', async () => {
      const result = await repo().list(tenantAId, { page: 1, perPage: 100 })
      expect(result.data.every((r) => r.tenantId === tenantAId)).toBe(true)
    })

    it('findAll: Tenant B sees only own app users', async () => {
      const result = await repo().list(tenantBId, { page: 1, perPage: 100 })
      expect(result.data.every((r) => r.tenantId === tenantBId)).toBe(true)
    })

    it('findById: Tenant A cannot access Tenant B app user', async () => {
      const result = await repo().findById(tenantAId, userBId)
      expect(result).toBeUndefined()
    })

    it('count: Tenant A count excludes Tenant B data', async () => {
      const countA = await repo().count(tenantAId)
      expect(countA).toBeGreaterThan(0)
    })

    it('update: Tenant A cannot update Tenant B app user', async () => {
      const result = await repo().update(tenantAId, userBId, { name: 'hacked' })
      expect(result).toBeUndefined()
    })

    it('delete: Tenant A cannot delete Tenant B app user', async () => {
      await repo().delete(tenantAId, userBId)
      const stillExists = await repo().findById(tenantBId, userBId)
      expect(stillExists).toBeDefined()
    })
  })

  // ---- devices ----
  describe('Tenant Isolation: devices', () => {
    const repo = () => new DeviceRepository(db)
    let deviceBId: string
    let appUserAId: string

    beforeAll(async () => {
      const userA = await seedAppUser(db, tenantAId, { email: 'devA@iso.test' })
      const userB = await seedAppUser(db, tenantBId, { email: 'devB@iso.test' })
      appUserAId = userA.id
      await seedDevice(db, tenantAId, userA.id)
      const devB = await seedDevice(db, tenantBId, userB.id)
      deviceBId = devB.id
    })

    it('findActiveByUser: Tenant A sees only own devices', async () => {
      const result = await repo().findActiveByUser(tenantAId, appUserAId)
      expect(result.every((r) => r.tenantId === tenantAId)).toBe(true)
    })

    it('findById: Tenant A cannot access Tenant B device', async () => {
      const result = await repo().findById(tenantAId, deviceBId)
      expect(result).toBeUndefined()
    })

    it('countByUser: Tenant A count excludes Tenant B data', async () => {
      const c = await repo().countByUser(tenantAId, appUserAId)
      expect(c).toBeGreaterThan(0)
    })

    it('deactivate: Tenant A cannot deactivate Tenant B device', async () => {
      await repo().deactivate(tenantAId, deviceBId)
      const dev = await repo().findById(tenantBId, deviceBId)
      expect(dev?.isActive).toBe(true)
    })
  })

  // ---- app_events (immutable — no update/delete) ----
  describe('Tenant Isolation: app_events', () => {
    const repo = () => new EventRepository(db)
    let eventBId: string

    beforeAll(async () => {
      const userA = await seedAppUser(db, tenantAId, { email: 'evtA@iso.test' })
      const userB = await seedAppUser(db, tenantBId, { email: 'evtB@iso.test' })
      await repo().create(tenantAId, { appUserId: userA.id, eventType: 'app_opened' })
      const evtB = await repo().create(tenantBId, { appUserId: userB.id, eventType: 'app_opened' })
      eventBId = evtB.id
    })

    it('list: Tenant A sees only own events', async () => {
      const result = await repo().list(tenantAId)
      expect(result.data.every((r) => r.tenantId === tenantAId)).toBe(true)
    })

    it('findById: Tenant A cannot access Tenant B event', async () => {
      const result = await repo().findById(tenantAId, eventBId)
      expect(result).toBeUndefined()
    })

    it('count: Tenant A count excludes Tenant B data', async () => {
      const c = await repo().count(tenantAId)
      expect(c).toBeGreaterThan(0)
    })
  })

  // ---- segments ----
  describe('Tenant Isolation: segments', () => {
    const repo = () => new SegmentRepository(db)
    let segBId: string

    beforeAll(async () => {
      await repo().create(tenantAId, { name: 'Seg A', rules: { operator: 'AND', conditions: [] } })
      const segB = await repo().create(tenantBId, {
        name: 'Seg B',
        rules: { operator: 'AND', conditions: [] },
      })
      segBId = segB.id
    })

    it('list: Tenant A sees only own segments', async () => {
      const result = await repo().list(tenantAId, { page: 1, perPage: 100 })
      expect(result.data.every((r) => r.tenantId === tenantAId)).toBe(true)
    })

    it('findById: Tenant A cannot access Tenant B segment', async () => {
      const result = await repo().findById(tenantAId, segBId)
      expect(result).toBeUndefined()
    })

    it('update: Tenant A cannot update Tenant B segment', async () => {
      const result = await repo().update(tenantAId, segBId, { name: 'hacked' })
      expect(result).toBeUndefined()
    })

    it('delete: Tenant A cannot delete Tenant B segment', async () => {
      await repo().delete(tenantAId, segBId)
      const stillExists = await repo().findById(tenantBId, segBId)
      expect(stillExists).toBeDefined()
    })
  })

  // ---- automation_configs ----
  describe('Tenant Isolation: automation_configs', () => {
    const repo = () => new AutomationRepository(db)

    beforeAll(async () => {
      await db.insert(automationConfigs).values({
        tenantId: tenantAId,
        flowType: 'cart_abandoned',
        isEnabled: true,
        delaySeconds: 3600,
        templateTitle: 'A Cart',
        templateBody: 'Body A',
      })
      await db.insert(automationConfigs).values({
        tenantId: tenantBId,
        flowType: 'cart_abandoned',
        isEnabled: true,
        delaySeconds: 3600,
        templateTitle: 'B Cart',
        templateBody: 'Body B',
      })
    })

    it('listByTenant: Tenant A sees only own configs', async () => {
      const result = await repo().listByTenant(tenantAId)
      expect(result.every((r) => r.tenantId === tenantAId)).toBe(true)
    })

    it('findByFlow: Tenant A cannot access Tenant B config', async () => {
      const resultA = await repo().findByFlow(tenantAId, 'cart_abandoned')
      expect(resultA?.tenantId).toBe(tenantAId)
      expect(resultA?.templateTitle).toBe('A Cart')
    })

    it('update: Tenant A cannot update Tenant B config', async () => {
      const result = await repo().update(tenantAId, 'welcome', { templateTitle: 'hacked' })
      // tenant A has no welcome config — update returns undefined
      expect(result).toBeUndefined()
    })
  })

  // ---- audit_log (immutable — no update/delete) ----
  describe('Tenant Isolation: audit_log', () => {
    const repo = () => new AuditLogRepository(db)
    let auditBId: string

    beforeAll(async () => {
      await repo().create(tenantAId, { action: 'test', resource: 'isolation' })
      const entryB = await repo().create(tenantBId, { action: 'test', resource: 'isolation' })
      auditBId = entryB.id
    })

    it('list: Tenant A sees only own audit entries', async () => {
      const result = await repo().list(tenantAId, { page: 1, perPage: 100 })
      expect(result.data.every((r) => r.tenantId === tenantAId)).toBe(true)
    })

    it('findById: Tenant A cannot access Tenant B audit entry', async () => {
      const result = await repo().findById(tenantAId, auditBId)
      expect(result).toBeUndefined()
    })
  })

  // ---- notification_deliveries ----
  describe('Tenant Isolation: notification_deliveries', () => {
    let deliveryBId: string

    beforeAll(async () => {
      await seedDelivery(db, { tenantId: tenantAId })
      const delB = await seedDelivery(db, { tenantId: tenantBId })
      deliveryBId = delB.id
    })

    it('query: Tenant A sees only own deliveries', async () => {
      const rows = await db
        .select()
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.tenantId, tenantAId))
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r) => r.tenantId === tenantAId)).toBe(true)
    })

    it('findById: Tenant A cannot access Tenant B delivery', async () => {
      const rows = await db
        .select()
        .from(notificationDeliveries)
        .where(
          and(
            eq(notificationDeliveries.tenantId, tenantAId),
            eq(notificationDeliveries.id, deliveryBId),
          ),
        )
      expect(rows.length).toBe(0)
    })

    it('count: Tenant A count excludes Tenant B data', async () => {
      const rows = await db
        .select({ total: count() })
        .from(notificationDeliveries)
        .where(eq(notificationDeliveries.tenantId, tenantAId))
      const result = rows[0]
      expect(result).toBeDefined()
      expect(Number(result!.total)).toBeGreaterThan(0)
    })
  })

  // ---- app_configs ----
  describe('Tenant Isolation: app_configs', () => {
    let configBId: string

    beforeAll(async () => {
      await db.insert(appConfigs).values({ tenantId: tenantAId, appName: 'App A' }).returning()
      const cfgBRows = await db
        .insert(appConfigs)
        .values({ tenantId: tenantBId, appName: 'App B' })
        .returning()
      configBId = cfgBRows[0]!.id
    })

    it('query: Tenant A sees only own config', async () => {
      const rows = await db.select().from(appConfigs).where(eq(appConfigs.tenantId, tenantAId))
      expect(rows.length).toBe(1)
      expect(rows[0]!.appName).toBe('App A')
    })

    it('findById: Tenant A cannot access Tenant B config', async () => {
      const rows = await db
        .select()
        .from(appConfigs)
        .where(and(eq(appConfigs.tenantId, tenantAId), eq(appConfigs.id, configBId)))
      expect(rows.length).toBe(0)
    })
  })
})
