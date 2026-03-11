# TDD Database — AppFy

> Especificação de testes de banco de dados sob a perspectiva do Data Engineer.
> Schema, RLS, migrations, repositories, retention, concorrência.

---

## 1. Schema Test Suite

### 1.1 Testes de Estrutura por Tabela

Para cada tabela, verificar em teste de integração contra PG real:

```typescript
// packages/db/test/integration/schema.spec.ts
import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'

describe('Schema Structure', () => {
  describe('tenants', () => {
    it('should have all required columns', async () => {
      const result = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'tenants'
        ORDER BY ordinal_position
      `)

      const columns = result.rows.map((r: any) => r.column_name)
      expect(columns).toContain('id')
      expect(columns).toContain('name')
      expect(columns).toContain('slug')
      expect(columns).toContain('platform')
      expect(columns).toContain('platform_store_url')
      expect(columns).toContain('platform_credentials')
      expect(columns).toContain('onesignal_app_id')
      expect(columns).toContain('plan_id')
      expect(columns).toContain('is_active')
      expect(columns).toContain('created_at')
      expect(columns).toContain('updated_at')
    })

    it('should have unique constraint on slug', async () => {
      await db.insert(tenants).values({
        name: 'Loja A', slug: 'loja-a', platform: 'shopify', isActive: true,
      })

      await expect(
        db.insert(tenants).values({
          name: 'Loja B', slug: 'loja-a', platform: 'nuvemshop', isActive: true,
        })
      ).rejects.toThrow(/unique/)
    })
  })

  describe('devices', () => {
    it('should have foreign key to app_users', async () => {
      // Tentar inserir device sem app_user válido
      await expect(
        db.insert(devices).values({
          tenantId: 'tenant-1',
          appUserId: 'non-existent-user',
          deviceToken: 'token-1',
          platform: 'android',
          isActive: true,
        })
      ).rejects.toThrow(/foreign key/)
    })

    it('should default isActive to true', async () => {
      const user = await seedAppUser(db, 'tenant-1')
      const [device] = await db.insert(devices).values({
        tenantId: 'tenant-1',
        appUserId: user.id,
        deviceToken: 'token-1',
        platform: 'android',
      }).returning()

      expect(device.isActive).toBe(true)
    })
  })

  describe('automation_configs', () => {
    it('should enforce unique (tenant_id, flow_type)', async () => {
      await db.insert(automationConfigs).values({
        tenantId: 'tenant-1',
        flowType: 'cart_abandoned',
        isEnabled: true,
        delaySeconds: 3600,
      })

      await expect(
        db.insert(automationConfigs).values({
          tenantId: 'tenant-1',
          flowType: 'cart_abandoned', // duplicado
          isEnabled: false,
          delaySeconds: 7200,
        })
      ).rejects.toThrow(/unique/)
    })

    it('should allow same flow_type for different tenants', async () => {
      await db.insert(automationConfigs).values({
        tenantId: 'tenant-1', flowType: 'welcome', isEnabled: true, delaySeconds: 300,
      })

      // NÃO deve falhar
      const [config] = await db.insert(automationConfigs).values({
        tenantId: 'tenant-2', flowType: 'welcome', isEnabled: true, delaySeconds: 600,
      }).returning()

      expect(config).toBeDefined()
    })
  })

  describe('notification_deliveries', () => {
    it('should have composite index on (tenant_id, status, created_at)', async () => {
      const result = await db.execute(sql`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'notification_deliveries'
      `)

      const indexNames = result.rows.map((r: any) => r.indexname)
      const hasCompositeIndex = indexNames.some((n: string) =>
        n.includes('tenant') && n.includes('status')
      )
      expect(hasCompositeIndex).toBe(true)
    })
  })

  describe('app_events', () => {
    it('should have index on (tenant_id, event_type, created_at)', async () => {
      const result = await db.execute(sql`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'app_events'
      `)

      const indexNames = result.rows.map((r: any) => r.indexname)
      const hasCompositeIndex = indexNames.some((n: string) =>
        n.includes('tenant') && n.includes('event')
      )
      expect(hasCompositeIndex).toBe(true)
    })
  })
})
```

### 1.2 Encrypted Credential Tests

```typescript
describe('Encrypted Credentials (JSONB)', () => {
  it('should store and retrieve valid EncryptedCredential', async () => {
    const credential = {
      ct: 'base64-ciphertext',
      iv: 'base64-iv',
      tag: 'base64-auth-tag',
      alg: 'aes-256-gcm',
    }

    const [tenant] = await db.insert(tenants).values({
      name: 'Test', slug: 'test-cred', platform: 'shopify',
      platformCredentials: credential,
      isActive: true,
    }).returning()

    const fetched = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.id),
    })

    expect(fetched!.platformCredentials).toEqual(credential)
    expect(fetched!.platformCredentials.tag).toBe('base64-auth-tag')
    expect(fetched!.platformCredentials.alg).toBe('aes-256-gcm')
  })

  it('should round-trip encrypt → store → retrieve → decrypt', async () => {
    const encService = new EncryptionService('test-32-char-key-for-encryption!')
    const originalToken = 'shpat_abc123_super_secret'

    // Encrypt
    const encrypted = encService.encrypt(originalToken)

    // Store
    const [tenant] = await db.insert(tenants).values({
      name: 'Roundtrip', slug: 'roundtrip', platform: 'shopify',
      platformCredentials: encrypted,
      isActive: true,
    }).returning()

    // Retrieve
    const fetched = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.id),
    })

    // Decrypt
    const decrypted = encService.decrypt(fetched!.platformCredentials)

    expect(decrypted).toBe(originalToken)
  })
})
```

---

## 2. RLS Policy Tests (CRÍTICO)

### 2.1 Template Genérico de RLS

```typescript
// packages/db/test/integration/rls/rls-test-helper.ts

/**
 * Executa query como um tenant autenticado (via RLS)
 * Simula o que Supabase faz com auth.jwt() ->> 'tenant_id'
 */
export async function queryAsTenant(db: DrizzleClient, tenantId: string, query: string) {
  return db.execute(sql.raw(`
    SET LOCAL role = 'authenticated';
    SET LOCAL request.jwt.claims = '{"tenant_id": "${tenantId}"}';
    ${query}
  `))
}

/**
 * Executa query como service_role (bypassa RLS)
 */
