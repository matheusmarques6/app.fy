# TDD Dev — AppFy

> Especificação de implementação TDD módulo por módulo.
> Stack: Vitest + Hono + Drizzle + OneSignal + BullMQ.
> Metodologia: Red-Green-Refactor (Manguinho/Rocketseat).

---

## 1. Infraestrutura de Testes

### 1.1 Vitest Config

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'packages/api/src'),
      '@db': resolve(__dirname, 'packages/db/src'),
      '@notifications': resolve(__dirname, 'packages/notifications/src'),
      '@integrations': resolve(__dirname, 'packages/integrations/src'),
      '@shared': resolve(__dirname, 'packages/shared/src'),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/test/unit/**/*.spec.ts'],
          pool: 'threads',
          coverage: {
            provider: 'v8',
            thresholds: { lines: 80, branches: 80, functions: 80 },
          },
        },
      },
      {
        test: {
          name: 'integration',
          include: ['packages/*/test/integration/**/*.spec.ts'],
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          setupFiles: ['./test/setup-integration.ts'],
          globalSetup: ['./test/global-setup.ts'],
        },
      },
      {
        test: {
          name: 'isolation',
          include: ['packages/*/test/isolation/**/*.spec.ts'],
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          setupFiles: ['./test/setup-integration.ts'],
        },
      },
    ],
  },
})
```

### 1.2 Global Setup (testcontainers)

```typescript
// test/global-setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { GenericContainer } from 'testcontainers'

let pgContainer: any
let redisContainer: any

export async function setup() {
  pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withTmpFs({ '/var/lib/postgresql/data': 'rw' })
    .start()

  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start()

  process.env.DATABASE_URL = pgContainer.getConnectionUri()
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`

  // Run migrations
  const { migrate } = await import('@db/migrate')
  await migrate(process.env.DATABASE_URL)
}

export async function teardown() {
  await pgContainer?.stop()
  await redisContainer?.stop()
}
```

### 1.3 Setup por Suite

```typescript
// test/setup-integration.ts
import { sql } from 'drizzle-orm'
import { createDrizzleClient } from '@db/client'

let db: ReturnType<typeof createDrizzleClient>

beforeAll(async () => {
  db = createDrizzleClient(process.env.DATABASE_URL!)
})

afterAll(async () => {
  await db.$client.end()
})

beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      notification_deliveries, notifications, app_events,
      app_user_products, app_user_segments, devices, app_users,
      automation_configs, audit_log, app_configs, memberships,
      tenants, users
    CASCADE
  `)
})

export { db }
```

### 1.4 Test Helpers

```typescript
// test/helpers/jwt.ts
import { SignJWT } from 'jose'

const TEST_SECRET = new TextEncoder().encode('test-jwt-secret-at-least-32-chars!')

export async function createTestJwt(claims: {
  sub: string
  tenant_id?: string
}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(TEST_SECRET)
}

// test/helpers/request.ts
export function authHeaders(jwt: string, tenantId: string) {
  return {
    'Authorization': `Bearer ${jwt}`,
    'X-Tenant-Id': tenantId,
    'Content-Type': 'application/json',
  }
}
```

### 1.5 MSW Setup

```typescript
// test/mocks/server.ts
import { setupServer } from 'msw/node'
import { onesignalHandlers } from './onesignal'
import { shopifyHandlers } from './shopify'
import { stripeHandlers } from './stripe'

export const mockServer = setupServer(
  ...onesignalHandlers,
  ...shopifyHandlers,
  ...stripeHandlers,
)

// test/mocks/onesignal.ts
import { http, HttpResponse } from 'msw'

export const onesignalHandlers = [
  http.post('https://onesignal.com/api/v1/notifications', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      id: `mock-${Date.now()}`,
      recipients: body.include_player_ids?.length ?? 0,
    })
  }),

  http.post('https://onesignal.com/api/v1/apps', async ({ request }) => {
    const body = await request.json() as any
    return HttpResponse.json({
      id: `app-${Date.now()}`,
      name: body.name,
      basic_auth_key: 'mock-key',
    })
  }),

  http.get('https://onesignal.com/api/v1/notifications/:id', () => {
    return HttpResponse.json({
      successful: 100,
      failed: 2,
      converted: 8,
      remaining: 0,
    })
  }),
]
```

### 1.6 Organização de Arquivos

```
packages/api/
├── src/
│   ├── app.ts                  # Hono app factory
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── notifications.ts
│   │   ├── app-users.ts
│   │   ├── devices.ts
│   │   ├── automations.ts
│   │   ├── integrations.ts
│   │   ├── billing.ts
│   │   └── webhooks.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── tenant.ts
│   │   ├── roles.ts
│   │   ├── validate.ts
│   │   ├── rate-limit.ts
│   │   └── logger.ts
│   ├── services/
│   │   ├── notification.service.ts
│   │   ├── push.service.ts
│   │   ├── automation.service.ts
│   │   ├── encryption.service.ts
│   │   ├── event.service.ts
│   │   └── billing.service.ts
│   ├── repositories/
│   │   ├── notification.repo.ts
│   │   ├── device.repo.ts
│   │   ├── app-user.repo.ts
│   │   ├── automation-config.repo.ts
│   │   ├── app-event.repo.ts
│   │   ├── membership.repo.ts
│   │   └── audit-log.repo.ts
│   └── factories/
│       └── dependencies.ts
└── test/
    ├── unit/
    │   ├── services/
    │   ├── middleware/
    │   └── domain/
    ├── integration/
    │   ├── repositories/
    │   ├── routes/
    │   └── workers/
    ├── isolation/
    │   └── multi-tenant.spec.ts
    ├── helpers/
    │   ├── jwt.ts
    │   ├── request.ts
    │   ├── builders.ts
    │   └── spies.ts
    ├── mocks/
    │   ├── server.ts
    │   ├── onesignal.ts
    │   ├── shopify.ts
    │   └── stripe.ts
    └── fixtures/
        ├── tenants.ts
        ├── notifications.ts
        └── webhooks.ts
```

---

## 2. TDD por Módulo

### 2.1 Auth Module

**Caso de uso:** Validar JWT, extrair userId, switch-tenant.

#### RED — Primeiro teste

```typescript
// packages/api/test/unit/middleware/auth.spec.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '@/app'
import { createTestJwt } from '../../helpers/jwt'

describe('Auth Middleware', () => {
  it('should set userId from valid JWT', async () => {
    // Arrange
    const app = createApp()
    app.get('/test-auth', (c) => c.json({ userId: c.get('userId') }))
    const jwt = await createTestJwt({ sub: 'user-123' })

    // Act
    const res = await app.request('/api/test-auth', {
      headers: { 'Authorization': `Bearer ${jwt}` },
    })

    // Assert
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.userId).toBe('user-123')
  })

  it('should return 401 without Authorization header', async () => {
    const app = createApp()
    const res = await app.request('/api/notifications')
    expect(res.status).toBe(401)
  })

  it('should return 401 with invalid JWT', async () => {
    const app = createApp()
    const res = await app.request('/api/notifications', {
      headers: { 'Authorization': 'Bearer invalid.jwt.token' },
    })
    expect(res.status).toBe(401)
  })
})
```

#### RED — Switch tenant

```typescript
// packages/api/test/unit/services/switch-tenant.spec.ts
describe('SwitchTenantUseCase', () => {
  function makeSut() {
    const membershipRepo = new MembershipRepositorySpy()
    const sut = new SwitchTenantUseCase(membershipRepo)
    return { sut, membershipRepo }
  }

  it('should return JWT with tenant_id when membership exists', async () => {
    // Arrange
    const { sut, membershipRepo } = makeSut()
    membershipRepo.findResult = { role: 'owner' }

    // Act
    const result = await sut.perform({
      userId: 'user-1',
      tenantId: 'tenant-1',
    })

    // Assert
    expect(result.token).toBeDefined()
    expect(membershipRepo.callsCount).toBe(1)
    expect(membershipRepo.lastInput).toEqual({
      userId: 'user-1',
      tenantId: 'tenant-1',
    })
  })

  it('should throw when no membership exists', async () => {
    const { sut, membershipRepo } = makeSut()
    membershipRepo.findResult = null

    await expect(
      sut.perform({ userId: 'user-1', tenantId: 'no-access' })
    ).rejects.toThrow('No membership found')
  })
})
```

#### GREEN — Implementação mínima

```typescript
// packages/api/src/services/switch-tenant.service.ts
export class SwitchTenantUseCase {
  constructor(private membershipRepo: MembershipRepository) {}

