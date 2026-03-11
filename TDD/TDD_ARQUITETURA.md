# TDD Arquitetura — AppFy

> Estratégia arquitetural de testes para o AppFy.
> Baseado no GUIA_TDD.md (Manguinho/Rocketseat) aplicado à stack Hono + Drizzle + OneSignal.

---

## 1. ADRs — Impacto na Testabilidade

### ADR-01: Hono (sem DI Container)

**Decisão:** Hono com factory functions manuais, sem NestJS DI.

**Impacto nos testes:**
- **Positivo:** `createDependencies(overrides)` permite injetar mocks diretamente. Sem decorators runtime = sem mágica nos testes.
- **Positivo:** Hono test client (`app.request()`) permite testar rotas sem subir servidor HTTP.
- **Trade-off:** Sem DI container, cada factory precisa ser mantida manualmente. Se adicionar dependência nova, atualizar factory + testes.

```typescript
// Factory para testes — override parcial
const app = createApp({
  notificationRepo: mockNotificationRepo,
  // pushService usa o default real (não preciso mockar tudo)
})
```

### ADR-02: Drizzle ORM

**Decisão:** Drizzle em vez de Prisma.

**Impacto nos testes:**
- **Positivo:** Type-safety em compile-time reduz necessidade de testes de tipo em runtime.
- **Positivo:** Queries são SQL-like puras — fácil de prever o que vai ao banco.
- **Trade-off:** Menos abstrações = mais SQL manual nos repositories. Testes de repository precisam cobrir queries complexas.

### ADR-03: OneSignal (Push Provider)

**Decisão:** OneSignal com adapter pattern (PushProvider interface).

**Impacto nos testes — 3 camadas de mock:**
1. **Unit:** Mock do PushProvider interface (spy verifica chamadas)
2. **Integration:** MSW intercepta chamadas HTTP ao OneSignal API
3. **E2E:** Sandbox OneSignal (test mode, não envia push real)

```typescript
// Camada 1: Mock puro
class PushProviderSpy implements PushProvider {
  calls: PushPayload[] = []
  async sendNotification(appId: string, payload: PushPayload) {
    this.calls.push(payload)
    return { id: 'mock-notification-id', recipients: 1 }
  }
}
```

### ADR-04: Repository Pattern (tenant_id obrigatório)

**Decisão:** Todo repository recebe `tenantId` como parâmetro obrigatório.

**Impacto nos testes:**
- **Positivo:** Cada método do repository é testável em isolamento — basta verificar que `WHERE tenant_id = ?` está presente.
- **Positivo:** Testes de isolamento multi-tenant são naturais — criar dados para tenant A e B, queries como tenant A só retornam dados de A.
- **Regra:** Nenhum teste de repository pode passar sem `tenantId`. Se passar, é bug no repository.

### ADR-05: BullMQ Workers (Processamento Assíncrono)

**Decisão:** BullMQ para notification dispatch, event ingestion, analytics.

**Impacto nos testes — 3 desafios:**
1. **Timing:** Jobs assíncronos não retornam resultado imediato. Testes precisam de `waitForJob()` helpers.
2. **Retry:** Backoff exponencial precisa ser testado com clock mockado.
3. **Dead letter:** Jobs que falham 3x devem ir para DLQ. Testar cenário de falha repetida.

```typescript
// Helper para testes de worker
async function processNextJob(queue: Queue, worker: Worker) {
  const job = await queue.add('test', payload)
  await job.waitUntilFinished(queueEvents, 5000)
  return job
}
```

---

## 2. Arquitetura de Testes em 4 Camadas

```
┌─────────────────────────────────────────────┐
│  Layer 4: HTTP (Hono test client)           │  ← 10% dos testes
│  Testa: rotas, middleware chain, responses  │
├─────────────────────────────────────────────┤
│  Layer 3: Infrastructure (testcontainers)   │  ← 20% dos testes
│  Testa: repos reais, Redis, BullMQ, MSW    │
├─────────────────────────────────────────────┤
│  Layer 2: Application (use cases mockados)  │  ← 30% dos testes
│  Testa: orquestração, regras de negócio    │
├─────────────────────────────────────────────┤
│  Layer 1: Domain (puro, ZERO deps)          │  ← 40% dos testes
│  Testa: entidades, value objects, cálculos │
└─────────────────────────────────────────────┘
```

### Layer 1: Domain (Pure Logic — ZERO dependências)