export async function queryAsServiceRole(db: DrizzleClient, query: string) {
  return db.execute(sql.raw(`
    SET LOCAL role = 'service_role';
    ${query}
  `))
}
```

### 2.2 RLS por Tabela

```typescript
// packages/db/test/integration/rls/notifications-rls.spec.ts
describe('RLS: notifications', () => {
  const TENANT_A = 'aaaa-aaaa-aaaa-aaaa'
  const TENANT_B = 'bbbb-bbbb-bbbb-bbbb'

  beforeEach(async () => {
    // Inserir como service_role (bypassa RLS)
    await queryAsServiceRole(db, `
      INSERT INTO notifications (id, tenant_id, title, body, type, status)
      VALUES
        ('notif-a1', '${TENANT_A}', 'Push A1', 'Body A1', 'manual', 'draft'),
        ('notif-a2', '${TENANT_A}', 'Push A2', 'Body A2', 'automated', 'sent'),
        ('notif-b1', '${TENANT_B}', 'Push B1', 'Body B1', 'manual', 'draft')
    `)
  })

  it('tenant A SELECT: vê apenas seus dados', async () => {
    const result = await queryAsTenant(db, TENANT_A, 'SELECT * FROM notifications')

    expect(result.rows).toHaveLength(2)
    expect(result.rows.every((r: any) => r.tenant_id === TENANT_A)).toBe(true)
  })

  it('tenant A SELECT WHERE tenant_id = B: retorna 0 rows', async () => {
    const result = await queryAsTenant(db, TENANT_A,
      `SELECT * FROM notifications WHERE tenant_id = '${TENANT_B}'`
    )

    expect(result.rows).toHaveLength(0)
  })

  it('tenant A UPDATE em dados do B: afeta 0 rows', async () => {
    const result = await queryAsTenant(db, TENANT_A,
      `UPDATE notifications SET title = 'HACKED' WHERE tenant_id = '${TENANT_B}' RETURNING *`
    )

    expect(result.rows).toHaveLength(0)

    // Verificar que B não foi alterado
    const check = await queryAsServiceRole(db,
      `SELECT title FROM notifications WHERE id = 'notif-b1'`
    )
    expect(check.rows[0].title).toBe('Push B1')
  })

  it('tenant A DELETE em dados do B: afeta 0 rows', async () => {
    const result = await queryAsTenant(db, TENANT_A,
      `DELETE FROM notifications WHERE tenant_id = '${TENANT_B}' RETURNING *`
    )

    expect(result.rows).toHaveLength(0)

    const check = await queryAsServiceRole(db,
      `SELECT COUNT(*) as cnt FROM notifications WHERE tenant_id = '${TENANT_B}'`
    )
    expect(Number(check.rows[0].cnt)).toBe(1)
  })

  it('tenant A INSERT com tenant_id de B: deve falhar', async () => {
    await expect(
      queryAsTenant(db, TENANT_A, `
        INSERT INTO notifications (id, tenant_id, title, body, type, status)
        VALUES ('notif-evil', '${TENANT_B}', 'Evil', 'Body', 'manual', 'draft')
      `)
    ).rejects.toThrow() // RLS policy blocks
  })
})
```

### 2.3 RLS para TODAS as tabelas (loop)

```typescript
// packages/db/test/integration/rls/all-tables-rls.spec.ts
const TABLES_WITH_RLS = [
  'notifications',
  'notification_deliveries',
  'app_users',
  'devices',
  'app_events',
  'app_user_segments',
  'app_user_products',
  'automation_configs',
  'app_configs',
  'audit_log',
  'memberships',
]