  async perform(input: { userId: string; tenantId: string }) {
    const membership = await this.membershipRepo.find(input.userId, input.tenantId)
    if (!membership) throw new Error('No membership found')

    const token = await signJwt({
      sub: input.userId,
      tenant_id: input.tenantId,
      role: membership.role,
    })

    return { token, role: membership.role }
  }
}
```

### 2.2 Tenant Middleware

```typescript
// packages/api/test/unit/middleware/tenant.spec.ts
describe('Tenant Middleware', () => {
  function makeSut() {
    const membershipRepo = new MembershipRepositorySpy()
    membershipRepo.findResult = { role: 'owner' }
    const app = createApp({ membershipRepo })
    return { app, membershipRepo }
  }

  it('should return 400 without X-Tenant-Id header', async () => {
    const { app } = makeSut()
    const jwt = await createTestJwt({ sub: 'user-1' })

    const res = await app.request('/api/notifications', {
      headers: { 'Authorization': `Bearer ${jwt}` },
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: 'X-Tenant-Id header required',
    })
  })

  it('should return 403 when user has no membership', async () => {
    const { app, membershipRepo } = makeSut()
    membershipRepo.findResult = null
    const jwt = await createTestJwt({ sub: 'user-1' })

    const res = await app.request('/api/notifications', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'X-Tenant-Id': 'tenant-no-access',
      },
    })

    expect(res.status).toBe(403)
  })

  it('should set tenantId and userRole in context', async () => {
    const { app, membershipRepo } = makeSut()
    membershipRepo.findResult = { role: 'editor' }
    const jwt = await createTestJwt({ sub: 'user-1' })

    // Route that echoes context
    app.get('/api/test-ctx', (c) => c.json({
      tenantId: c.get('tenantId'),
      userRole: c.get('userRole'),
    }))

    const res = await app.request('/api/test-ctx', {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'X-Tenant-Id': 'tenant-1',
      },
    })

    const data = await res.json()
    expect(data.tenantId).toBe('tenant-1')
    expect(data.userRole).toBe('editor')
  })
})
```

### 2.3 Notification Module (CORE)

#### Create Notification — RED-GREEN-REFACTOR completo

```typescript
// packages/api/test/unit/services/notification.spec.ts
describe('CreateNotificationUseCase', () => {
  function makeSut() {
    const notificationRepo = new NotificationRepositorySpy()
    const auditLogRepo = new AuditLogRepositorySpy()
    const sut = new CreateNotificationUseCase(notificationRepo, auditLogRepo)
    return { sut, notificationRepo, auditLogRepo }
  }

  // RED 1: Deve salvar notificação no repo
  it('should call notificationRepo.create with correct data', async () => {
    const { sut, notificationRepo } = makeSut()

    await sut.perform({
      tenantId: 'tenant-1',
      userId: 'user-1',
      title: 'Promoção',
      body: '50% off em tudo',
      type: 'manual',
    })

    expect(notificationRepo.createCallsCount).toBe(1)
    expect(notificationRepo.lastCreateInput).toMatchObject({
      tenantId: 'tenant-1',
      title: 'Promoção',
      body: '50% off em tudo',
      type: 'manual',
      status: 'draft',
    })
  })

  // RED 2: Deve retornar a notificação criada
  it('should return created notification with id and status draft', async () => {
    const { sut } = makeSut()

    const result = await sut.perform({
      tenantId: 'tenant-1',
      userId: 'user-1',
      title: 'Promoção',
      body: '50% off',
      type: 'manual',
    })

    expect(result.id).toBeDefined()
    expect(result.status).toBe('draft')
  })

  // RED 3: Deve registrar no audit log
  it('should create audit log entry', async () => {
    const { sut, auditLogRepo } = makeSut()

    await sut.perform({
      tenantId: 'tenant-1',
      userId: 'user-1',
      title: 'Promoção',
      body: '50% off',
      type: 'manual',
    })

    expect(auditLogRepo.callsCount).toBe(1)
    expect(auditLogRepo.lastInput).toMatchObject({
      tenantId: 'tenant-1',
      userId: 'user-1',
      action: 'notification.created',
      resource: 'notification',
    })
  })

  // RED 4: Deve sanitizar XSS no título e body
  it('should sanitize XSS in title and body', async () => {
    const { sut, notificationRepo } = makeSut()

    await sut.perform({
      tenantId: 'tenant-1',
      userId: 'user-1',
      title: '<script>alert("xss")</script>Promoção',
      body: '<img onerror=alert(1)>Compre agora',
      type: 'manual',
    })

    expect(notificationRepo.lastCreateInput.title).toBe('Promoção')
    expect(notificationRepo.lastCreateInput.body).toBe('Compre agora')
  })

  // RED 5: Deve rejeitar título vazio
  it('should throw on empty title', async () => {
    const { sut } = makeSut()

    await expect(sut.perform({
      tenantId: 'tenant-1',
      userId: 'user-1',
      title: '',
      body: 'body',
      type: 'manual',
    })).rejects.toThrow('Title is required')
  })
})
```

#### GREEN — Implementação

```typescript
// packages/api/src/services/notification.service.ts
export class CreateNotificationUseCase {
  constructor(
    private notificationRepo: NotificationRepository,
    private auditLogRepo: AuditLogRepository,
  ) {}

  async perform(input: CreateNotificationInput) {
    const title = sanitize(input.title)
    const body = sanitize(input.body)

    if (!title) throw new Error('Title is required')
    if (!body) throw new Error('Body is required')

    const notification = await this.notificationRepo.create(input.tenantId, {
      title,
      body,
      type: input.type,
      status: 'draft',
      createdBy: input.userId,
    })

    await this.auditLogRepo.create({
      tenantId: input.tenantId,
      userId: input.userId,
      action: 'notification.created',
      resource: 'notification',
      details: { notificationId: notification.id },
    })

    return notification
  }
}
```

#### Plan Limit Enforcement

```typescript
describe('Plan Limit Enforcement', () => {
  function makeSut() {
    const tenantRepo = new TenantRepositorySpy()
    const sut = new CheckPlanLimitUseCase(tenantRepo)
    return { sut, tenantRepo }
  }

  it('should allow manual notification under limit', async () => {
    const { sut, tenantRepo } = makeSut()
    tenantRepo.getTenantResult = {
      notificationCountCurrentPeriod: 10,
      notificationLimit: 15,
    }

    const result = await sut.check('tenant-1', 'manual')

    expect(result.allowed).toBe(true)
  })

  it('should block manual notification at limit', async () => {
    const { sut, tenantRepo } = makeSut()
    tenantRepo.getTenantResult = {
      notificationCountCurrentPeriod: 15,
      notificationLimit: 15,
    }

    const result = await sut.check('tenant-1', 'manual')

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('Plan limit reached')
  })

  it('should ALWAYS allow automated notifications even over limit', async () => {
    const { sut, tenantRepo } = makeSut()
    tenantRepo.getTenantResult = {
      notificationCountCurrentPeriod: 100,
      notificationLimit: 15,
    }

    const result = await sut.check('tenant-1', 'automated')

    expect(result.allowed).toBe(true) // automáticas nunca param
  })

  // Boundary
  it('should allow at limit - 1', async () => {
    const { sut, tenantRepo } = makeSut()
    tenantRepo.getTenantResult = {
      notificationCountCurrentPeriod: 14,
      notificationLimit: 15,
    }

    const result = await sut.check('tenant-1', 'manual')
    expect(result.allowed).toBe(true)
  })

  it('should handle unlimited plan (null limit)', async () => {
    const { sut, tenantRepo } = makeSut()
    tenantRepo.getTenantResult = {
      notificationCountCurrentPeriod: 99999,
      notificationLimit: null, // ilimitado
    }

    const result = await sut.check('tenant-1', 'manual')
    expect(result.allowed).toBe(true)
  })
})
```

### 2.4 Push Module (OneSignal)

```typescript
// packages/api/test/unit/services/push.spec.ts
describe('OneSignalPushService', () => {
  function makeSut() {
    const sut = new OneSignalPushService({ apiKey: 'test-key' })
    return { sut }
  }

  it('should send notification with correct payload', async () => {
    const { sut } = makeSut()

    const result = await sut.sendNotification('app-123', {
      title: 'Promoção!',
      body: 'Compre agora',
      tokens: ['player-1', 'player-2'],
      data: { notificationId: 'notif-1', targetUrl: '/products/123' },
    })

    expect(result.id).toBeDefined()
    expect(result.recipients).toBe(2)
  })

  it('should handle empty tokens array', async () => {
    const { sut } = makeSut()

    const result = await sut.sendNotification('app-123', {
      title: 'Test', body: 'Test', tokens: [],
    })

    expect(result.recipients).toBe(0)
  })

  it('should create OneSignal app for new tenant', async () => {
    const { sut } = makeSut()

    const result = await sut.createApp({
      name: 'Loja Nike',
      apnsCert: 'cert-content',
      gcmKey: 'gcm-key',
    })

    expect(result.appId).toBeDefined()
    expect(typeof result.appId).toBe('string')
  })
})