Testes mais rápidos (~1ms cada). Não precisam de mock, banco, ou rede.

**O que testar:**
- Template variable substitution: `"Olá {{name}}"` → `"Olá João"`
- Notification pipeline validation: título vazio, body > 200 chars, URL inválida
- Plan limit calculation: `notificationCount >= plan.limit` → bloqueia manuais
- Conversion attribution window: push enviado há 25h → NÃO é conversão (janela 24h)
- Frequency capping: 4 push no dia para usuário com limite 3 → bloqueia
- Notification status machine: `draft → approved → scheduled → sending → sent` (transições válidas)

```typescript
// Exemplo Layer 1: Template substitution (puro)
describe('TemplateEngine', () => {
  it('should replace all variables', () => {
    const template = '{{store_name}} - {{product_name}} por R${{price}}'
    const vars = { store_name: 'Loja X', product_name: 'Tênis', price: '199,90' }

    const result = renderTemplate(template, vars)

    expect(result).toBe('Loja X - Tênis por R$199,90')
  })

  it('should throw on missing variable', () => {
    const template = '{{store_name}} - {{product_name}}'
    const vars = { store_name: 'Loja X' } // falta product_name

    expect(() => renderTemplate(template, vars)).toThrow('Missing variable: product_name')
  })
})
```

### Layer 2: Application (Use Cases — dependências mockadas)

Testes de orquestração. Verifica se o use case chama as dependências corretas na ordem correta.

**O que testar:**
- CreateNotification: valida → salva → agenda job no BullMQ
- SendPush: busca devices → chama OneSignal → salva deliveries
- ProcessWebhook: valida assinatura → identifica tipo → dispara flow
- SwitchTenant: busca membership → valida role → emite JWT com tenant_id
- IngestEvent: dedup → salva → verifica triggers de automation

```typescript
// Exemplo Layer 2: SendPush use case
describe('SendPushUseCase', () => {
  it('should send to all active devices of target users', async () => {
    const { sut, deviceRepo, pushProvider } = makeSut()
    deviceRepo.findByTenantResult = [
      { id: 'd1', deviceToken: 'token-1', isActive: true },
      { id: 'd2', deviceToken: 'token-2', isActive: true },
      { id: 'd3', deviceToken: 'token-3', isActive: false }, // inativo
    ]

    await sut.perform({ tenantId: 'tenant-1', notificationId: 'notif-1' })

    expect(pushProvider.calls).toHaveLength(1) // 1 batch call
    expect(pushProvider.calls[0].tokens).toEqual(['token-1', 'token-2']) // só ativos
  })
})
```

### Layer 3: Infrastructure (Real integrations — testcontainers)

Testes contra PostgreSQL e Redis reais via Docker. Mais lentos (~100ms cada).

**O que testar:**
- Repository queries contra PostgreSQL real
- RLS policies (SET LOCAL jwt.claims → query → verificar isolamento)
- BullMQ job processing com Redis real
- Rate limiting com Redis sliding window

```typescript
// Exemplo Layer 3: Repository com PG real
describe('NotificationRepository (integration)', () => {
  let db: DrizzleClient
  let repo: NotificationRepository

  beforeAll(async () => {
    db = await createTestDatabase() // testcontainers PG
    repo = new NotificationRepository(db)
  })

  afterAll(async () => {
    await db.$client.end()
  })

  beforeEach(async () => {
    await truncateAllTables(db)
  })

  it('should only return notifications for given tenant', async () => {
    // Arrange
    await seedNotification(db, { tenantId: 'tenant-a', title: 'Push A' })
    await seedNotification(db, { tenantId: 'tenant-b', title: 'Push B' })

    // Act
    const results = await repo.findAll('tenant-a')

    // Assert
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Push A')
  })
})
```

### Layer 4: HTTP (Route handlers — Hono test client)

Testa o contrato HTTP completo: request → middleware → handler → response.