TABLES_WITH_RLS.forEach((table) => {
  describe(`RLS: ${table}`, () => {
    it(`should block cross-tenant SELECT on ${table}`, async () => {
      // Inserir dados para tenant A e B como service_role
      await seedTableForTenant(db, table, TENANT_A)
      await seedTableForTenant(db, table, TENANT_B)

      // Query como tenant A
      const result = await queryAsTenant(db, TENANT_A, `SELECT * FROM ${table}`)

      // Todos os resultados devem ser do tenant A
      result.rows.forEach((row: any) => {
        expect(row.tenant_id).toBe(TENANT_A)
      })
    })

    it(`should block cross-tenant UPDATE on ${table}`, async () => {
      await seedTableForTenant(db, table, TENANT_B)

      const result = await queryAsTenant(db, TENANT_A,
        `UPDATE ${table} SET updated_at = NOW() WHERE tenant_id = '${TENANT_B}' RETURNING *`
      )

      expect(result.rows).toHaveLength(0)
    })
  })
})
```

### 2.4 Plans NÃO tem RLS

```typescript
describe('RLS: plans (sem RLS)', () => {
  it('should be readable by any authenticated user', async () => {
    await queryAsServiceRole(db, `
      INSERT INTO plans (id, name, notification_limit, price_monthly, price_yearly)
      VALUES ('plan-1', 'starter', 15, 127, 1270)
    `)

    const result = await queryAsTenant(db, 'any-tenant-id',
      'SELECT * FROM plans'
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].name).toBe('starter')
  })
})
```

---

## 3. Repository Pattern Tests

### 3.1 NotificationRepository

```typescript
// packages/api/test/integration/repositories/notification.repo.spec.ts
describe('NotificationRepository (integration)', () => {
  let repo: NotificationRepository

  beforeAll(() => {
    repo = new NotificationRepository(db)
  })

  describe('findAll', () => {
    it('should return only notifications for given tenant', async () => {
      await seedNotification(db, { tenantId: 'tenant-a', title: 'A' })
      await seedNotification(db, { tenantId: 'tenant-b', title: 'B' })

      const results = await repo.findAll('tenant-a')

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('A')
    })

    it('should return empty array for tenant with no notifications', async () => {
      const results = await repo.findAll('tenant-empty')
      expect(results).toEqual([])
    })

    it('should order by createdAt desc', async () => {
      await seedNotification(db, { tenantId: 't1', title: 'Old', createdAt: new Date('2026-01-01') })
      await seedNotification(db, { tenantId: 't1', title: 'New', createdAt: new Date('2026-03-01') })

      const results = await repo.findAll('t1')

      expect(results[0].title).toBe('New')
      expect(results[1].title).toBe('Old')
    })
  })

  describe('findById', () => {
    it('should return notification if tenant matches', async () => {
      const notif = await seedNotification(db, { tenantId: 'tenant-a', title: 'Test' })

      const result = await repo.findById('tenant-a', notif.id)

      expect(result).toBeDefined()
      expect(result!.title).toBe('Test')
    })

    it('should return null if tenant does not match (IDOR prevention)', async () => {
      const notif = await seedNotification(db, { tenantId: 'tenant-b', title: 'Secret' })

      const result = await repo.findById('tenant-a', notif.id)

      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create with correct tenant_id', async () => {
      const result = await repo.create('tenant-x', {
        title: 'New Push',
        body: 'New Body',
        type: 'manual',
        status: 'draft',
      })

      expect(result.id).toBeDefined()
      expect(result.tenantId).toBe('tenant-x')
    })
  })

  describe('updateStatus', () => {
    it('should update status for correct tenant', async () => {
      const notif = await seedNotification(db, { tenantId: 'tenant-a', status: 'draft' })

      await repo.updateStatus('tenant-a', notif.id, 'approved')

      const updated = await repo.findById('tenant-a', notif.id)
      expect(updated!.status).toBe('approved')
    })

    it('should NOT update notification of different tenant', async () => {
      const notif = await seedNotification(db, { tenantId: 'tenant-b', status: 'draft' })

      await repo.updateStatus('tenant-a', notif.id, 'approved')

      const unchanged = await repo.findById('tenant-b', notif.id)
      expect(unchanged!.status).toBe('draft') // inalterado
    })
  })

  describe('countForPeriod', () => {
    it('should count notifications sent this period', async () => {
      await seedNotification(db, { tenantId: 't1', status: 'sent', type: 'manual' })
      await seedNotification(db, { tenantId: 't1', status: 'sent', type: 'manual' })
      await seedNotification(db, { tenantId: 't1', status: 'draft', type: 'manual' }) // não conta
      await seedNotification(db, { tenantId: 't2', status: 'sent', type: 'manual' }) // outro tenant

      const count = await repo.countSentForPeriod('t1')

      expect(count).toBe(2)
    })
  })
})
```

### 3.2 DeviceRepository

```typescript
describe('DeviceRepository (integration)', () => {
  let repo: DeviceRepository

  beforeAll(() => { repo = new DeviceRepository(db) })

  it('should find active devices for tenant', async () => {
    const user = await seedAppUser(db, 'tenant-1')
    await seedDevice(db, { tenantId: 'tenant-1', appUserId: user.id, isActive: true })
    await seedDevice(db, { tenantId: 'tenant-1', appUserId: user.id, isActive: false })
    await seedDevice(db, { tenantId: 'tenant-2', appUserId: 'other-user', isActive: true })

    const devices = await repo.findActiveByTenant('tenant-1')

    expect(devices).toHaveLength(1)
    expect(devices[0].isActive).toBe(true)
    expect(devices[0].tenantId).toBe('tenant-1')
  })

  it('should deactivate device by id', async () => {
    const user = await seedAppUser(db, 'tenant-1')
    const device = await seedDevice(db, { tenantId: 'tenant-1', appUserId: user.id, isActive: true })

    await repo.deactivate('tenant-1', device.id)

    const updated = await repo.findById('tenant-1', device.id)
    expect(updated!.isActive).toBe(false)
  })

  it('should NOT deactivate device of different tenant', async () => {
    const user = await seedAppUser(db, 'tenant-2')
    const device = await seedDevice(db, { tenantId: 'tenant-2', appUserId: user.id, isActive: true })

    await repo.deactivate('tenant-1', device.id) // wrong tenant

    const unchanged = await repo.findById('tenant-2', device.id)
    expect(unchanged!.isActive).toBe(true)
  })
})
```

### 3.3 AppEventRepository

```typescript
describe('AppEventRepository (integration)', () => {
  let repo: AppEventRepository

  beforeAll(() => { repo = new AppEventRepository(db) })

  it('should insert event', async () => {
    const event = await repo.create('tenant-1', {
      eventType: 'product_viewed',
      appUserId: 'user-1',
      properties: { productId: 'prod-123' },
    })

    expect(event.id).toBeDefined()
    expect(event.tenantId).toBe('tenant-1')
    expect(event.eventType).toBe('product_viewed')
  })

  it('should find recent events by type for dedup', async () => {
    await repo.create('tenant-1', {
      eventType: 'product_viewed',
      appUserId: 'user-1',
      properties: { productId: 'prod-123' },
    })

    const recent = await repo.findRecent('tenant-1', 'user-1', 'product_viewed', 5000)

    expect(recent).toBeDefined()
  })

  it('should count events by type for user', async () => {
    await repo.create('tenant-1', { eventType: 'app_opened', appUserId: 'user-1', properties: {} })
    await repo.create('tenant-1', { eventType: 'app_opened', appUserId: 'user-1', properties: {} })
    await repo.create('tenant-1', { eventType: 'product_viewed', appUserId: 'user-1', properties: {} })

    const count = await repo.countByType('tenant-1', 'user-1', 'app_opened')

    expect(count).toBe(2)
  })

  it('should not return events from other tenants', async () => {
    await repo.create('tenant-2', { eventType: 'app_opened', appUserId: 'user-1', properties: {} })

    const count = await repo.countByType('tenant-1', 'user-1', 'app_opened')

    expect(count).toBe(0)
  })
})
```

---

## 4. Data Retention Tests

```typescript
// packages/db/test/integration/retention/retention.spec.ts
describe('Data Retention Jobs', () => {
  describe('notification_deliveries (180 days)', () => {
    it('should delete deliveries older than 180 days', async () => {
      const old = await seedDelivery(db, {
        tenantId: 'tenant-1',
        createdAt: daysAgo(181),
      })
      const recent = await seedDelivery(db, {
        tenantId: 'tenant-1',
        createdAt: daysAgo(10),
      })

      await runRetentionJob(db, 'notification_deliveries', 180)

      expect(await deliveryExists(db, old.id)).toBe(false)
      expect(await deliveryExists(db, recent.id)).toBe(true)
    })

    // Boundary: exatamente 180 dias
    it('should keep deliveries at exactly 180 days', async () => {
      const exact = await seedDelivery(db, {
        tenantId: 'tenant-1',
        createdAt: daysAgo(180),
      })

      await runRetentionJob(db, 'notification_deliveries', 180)

      expect(await deliveryExists(db, exact.id)).toBe(true) // <= 180 days
    })

    it('should delete at 181 days', async () => {
      const overLimit = await seedDelivery(db, {
        tenantId: 'tenant-1',
        createdAt: daysAgo(181),
      })

      await runRetentionJob(db, 'notification_deliveries', 180)

      expect(await deliveryExists(db, overLimit.id)).toBe(false)
    })

    it('should not cross tenant boundaries', async () => {
      const oldA = await seedDelivery(db, { tenantId: 'tenant-a', createdAt: daysAgo(200) })
      const oldB = await seedDelivery(db, { tenantId: 'tenant-b', createdAt: daysAgo(200) })

      // Retention job global (não por tenant)
      await runRetentionJob(db, 'notification_deliveries', 180)

      // Ambos devem ser deletados (retention é global, não por tenant)
      expect(await deliveryExists(db, oldA.id)).toBe(false)
      expect(await deliveryExists(db, oldB.id)).toBe(false)
    })
  })

  describe('app_events (90 days)', () => {
    it('should delete events older than 90 days', async () => {
      const old = await seedEvent(db, { tenantId: 'tenant-1', createdAt: daysAgo(91) })
      const recent = await seedEvent(db, { tenantId: 'tenant-1', createdAt: daysAgo(10) })

      await runRetentionJob(db, 'app_events', 90)

      expect(await eventExists(db, old.id)).toBe(false)
      expect(await eventExists(db, recent.id)).toBe(true)
    })
  })
})

