import { getTableColumns, getTableName } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import * as schema from '../index.js'

const ALL_TABLES = [
  { name: 'tenants', table: schema.tenants },
  { name: 'users', table: schema.users },
  { name: 'memberships', table: schema.memberships },
  { name: 'app_configs', table: schema.appConfigs },
  { name: 'app_users', table: schema.appUsers },
  { name: 'devices', table: schema.devices },
  { name: 'app_user_segments', table: schema.appUserSegments },
  { name: 'app_user_products', table: schema.appUserProducts },
  { name: 'app_events', table: schema.appEvents },
  { name: 'notifications', table: schema.notifications },
  { name: 'notification_deliveries', table: schema.notificationDeliveries },
  { name: 'automation_configs', table: schema.automationConfigs },
  { name: 'plans', table: schema.plans },
  { name: 'audit_log', table: schema.auditLog },
] as const

const TENANT_SCOPED_TABLES = ALL_TABLES.filter(
  (t) => !['users', 'plans', 'tenants'].includes(t.name),
)

describe('Schema: all 14 tables are defined', () => {
  it('exports exactly 14 table objects', () => {
    expect(ALL_TABLES).toHaveLength(14)
  })

  for (const { name, table } of ALL_TABLES) {
    it(`${name} table is defined with correct SQL name`, () => {
      expect(getTableName(table)).toBe(name)
    })
  }
})

describe('Schema: tenant_id on all tenant-scoped tables', () => {
  for (const { name, table } of TENANT_SCOPED_TABLES) {
    it(`${name} has tenant_id column`, () => {
      const columns = getTableColumns(table)
      expect(columns).toHaveProperty('tenantId')
    })
  }
})

describe('Schema: notifications table', () => {
  it('has segmentRules JSONB column', () => {
    const columns = getTableColumns(schema.notifications)
    expect(columns).toHaveProperty('segmentRules')
  })

  it('has abConfig JSONB column', () => {
    const columns = getTableColumns(schema.notifications)
    expect(columns).toHaveProperty('abConfig')
  })

  it('has abVariant enum column', () => {
    const columns = getTableColumns(schema.notifications)
    expect(columns).toHaveProperty('abVariant')
  })

  it('has status with draft default', () => {
    const columns = getTableColumns(schema.notifications)
    expect(columns.status).toBeDefined()
  })

  it('has all required columns', () => {
    const columns = getTableColumns(schema.notifications)
    const expected = [
      'id', 'tenantId', 'type', 'flowType', 'title', 'body',
      'imageUrl', 'targetUrl', 'segmentRules', 'scheduledAt',
      'sentAt', 'createdBy', 'abVariant', 'abConfig', 'status',
      'createdAt', 'updatedAt',
    ]
    for (const col of expected) {
      expect(columns, `missing column: ${col}`).toHaveProperty(col)
    }
  })
})

describe('Schema: notification_deliveries table', () => {
  it('has all status timestamp columns', () => {
    const columns = getTableColumns(schema.notificationDeliveries)
    const expected = ['sentAt', 'deliveredAt', 'openedAt', 'clickedAt', 'convertedAt']
    for (const col of expected) {
      expect(columns, `missing column: ${col}`).toHaveProperty(col)
    }
  })

  it('has appUserId for LGPD anonymization', () => {
    const columns = getTableColumns(schema.notificationDeliveries)
    expect(columns).toHaveProperty('appUserId')
  })

  it('has updatedAt for status transition tracking', () => {
    const columns = getTableColumns(schema.notificationDeliveries)
    expect(columns).toHaveProperty('updatedAt')
  })
})

describe('Schema: tenants table', () => {
  it('has notification_count_current_period', () => {
    const columns = getTableColumns(schema.tenants)
    expect(columns).toHaveProperty('notificationCountCurrentPeriod')
  })

  it('has stripe_customer_id', () => {
    const columns = getTableColumns(schema.tenants)
    expect(columns).toHaveProperty('stripeCustomerId')
  })

  it('has stripe_subscription_id', () => {
    const columns = getTableColumns(schema.tenants)
    expect(columns).toHaveProperty('stripeSubscriptionId')
  })

  it('has platform_credentials JSONB', () => {
    const columns = getTableColumns(schema.tenants)
    expect(columns).toHaveProperty('platformCredentials')
  })
})

describe('Schema: devices table', () => {
  it('has is_active with default true', () => {
    const columns = getTableColumns(schema.devices)
    expect(columns).toHaveProperty('isActive')
  })

  it('has app_user_id FK', () => {
    const columns = getTableColumns(schema.devices)
    expect(columns).toHaveProperty('appUserId')
  })
})

describe('Schema: enums are exported', () => {
  it('exports all enum types', () => {
    expect(schema.platformEnum).toBeDefined()
    expect(schema.flowTypeEnum).toBeDefined()
    expect(schema.notificationStatusEnum).toBeDefined()
    expect(schema.notificationTypeEnum).toBeDefined()
    expect(schema.abVariantEnum).toBeDefined()
    expect(schema.deliveryStatusEnum).toBeDefined()
    expect(schema.eventTypeEnum).toBeDefined()
    expect(schema.devicePlatformEnum).toBeDefined()
    expect(schema.membershipRoleEnum).toBeDefined()
    expect(schema.buildStatusEnum).toBeDefined()
    expect(schema.planNameEnum).toBeDefined()
    expect(schema.interactionTypeEnum).toBeDefined()
  })
})