```typescript
// Exemplo Layer 4: Rota de notificações
describe('POST /api/notifications', () => {
  it('should return 201 with created notification', async () => {
    const app = createApp({ ...mockDeps })

    const res = await app.request('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${validJwt}`,
        'X-Tenant-Id': 'tenant-1',
      },
      body: JSON.stringify({
        title: 'Promoção!',
        body: 'Até 50% off',
        type: 'manual',
      }),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBeDefined()
    expect(data.status).toBe('draft')
  })

  it('should return 400 on missing title', async () => {
    const app = createApp({ ...mockDeps })

    const res = await app.request('/api/notifications', {
      method: 'POST',
      headers: { ...validHeaders },
      body: JSON.stringify({ body: 'sem título' }),
    })

    expect(res.status).toBe(400)
  })

  it('should return 403 without X-Tenant-Id', async () => {
    const app = createApp({ ...mockDeps })

    const res = await app.request('/api/notifications', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${validJwt}` },
      body: JSON.stringify({ title: 'Test', body: 'Test' }),
    })

    expect(res.status).toBe(400) // tenantMiddleware rejects
  })
})
```

---

## 3. Dependency Injection sem Container

### Pattern: createDependencies(overrides)

```typescript
// packages/api/src/factories/dependencies.ts
export interface Dependencies {
  db: DrizzleClient
  redis: RedisClient
  notificationRepo: NotificationRepository
  deviceRepo: DeviceRepository
  appUserRepo: AppUserRepository
  membershipRepo: MembershipRepository
  automationConfigRepo: AutomationConfigRepository
  appEventRepo: AppEventRepository
  auditLogRepo: AuditLogRepository
  pushService: PushProvider
  notificationService: NotificationService
  encryptionService: EncryptionService
  stripeService: StripeService
}

export function createDependencies(overrides?: Partial<Dependencies>): Dependencies {
  const db = overrides?.db ?? createDrizzleClient()
  const redis = overrides?.redis ?? createRedisClient()

  return {
    db,
    redis,
    notificationRepo: overrides?.notificationRepo ?? new NotificationRepository(db),
    deviceRepo: overrides?.deviceRepo ?? new DeviceRepository(db),
    appUserRepo: overrides?.appUserRepo ?? new AppUserRepository(db),
    membershipRepo: overrides?.membershipRepo ?? new MembershipRepository(db),
    automationConfigRepo: overrides?.automationConfigRepo ?? new AutomationConfigRepository(db),
    appEventRepo: overrides?.appEventRepo ?? new AppEventRepository(db),
    auditLogRepo: overrides?.auditLogRepo ?? new AuditLogRepository(db),
    pushService: overrides?.pushService ?? new OneSignalPushService(),
    notificationService: overrides?.notificationService ?? new NotificationService(),
    encryptionService: overrides?.encryptionService ?? new EncryptionService(),
    stripeService: overrides?.stripeService ?? new StripeService(),
  }
}
```

### Override Parcial (só mocka o que precisa)

```typescript
// Teste: só preciso mockar push, resto é real
const app = createApp({
  pushService: new PushProviderSpy(), // mock
  // todos os outros usam implementação real
})
```

### Factory de Teste Reutilizável

```typescript
// packages/api/test/helpers/make-app.ts
export function makeTestApp(overrides?: Partial<Dependencies>) {
  const pushSpy = new PushProviderSpy()
  const membershipSpy = new MembershipRepositorySpy()
  membershipSpy.defaultRole = 'owner'

  const deps = createDependencies({
    pushService: pushSpy,
    membershipRepo: membershipSpy,
    ...overrides,
  })

  return {
    app: createApp(deps),
    deps,
    pushSpy,
    membershipSpy,
  }
}
```

---

## 4. Mock de Serviços Externos

| Serviço | Estratégia de Mock | Ferramenta | Quando Usar |
|---|---|---|---|
| **Supabase Auth** | Gerar JWTs localmente | `jose` library | Unit + Integration |
| **OneSignal API** | Interceptar HTTP | MSW | Integration |
| **Shopify API** | Interceptar HTTP + HMAC mock | MSW + crypto | Integration |
| **Nuvemshop API** | Interceptar HTTP | MSW | Integration |
| **Stripe API** | Servidor mock oficial | `stripe-mock` Docker | Integration |
| **Klaviyo API** | Interceptar HTTP | MSW | Integration |
| **Redis** | Instância real em container | testcontainers | Integration |
| **PostgreSQL** | Instância real em container | testcontainers | Integration |
| **Cloudflare R2** | MinIO em container | testcontainers | Integration |

### MSW Setup para OneSignal

```typescript
// packages/api/test/mocks/onesignal.ts
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const onesignalHandlers = [
  // Criar notificação
  http.post('https://onesignal.com/api/v1/notifications', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 'mock-notif-id',
      recipients: body.include_player_ids?.length ?? 0,
    })
  }),

  // Criar app
  http.post('https://onesignal.com/api/v1/apps', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({
      id: 'mock-app-id',
      name: body.name,
      basic_auth_key: 'mock-auth-key',
    })
  }),

  // Status de delivery
  http.get('https://onesignal.com/api/v1/notifications/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      successful: 150,
      failed: 3,
      converted: 12,
      remaining: 0,
    })
  }),
]

export const onesignalServer = setupServer(...onesignalHandlers)
```

### JWT Local para Testes

```typescript
// packages/api/test/helpers/jwt.ts
import { SignJWT } from 'jose'

const TEST_SECRET = new TextEncoder().encode('test-secret-at-least-32-chars!!')

export async function createTestJwt(claims: {
  sub: string
  tenant_id?: string
  role?: string
}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(TEST_SECRET)
}

// Uso no teste:
const jwt = await createTestJwt({ sub: 'user-1', tenant_id: 'tenant-1' })
```

### Shopify Webhook HMAC

```typescript
// packages/api/test/helpers/shopify.ts
import { createHmac } from 'crypto'

export function signShopifyWebhook(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64')
}

// Uso no teste:
const body = JSON.stringify({ id: 123, email: 'test@shop.com' })
const hmac = signShopifyWebhook(body, 'test-shopify-secret')

const res = await app.request('/webhooks/shopify/orders', {
  method: 'POST',
  headers: {
    'X-Shopify-Hmac-Sha256': hmac,
    'Content-Type': 'application/json',
  },
  body,
})
```

---

## 5. Ambiente de Teste

### Docker Compose para Testes

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
    tmpfs: /var/lib/postgresql/data  # RAM = rápido
    command: >
      postgres
        -c fsync=off
        -c synchronous_commit=off
        -c full_page_writes=off

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    command: redis-server --save "" --appendonly no  # sem persistência

  minio-test:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9001:9000"
    command: server /data
    tmpfs: /data

  stripe-mock:
    image: stripe/stripe-mock:latest
    ports:
      - "12111:12111"
```

### GitHub Actions Service Containers

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: appfy_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5433:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6380:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
```

### Vitest Config — Projetos Paralelos

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        // Unit tests — rápidos, paralelos, sem deps externas
        test: {
          name: 'unit',
          include: ['packages/*/test/unit/**/*.spec.ts'],
          pool: 'threads', // máxima velocidade
          coverage: {
            provider: 'v8',
            thresholds: { lines: 80, branches: 80, functions: 80 },
          },
        },
      },
      {
        // Integration tests — com banco, sequenciais por segurança
        test: {
          name: 'integration',
          include: ['packages/*/test/integration/**/*.spec.ts'],
          pool: 'forks', // isolamento de processo
          poolOptions: { forks: { singleFork: true } }, // sequencial
          setupFiles: ['./test/setup-integration.ts'],
        },
      },
      {
        // Isolation tests — multi-tenant verification
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

### Cleanup Strategy: Truncate entre testes

```typescript
// test/setup-integration.ts
import { sql } from 'drizzle-orm'

export async function truncateAllTables(db: DrizzleClient) {
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
      tenants,
      users
    CASCADE
  `)
}
```

---

## 6. Performance Test Strategy

### Métricas com Limites

| Métrica | Limite | Como Testar |
|---|---|---|
| API response time | p95 < 200ms | Benchmark nos testes de integração |
| Push dispatch latency | < 5s | Timer no worker test |
| Worker queue depth | alerta > 10K | Mock BullMQ + assertion |
| DB query time | p95 < 50ms | EXPLAIN ANALYZE nos testes de repo |

### Teste de Latência em CI

```typescript
describe('Performance', () => {
  it('should respond to GET /api/notifications in under 200ms', async () => {
    const app = createApp({ ...realDeps })
    await seedNotifications(db, 100) // 100 notificações

    const start = performance.now()
    const res = await app.request('/api/notifications', {
      headers: validHeaders,
    })
    const elapsed = performance.now() - start

    expect(res.status).toBe(200)
    expect(elapsed).toBeLessThan(200) // p95 < 200ms
  })
})
```

### Load Test Semanal (k6)

```javascript
// infra/k6/push-dispatch.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp up
    { duration: '1m', target: 50 },    // sustain
    { duration: '10s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const res = http.post(`${BASE_URL}/api/notifications`, JSON.stringify({
    title: 'Load test',
    body: 'Performance check',
    type: 'manual',
  }), { headers: { 'Content-Type': 'application/json', ...authHeaders } })

  check(res, { 'status 201': (r) => r.status === 201 })
  sleep(0.1)
}
```

---

## 7. Contract Testing

### Zod Schemas como Contrato

```typescript
// packages/shared/src/schemas/notification.ts
import { z } from 'zod'