// Helper
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function runRetentionJob(db: DrizzleClient, table: string, days: number) {
  await db.execute(sql.raw(`
    DELETE FROM ${table}
    WHERE created_at < NOW() - INTERVAL '${days} days'
  `))
}
```

---

## 5. Index Performance Tests

```typescript
// packages/db/test/integration/performance/query-plans.spec.ts
describe('Query Performance (EXPLAIN ANALYZE)', () => {
  beforeAll(async () => {
    // Seed 10K rows para testes de performance
    await seed10KDeliveries(db, 'tenant-perf')
    await seed10KEvents(db, 'tenant-perf')
  })

  it('notification_deliveries: index scan on (tenant_id, status, created_at)', async () => {
    const result = await db.execute(sql`
      EXPLAIN ANALYZE
      SELECT * FROM notification_deliveries
      WHERE tenant_id = 'tenant-perf'
        AND status = 'pending'
        AND created_at > NOW() - INTERVAL '24 hours'
    `)

    const plan = result.rows.map((r: any) => r['QUERY PLAN']).join('\n')

    // Deve usar index scan, NÃO seq scan
    expect(plan).toMatch(/Index Scan|Bitmap Index Scan/)
    expect(plan).not.toMatch(/Seq Scan/)
  })

  it('app_events: index scan on (tenant_id, event_type, created_at)', async () => {
    const result = await db.execute(sql`
      EXPLAIN ANALYZE
      SELECT * FROM app_events
      WHERE tenant_id = 'tenant-perf'
        AND event_type = 'product_viewed'
        AND created_at > NOW() - INTERVAL '24 hours'
    `)

    const plan = result.rows.map((r: any) => r['QUERY PLAN']).join('\n')

    expect(plan).toMatch(/Index Scan|Bitmap Index Scan/)
  })

  it('automation_configs: fast lookup by (tenant_id, flow_type)', async () => {
    const result = await db.execute(sql`
      EXPLAIN ANALYZE
      SELECT * FROM automation_configs
      WHERE tenant_id = 'tenant-perf'
        AND flow_type = 'cart_abandoned'
    `)

    const plan = result.rows.map((r: any) => r['QUERY PLAN']).join('\n')

    // Unique index deve ser usado
    expect(plan).toMatch(/Index Scan/)
  })

  it('notification count for plan limit should be fast', async () => {
    const start = performance.now()

    await db.execute(sql`
      SELECT COUNT(*) FROM notifications
      WHERE tenant_id = 'tenant-perf'
        AND status = 'sent'
        AND type = 'manual'
        AND created_at > date_trunc('month', NOW())
    `)

    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50) // < 50ms
  })
})
```

---

## 6. Migration Tests

```typescript
// packages/db/test/integration/migrations/migration.spec.ts
describe('Migrations', () => {
  it('should run all migrations on fresh database', async () => {
    const freshDb = await createFreshTestDatabase()

    await expect(runMigrations(freshDb)).resolves.not.toThrow()

    // Verificar que todas as tabelas existem
    const tables = await getTableNames(freshDb)
    expect(tables).toContain('tenants')
    expect(tables).toContain('users')
    expect(tables).toContain('memberships')
    expect(tables).toContain('notifications')
    expect(tables).toContain('notification_deliveries')
    expect(tables).toContain('app_users')
    expect(tables).toContain('devices')
    expect(tables).toContain('app_events')
    expect(tables).toContain('app_user_segments')
    expect(tables).toContain('app_user_products')
    expect(tables).toContain('automation_configs')
    expect(tables).toContain('plans')
    expect(tables).toContain('audit_log')
    expect(tables).toContain('app_configs')

    await freshDb.$client.end()
  })

  it('should run migrations on database with existing data', async () => {
    const existingDb = await createTestDatabaseWithData()

    // Rodar migrations novamente (deve ser idempotente)
    await expect(runMigrations(existingDb)).resolves.not.toThrow()

    // Verificar que dados existentes não foram perdidos
    const tenants = await existingDb.query.tenants.findMany()
    expect(tenants.length).toBeGreaterThan(0)

    await existingDb.$client.end()
  })

  it('should have RLS policies after migration', async () => {
    const freshDb = await createFreshTestDatabase()
    await runMigrations(freshDb)

    const result = await freshDb.execute(sql`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
    `)

    const tablesWithRLS = [...new Set(result.rows.map((r: any) => r.tablename))]

    expect(tablesWithRLS).toContain('notifications')
    expect(tablesWithRLS).toContain('notification_deliveries')
    expect(tablesWithRLS).toContain('app_users')
    expect(tablesWithRLS).toContain('devices')
    expect(tablesWithRLS).toContain('app_events')
    expect(tablesWithRLS).toContain('automation_configs')

    // plans NÃO deve ter RLS
    expect(tablesWithRLS).not.toContain('plans')

    await freshDb.$client.end()
  })
})
```

---

## 7. Concurrent Access Tests

```typescript
// packages/db/test/integration/concurrency/concurrent.spec.ts
describe('Concurrent Access', () => {
  it('should handle concurrent notification count increments', async () => {
    const tenant = await seedTenant(db, { notificationCountCurrentPeriod: 0 })

    // 10 incrementos concorrentes
    const promises = Array.from({ length: 10 }, () =>
      db.execute(sql`
        UPDATE tenants
        SET notification_count_current_period = notification_count_current_period + 1
        WHERE id = ${tenant.id}
      `)
    )

    await Promise.all(promises)

    const updated = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.id),
    })

    expect(updated!.notificationCountCurrentPeriod).toBe(10) // sem race condition
  })

  it('should handle concurrent device registration for same user', async () => {
    const user = await seedAppUser(db, 'tenant-1')

    const promises = Array.from({ length: 5 }, (_, i) =>
      db.insert(devices).values({
        tenantId: 'tenant-1',
        appUserId: user.id,
        deviceToken: `token-${i}`,
        platform: 'android',
        isActive: true,
      }).returning()
    )

    const results = await Promise.all(promises)

    // Todos devem ser criados (1 user pode ter N devices)
    expect(results).toHaveLength(5)
    expect(results.every((r) => r[0].appUserId === user.id)).toBe(true)
  })

  it('should handle concurrent delivery status updates', async () => {
    const delivery = await seedDelivery(db, { tenantId: 'tenant-1', status: 'sent' })

    // Simular 2 workers processando o mesmo delivery
    const [result1, result2] = await Promise.allSettled([
      db.update(notificationDeliveries)
        .set({ status: 'delivered', deliveredAt: new Date() })
        .where(and(
          eq(notificationDeliveries.id, delivery.id),
          eq(notificationDeliveries.status, 'sent'), // optimistic lock
        ))
        .returning(),
      db.update(notificationDeliveries)
        .set({ status: 'delivered', deliveredAt: new Date() })
        .where(and(
          eq(notificationDeliveries.id, delivery.id),
          eq(notificationDeliveries.status, 'sent'), // optimistic lock
        ))
        .returning(),
    ])

    // Exatamente 1 deve ter atualizado (optimistic locking)
    const successes = [result1, result2].filter(
      (r) => r.status === 'fulfilled' && r.value.length > 0
    )
    expect(successes.length).toBeLessThanOrEqual(1)
  })
})
```

---

## 8. Seed Data Helpers

```typescript
// packages/db/test/helpers/seed.ts
import { randomUUID } from 'crypto'