// packages/api/test/unit/services/push-dispatch.spec.ts
describe('PushDispatchUseCase', () => {
  function makeSut() {
    const deviceRepo = new DeviceRepositorySpy()
    const pushProvider = new PushProviderSpy()
    const deliveryRepo = new DeliveryRepositorySpy()
    const notificationRepo = new NotificationRepositorySpy()
    const tenantRepo = new TenantRepositorySpy()
    tenantRepo.getTenantResult = { onesignalAppId: 'os-app-123' }

    const sut = new PushDispatchUseCase(
      deviceRepo, pushProvider, deliveryRepo, notificationRepo, tenantRepo,
    )
    return { sut, deviceRepo, pushProvider, deliveryRepo, notificationRepo, tenantRepo }
  }

  it('should fetch active devices and send via push provider', async () => {
    const { sut, deviceRepo, pushProvider } = makeSut()
    deviceRepo.findActiveResult = [
      { id: 'd1', deviceToken: 'token-1', platform: 'android' },
      { id: 'd2', deviceToken: 'token-2', platform: 'ios' },
    ]

    await sut.perform({ tenantId: 'tenant-1', notificationId: 'notif-1' })

    expect(pushProvider.calls).toHaveLength(1)
    expect(pushProvider.calls[0].tokens).toEqual(['token-1', 'token-2'])
  })

  it('should create delivery records for each device', async () => {
    const { sut, deviceRepo, deliveryRepo } = makeSut()
    deviceRepo.findActiveResult = [
      { id: 'd1', deviceToken: 'token-1', platform: 'android' },
      { id: 'd2', deviceToken: 'token-2', platform: 'ios' },
    ]

    await sut.perform({ tenantId: 'tenant-1', notificationId: 'notif-1' })

    expect(deliveryRepo.bulkCreateCallsCount).toBe(1)
    expect(deliveryRepo.lastBulkInput).toHaveLength(2)
    expect(deliveryRepo.lastBulkInput[0].status).toBe('sent')
  })

  it('should update notification status to sent', async () => {
    const { sut, notificationRepo, deviceRepo } = makeSut()
    deviceRepo.findActiveResult = [{ id: 'd1', deviceToken: 'token-1', platform: 'android' }]

    await sut.perform({ tenantId: 'tenant-1', notificationId: 'notif-1' })

    expect(notificationRepo.lastStatusUpdate).toEqual({
      id: 'notif-1',
      status: 'sent',
    })
  })

  it('should skip inactive devices', async () => {
    const { sut, deviceRepo, pushProvider } = makeSut()
    deviceRepo.findActiveResult = [] // nenhum device ativo

    await sut.perform({ tenantId: 'tenant-1', notificationId: 'notif-1' })

    expect(pushProvider.calls).toHaveLength(0)
  })
})
```

### 2.5 Automation Flows

```typescript
// packages/api/test/unit/services/automation.spec.ts
describe('AutomationTriggerUseCase', () => {
  function makeSut() {
    const configRepo = new AutomationConfigRepositorySpy()
    const notificationRepo = new NotificationRepositorySpy()
    const queue = new BullMQSpy()

    configRepo.defaultConfig = {
      isEnabled: true,
      delaySeconds: 3600,
      templateTitle: 'Olá {{name}}, seu carrinho te espera!',
      templateBody: '{{product_name}} está esperando por você',
    }

    const sut = new AutomationTriggerUseCase(configRepo, notificationRepo, queue)
    return { sut, configRepo, notificationRepo, queue }
  }

  it('should create notification and enqueue delayed job', async () => {
    const { sut, queue, notificationRepo } = makeSut()

    await sut.trigger({
      tenantId: 'tenant-1',
      flowType: 'cart_abandoned',
      variables: {
        name: 'João',
        product_name: 'Tênis Nike',
        product_image_url: 'https://r2.example.com/tenis.jpg',
        checkout_url: 'https://loja.com/checkout/abc',
      },
    })

    // Notificação criada com template substituído
    expect(notificationRepo.lastCreateInput.title).toBe('Olá João, seu carrinho te espera!')
    expect(notificationRepo.lastCreateInput.body).toBe('Tênis Nike está esperando por você')
    expect(notificationRepo.lastCreateInput.type).toBe('automated')

    // Job enfileirado com delay
    expect(queue.addedJobs).toHaveLength(1)
    expect(queue.addedJobs[0].opts.delay).toBe(3600 * 1000) // 1h em ms
  })

  it('should NOT trigger if flow is disabled', async () => {
    const { sut, configRepo, queue } = makeSut()
    configRepo.defaultConfig = { ...configRepo.defaultConfig, isEnabled: false }

    await sut.trigger({
      tenantId: 'tenant-1',
      flowType: 'cart_abandoned',
      variables: {},
    })

    expect(queue.addedJobs).toHaveLength(0)
  })

  it('should use immediate send for order_confirmed (delay = 0)', async () => {
    const { sut, configRepo, queue } = makeSut()
    configRepo.defaultConfig = { ...configRepo.defaultConfig, delaySeconds: 0 }

    await sut.trigger({
      tenantId: 'tenant-1',
      flowType: 'order_confirmed',
      variables: { order_number: '#12345' },
    })

    expect(queue.addedJobs[0].opts.delay).toBe(0)
  })

  it('should handle missing config gracefully (use defaults)', async () => {
    const { sut, configRepo, queue } = makeSut()
    configRepo.defaultConfig = null // sem config custom

    await sut.trigger({
      tenantId: 'tenant-1',
      flowType: 'welcome',
      variables: { name: 'Maria' },
    })

    // Deve usar template padrão do sistema
    expect(queue.addedJobs).toHaveLength(1)
  })
})
```

### 2.6 Integration Adapters

```typescript
// packages/integrations/test/unit/shopify.spec.ts
describe('ShopifyAdapter', () => {
  function makeSut() {
    const sut = new ShopifyAdapter({
      storeUrl: 'https://test-store.myshopify.com',
      accessToken: 'shpat_test123',
    })
    return { sut }
  }

  it('should fetch products', async () => {
    const { sut } = makeSut()

    const products = await sut.getProducts({ limit: 10 })

    expect(Array.isArray(products)).toBe(true)
    expect(products[0]).toHaveProperty('id')
    expect(products[0]).toHaveProperty('title')
    expect(products[0]).toHaveProperty('price')
  })

  it('should fetch abandoned carts', async () => {
    const { sut } = makeSut()

    const carts = await sut.getAbandonedCarts()

    expect(Array.isArray(carts)).toBe(true)
  })

  it('should verify webhook HMAC signature', () => {
    const body = '{"test": true}'
    const secret = 'test-secret'
    const validHmac = createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64')

    expect(ShopifyAdapter.verifyWebhook(body, validHmac, secret)).toBe(true)
  })

  it('should reject invalid webhook HMAC', () => {
    const body = '{"test": true}'
    const secret = 'test-secret'

    expect(ShopifyAdapter.verifyWebhook(body, 'invalid-hmac', secret)).toBe(false)
  })

  it('should reject tampered webhook body', () => {
    const body = '{"test": true}'
    const tamperedBody = '{"test": false}'
    const secret = 'test-secret'
    const hmac = createHmac('sha256', secret).update(body, 'utf8').digest('base64')

    expect(ShopifyAdapter.verifyWebhook(tamperedBody, hmac, secret)).toBe(false)
  })
})
```

### 2.7 App Users & Devices

```typescript
// packages/api/test/unit/services/device.spec.ts
describe('RegisterDeviceUseCase', () => {
  function makeSut() {
    const deviceRepo = new DeviceRepositorySpy()
    const appUserRepo = new AppUserRepositorySpy()
    const sut = new RegisterDeviceUseCase(deviceRepo, appUserRepo)
    return { sut, deviceRepo, appUserRepo }
  }

  it('should create new app user and device', async () => {
    const { sut, deviceRepo, appUserRepo } = makeSut()
    appUserRepo.findByExternalResult = null // user não existe

    await sut.perform({
      tenantId: 'tenant-1',
      deviceToken: 'player-123',
      platform: 'android',
      externalUserId: 'shopify-customer-456',
    })

    expect(appUserRepo.createCallsCount).toBe(1)
    expect(deviceRepo.createCallsCount).toBe(1)
    expect(deviceRepo.lastCreateInput.deviceToken).toBe('player-123')
    expect(deviceRepo.lastCreateInput.platform).toBe('android')
  })

  it('should link device to existing app user', async () => {
    const { sut, deviceRepo, appUserRepo } = makeSut()
    appUserRepo.findByExternalResult = { id: 'existing-user-id' }

    await sut.perform({
      tenantId: 'tenant-1',
      deviceToken: 'player-789',
      platform: 'ios',
      externalUserId: 'shopify-customer-456',
    })

    expect(appUserRepo.createCallsCount).toBe(0) // não cria novo user
    expect(deviceRepo.lastCreateInput.appUserId).toBe('existing-user-id')
  })

  it('should deactivate old device when token rotates', async () => {
    const { sut, deviceRepo, appUserRepo } = makeSut()
    appUserRepo.findByExternalResult = { id: 'user-1' }
    deviceRepo.findByTokenResult = { id: 'old-device', deviceToken: 'old-token' }

    await sut.perform({
      tenantId: 'tenant-1',
      deviceToken: 'new-token',
      platform: 'android',
      externalUserId: 'shopify-customer-456',
      oldDeviceToken: 'old-token',
    })

    expect(deviceRepo.deactivateCallsCount).toBe(1)
    expect(deviceRepo.lastDeactivatedId).toBe('old-device')
  })
})
```

### 2.8 Events (app_events)

```typescript
// packages/api/test/unit/services/event.spec.ts
describe('IngestEventUseCase', () => {
  function makeSut() {
    const eventRepo = new AppEventRepositorySpy()
    const automationTrigger = new AutomationTriggerSpy()
    const sut = new IngestEventUseCase(eventRepo, automationTrigger)
    return { sut, eventRepo, automationTrigger }
  }

  it('should save event to repository', async () => {
    const { sut, eventRepo } = makeSut()

    await sut.perform({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      eventType: 'product_viewed',
      properties: { productId: 'prod-123', productName: 'Tênis' },
    })

    expect(eventRepo.createCallsCount).toBe(1)
    expect(eventRepo.lastInput.eventType).toBe('product_viewed')
  })

  it('should trigger browse_abandoned flow on product_viewed', async () => {
    const { sut, automationTrigger } = makeSut()

    await sut.perform({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      eventType: 'product_viewed',
      properties: { productId: 'prod-123' },
    })

    // browse_abandoned check é agendado (verifica se add_to_cart não aconteceu depois)
    expect(automationTrigger.scheduledChecks).toContainEqual({
      flowType: 'browse_abandoned',
      tenantId: 'tenant-1',
      appUserId: 'user-1',
    })
  })

  it('should trigger welcome flow on first app_opened', async () => {
    const { sut, automationTrigger, eventRepo } = makeSut()
    eventRepo.countByTypeResult = 0 // primeiro app_opened

    await sut.perform({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      eventType: 'app_opened',
      properties: {},
    })

    expect(automationTrigger.triggeredFlows).toContain('welcome')
  })

  it('should NOT trigger welcome on subsequent app_opened', async () => {
    const { sut, automationTrigger, eventRepo } = makeSut()
    eventRepo.countByTypeResult = 5 // já abriu antes

    await sut.perform({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      eventType: 'app_opened',
      properties: {},
    })

    expect(automationTrigger.triggeredFlows).not.toContain('welcome')
  })

  it('should reject unknown event type', async () => {
    const { sut } = makeSut()

    await expect(sut.perform({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      eventType: 'invalid_event' as any,
      properties: {},
    })).rejects.toThrow('Unknown event type')
  })

  it('should deduplicate same event within 5 seconds', async () => {
    const { sut, eventRepo } = makeSut()
    eventRepo.findRecentResult = { id: 'existing-event' }

    await sut.perform({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      eventType: 'product_viewed',
      properties: { productId: 'prod-123' },
    })

    expect(eventRepo.createCallsCount).toBe(0) // dedup: não cria
  })
})
```

### 2.9 Billing (Stripe)

```typescript
// packages/api/test/unit/services/billing.spec.ts
describe('BillingService', () => {
  function makeSut() {
    const stripeService = new StripeServiceSpy()
    const tenantRepo = new TenantRepositorySpy()
    const sut = new BillingService(stripeService, tenantRepo)
    return { sut, stripeService, tenantRepo }
  }

  it('should create subscription for new tenant', async () => {
    const { sut, stripeService } = makeSut()

    await sut.createSubscription({
      tenantId: 'tenant-1',
      planId: 'business',
      paymentMethodId: 'pm_test_123',
    })

    expect(stripeService.createSubscriptionCallsCount).toBe(1)
    expect(stripeService.lastSubscriptionInput.priceId).toBeDefined()
  })

  it('should update tenant with stripe IDs', async () => {
    const { sut, tenantRepo } = makeSut()

    await sut.createSubscription({
      tenantId: 'tenant-1',
      planId: 'starter',
      paymentMethodId: 'pm_test_123',
    })

    expect(tenantRepo.lastUpdate).toMatchObject({
      stripeCustomerId: expect.any(String),
      stripeSubscriptionId: expect.any(String),
    })
  })

  it('should handle upgrade (starter → business)', async () => {
    const { sut, stripeService, tenantRepo } = makeSut()
    tenantRepo.getTenantResult = {
      stripeSubscriptionId: 'sub_existing',
      planId: 'starter',
    }

    await sut.changePlan({
      tenantId: 'tenant-1',
      newPlanId: 'business',
    })

    expect(stripeService.updateSubscriptionCallsCount).toBe(1)
  })

  it('should reset notification count on plan change', async () => {
    const { sut, tenantRepo } = makeSut()
    tenantRepo.getTenantResult = {
      stripeSubscriptionId: 'sub_existing',
      planId: 'starter',
      notificationCountCurrentPeriod: 10,
    }

    await sut.changePlan({ tenantId: 'tenant-1', newPlanId: 'business' })

    expect(tenantRepo.lastUpdate.notificationCountCurrentPeriod).toBe(0)
  })
})
```

### 2.10 Encrypted Credentials

```typescript
// packages/api/test/unit/services/encryption.spec.ts
describe('EncryptionService', () => {
  function makeSut() {
    const sut = new EncryptionService('a-32-char-secret-key-for-tests!!')
    return { sut }
  }

  // RED 1: Round-trip
  it('should encrypt and decrypt back to original', () => {
    const { sut } = makeSut()
    const original = 'shpat_abc123_secret_token'

    const encrypted = sut.encrypt(original)
    const decrypted = sut.decrypt(encrypted)

    expect(decrypted).toBe(original)
  })

  // RED 2: Output format
  it('should produce JSONB with ct, iv, tag, alg', () => {
    const { sut } = makeSut()
    const encrypted = sut.encrypt('test')

    expect(encrypted).toEqual({
      ct: expect.any(String),
      iv: expect.any(String),
      tag: expect.any(String),
      alg: 'aes-256-gcm',
    })
  })

  // RED 3: Random IV
  it('should produce different output for same input', () => {
    const { sut } = makeSut()
    const a = sut.encrypt('same-input')
    const b = sut.encrypt('same-input')

    expect(a.ct).not.toBe(b.ct)
    expect(a.iv).not.toBe(b.iv)
  })

  // RED 4: Tampered data
  it('should reject tampered ciphertext', () => {
    const { sut } = makeSut()
    const encrypted = sut.encrypt('sensitive-data')
    encrypted.ct = encrypted.ct.replace('a', 'b')

    expect(() => sut.decrypt(encrypted)).toThrow()
  })

  // RED 5: Missing auth_tag
  it('should reject missing auth_tag', () => {
    const { sut } = makeSut()
    const encrypted = sut.encrypt('test')
    const { tag, ...withoutTag } = encrypted

    expect(() => sut.decrypt(withoutTag as any)).toThrow()
  })

  // RED 6: Wrong key
  it('should reject decryption with different key', () => {
    const encryptor = new EncryptionService('key-a-32-chars-long-exactly-now!')
    const decryptor = new EncryptionService('different-32-char-key-for-tests!')

    const encrypted = encryptor.encrypt('secret')

    expect(() => decryptor.decrypt(encrypted)).toThrow()
  })
})
```

### 2.11 A/B Testing Module

**Caso de uso:** Criar teste A/B com 2 variantes por notificação, dividir audiência, enviar variantes separadas e calcular vencedor por conversion rate.

> Disponível a partir do plano **Business**. Campo `ab_variant` ("a" | "b" | null) na tabela `notifications`.

#### Unit tests (Layer 1 — Domain)

```typescript
// packages/api/test/unit/domain/ab-testing.spec.ts
import { describe, it, expect } from 'vitest'