export const createNotificationSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(500),
  type: z.enum(['manual', 'automated']),
  flowType: z.enum([
    'cart_abandoned', 'pix_recovery', 'boleto_recovery', 'welcome',
    'checkout_abandoned', 'order_confirmed', 'tracking_created',
    'browse_abandoned', 'upsell'
  ]).optional(),
  imageUrl: z.string().url().optional(),
  targetUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
})

// O mesmo schema valida input no middleware E no teste
```

### Interface Compliance Tests

```typescript
// packages/integrations/test/contract/platform-adapter.spec.ts
export function platformAdapterContractTest(
  name: string,
  createAdapter: () => PlatformAdapter
) {
  describe(`PlatformAdapter contract: ${name}`, () => {
    let adapter: PlatformAdapter

    beforeAll(() => { adapter = createAdapter() })

    it('getProducts should return array of Product', async () => {
      const products = await adapter.getProducts({ limit: 10 })
      expect(Array.isArray(products)).toBe(true)
      if (products.length > 0) {
        expect(products[0]).toHaveProperty('id')
        expect(products[0]).toHaveProperty('title')
        expect(products[0]).toHaveProperty('price')
      }
    })

    it('getOrders should return array of Order', async () => {
      const orders = await adapter.getOrders({ limit: 10 })
      expect(Array.isArray(orders)).toBe(true)
    })

    it('getAbandonedCarts should return array of AbandonedCart', async () => {
      const carts = await adapter.getAbandonedCarts()
      expect(Array.isArray(carts)).toBe(true)
    })
  })
}