export async function seedTenant(db: DrizzleClient, overrides?: Partial<typeof tenants.$inferInsert>) {
  const [result] = await db.insert(tenants).values({
    id: randomUUID(),
    name: 'Test Tenant',
    slug: `test-${randomUUID().slice(0, 8)}`,
    platform: 'shopify',
    isActive: true,
    notificationCountCurrentPeriod: 0,
    ...overrides,
  }).returning()
  return result
}

export async function seedAppUser(db: DrizzleClient, tenantId: string, overrides?: any) {
  const [result] = await db.insert(appUsers).values({
    id: randomUUID(),
    tenantId,
    pushOptIn: true,
    totalPurchases: 0,
    totalSpent: 0,
    ...overrides,
  }).returning()
  return result
}

export async function seedDevice(db: DrizzleClient, data: {
  tenantId: string
  appUserId: string
  isActive?: boolean
  deviceToken?: string
  platform?: string
}) {
  const [result] = await db.insert(devices).values({
    id: randomUUID(),
    tenantId: data.tenantId,
    appUserId: data.appUserId,
    deviceToken: data.deviceToken ?? `token-${randomUUID().slice(0, 8)}`,
    platform: data.platform ?? 'android',
    isActive: data.isActive ?? true,
  }).returning()
  return result
}

export async function seedNotification(db: DrizzleClient, data: {
  tenantId: string
  title?: string
  status?: string
  type?: string
  createdAt?: Date
}) {
  const [result] = await db.insert(notifications).values({
    id: randomUUID(),
    tenantId: data.tenantId,
    title: data.title ?? 'Test Notification',
    body: 'Test Body',
    type: data.type ?? 'manual',
    status: data.status ?? 'draft',
    createdAt: data.createdAt ?? new Date(),
  }).returning()
  return result
}

export async function seedDelivery(db: DrizzleClient, data: {
  tenantId: string
  status?: string
  createdAt?: Date
}) {
  const notif = await seedNotification(db, { tenantId: data.tenantId })
  const user = await seedAppUser(db, data.tenantId)
  const device = await seedDevice(db, { tenantId: data.tenantId, appUserId: user.id })

  const [result] = await db.insert(notificationDeliveries).values({
    id: randomUUID(),
    notificationId: notif.id,
    deviceId: device.id,
    tenantId: data.tenantId,
    status: data.status ?? 'pending',
    createdAt: data.createdAt ?? new Date(),
  }).returning()
  return result
}

export async function seedEvent(db: DrizzleClient, data: {
  tenantId: string
  eventType?: string
  createdAt?: Date
}) {
  const [result] = await db.insert(appEvents).values({
    id: randomUUID(),
    tenantId: data.tenantId,
    eventType: data.eventType ?? 'app_opened',
    properties: {},
    createdAt: data.createdAt ?? new Date(),
  }).returning()
  return result
}

// Bulk seed para testes de performance
export async function seed10KDeliveries(db: DrizzleClient, tenantId: string) {
  const notif = await seedNotification(db, { tenantId })
  const user = await seedAppUser(db, tenantId)
  const device = await seedDevice(db, { tenantId, appUserId: user.id })

  const values = Array.from({ length: 10000 }, (_, i) => ({
    id: randomUUID(),
    notificationId: notif.id,
    deviceId: device.id,
    tenantId,
    status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'sent' : 'delivered',
    createdAt: new Date(Date.now() - i * 60000), // 1 per minute
  }))

  // Insert in batches of 1000
  for (let i = 0; i < values.length; i += 1000) {
    await db.insert(notificationDeliveries).values(values.slice(i, i + 1000))
  }
}
```

---

## 9. Transaction Tests (Drizzle)

```typescript
describe('Drizzle Transactions', () => {
  it('should rollback on error', async () => {
    const tenantBefore = await seedTenant(db, { name: 'Original' })

    try {
      await db.transaction(async (tx) => {
        await tx.update(tenants)
          .set({ name: 'Updated' })
          .where(eq(tenants.id, tenantBefore.id))

        throw new Error('Simulated failure')
      })
    } catch {
      // expected
    }

    const after = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantBefore.id),
    })

    expect(after!.name).toBe('Original') // rollback happened
  })

  it('should commit on success', async () => {
    const tenant = await seedTenant(db, { name: 'Before' })

    await db.transaction(async (tx) => {
      await tx.update(tenants)
        .set({ name: 'After' })
        .where(eq(tenants.id, tenant.id))
    })

    const after = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.id),
    })

    expect(after!.name).toBe('After')
  })

  it('should isolate notification creation + delivery creation', async () => {
    // Se delivery falha, notificação também deve ser revertida
    const tenant = await seedTenant(db)

    try {
      await db.transaction(async (tx) => {
        const [notif] = await tx.insert(notifications).values({
          tenantId: tenant.id,
          title: 'Atomic',
          body: 'Test',
          type: 'manual',
          status: 'draft',
        }).returning()

        // Force failure
        await tx.insert(notificationDeliveries).values({
          notificationId: notif.id,
          deviceId: 'non-existent-device', // FK violation
          tenantId: tenant.id,
          status: 'pending',
        })
      })
    } catch {
      // expected FK error
    }

    // Notification should NOT exist (rolled back)
    const notifs = await db.query.notifications.findMany({
      where: and(
        eq(notifications.tenantId, tenant.id),
        eq(notifications.title, 'Atomic'),
      ),
    })

    expect(notifs).toHaveLength(0)
  })
})
```

---

## 10. Docker Compose Test

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: appfy_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    tmpfs: /var/lib/postgresql/data
    command: >
      postgres
        -c fsync=off
        -c synchronous_commit=off
        -c full_page_writes=off
        -c max_connections=200

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    command: redis-server --save "" --appendonly no

  minio-test:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9001:9000"
    command: server /data
    tmpfs: /data
```