describe('createABVariant', () => {
  function makeSut() {
    const sut = createABVariant
    return { sut }
  }

  it('should create variant A and variant B for a notification', () => {
    // Arrange
    const { sut } = makeSut()

    // Act
    const result = sut({
      notificationId: 'notif-1',
      titleA: 'Promoção imperdível!',
      bodyA: 'Compre agora com 50% off',
      titleB: 'Última chance!',
      bodyB: 'Desconto de 50% acaba hoje',
    })

    // Assert
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      variant: 'a',
      title: 'Promoção imperdível!',
      body: 'Compre agora com 50% off',
    })
    expect(result[1]).toMatchObject({
      variant: 'b',
      title: 'Última chance!',
      body: 'Desconto de 50% acaba hoje',
    })
  })
})

describe('splitAudience', () => {
  function makeSut() {
    const sut = splitAudience
    return { sut }
  }

  it('should split audience 50/50 between variants', () => {
    // Arrange
    const { sut } = makeSut()
    const devices = Array.from({ length: 100 }, (_, i) => ({
      id: `d-${i}`,
      deviceToken: `token-${i}`,
    }))

    // Act
    const result = sut(devices)

    // Assert
    expect(result.groupA).toHaveLength(50)
    expect(result.groupB).toHaveLength(50)
  })

  it('should accept custom distribution (70/30, 60/40)', () => {
    // Arrange
    const { sut } = makeSut()
    const devices = Array.from({ length: 100 }, (_, i) => ({
      id: `d-${i}`,
      deviceToken: `token-${i}`,
    }))

    // Act
    const result = sut(devices, { splitA: 70, splitB: 30 })

    // Assert
    expect(result.groupA).toHaveLength(70)
    expect(result.groupB).toHaveLength(30)
  })

  it('should reject splits that do not sum to 100%', () => {
    // Arrange
    const { sut } = makeSut()
    const devices = [{ id: 'd-1', deviceToken: 'token-1' }]

    // Act & Assert
    expect(() => sut(devices, { splitA: 60, splitB: 60 })).toThrow(
      'Split must sum to 100%',
    )
  })
})