// Executar para cada adapter:
platformAdapterContractTest('Shopify', () => new ShopifyAdapter(mockConfig))
platformAdapterContractTest('Nuvemshop', () => new NuvemshopAdapter(mockConfig))
```

```typescript
// packages/notifications/test/contract/push-provider.spec.ts
export function pushProviderContractTest(
  name: string,
  createProvider: () => PushProvider
) {
  describe(`PushProvider contract: ${name}`, () => {
    let provider: PushProvider

    beforeAll(() => { provider = createProvider() })

    it('sendNotification should return id and recipients count', async () => {
      const result = await provider.sendNotification('app-id', {
        title: 'Test', body: 'Test', tokens: ['token-1'],
      })
      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('recipients')
      expect(result.recipients).toBeGreaterThanOrEqual(0)
    })

    it('createApp should return appId', async () => {
      const result = await provider.createApp({ name: 'Test App' })
      expect(result).toHaveProperty('appId')
      expect(typeof result.appId).toBe('string')
    })
  })
}

pushProviderContractTest('OneSignal', () => new OneSignalProvider(mockConfig))
```

### Webhook Payload Validation

```typescript
// packages/integrations/test/webhooks/shopify-fixtures.ts
export const shopifyWebhookFixtures = {
  orderPaid: {
    id: 123456,
    financial_status: 'paid',
    line_items: [{ product_id: 789, title: 'Tênis', price: '199.90' }],
    customer: { id: 111, email: 'test@email.com' },
  },
  cartAbandoned: {
    id: 654321,
    abandoned_checkout_url: 'https://store.myshopify.com/checkouts/abc',
    line_items: [{ product_id: 789, title: 'Tênis', price: '199.90' }],
  },
}

// Teste:
it('should parse Shopify order_paid webhook correctly', () => {
  const result = shopifyOrderSchema.safeParse(shopifyWebhookFixtures.orderPaid)
  expect(result.success).toBe(true)
})
```

---

## 8. Pirâmide de Testes para AppFy

```
         ╱╲
        ╱ E2E ╲           ~50 testes (10%)
       ╱  5 min  ╲         Playwright + Hono
      ╱────────────╲
     ╱ Integration   ╲     ~100 testes (20%)
    ╱  PG + Redis +    ╲    testcontainers + MSW
   ╱  MSW (30-60s)      ╲
  ╱──────────────────────╲
 ╱    Unit Tests           ╲  ~350 testes (70%)