### Env para Testes

```bash
# .env.test
DATABASE_URL=postgresql://test:test@localhost:5433/appfy_test
DIRECT_URL=postgresql://test:test@localhost:5433/appfy_test
REDIS_URL=redis://localhost:6380
JWT_SECRET=test-jwt-secret-at-least-32-chars!!
ENCRYPTION_SECRET=test-32-char-encryption-secret!!
SENTRY_DSN=
```

---

## 11. RLS for `tenants` Table (CRÍTICO — Credenciais Encriptadas)

A tabela `tenants` contém `platform_credentials`, `klaviyo_credentials` e `onesignal_api_key_encrypted` (OAuth tokens encriptados). Acesso deve ser restrito por membership ativa.

### 11.1 SQL Policies

```sql
-- Habilitar RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- SELECT: apenas membros ativos do tenant
CREATE POLICY tenants_select_member ON tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = tenants.id
        AND memberships.user_id = (auth.jwt() ->> 'sub')::uuid
    )
  );

-- UPDATE: apenas owners
CREATE POLICY tenants_update_owner ON tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.tenant_id = tenants.id
        AND memberships.user_id = (auth.jwt() ->> 'sub')::uuid
        AND memberships.role = 'owner'
    )
  );

-- INSERT: apenas service_role (provisionamento de tenant)
CREATE POLICY tenants_insert_service ON tenants
  FOR INSERT
  WITH CHECK (false); -- authenticated nunca insere; service_role bypassa RLS

-- DELETE: apenas service_role
CREATE POLICY tenants_delete_service ON tenants
  FOR DELETE
  USING (false); -- authenticated nunca deleta; service_role bypassa RLS
```

### 11.2 RLS Tests