describe('calculateWinner', () => {
  function makeSut() {
    const sut = calculateWinner
    return { sut }
  }

  it('should return variant with higher conversion rate', () => {
    // Arrange
    const { sut } = makeSut()
    const metrics = {
      a: { delivered: 500, converted: 50 },  // 10%
      b: { delivered: 500, converted: 75 },  // 15%
    }

    // Act
    const result = sut(metrics)

    // Assert
    expect(result.winner).toBe('b')
    expect(result.conversionRateA).toBeCloseTo(0.10)
    expect(result.conversionRateB).toBeCloseTo(0.15)
  })

  it('should return null if sample insufficient (< 100 deliveries per variant)', () => {
    // Arrange
    const { sut } = makeSut()
    const metrics = {
      a: { delivered: 50, converted: 10 },
      b: { delivered: 80, converted: 20 },
    }

    // Act
    const result = sut(metrics)

    // Assert
    expect(result.winner).toBeNull()
    expect(result.reason).toBe('Insufficient sample size')
  })

  it('should return tie if difference < 1%', () => {
    // Arrange
    const { sut } = makeSut()
    const metrics = {
      a: { delivered: 1000, converted: 100 },  // 10.0%
      b: { delivered: 1000, converted: 105 },  // 10.5%
    }

    // Act
    const result = sut(metrics)

    // Assert
    expect(result.winner).toBe('tie')
  })
})
```

#### Unit tests (Layer 2 — Application)

```typescript
// packages/api/test/unit/services/ab-testing.spec.ts
import { describe, it, expect } from 'vitest'

describe('CreateABTestUseCase', () => {
  function makeSut() {
    const notificationRepo = new NotificationRepositorySpy()
    const auditLogRepo = new AuditLogRepositorySpy()
    const sut = new CreateABTestUseCase(notificationRepo, auditLogRepo)
    return { sut, notificationRepo, auditLogRepo }
  }

  it('should create A/B test with 2 variants and save to repo', async () => {
    // Arrange
    const { sut, notificationRepo } = makeSut()

    // Act
    const result = await sut.perform({
      tenantId: 'tenant-1',
      userId: 'user-1',
      titleA: 'Variante A',
      bodyA: 'Corpo A',
      titleB: 'Variante B',
      bodyB: 'Corpo B',
      type: 'manual',
    })

    // Assert
    expect(notificationRepo.createCallsCount).toBe(2)
    expect(result.variants).toHaveLength(2)
    expect(result.variants[0].abVariant).toBe('a')
    expect(result.variants[1].abVariant).toBe('b')
  })

  it('should reject more than 2 variants in MVP', async () => {
    // Arrange
    const { sut } = makeSut()

    // Act & Assert
    await expect(sut.perform({
      tenantId: 'tenant-1',
      userId: 'user-1',
      variants: [
        { title: 'A', body: 'A' },
        { title: 'B', body: 'B' },
        { title: 'C', body: 'C' },
      ],
      type: 'manual',
    })).rejects.toThrow('MVP supports maximum 2 variants')
  })
})

describe('SendABNotificationUseCase', () => {
  function makeSut() {
    const deviceRepo = new DeviceRepositorySpy()
    const pushProvider = new PushProviderSpy()
    const deliveryRepo = new DeliveryRepositorySpy()
    const notificationRepo = new NotificationRepositorySpy()
    const tenantRepo = new TenantRepositorySpy()
    tenantRepo.getTenantResult = { onesignalAppId: 'os-app-123' }
    deviceRepo.findActiveResult = Array.from({ length: 100 }, (_, i) => ({
      id: `d-${i}`,
      deviceToken: `token-${i}`,
      platform: 'android',
    }))

    const sut = new SendABNotificationUseCase(
      deviceRepo, pushProvider, deliveryRepo, notificationRepo, tenantRepo,
    )
    return { sut, deviceRepo, pushProvider, deliveryRepo, notificationRepo, tenantRepo }
  }

  it('should send variant A to group A and variant B to group B', async () => {
    // Arrange
    const { sut, pushProvider } = makeSut()

    // Act
    await sut.perform({
      tenantId: 'tenant-1',
      notificationIdA: 'notif-a',
      notificationIdB: 'notif-b',
    })

    // Assert
    expect(pushProvider.calls).toHaveLength(2)
    expect(pushProvider.calls[0].tokens).toHaveLength(50)
    expect(pushProvider.calls[1].tokens).toHaveLength(50)
    // Ensure no overlap between groups
    const allTokens = [
      ...pushProvider.calls[0].tokens,
      ...pushProvider.calls[1].tokens,
    ]
    expect(new Set(allTokens).size).toBe(100)
  })
})

describe('GetABResultsUseCase', () => {
  function makeSut() {
    const deliveryRepo = new DeliveryRepositorySpy()
    const sut = new GetABResultsUseCase(deliveryRepo)
    return { sut, deliveryRepo }
  }

  it('should return metrics per variant (sent, delivered, opened, clicked, converted)', async () => {
    // Arrange
    const { sut, deliveryRepo } = makeSut()
    deliveryRepo.getMetricsByVariantResult = {
      a: { sent: 500, delivered: 480, opened: 120, clicked: 60, converted: 30 },
      b: { sent: 500, delivered: 490, opened: 150, clicked: 80, converted: 45 },
    }

    // Act
    const result = await sut.perform({
      tenantId: 'tenant-1',
      notificationIdA: 'notif-a',
      notificationIdB: 'notif-b',
    })

    // Assert
    expect(result.variantA).toMatchObject({
      sent: 500, delivered: 480, opened: 120, clicked: 60, converted: 30,
    })
    expect(result.variantB).toMatchObject({
      sent: 500, delivered: 490, opened: 150, clicked: 80, converted: 45,
    })
  })

  it('should calculate winner and confidence', async () => {
    // Arrange
    const { sut, deliveryRepo } = makeSut()
    deliveryRepo.getMetricsByVariantResult = {
      a: { sent: 500, delivered: 480, opened: 120, clicked: 60, converted: 30 },
      b: { sent: 500, delivered: 490, opened: 150, clicked: 80, converted: 45 },
    }

    // Act
    const result = await sut.perform({
      tenantId: 'tenant-1',
      notificationIdA: 'notif-a',
      notificationIdB: 'notif-b',
    })

    // Assert
    expect(result.winner).toBe('b')
    expect(result.conversionRateA).toBeCloseTo(30 / 480)
    expect(result.conversionRateB).toBeCloseTo(45 / 490)
  })
})
```

#### Integration tests (Layer 3)

```typescript
// packages/api/test/integration/ab-testing.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../../setup-integration'
import { createTestJwt, authHeaders } from '../../helpers/jwt'
import { NotificationBuilder } from '../../helpers/builders'

describe('A/B Testing — Integration', () => {
  it('should dispatch A/B notification and split deliveries correctly', async () => {
    // Arrange — insert tenant, devices, and A/B notification pair
    const tenantId = 'tenant-ab-1'
    const jwt = await createTestJwt({ sub: 'user-1', tenant_id: tenantId })

    const notifA = new NotificationBuilder()
      .withTenant(tenantId)
      .withTitle('Variante A')
      .withBody('Corpo A')
      .build()

    const notifB = new NotificationBuilder()
      .withTenant(tenantId)
      .withTitle('Variante B')
      .withBody('Corpo B')
      .build()

    // Insert 200 active devices
    // ... (seed via db insert)

    // Act — send A/B notification via API
    const res = await app.request('/api/v1/notifications/ab-send', {
      method: 'POST',
      headers: authHeaders(jwt, tenantId),
      body: JSON.stringify({
        notificationIdA: notifA.id,
        notificationIdB: notifB.id,
      }),
    })

    // Assert
    expect(res.status).toBe(200)

    // Verify deliveries are split
    const deliveriesA = await db.query.notificationDeliveries.findMany({
      where: (d, { eq }) => eq(d.notificationId, notifA.id),
    })
    const deliveriesB = await db.query.notificationDeliveries.findMany({
      where: (d, { eq }) => eq(d.notificationId, notifB.id),
    })

    expect(deliveriesA.length).toBe(100)
    expect(deliveriesB.length).toBe(100)
    expect(deliveriesA.length + deliveriesB.length).toBe(200)
  })

  it('should isolate metrics per variant', async () => {
    // Arrange — insert deliveries with different statuses per variant
    const tenantId = 'tenant-ab-2'
    const jwt = await createTestJwt({ sub: 'user-1', tenant_id: tenantId })

    // ... (seed deliveries: 50 opened for A, 80 opened for B)

    // Act — fetch A/B results
    const res = await app.request('/api/v1/notifications/ab-results?' +
      'notificationIdA=notif-a&notificationIdB=notif-b', {
      headers: authHeaders(jwt, tenantId),
    })

    // Assert
    expect(res.status).toBe(200)
    const data = await res.json()

    expect(data.variantA.opened).toBe(50)
    expect(data.variantB.opened).toBe(80)
    expect(data.winner).toBe('b')
  })
})
```

### 2.12 Segments

**Caso de uso:** Avaliar regras JSONB de segmentação (high_value, inactive_30d, new_user), combinar regras AND/OR, refresh de membros do segmento, e CRUD de user-segment com isolamento multi-tenant.

> Regras armazenadas como JSONB em `segment_rules`. Tabela `app_user_segments` para associação N:N.

#### Unit tests — SegmentService

```typescript
// packages/api/test/unit/services/segment.spec.ts
import { describe, it, expect } from 'vitest'