╱  Pure logic (<5s total)    ╲  Vitest threads
╱──────────────────────────────╲
```

### Distribuição por Package

| Package | Unit | Integration | E2E | Total |
|---|---|---|---|---|
| `packages/api` (routes + middleware) | 40 | 30 | 20 | 90 |
| `packages/api` (services) | 80 | 10 | — | 90 |
| `packages/api` (repositories) | 20 | 40 | — | 60 |
| `packages/notifications` | 60 | 15 | 10 | 85 |
| `packages/integrations` | 50 | 20 | 5 | 75 |
| `packages/db` | 10 | 30 | — | 40 |
| `packages/shared` | 30 | — | — | 30 |
| `workers/` | 20 | 15 | 5 | 40 |
| **Total** | **310** | **160** | **40** | **510** |

### Tempos Alvo

| Tipo | Tempo Total | CI Stage |
|---|---|---|
| Unit | < 5s | `quality` job |
| Integration | < 60s | `test` job |
| E2E | < 5min | `e2e` job (post-deploy) |
| **Total CI** | **< 7 min** | — |

---

## 9. Cenários Críticos (Não Pode Fazer Deploy Sem)

### Tier 1: Bloqueadores Absolutos (~50 testes)

| Cenário | Tipo | Por Quê |
|---|---|---|
| Isolamento multi-tenant (IDOR) | Isolation | Vazamento de dados = morte do produto |
| RLS policies em todas as tabelas | Integration | Defense-in-depth obrigatória |
| Encrypted credentials round-trip | Unit | auth_tag ausente = AES-CTR (inseguro) |
| JWT validation (expirado, inválido, sem tenant) | Unit | Acesso não autorizado |
| Switch-tenant (membership check) | Integration | Escalação de privilégio |

### Tier 2: Funcionalidade Core (~50 testes)

| Cenário | Tipo | Por Quê |
|---|---|---|
| Push pipeline (create → send → track) | Integration | Se push não funciona, produto não existe |
| Todos os 9 automation flows | Unit + Integration | Core value proposition |
| Template variable substitution | Unit | Notificação com `{{product_name}}` = inútil |
| Plan limit enforcement | Unit | Billing depende disso |
| Webhook signature verification (Shopify) | Unit | Webhook sem HMAC = vulnerabilidade |

### Tier 3: Resiliência (~30 testes)

| Cenário | Tipo | Por Quê |
|---|---|---|
| OneSignal API failure → retry + DLQ | Integration | Push não pode falhar silenciosamente |
| Stripe webhook → subscription lifecycle | Integration | Billing incorreto = churn |
| Event dedup (same event twice) | Unit | Webhook retry = evento duplicado |
| Rate limiting (Redis sliding window) | Integration | Sem rate limit = abuse |
| Data retention job | Integration | notification_deliveries cresce infinitamente |

---

## 10. Workflow TDD por Feature

```
┌─────────────────────────────┐
│  1. PLAN                     │
│  - Caso de uso (texto)       │
│  - Input/Output/Regras       │
│  - Edge cases listados       │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  2. RED (Layer 1 primeiro)   │
│  - Teste de domínio puro     │
│  - Compile error = RED ✓     │
│  - Assertion fail = RED ✓    │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  3. GREEN (mínimo possível)  │
│  - Hardcode é OK             │
│  - Marretada é OK            │
│  - Fez o teste passar? COMMIT│
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  4. REFACTOR                 │
│  - Extrair entidade/VO       │
│  - Remover duplicação        │
│  - Testes ainda passam? ✓    │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  5. Repetir RED-GREEN-REFACTOR│
│  - Para cada edge case       │
│  - Boundary tests (+1, -1)   │
│  - Até cobrir o caso de uso  │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  6. Subir Layer (2, 3, 4)    │
│  - Use case com mocks        │
│  - Repo com PG real          │
│  - Rota com Hono client      │
└──────────┬──────────────────┘
           │
┌──────────▼──────────────────┐
│  7. CI Verde → Deploy        │
│  - biome check               │
│  - tsc --noEmit              │
│  - vitest run (all projects) │
│  - coverage ≥ 80%            │
└─────────────────────────────┘
```

**Regra de ouro:** Nunca pule do Layer 1 direto para o Layer 4. A tentação de "testar a rota" antes da lógica é forte, mas gera testes frágeis que dependem de implementação.