```typescript
// packages/db/test/integration/rls/tenants-rls.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { queryAsTenant, queryAsServiceRole, queryAsUser } from './rls-test-helper'

/**
 * Helper: executa query como um usuário autenticado (via sub claim, não tenant_id)
 * Necessário porque tenants RLS depende de memberships.user_id, não de tenant_id no JWT.
 */
export async function queryAsUser(db: DrizzleClient, userId: string, query: string) {
  return db.execute(sql.raw(`
    SET LOCAL role = 'authenticated';
    SET LOCAL request.jwt.claims = '{"sub": "${userId}"}';
    ${query}
  `))
}

describe('RLS: tenants', () => {
  const TENANT_A = 'aaaa-aaaa-aaaa-aaaa'
  const TENANT_B = 'bbbb-bbbb-bbbb-bbbb'
  const USER_OWNER = 'user-owner-1111'
  const USER_EDITOR = 'user-editor-2222'
  const USER_NO_MEMBERSHIP = 'user-nomember-3333'

  beforeEach(async () => {
    // Seed como service_role (bypassa RLS)
    await queryAsServiceRole(db, `
      INSERT INTO tenants (id, name, slug, platform, platform_credentials, is_active)
      VALUES
        ('${TENANT_A}', 'Loja A', 'loja-a', 'shopify',
         '{"ct":"enc-a","iv":"iv-a","tag":"tag-a","alg":"aes-256-gcm"}', true),
        ('${TENANT_B}', 'Loja B', 'loja-b', 'nuvemshop',
         '{"ct":"enc-b","iv":"iv-b","tag":"tag-b","alg":"aes-256-gcm"}', true)
    `)

    await queryAsServiceRole(db, `
      INSERT INTO users (id, email, name) VALUES
        ('${USER_OWNER}', 'owner@test.com', 'Owner'),
        ('${USER_EDITOR}', 'editor@test.com', 'Editor'),
        ('${USER_NO_MEMBERSHIP}', 'nobody@test.com', 'Nobody')
    `)

    await queryAsServiceRole(db, `
      INSERT INTO memberships (id, user_id, tenant_id, role) VALUES
        ('mem-1', '${USER_OWNER}', '${TENANT_A}', 'owner'),
        ('mem-2', '${USER_EDITOR}', '${TENANT_A}', 'editor')
    `)
  })

  describe('SELECT', () => {
    it('authenticated user with membership can SELECT their tenant', async () => {
      const result = await queryAsUser(db, USER_OWNER,
        `SELECT id, name, slug FROM tenants WHERE id = '${TENANT_A}'`
      )

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Loja A')
    })

    it('authenticated user with membership can SELECT tenant (editor role)', async () => {
      const result = await queryAsUser(db, USER_EDITOR,
        `SELECT id, name FROM tenants WHERE id = '${TENANT_A}'`
      )

      expect(result.rows).toHaveLength(1)
    })

    it('authenticated user WITHOUT membership cannot SELECT tenant', async () => {
      const result = await queryAsUser(db, USER_NO_MEMBERSHIP,
        `SELECT * FROM tenants`
      )

      expect(result.rows).toHaveLength(0)
    })

    it('authenticated user cannot SELECT other tenant platform_credentials', async () => {
      // User has membership in TENANT_A but NOT in TENANT_B
      const result = await queryAsUser(db, USER_OWNER,
        `SELECT id, platform_credentials FROM tenants WHERE id = '${TENANT_B}'`
      )

      expect(result.rows).toHaveLength(0)
    })

    it('user with membership only sees their own tenants', async () => {
      const result = await queryAsUser(db, USER_OWNER, 'SELECT * FROM tenants')

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].id).toBe(TENANT_A)
    })
  })

  describe('UPDATE', () => {
    it('owner can UPDATE their tenant', async () => {
      const result = await queryAsUser(db, USER_OWNER,
        `UPDATE tenants SET name = 'Loja A Renamed' WHERE id = '${TENANT_A}' RETURNING *`
      )

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('Loja A Renamed')
    })

    it('editor CANNOT UPDATE tenant (only owner allowed)', async () => {
      const result = await queryAsUser(db, USER_EDITOR,
        `UPDATE tenants SET name = 'Hacked' WHERE id = '${TENANT_A}' RETURNING *`
      )

      expect(result.rows).toHaveLength(0)

      // Verificar que não foi alterado
      const check = await queryAsServiceRole(db,
        `SELECT name FROM tenants WHERE id = '${TENANT_A}'`
      )
      expect(check.rows[0].name).toBe('Loja A')
    })

    it('owner CANNOT UPDATE other tenant', async () => {
      const result = await queryAsUser(db, USER_OWNER,
        `UPDATE tenants SET name = 'Hacked' WHERE id = '${TENANT_B}' RETURNING *`
      )

      expect(result.rows).toHaveLength(0)

      const check = await queryAsServiceRole(db,
        `SELECT name FROM tenants WHERE id = '${TENANT_B}'`
      )
      expect(check.rows[0].name).toBe('Loja B')
    })

    it('user without membership CANNOT UPDATE any tenant', async () => {
      const result = await queryAsUser(db, USER_NO_MEMBERSHIP,
        `UPDATE tenants SET name = 'Hacked' WHERE id = '${TENANT_A}' RETURNING *`
      )

      expect(result.rows).toHaveLength(0)
    })
  })

  describe('INSERT', () => {
    it('authenticated user CANNOT INSERT tenant (service_role only)', async () => {
      await expect(
        queryAsUser(db, USER_OWNER, `
          INSERT INTO tenants (id, name, slug, platform, is_active)
          VALUES ('new-tenant-id', 'Evil Tenant', 'evil', 'shopify', true)
        `)
      ).rejects.toThrow() // RLS policy blocks
    })

    it('service_role CAN INSERT tenant (provisioning)', async () => {
      const result = await queryAsServiceRole(db, `
        INSERT INTO tenants (id, name, slug, platform, is_active)
        VALUES ('new-tenant-id', 'New Tenant', 'new-tenant', 'shopify', true)
        RETURNING *
      `)

      expect(result.rows).toHaveLength(1)
      expect(result.rows[0].name).toBe('New Tenant')
    })
  })

  describe('DELETE', () => {
    it('authenticated user CANNOT DELETE tenant (service_role only)', async () => {
      const result = await queryAsUser(db, USER_OWNER,
        `DELETE FROM tenants WHERE id = '${TENANT_A}' RETURNING *`
      )

      expect(result.rows).toHaveLength(0)

      // Tenant still exists
      const check = await queryAsServiceRole(db,
        `SELECT COUNT(*) as cnt FROM tenants WHERE id = '${TENANT_A}'`
      )
      expect(Number(check.rows[0].cnt)).toBe(1)
    })

    it('service_role CAN DELETE tenant', async () => {
      await queryAsServiceRole(db, `
        DELETE FROM memberships WHERE tenant_id = '${TENANT_B}'
      `)

      const result = await queryAsServiceRole(db,
        `DELETE FROM tenants WHERE id = '${TENANT_B}' RETURNING *`
      )

      expect(result.rows).toHaveLength(1)
    })
  })
})
```

### 11.3 Migration Verification

```typescript
describe('Migration: tenants RLS enabled', () => {
  it('should have RLS enabled on tenants table', async () => {
    const result = await db.execute(sql`
      SELECT relrowsecurity
      FROM pg_class
      WHERE relname = 'tenants'
    `)

    expect(result.rows[0].relrowsecurity).toBe(true)
  })

  it('should have tenants in pg_policies after migration', async () => {
    const result = await db.execute(sql`
      SELECT policyname FROM pg_policies
      WHERE tablename = 'tenants' AND schemaname = 'public'
    `)

    const policies = result.rows.map((r: any) => r.policyname)
    expect(policies).toContain('tenants_select_member')
    expect(policies).toContain('tenants_update_owner')
    expect(policies).toContain('tenants_insert_service')
    expect(policies).toContain('tenants_delete_service')
  })
})
```

---

## 12. RBAC Matrix Tests (Operações Destrutivas)

Testa sistematicamente que cada role (`viewer`, `editor`, `owner`) tem acesso correto a cada endpoint.

### 12.1 RBAC Test Helper

```typescript
// packages/api/test/helpers/rbac-helper.ts
import { createApp } from '@/app'
import { createDependencies } from '@/factories/dependencies'

type Role = 'owner' | 'editor' | 'viewer'

/**
 * Cria app Hono de teste e retorna helper para fazer requests autenticados por role.
 */
export function createRbacTestClient(deps = createDependencies()) {
  const app = createApp(deps)

  async function request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    role: Role,
    body?: Record<string, unknown>,
  ) {
    const token = generateTestJwt({
      sub: `user-${role}`,
      tenant_id: 'tenant-rbac',
    })

    const init: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Id': 'tenant-rbac',
        'Content-Type': 'application/json',
      },
    }

    if (body) {
      init.body = JSON.stringify(body)
    }

    return app.request(path, init)
  }

  return { request }
}

/**
 * Seed memberships para os 3 roles de teste
 */
export async function seedRbacMemberships(db: DrizzleClient) {
  const tenant = await seedTenant(db, { id: 'tenant-rbac' })

  await db.insert(users).values([
    { id: 'user-owner', email: 'owner@test.com', name: 'Owner' },
    { id: 'user-editor', email: 'editor@test.com', name: 'Editor' },
    { id: 'user-viewer', email: 'viewer@test.com', name: 'Viewer' },
  ])

  await db.insert(memberships).values([
    { userId: 'user-owner', tenantId: 'tenant-rbac', role: 'owner' },
    { userId: 'user-editor', tenantId: 'tenant-rbac', role: 'editor' },
    { userId: 'user-viewer', tenantId: 'tenant-rbac', role: 'viewer' },
  ])

  return tenant
}
```

### 12.2 RBAC Matrix — Systematic Tests