describe('SegmentService', () => {
  describe('evaluateRules', () => {
    function makeSut() {
      const segmentRepo = new SegmentRepositorySpy()
      const userSegmentRepo = new UserSegmentRepositorySpy()
      const appUserRepo = new AppUserRepositorySpy()
      const sut = new SegmentService(segmentRepo, userSegmentRepo, appUserRepo)
      return { sut, segmentRepo, userSegmentRepo, appUserRepo }
    }

    // RED 1: Avalia regras JSONB individuais
    it('should evaluate high_value rule based on totalSpent', () => {
      // Arrange
      const { sut } = makeSut()
      const user = new AppUserBuilder().highValue().build() // totalSpent: 5000
      const rules = [{ field: 'totalSpent', operator: 'gte', value: 1000 }]

      // Act
      const result = sut.evaluateRules(user, rules)

      // Assert
      expect(result).toBe(true)
    })

    it('should evaluate inactive_30d rule based on lastActiveAt', () => {
      // Arrange
      const { sut } = makeSut()
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
      const user = new AppUserBuilder().build()
      user.lastActiveAt = thirtyOneDaysAgo
      const rules = [{ field: 'lastActiveAt', operator: 'lt', value: '30d_ago' }]

      // Act
      const result = sut.evaluateRules(user, rules)

      // Assert
      expect(result).toBe(true)
    })

    it('should evaluate new_user rule based on createdAt', () => {
      // Arrange
      const { sut } = makeSut()
      const user = new AppUserBuilder().build() // createdAt: new Date()
      const rules = [{ field: 'createdAt', operator: 'gte', value: '7d_ago' }]

      // Act
      const result = sut.evaluateRules(user, rules)

      // Assert
      expect(result).toBe(true)
    })

    // RED 2: Combina regras AND/OR
    it('should combine rules with AND logic (all must match)', () => {
      // Arrange
      const { sut } = makeSut()
      const user = new AppUserBuilder().highValue().build()
      const rules = [
        { field: 'totalSpent', operator: 'gte', value: 1000 },
        { field: 'totalPurchases', operator: 'gte', value: 5 },
      ]

      // Act
      const result = sut.evaluateRules(user, rules, 'AND')

      // Assert
      expect(result).toBe(true)
    })

    it('should combine rules with OR logic (at least one must match)', () => {
      // Arrange
      const { sut } = makeSut()
      const user = new AppUserBuilder().build() // totalSpent: 0, totalPurchases: 0
      const rules = [
        { field: 'totalSpent', operator: 'gte', value: 1000 },
        { field: 'pushOptIn', operator: 'eq', value: true },
      ]

      // Act
      const result = sut.evaluateRules(user, rules, 'OR')

      // Assert
      expect(result).toBe(true) // pushOptIn é true por default
    })

    it('should return false when AND rules partially match', () => {
      // Arrange
      const { sut } = makeSut()
      const user = new AppUserBuilder().build() // totalSpent: 0
      const rules = [
        { field: 'totalSpent', operator: 'gte', value: 1000 },
        { field: 'pushOptIn', operator: 'eq', value: true },
      ]

      // Act
      const result = sut.evaluateRules(user, rules, 'AND')

      // Assert
      expect(result).toBe(false)
    })

    // RED 3: Rejeita operador invalido
    it('should throw on invalid operator', () => {
      // Arrange
      const { sut } = makeSut()
      const user = new AppUserBuilder().build()
      const rules = [{ field: 'totalSpent', operator: 'INVALID', value: 100 }]

      // Act & Assert
      expect(() => sut.evaluateRules(user, rules)).toThrow('Invalid operator: INVALID')
    })
  })

  describe('refreshSegment', () => {
    function makeSut() {
      const segmentRepo = new SegmentRepositorySpy()
      const userSegmentRepo = new UserSegmentRepositorySpy()
      const appUserRepo = new AppUserRepositorySpy()
      const sut = new SegmentService(segmentRepo, userSegmentRepo, appUserRepo)
      return { sut, segmentRepo, userSegmentRepo, appUserRepo }
    }

    // RED 4: Atualiza membros do segmento baseado em regras
    it('should add users matching segment rules', async () => {
      // Arrange
      const { sut, appUserRepo, userSegmentRepo, segmentRepo } = makeSut()
      segmentRepo.findByIdResult = {
        id: 'seg-1',
        tenantId: 'tenant-1',
        name: 'high_value',
        rules: [{ field: 'totalSpent', operator: 'gte', value: 1000 }],
      }
      appUserRepo.findAllByTenantResult = [
        new AppUserBuilder().withTenant('tenant-1').highValue().build(),
        new AppUserBuilder().withTenant('tenant-1').build(), // totalSpent: 0
      ]
      userSegmentRepo.getUsersBySegmentResult = []

      // Act
      await sut.refreshSegment('tenant-1', 'seg-1')

      // Assert
      expect(userSegmentRepo.addUserCallsCount).toBe(1) // apenas 1 user qualifica
    })

    // RED 5: Remove usuarios que nao atendem mais os criterios
    it('should remove users that no longer match segment rules', async () => {
      // Arrange
      const { sut, appUserRepo, userSegmentRepo, segmentRepo } = makeSut()
      segmentRepo.findByIdResult = {
        id: 'seg-1',
        tenantId: 'tenant-1',
        name: 'high_value',
        rules: [{ field: 'totalSpent', operator: 'gte', value: 1000 }],
      }
      appUserRepo.findAllByTenantResult = [
        new AppUserBuilder().withTenant('tenant-1').build(), // totalSpent: 0
      ]
      userSegmentRepo.getUsersBySegmentResult = [
        { appUserId: 'user-previously-qualified', segmentName: 'high_value' },
      ]

      // Act
      await sut.refreshSegment('tenant-1', 'seg-1')

      // Assert
      expect(userSegmentRepo.removeUserCallsCount).toBe(1)
      expect(userSegmentRepo.lastRemovedUserId).toBe('user-previously-qualified')
    })
  })
})
```

#### Unit tests — SegmentRepository

```typescript
// packages/api/test/unit/repositories/segment.spec.ts
import { describe, it, expect } from 'vitest'

describe('SegmentRepository', () => {
  function makeSut() {
    const db = new DrizzleClientSpy()
    const sut = new SegmentRepository(db)
    return { sut, db }
  }

  // RED 6: Retorna apenas segmentos do tenant
  it('should return only segments for the given tenant', async () => {
    // Arrange
    const { sut, db } = makeSut()
    db.queryResult = [
      { id: 'seg-1', tenantId: 'tenant-1', name: 'high_value' },
    ]

    // Act
    const result = await sut.findByTenant('tenant-1')

    // Assert
    expect(result).toHaveLength(1)
    expect(result[0].tenantId).toBe('tenant-1')
    expect(db.lastWhereClause).toMatchObject({ tenantId: 'tenant-1' })
  })

  // RED 7: IDOR prevention
  it('should NOT return segments from another tenant (IDOR prevention)', async () => {
    // Arrange
    const { sut, db } = makeSut()
    db.queryResult = []

    // Act
    const result = await sut.findByTenant('tenant-2')

    // Assert
    expect(result).toHaveLength(0)
    expect(db.lastWhereClause).toMatchObject({ tenantId: 'tenant-2' })
  })
})
```

#### Unit tests — UserSegmentRepository

```typescript
// packages/api/test/unit/repositories/user-segment.spec.ts
import { describe, it, expect } from 'vitest'

describe('UserSegmentRepository', () => {
  function makeSut() {
    const db = new DrizzleClientSpy()
    const sut = new UserSegmentRepository(db)
    return { sut, db }
  }

  // RED 8: Adiciona usuario ao segmento
  it('should add user to segment', async () => {
    // Arrange
    const { sut, db } = makeSut()

    // Act
    await sut.addUser({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      segmentName: 'high_value',
    })

    // Assert
    expect(db.insertCallsCount).toBe(1)
    expect(db.lastInsertInput).toMatchObject({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      segmentName: 'high_value',
    })
  })

  // RED 9: Remove usuario do segmento
  it('should remove user from segment', async () => {
    // Arrange
    const { sut, db } = makeSut()

    // Act
    await sut.removeUser({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      segmentName: 'high_value',
    })

    // Assert
    expect(db.deleteCallsCount).toBe(1)
    expect(db.lastDeleteWhere).toMatchObject({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
      segmentName: 'high_value',
    })
  })

  // RED 10: Lista segmentos de um usuario
  it('should list all segments for a user', async () => {
    // Arrange
    const { sut, db } = makeSut()
    db.queryResult = [
      { segmentName: 'high_value', assignedAt: new Date() },
      { segmentName: 'new_user', assignedAt: new Date() },
    ]

    // Act
    const result = await sut.getUserSegments('tenant-1', 'user-1')

    // Assert
    expect(result).toHaveLength(2)
    expect(result.map((s: any) => s.segmentName)).toEqual(['high_value', 'new_user'])
    expect(db.lastWhereClause).toMatchObject({
      tenantId: 'tenant-1',
      appUserId: 'user-1',
    })
  })
})
```

### 2.13 Remote Config

**Caso de uso:** Gerenciar configuração remota por tenant (feature flags, theme, etc.), com cache invalidation e validação Zod. Defaults do sistema quando tenant não tem config customizada.

> Tabela `app_configs` com coluna `tenant_id` (unique). Cache key: `remote-config:{tenantId}`.

#### Unit tests — RemoteConfigService

```typescript
// packages/api/test/unit/services/remote-config.spec.ts
import { describe, it, expect } from 'vitest'