```typescript
// packages/api/test/integration/rbac/rbac-matrix.spec.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createRbacTestClient, seedRbacMemberships } from '../helpers/rbac-helper'

/**
 * Matriz de permissões RBAC.
 * Cada entrada define: [method, path, body?, expectedStatus por role]
 */
type RbacEntry = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  body?: Record<string, unknown>
  expected: { viewer: number; editor: number; owner: number }
}

const RBAC_MATRIX: RbacEntry[] = [
  // --- Notifications ---
  {
    method: 'GET',
    path: '/api/notifications',
    expected: { viewer: 200, editor: 200, owner: 200 },
  },
  {
    method: 'POST',
    path: '/api/notifications',
    body: { title: 'Test Push', body: 'Body', type: 'manual' },
    expected: { viewer: 403, editor: 200, owner: 200 },
  },
  {
    method: 'DELETE',
    path: '/api/notifications/notif-rbac-1',
    expected: { viewer: 403, editor: 403, owner: 200 },
  },

  // --- Billing ---
  {
    method: 'POST',
    path: '/api/billing/upgrade',
    body: { planId: 'plan-business' },
    expected: { viewer: 403, editor: 403, owner: 200 },
  },

  // --- Members ---
  {
    method: 'POST',
    path: '/api/members/invite',
    body: { email: 'new@test.com', role: 'viewer' },
    expected: { viewer: 403, editor: 403, owner: 200 },
  },

  // --- Settings ---
  {
    method: 'PUT',
    path: '/api/settings',
    body: { name: 'Updated Store Name' },
    expected: { viewer: 403, editor: 200, owner: 200 },
  },
]

describe('RBAC Matrix (systematic)', () => {
  let client: ReturnType<typeof createRbacTestClient>

  beforeAll(async () => {
    await seedRbacMemberships(db)

    // Seed notification para DELETE test
    await seedNotification(db, { id: 'notif-rbac-1', tenantId: 'tenant-rbac', title: 'To Delete' })

    client = createRbacTestClient()
  })

  const ROLES: Array<'viewer' | 'editor' | 'owner'> = ['viewer', 'editor', 'owner']

  RBAC_MATRIX.forEach(({ method, path, body, expected }) => {
    describe(`${method} ${path}`, () => {
      ROLES.forEach((role) => {
        it(`${role}: should return ${expected[role]}`, async () => {
          const res = await client.request(method, path, role, body)

          expect(res.status).toBe(expected[role])
        })
      })
    })
  })
})
```

### 12.3 RBAC Edge Cases

```typescript
// packages/api/test/integration/rbac/rbac-edge-cases.spec.ts
describe('RBAC Edge Cases', () => {
  let client: ReturnType<typeof createRbacTestClient>

  beforeAll(async () => {
    await seedRbacMemberships(db)
    client = createRbacTestClient()
  })

  describe('viewer role restrictions', () => {
    it('viewer can GET all read-only endpoints', async () => {
      const readEndpoints = [
        '/api/notifications',
        '/api/app-users',
        '/api/analytics/overview',
        '/api/automation-configs',
      ]

      for (const path of readEndpoints) {
        const res = await client.request('GET', path, 'viewer')
        expect(res.status).toBe(200)
      }
    })

    it('viewer CANNOT perform any write operation', async () => {
      const writeOps: Array<{ method: 'POST' | 'PUT' | 'DELETE'; path: string; body?: any }> = [
        { method: 'POST', path: '/api/notifications', body: { title: 'X', body: 'Y', type: 'manual' } },
        { method: 'PUT', path: '/api/settings', body: { name: 'X' } },
        { method: 'DELETE', path: '/api/notifications/any-id' },
        { method: 'POST', path: '/api/members/invite', body: { email: 'x@y.com', role: 'viewer' } },
        { method: 'POST', path: '/api/billing/upgrade', body: { planId: 'plan-1' } },
      ]

      for (const { method, path, body } of writeOps) {
        const res = await client.request(method, path, 'viewer', body)
        expect(res.status).toBe(403)
      }
    })
  })

  describe('editor role restrictions', () => {
    it('editor can create and update resources', async () => {
      const res = await client.request('POST', '/api/notifications', 'editor', {
        title: 'Editor Push', body: 'Body', type: 'manual',
      })
      expect(res.status).toBe(200)
    })

    it('editor CANNOT delete resources (owner-only)', async () => {
      const notif = await seedNotification(db, { tenantId: 'tenant-rbac' })

      const res = await client.request('DELETE', `/api/notifications/${notif.id}`, 'editor')
      expect(res.status).toBe(403)
    })

    it('editor CANNOT manage billing', async () => {
      const res = await client.request('POST', '/api/billing/upgrade', 'editor', {
        planId: 'plan-elite',
      })
      expect(res.status).toBe(403)
    })

    it('editor CANNOT invite members', async () => {
      const res = await client.request('POST', '/api/members/invite', 'editor', {
        email: 'new@test.com', role: 'viewer',
      })
      expect(res.status).toBe(403)
    })
  })

  describe('owner role full access', () => {
    it('owner can DELETE resources', async () => {
      const notif = await seedNotification(db, { tenantId: 'tenant-rbac' })

      const res = await client.request('DELETE', `/api/notifications/${notif.id}`, 'owner')
      expect(res.status).toBe(200)
    })

    it('owner can manage billing', async () => {
      const res = await client.request('POST', '/api/billing/upgrade', 'owner', {
        planId: 'plan-elite',
      })
      expect(res.status).toBe(200)
    })

    it('owner can invite members', async () => {
      const res = await client.request('POST', '/api/members/invite', 'owner', {
        email: 'invited@test.com', role: 'editor',
      })
      expect(res.status).toBe(200)
    })

    it('owner can update settings', async () => {
      const res = await client.request('PUT', '/api/settings', 'owner', {
        name: 'Updated By Owner',
      })
      expect(res.status).toBe(200)
    })
  })

  describe('cross-tenant RBAC isolation', () => {
    it('owner of tenant A CANNOT access tenant B resources', async () => {
      const tenantB = await seedTenant(db, { id: 'tenant-rbac-b' })
      await seedNotification(db, { tenantId: tenantB.id, title: 'Secret B' })

      // Owner of tenant-rbac tries to access tenant-rbac-b
      const token = generateTestJwt({
        sub: 'user-owner',
        tenant_id: 'tenant-rbac-b', // forged tenant_id
      })

      const res = await app.request('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-Id': 'tenant-rbac-b',
        },
      })

      // Should be 403 — no membership in tenant-rbac-b
      expect(res.status).toBe(403)
    })
  })
})