describe('RemoteConfigService', () => {
  describe('get', () => {
    function makeSut() {
      const configRepo = new RemoteConfigRepositorySpy()
      const cache = new CacheSpy()
      const sut = new RemoteConfigService(configRepo, cache)
      return { sut, configRepo, cache }
    }

    // RED 1: Retorna config ativa para o tenant
    it('should return active config for the tenant', async () => {
      // Arrange
      const { sut, configRepo } = makeSut()
      configRepo.findByTenantResult = {
        tenantId: 'tenant-1',
        config: {
          featureFlags: { showBanner: true },
          themeColor: '#FF0000',
        },
      }

      // Act
      const result = await sut.get('tenant-1')

      // Assert
      expect(result.config.featureFlags.showBanner).toBe(true)
      expect(result.config.themeColor).toBe('#FF0000')
    })

    // RED 2: Retorna defaults se tenant nao tem config customizada
    it('should return default config when tenant has no custom config', async () => {
      // Arrange
      const { sut, configRepo } = makeSut()
      configRepo.findByTenantResult = null

      // Act
      const result = await sut.get('tenant-1')

      // Assert
      expect(result.config).toBeDefined()
      expect(result.isDefault).toBe(true)
    })
  })

  describe('update', () => {
    function makeSut() {
      const configRepo = new RemoteConfigRepositorySpy()
      const cache = new CacheSpy()
      const sut = new RemoteConfigService(configRepo, cache)
      return { sut, configRepo, cache }
    }

    // RED 3: Atualiza config e invalida cache
    it('should update config and invalidate cache', async () => {
      // Arrange
      const { sut, configRepo, cache } = makeSut()
      const newConfig = {
        featureFlags: { showBanner: false },
        themeColor: '#00FF00',
      }

      // Act
      await sut.update('tenant-1', newConfig)

      // Assert
      expect(configRepo.upsertCallsCount).toBe(1)
      expect(configRepo.lastUpsertInput).toMatchObject({
        tenantId: 'tenant-1',
        config: newConfig,
      })
      expect(cache.deleteCallsCount).toBe(1)
      expect(cache.lastDeletedKey).toBe('remote-config:tenant-1')
    })

    // RED 4: Valida schema da config (Zod)
    it('should reject invalid config schema', async () => {
      // Arrange
      const { sut } = makeSut()
      const invalidConfig = {
        featureFlags: 'not-an-object',
        themeColor: 12345,
      }

      // Act & Assert
      await expect(
        sut.update('tenant-1', invalidConfig as any)
      ).rejects.toThrow('Validation failed')
    })
  })
})
```

#### Unit tests — RemoteConfigRepository

```typescript
// packages/api/test/unit/repositories/remote-config.spec.ts
import { describe, it, expect } from 'vitest'

describe('RemoteConfigRepository', () => {
  function makeSut() {
    const db = new DrizzleClientSpy()
    const sut = new RemoteConfigRepository(db)
    return { sut, db }
  }

  // RED 5: IDOR prevention — retorna apenas config do tenant solicitado
  it('should only return config for the given tenant (IDOR prevention)', async () => {
    // Arrange
    const { sut, db } = makeSut()
    db.queryResult = [{ tenantId: 'tenant-1', config: { themeColor: '#FF0000' } }]

    // Act
    const result = await sut.findByTenant('tenant-1')

    // Assert
    expect(db.lastWhereClause).toMatchObject({ tenantId: 'tenant-1' })
    expect(result?.tenantId).toBe('tenant-1')
  })

  it('should NOT return config from another tenant', async () => {
    // Arrange
    const { sut, db } = makeSut()
    db.queryResult = []

    // Act
    const result = await sut.findByTenant('tenant-2')

    // Assert
    expect(result).toBeNull()
    expect(db.lastWhereClause).toMatchObject({ tenantId: 'tenant-2' })
  })
})
```

#### Unit tests — Cache Invalidation

```typescript
// packages/api/test/unit/services/remote-config-cache.spec.ts
import { describe, it, expect } from 'vitest'

describe('RemoteConfig Cache Invalidation', () => {
  function makeSut() {
    const configRepo = new RemoteConfigRepositorySpy()
    const cache = new CacheSpy()
    const sut = new RemoteConfigService(configRepo, cache)
    return { sut, configRepo, cache }
  }

  // RED 6: Apos update, proximo get retorna valor novo
  it('should return updated value on next get after update', async () => {
    // Arrange
    const { sut, configRepo, cache } = makeSut()
    configRepo.findByTenantResult = { tenantId: 'tenant-1', config: { themeColor: '#FF0000' } }

    // Act — primeiro get (popula cache)
    const firstResult = await sut.get('tenant-1')
    expect(firstResult.config.themeColor).toBe('#FF0000')

    // Act — update invalida cache
    const newConfig = { themeColor: '#00FF00' }
    configRepo.findByTenantResult = { tenantId: 'tenant-1', config: newConfig }
    await sut.update('tenant-1', newConfig)

    // Act — segundo get deve retornar valor atualizado (cache invalidado)
    cache.getResult = null
    const secondResult = await sut.get('tenant-1')

    // Assert
    expect(secondResult.config.themeColor).toBe('#00FF00')
  })
})
```

### 2.14 Analytics/Metrics

**Caso de uso:** Dashboard de métricas agregadas (sent, delivered, opened, clicked, converted), filtro por período, cálculo de taxas, métricas por notificação individual e por tipo de flow. Worker de agregação idempotente.

> Dados vêm de `notification_deliveries`. Worker `metrics-update` processa deliveries pendentes.

#### Unit tests — MetricsService

```typescript
// packages/api/test/unit/services/metrics.spec.ts
import { describe, it, expect } from 'vitest'

describe('MetricsService', () => {
  describe('getDashboard', () => {
    function makeSut() {
      const deliveryRepo = new DeliveryRepositorySpy()
      const sut = new MetricsService(deliveryRepo)
      return { sut, deliveryRepo }
    }

    // RED 1: Retorna metricas agregadas
    it('should return aggregated metrics (sent, delivered, opened, clicked, converted)', async () => {
      // Arrange
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.getAggregatedResult = {
        sent: 1000,
        delivered: 950,
        opened: 380,
        clicked: 190,
        converted: 45,
      }

      // Act
      const result = await sut.getDashboard('tenant-1', { period: '30d' })

      // Assert
      expect(result.sent).toBe(1000)
      expect(result.delivered).toBe(950)
      expect(result.opened).toBe(380)
      expect(result.clicked).toBe(190)
      expect(result.converted).toBe(45)
    })

    // RED 2: Filtra por periodo (7d, 30d, custom)
    it('should filter metrics by 7d period', async () => {
      // Arrange
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.getAggregatedResult = {
        sent: 100, delivered: 95, opened: 40, clicked: 20, converted: 5,
      }

      // Act
      await sut.getDashboard('tenant-1', { period: '7d' })

      // Assert
      expect(deliveryRepo.lastQueryParams.period).toBe('7d')
      const expectedStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      expect(deliveryRepo.lastQueryParams.startDate.getDate()).toBe(expectedStart.getDate())
    })

    it('should filter metrics by custom date range', async () => {
      // Arrange
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.getAggregatedResult = {
        sent: 500, delivered: 475, opened: 200, clicked: 100, converted: 25,
      }
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-01-31')

      // Act
      await sut.getDashboard('tenant-1', { startDate, endDate })

      // Assert
      expect(deliveryRepo.lastQueryParams.startDate).toEqual(startDate)
      expect(deliveryRepo.lastQueryParams.endDate).toEqual(endDate)
    })

    // RED 3: Calcula taxas (open_rate, click_rate, conversion_rate)
    it('should calculate open_rate, click_rate, and conversion_rate', async () => {
      // Arrange
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.getAggregatedResult = {
        sent: 1000,
        delivered: 950,
        opened: 380,
        clicked: 190,
        converted: 45,
      }

      // Act
      const result = await sut.getDashboard('tenant-1', { period: '30d' })

      // Assert
      expect(result.openRate).toBeCloseTo(0.4)       // 380/950
      expect(result.clickRate).toBeCloseTo(0.5)       // 190/380
      expect(result.conversionRate).toBeCloseTo(0.2368, 3) // 45/190
    })

    it('should handle zero delivered (avoid division by zero)', async () => {
      // Arrange
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.getAggregatedResult = {
        sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0,
      }

      // Act
      const result = await sut.getDashboard('tenant-1', { period: '7d' })

      // Assert
      expect(result.openRate).toBe(0)
      expect(result.clickRate).toBe(0)
      expect(result.conversionRate).toBe(0)
    })

    // RED 4: Isolamento multi-tenant
    it('should only return metrics for the specified tenant', async () => {
      // Arrange
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.getAggregatedResult = {
        sent: 100, delivered: 95, opened: 40, clicked: 20, converted: 5,
      }

      // Act
      await sut.getDashboard('tenant-1', { period: '30d' })

      // Assert
      expect(deliveryRepo.lastQueryParams.tenantId).toBe('tenant-1')
    })
  })

  describe('getByNotification', () => {
    function makeSut() {
      const deliveryRepo = new DeliveryRepositorySpy()
      const sut = new MetricsService(deliveryRepo)
      return { sut, deliveryRepo }
    }

    // RED 5: Metricas por notificacao individual
    it('should return metrics for a specific notification', async () => {
      // Arrange
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.getByNotificationResult = {
        notificationId: 'notif-1',
        sent: 500,
        delivered: 480,
        opened: 200,
        clicked: 100,
        converted: 20,
      }

      // Act
      const result = await sut.getByNotification('tenant-1', 'notif-1')

      // Assert
      expect(result.notificationId).toBe('notif-1')
      expect(result.sent).toBe(500)
      expect(result.delivered).toBe(480)
      expect(deliveryRepo.lastQueryParams.tenantId).toBe('tenant-1')
    })
  })

  describe('getByFlowType', () => {
    function makeSut() {
      const deliveryRepo = new DeliveryRepositorySpy()
      const sut = new MetricsService(deliveryRepo)
      return { sut, deliveryRepo }
    }

    // RED 6: Metricas por tipo de flow
    it('should return metrics grouped by flow type', async () => {
      // Arrange
      const { sut, deliveryRepo } = makeSut()
      deliveryRepo.getByFlowTypeResult = {
        flowType: 'cart_abandoned',
        sent: 300,
        delivered: 285,
        opened: 150,
        clicked: 90,
        converted: 30,
      }

      // Act
      const result = await sut.getByFlowType('tenant-1', 'cart_abandoned', { period: '30d' })

      // Assert
      expect(result.flowType).toBe('cart_abandoned')
      expect(result.sent).toBe(300)
      expect(result.converted).toBe(30)
      expect(deliveryRepo.lastQueryParams.tenantId).toBe('tenant-1')
      expect(deliveryRepo.lastQueryParams.flowType).toBe('cart_abandoned')
    })
  })
})
```

#### Unit tests — MetricsWorker

```typescript
// packages/api/test/unit/workers/metrics-worker.spec.ts
import { describe, it, expect } from 'vitest'

describe('MetricsWorker', () => {
  describe('aggregate', () => {
    function makeSut() {
      const deliveryRepo = new DeliveryRepositorySpy()
      const metricsRepo = new MetricsRepositorySpy()
      const sut = new MetricsWorker(deliveryRepo, metricsRepo)
      return { sut, deliveryRepo, metricsRepo }
    }

    // RED 7: Processa deliveries e atualiza metricas agregadas
    it('should process pending deliveries and update aggregated metrics', async () => {
      // Arrange
      const { sut, deliveryRepo, metricsRepo } = makeSut()
      deliveryRepo.getPendingAggregationResult = [
        { tenantId: 'tenant-1', notificationId: 'notif-1', status: 'delivered', count: 50 },
        { tenantId: 'tenant-1', notificationId: 'notif-1', status: 'opened', count: 20 },
        { tenantId: 'tenant-1', notificationId: 'notif-1', status: 'clicked', count: 10 },
      ]

      // Act
      await sut.aggregate()

      // Assert
      expect(metricsRepo.upsertCallsCount).toBe(3)
      expect(metricsRepo.lastUpsertInputs).toContainEqual(
        expect.objectContaining({ tenantId: 'tenant-1', status: 'delivered', count: 50 })
      )
      expect(deliveryRepo.markAsAggregatedCallsCount).toBe(1)
    })

    // RED 8: Idempotente (reprocessar nao duplica)
    it('should be idempotent (reprocessing does not duplicate metrics)', async () => {
      // Arrange
      const { sut, deliveryRepo, metricsRepo } = makeSut()
      deliveryRepo.getPendingAggregationResult = [
        { tenantId: 'tenant-1', notificationId: 'notif-1', status: 'delivered', count: 50 },
      ]

      // Act — processa primeira vez
      await sut.aggregate()

      // Simula reprocessamento: mesmo batch retornado
      deliveryRepo.getPendingAggregationResult = [
        { tenantId: 'tenant-1', notificationId: 'notif-1', status: 'delivered', count: 50 },
      ]
      await sut.aggregate()

      // Assert — usa UPSERT, nao INSERT; deliveries marcadas impedem duplicacao
      expect(metricsRepo.lastUpsertOperation).toBe('upsert')
      expect(deliveryRepo.markAsAggregatedCallsCount).toBe(2)
    })

    it('should handle empty pending aggregation gracefully', async () => {
      // Arrange
      const { sut, deliveryRepo, metricsRepo } = makeSut()
      deliveryRepo.getPendingAggregationResult = []

      // Act
      await sut.aggregate()

      // Assert
      expect(metricsRepo.upsertCallsCount).toBe(0)
    })
  })
})
```

---

## 3. Spies Reutilizáveis

```typescript
// packages/api/test/helpers/spies.ts

export class NotificationRepositorySpy {
  createCallsCount = 0
  lastCreateInput: any = null
  createResult = { id: 'mock-notif-id', status: 'draft' }
  lastStatusUpdate: any = null

  async create(tenantId: string, data: any) {
    this.createCallsCount++
    this.lastCreateInput = { tenantId, ...data }
    return { ...this.createResult, tenantId, ...data }
  }

  async updateStatus(id: string, status: string) {
    this.lastStatusUpdate = { id, status }
  }
}

export class PushProviderSpy implements PushProvider {
  calls: any[] = []

  async sendNotification(appId: string, payload: any) {
    this.calls.push({ appId, ...payload })
    return { id: `mock-${Date.now()}`, recipients: payload.tokens?.length ?? 0 }
  }

  async createApp(config: any) {
    return { appId: `app-${Date.now()}` }
  }

  async getDeliveryStatus() {
    return { successful: 100, failed: 0 }
  }
}

export class MembershipRepositorySpy {
  callsCount = 0
  lastInput: any = null
  findResult: any = { role: 'owner' }

  async find(userId: string, tenantId: string) {
    this.callsCount++
    this.lastInput = { userId, tenantId }
    return this.findResult
  }
}

export class BullMQSpy {
  addedJobs: any[] = []

  async add(name: string, data: any, opts?: any) {
    this.addedJobs.push({ name, data, opts })
    return { id: `job-${Date.now()}` }
  }
}

export class AuditLogRepositorySpy {
  callsCount = 0
  lastInput: any = null

  async create(data: any) {
    this.callsCount++
    this.lastInput = data
  }
}
```

---

## 4. Builders

```typescript
// packages/api/test/helpers/builders.ts
import { randomUUID } from 'crypto'

export class NotificationBuilder {
  private data: any = {
    id: randomUUID(),
    tenantId: 'default-tenant',
    title: 'Default Title',
    body: 'Default Body',
    type: 'manual',
    status: 'draft',
    createdAt: new Date(),
  }

  withTenant(id: string) { this.data.tenantId = id; return this }
  withTitle(t: string) { this.data.title = t; return this }
  withBody(b: string) { this.data.body = b; return this }
  withStatus(s: string) { this.data.status = s; return this }
  withType(t: 'manual' | 'automated') { this.data.type = t; return this }
  automated(flowType: string) {
    this.data.type = 'automated'
    this.data.flowType = flowType
    return this
  }
  scheduled(at: Date) {
    this.data.scheduledAt = at
    this.data.status = 'scheduled'
    return this
  }

  build() { return { ...this.data } }
}

export class DeviceBuilder {
  private data: any = {
    id: randomUUID(),
    tenantId: 'default-tenant',
    appUserId: randomUUID(),
    deviceToken: `player-${randomUUID().slice(0, 8)}`,
    platform: 'android',
    isActive: true,
    lastSeenAt: new Date(),
    createdAt: new Date(),
  }

  withTenant(id: string) { this.data.tenantId = id; return this }
  withUser(id: string) { this.data.appUserId = id; return this }
  withToken(t: string) { this.data.deviceToken = t; return this }
  ios() { this.data.platform = 'ios'; return this }
  inactive() { this.data.isActive = false; return this }

  build() { return { ...this.data } }
}

export class AppUserBuilder {
  private data: any = {
    id: randomUUID(),
    tenantId: 'default-tenant',
    pushOptIn: true,
    totalPurchases: 0,
    totalSpent: 0,
    createdAt: new Date(),
  }

  withTenant(id: string) { this.data.tenantId = id; return this }
  withExternalId(id: string) { this.data.userIdExternal = id; return this }
  highValue() {
    this.data.totalPurchases = 10
    this.data.totalSpent = 5000
    return this
  }
  optedOut() { this.data.pushOptIn = false; return this }

  build() { return { ...this.data } }
}
```
