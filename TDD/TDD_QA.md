# TDD QA — AppFy

> Especificação de qualidade e testes sob a perspectiva do QA.
> Quality gates, isolamento multi-tenant, segurança, push tracking.

---

## 1. Quality Gates (G0–G7)

### G0 — Pre-commit (Local)

**Roda em:** hook de pre-commit (husky + lint-staged)

| Check | Comando | Critério de Aprovação |
|---|---|---|
| Format | `biome format --check` | Zero erros de formatação |
| Lint | `biome lint` | Zero warnings/errors |
| Type check | `tsc --noEmit` | Zero erros de tipo |

**Se falhar:** commit é bloqueado. Dev corrige antes de commitar.

### G1 — Unit Tests (CI — quality job)

**Roda em:** push para qualquer branch

| Check | Comando | Critério |
|---|---|---|
| Unit tests | `vitest run --project unit` | 100% passando |
| Coverage | `vitest run --project unit --coverage` | ≥80% lines, branches, functions |
| Coverage delta | comparar com main | Não pode diminuir |

### G2 — Integration Tests (CI — test job)

**Roda em:** push para qualquer branch

| Check | Comando | Critério |
|---|---|---|
| Integration tests | `vitest run --project integration` | 100% passando |
| Isolation tests | `vitest run --project isolation` | 100% passando (multi-tenant) |
| DB migrations | `drizzle-kit push --dry-run` | Sem erros em banco fresh |

**Requer:** PostgreSQL + Redis em service containers.

### G3 — Security (CI — security job)

| Check | Comando | Critério |
|---|---|---|
| Dependency audit | `pnpm audit --audit-level=high` | Zero vulnerabilidades high/critical |
| SAST | CodeQL analysis | Zero alerts high/critical |
| Secrets scan | `trufflehog --only-verified` | Zero secrets no código |

### G4 — Build (CI — build job)

| Check | Comando | Critério |
|---|---|---|
| API build | `pnpm --filter @appfy/api build` | Sem erros |
| Web build | `pnpm --filter @appfy/web build` | Sem erros |
| Shared build | `pnpm --filter @appfy/shared build` | Sem erros |

### G5 — Deploy Staging (CI — deploy-staging job)

| Check | Comando | Critério |
|---|---|---|
| Deploy web | `vercel deploy --prebuilt` | Sucesso |
| Deploy API | Railway deploy | Sucesso |
| Health check | `curl /health` | Status 200, `{ "status": "ok" }` |

### G6 — E2E + Smoke (CI — e2e job)

| Check | Comando | Critério |
|---|---|---|
| Smoke tests | `curl` health + auth + notification endpoint | Respostas 200/201 |
| E2E flows | Playwright (login → create notification → send) | 100% passando |

### G7 — Production Deploy (Manual gate)

| Check | Responsável | Critério |
|---|---|---|
| G0-G6 todos verdes | CI | Automático |
| Review humano | Dev/PO | Aprovação manual |
| Rollback plan | DevOps | Documentado |
| Monitoring alert check | QA | Sentry configurado para novo código |

---

## 2. Categorias de Teste & Coverage

### Pirâmide de Testes

```
       ╱╲         E2E (5%) — Playwright
      ╱────╲       Flows críticos end-to-end
     ╱ Integ ╲     Integration (25%) — testcontainers + MSW
    ╱──────────╲    Repos, adapters, workers
   ╱    Unit     ╲   Unit (70%) — pure logic
  ╱────────────────╲  Domain, services, validators, templates
```

### Coverage por Package

| Package | Mínimo | Alvo | Justificativa |
|---|---|---|---|
| `packages/api/services` | 85% | 90% | Lógica de negócio core |
| `packages/api/repositories` | 80% | 85% | Queries SQL precisam de cobertura |
| `packages/api/middleware` | 80% | 90% | Auth/tenant são críticos |
| `packages/notifications` | 85% | 90% | Core do produto |
| `packages/integrations` | 75% | 80% | Depende de APIs externas |
| `packages/db` | 70% | 80% | Schemas + migrations |
| `packages/shared` | 90% | 95% | Utils compartilhados |
| `workers/` | 75% | 85% | Processamento assíncrono |

### Exemplo: Vitest Coverage Config

```typescript
// vitest.config.ts (excerpt)
coverage: {
  provider: 'v8',
  reporter: ['text', 'json-summary', 'html'],
  thresholds: {
    lines: 80,
    branches: 80,
    functions: 80,
    statements: 80,
  },
  exclude: [
    'test/**',
    '**/*.spec.ts',
    '**/types.ts',
    '**/index.ts', // re-exports
    'drizzle.config.ts',
  ],
}
```

---

## 3. Suite de Testes de Isolamento Multi-Tenant

### Template Reutilizável

```typescript
// packages/api/test/isolation/create-isolation-suite.ts
import { describe, it, expect, beforeEach } from 'vitest'

interface IsolationSuiteConfig<T> {
  name: string
  repo: {
    create: (tenantId: string, data: Partial<T>) => Promise<T>
    findAll: (tenantId: string) => Promise<T[]>
    findById: (tenantId: string, id: string) => Promise<T | null>
    update: (tenantId: string, id: string, data: Partial<T>) => Promise<T | null>
    delete: (tenantId: string, id: string) => Promise<boolean>
  }
  sampleData: Partial<T>
}

export function createIsolationSuite<T extends { id: string }>(config: IsolationSuiteConfig<T>) {
  describe(`Isolamento Multi-Tenant: ${config.name}`, () => {
    const TENANT_A = 'tenant-aaaa-aaaa-aaaa'
    const TENANT_B = 'tenant-bbbb-bbbb-bbbb'

    let itemA: T
    let itemB: T

    beforeEach(async () => {
      itemA = await config.repo.create(TENANT_A, config.sampleData)
      itemB = await config.repo.create(TENANT_B, config.sampleData)
    })

    it('tenant A NÃO vê dados do tenant B em findAll', async () => {
      const results = await config.repo.findAll(TENANT_A)
      const ids = results.map((r) => r.id)

      expect(ids).toContain(itemA.id)
      expect(ids).not.toContain(itemB.id)
    })

    it('tenant A NÃO acessa item do tenant B por ID', async () => {
      const result = await config.repo.findById(TENANT_A, itemB.id)

      expect(result).toBeNull()
    })

    it('tenant A NÃO consegue atualizar item do tenant B', async () => {
      const result = await config.repo.update(TENANT_A, itemB.id, { ...config.sampleData })

      expect(result).toBeNull()

      // Verificar que o item B não foi alterado
      const unchanged = await config.repo.findById(TENANT_B, itemB.id)
      expect(unchanged).toBeDefined()
    })

    it('tenant A NÃO consegue deletar item do tenant B', async () => {
      const result = await config.repo.delete(TENANT_A, itemB.id)

      expect(result).toBe(false)

      // Verificar que o item B ainda existe
      const stillExists = await config.repo.findById(TENANT_B, itemB.id)
      expect(stillExists).toBeDefined()
    })
  })
}
```

### Matriz de Isolamento (TODAS as tabelas)

| Tabela | findAll | findById | create | update | delete | count |
|---|---|---|---|---|---|---|
| `notifications` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `notification_deliveries` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `app_users` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `devices` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `app_events` | ✓ | ✓ | ✓ | — | — | ✓ |
| `app_user_segments` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `app_user_products` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `automation_configs` | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `app_configs` | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| `audit_log` | ✓ | ✓ | ✓ | — | — | ✓ |

**Total: ~60 testes de isolamento** (6 operações × 10 tabelas)

### Cenários Específicos de Isolamento

```typescript
// Switch-tenant security
describe('Switch Tenant Security', () => {
  it('should reject switch to tenant without membership', async () => {
    const jwt = await createTestJwt({ sub: 'user-1' }) // sem tenant

    const res = await app.request('/auth/switch-tenant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId: 'tenant-without-membership' }),
    })

    expect(res.status).toBe(403)
  })

  it('should not allow viewer to switch and act as owner', async () => {
    // User tem membership como 'viewer' no tenant
    const jwt = await createTestJwt({ sub: 'user-viewer', tenant_id: 'tenant-1' })

    const res = await app.request('/api/notifications', {
      method: 'DELETE', // operação destrutiva
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'X-Tenant-Id': 'tenant-1',
      },
    })

    expect(res.status).toBe(403)
  })
})
```

### RLS Policy Tests (SQL direto)

```typescript
describe('RLS Policies', () => {
  it('should block cross-tenant SELECT via RLS', async () => {
    // Inserir dados como service_role (bypassa RLS)
    await db.execute(sql`
      INSERT INTO notifications (id, tenant_id, title, body, type, status)
      VALUES ('notif-a', 'tenant-a', 'Push A', 'Body A', 'manual', 'draft')
    `)
    await db.execute(sql`
      INSERT INTO notifications (id, tenant_id, title, body, type, status)
      VALUES ('notif-b', 'tenant-b', 'Push B', 'Body B', 'manual', 'draft')
    `)

    // Simular query como tenant-a (via RLS)
    const result = await db.execute(sql`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"tenant_id": "tenant-a"}';
      SELECT * FROM notifications;
    `)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].title).toBe('Push A')
  })

  it('should block cross-tenant UPDATE via RLS', async () => {
    await db.execute(sql`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"tenant_id": "tenant-a"}';
      UPDATE notifications SET title = 'HACKED' WHERE tenant_id = 'tenant-b';
    `)

    // Verificar que tenant-b não foi alterado
    const result = await db.execute(sql`
      SET LOCAL role = 'service_role';
      SELECT title FROM notifications WHERE tenant_id = 'tenant-b';
    `)
    expect(result.rows[0].title).toBe('Push B')
  })
})
```

---

## 4. Push Notification Test Matrix

### 4.1 OneSignal Integration (MSW Mock)

```typescript
describe('OneSignalPushService', () => {
  const makeSut = () => {
    const sut = new OneSignalPushService({
      apiKey: 'test-api-key',
      userAuthKey: 'test-auth-key',
    })
    return { sut }
  }

  it('should send notification to specified devices', async () => {
    const { sut } = makeSut()

    const result = await sut.sendNotification('app-id-1', {
      title: 'Promoção!',
      body: 'Até 50% off',
      tokens: ['player-1', 'player-2'],
    })

    expect(result.id).toBe('mock-notif-id')
    expect(result.recipients).toBe(2)
  })

  it('should handle OneSignal API failure with retry', async () => {
    // MSW retorna 500 nas primeiras 2 tentativas, 200 na terceira
    let attempts = 0
    onesignalServer.use(
      http.post('https://onesignal.com/api/v1/notifications', () => {
        attempts++
        if (attempts < 3) return new HttpResponse(null, { status: 500 })
        return HttpResponse.json({ id: 'success', recipients: 1 })
      })
    )

    const { sut } = makeSut()
    const result = await sut.sendNotification('app-id-1', {
      title: 'Retry test', body: 'Test', tokens: ['player-1'],
    })

    expect(result.id).toBe('success')
    expect(attempts).toBe(3) // 2 falhas + 1 sucesso
  })

  it('should throw after max retries exceeded', async () => {
    onesignalServer.use(
      http.post('https://onesignal.com/api/v1/notifications', () => {
        return new HttpResponse(null, { status: 500 })
      })
    )

    const { sut } = makeSut()

    await expect(sut.sendNotification('app-id-1', {
      title: 'Fail test', body: 'Test', tokens: ['player-1'],
    })).rejects.toThrow('OneSignal API failed after 3 attempts')
  })
})
```

### 4.2 Delivery Tracking Pipeline

```typescript
describe('Delivery Tracking State Machine', () => {
  // Status: pending → sent → delivered → opened → clicked → converted

  it('should transition: pending → sent', async () => {
    const delivery = await createDelivery({ status: 'pending' })
    const updated = await updateDeliveryStatus(delivery.id, 'sent')

    expect(updated.status).toBe('sent')
    expect(updated.sentAt).toBeDefined()
  })

  it('should transition: sent → delivered → opened → clicked → converted', async () => {
    const delivery = await createDelivery({ status: 'sent' })

    await updateDeliveryStatus(delivery.id, 'delivered')
    await updateDeliveryStatus(delivery.id, 'opened')
    await updateDeliveryStatus(delivery.id, 'clicked')
    await updateDeliveryStatus(delivery.id, 'converted')

    const final = await getDelivery(delivery.id)
    expect(final.status).toBe('converted')
    expect(final.deliveredAt).toBeDefined()
    expect(final.openedAt).toBeDefined()
    expect(final.clickedAt).toBeDefined()
    expect(final.convertedAt).toBeDefined()
  })

  it('should reject invalid transition: pending → converted', async () => {
    const delivery = await createDelivery({ status: 'pending' })

    await expect(
      updateDeliveryStatus(delivery.id, 'converted')
    ).rejects.toThrow('Invalid status transition')
  })

  it('should handle failed status at any point', async () => {
    const delivery = await createDelivery({ status: 'sent' })
    const updated = await updateDeliveryStatus(delivery.id, 'failed', {
      errorMessage: 'Invalid device token',
    })

    expect(updated.status).toBe('failed')
    expect(updated.errorMessage).toBe('Invalid device token')
  })
})
```

### 4.3 Conversion Attribution

```typescript
describe('Conversion Attribution', () => {
  beforeAll(() => { vi.useFakeTimers() })
  afterAll(() => { vi.useRealTimers() })

  it('should attribute conversion within 24h window (normal flow)', () => {
    const pushSentAt = new Date('2026-03-10T10:00:00Z')
    const purchaseAt = new Date('2026-03-10T20:00:00Z') // 10h depois

    const result = shouldAttributeConversion(pushSentAt, purchaseAt, 'single')

    expect(result).toBe(true)
  })

  it('should NOT attribute conversion after 24h window', () => {
    const pushSentAt = new Date('2026-03-10T10:00:00Z')
    const purchaseAt = new Date('2026-03-11T11:00:00Z') // 25h depois

    const result = shouldAttributeConversion(pushSentAt, purchaseAt, 'single')

    expect(result).toBe(false)
  })

  // Boundary: exatamente no limite
  it('should attribute at exactly 24h (boundary)', () => {
    const pushSentAt = new Date('2026-03-10T10:00:00Z')
    const purchaseAt = new Date('2026-03-11T10:00:00Z') // exatamente 24h

    const result = shouldAttributeConversion(pushSentAt, purchaseAt, 'single')

    expect(result).toBe(true) // <= 24h
  })

  it('should NOT attribute at 24h + 1ms (boundary)', () => {
    const pushSentAt = new Date('2026-03-10T10:00:00Z')
    const purchaseAt = new Date('2026-03-11T10:00:00.001Z') // 24h + 1ms

    const result = shouldAttributeConversion(pushSentAt, purchaseAt, 'single')

    expect(result).toBe(false)
  })

  // Multi-campanha: janela de 1h
  it('should use 1h window for multi-campaign same day', () => {
    const pushSentAt = new Date('2026-03-10T14:00:00Z')
    const purchaseAt = new Date('2026-03-10T14:30:00Z') // 30min depois

    const result = shouldAttributeConversion(pushSentAt, purchaseAt, 'multi')

    expect(result).toBe(true)
  })

  it('should NOT attribute multi-campaign after 1h', () => {
    const pushSentAt = new Date('2026-03-10T14:00:00Z')
    const purchaseAt = new Date('2026-03-10T15:01:00Z') // 61min depois

    const result = shouldAttributeConversion(pushSentAt, purchaseAt, 'multi')

    expect(result).toBe(false)
  })

  it('should attribute to most recent push in multi-campaign', () => {
    const pushes = [
      { id: 'push-1', sentAt: new Date('2026-03-10T10:00:00Z') },
      { id: 'push-2', sentAt: new Date('2026-03-10T14:00:00Z') },
      { id: 'push-3', sentAt: new Date('2026-03-10T16:00:00Z') },
    ]
    const purchaseAt = new Date('2026-03-10T16:30:00Z')

    const attributed = findAttributedPush(pushes, purchaseAt)

    expect(attributed?.id).toBe('push-3') // mais recente antes da compra
  })
})
```

### 4.4 Template Variable Substitution

```typescript
describe('Template Variable Substitution', () => {
  it('should replace all known variables', () => {
    const template = '{{store_name}} - {{product_name}} por R${{price}}'
    const vars = { store_name: 'Nike', product_name: 'Air Max', price: '599,90' }

    expect(renderTemplate(template, vars)).toBe('Nike - Air Max por R$599,90')
  })

  it('should throw on missing required variable', () => {
    const template = '{{store_name}} - {{product_name}}'
    const vars = { store_name: 'Nike' }

    expect(() => renderTemplate(template, vars)).toThrow('Missing variable: product_name')
  })

  it('should handle empty string variable', () => {
    const template = 'Olá {{name}}, seu pedido chegou!'
    const vars = { name: '' }

    expect(renderTemplate(template, vars)).toBe('Olá , seu pedido chegou!')
  })

  it('should sanitize XSS in variables', () => {
    const template = '{{product_name}} está em promoção!'
    const vars = { product_name: '<script>alert("xss")</script>Tênis' }

    const result = renderTemplate(template, vars)
    expect(result).not.toContain('<script>')
  })

  it('should handle variables with special regex chars', () => {
    const template = '{{product_name}} por R${{price}}'
    const vars = { product_name: 'Tênis (42)', price: '199.90' }

    expect(renderTemplate(template, vars)).toBe('Tênis (42) por R$199.90')
  })
})
```

### 4.5 Automation Flow Tests (9 flows)

```typescript
describe('Automation Flows', () => {
  const flows = [
    { type: 'cart_abandoned', trigger: 'cart_abandoned_webhook', defaultDelay: 3600 },
    { type: 'pix_recovery', trigger: 'order_pending_pix', defaultDelay: 1800 },
    { type: 'boleto_recovery', trigger: 'order_pending_boleto', defaultDelay: 3600 },
    { type: 'welcome', trigger: 'app_first_open', defaultDelay: 300 },
    { type: 'checkout_abandoned', trigger: 'checkout_abandoned_webhook', defaultDelay: 3600 },
    { type: 'order_confirmed', trigger: 'order_paid_webhook', defaultDelay: 0 },
    { type: 'tracking_created', trigger: 'fulfillment_created_webhook', defaultDelay: 0 },
    { type: 'browse_abandoned', trigger: 'product_viewed_no_cart', defaultDelay: 7200 },
    { type: 'upsell', trigger: 'order_delivered_webhook', defaultDelay: 259200 },
  ]

  flows.forEach(({ type, trigger, defaultDelay }) => {
    describe(`Flow: ${type}`, () => {
      it(`should create delayed job on ${trigger}`, async () => {
        const { sut, queue } = makeSut()
        const config = { flowType: type, isEnabled: true, delaySeconds: defaultDelay }

        await sut.handleTrigger(trigger, { tenantId: 'tenant-1', data: {} })

        expect(queue.addedJobs).toHaveLength(1)
        expect(queue.addedJobs[0].delay).toBe(defaultDelay * 1000)
      })

      it('should NOT trigger if flow is disabled', async () => {
        const { sut, queue } = makeSut()
        // automation_configs.is_enabled = false

        await sut.handleTrigger(trigger, { tenantId: 'tenant-1', data: {} })

        expect(queue.addedJobs).toHaveLength(0)
      })

      it('should use custom delay from automation_configs', async () => {
        const { sut, queue, configRepo } = makeSut()
        configRepo.setConfig(type, { delaySeconds: 7200 }) // 2h custom

        await sut.handleTrigger(trigger, { tenantId: 'tenant-1', data: {} })

        expect(queue.addedJobs[0].delay).toBe(7200 * 1000)
      })

      it('should use custom template from automation_configs', async () => {
        const { sut, notificationRepo, configRepo } = makeSut()
        configRepo.setConfig(type, {
          templateTitle: 'Custom {{store_name}}',
          templateBody: 'Custom body {{product_name}}',
        })

        await sut.handleTrigger(trigger, {
          tenantId: 'tenant-1',
          data: { store_name: 'Nike', product_name: 'Air Max' },
        })

        const created = notificationRepo.lastCreated
        expect(created.title).toBe('Custom Nike')
        expect(created.body).toBe('Custom body Air Max')
      })
    })
  })
})
```

---

## 5. Security Test Checklist

### 5.1 AES-256-GCM Encryption

```typescript
describe('EncryptionService', () => {
  const makeSut = () => {
    const sut = new EncryptionService('a-32-char-secret-key-for-tests!!')
    return { sut }
  }

  it('should encrypt and decrypt roundtrip', () => {
    const { sut } = makeSut()
    const plaintext = 'shpat_abc123_shopify_token'

    const encrypted = sut.encrypt(plaintext)
    const decrypted = sut.decrypt(encrypted)

    expect(decrypted).toBe(plaintext)
  })

  it('should produce JSONB with all required fields', () => {
    const { sut } = makeSut()
    const encrypted = sut.encrypt('test-token')

    expect(encrypted).toHaveProperty('ct')
    expect(encrypted).toHaveProperty('iv')
    expect(encrypted).toHaveProperty('tag')
    expect(encrypted).toHaveProperty('alg')
    expect(encrypted.alg).toBe('aes-256-gcm')
  })

  it('should reject decryption with missing auth_tag', () => {
    const { sut } = makeSut()
    const encrypted = sut.encrypt('test-token')
    const tampered = { ...encrypted, tag: undefined }

    expect(() => sut.decrypt(tampered as any)).toThrow()
  })

  it('should reject decryption with tampered ciphertext', () => {
    const { sut } = makeSut()
    const encrypted = sut.encrypt('test-token')
    const tampered = { ...encrypted, ct: encrypted.ct + 'XX' }

    expect(() => sut.decrypt(tampered)).toThrow()
  })

  it('should reject decryption with wrong key', () => {
    const encryptor = new EncryptionService('key-a-32-chars-long-exactly-now!')
    const decryptor = new EncryptionService('different-32-char-key-for-tests!')

    const encrypted = encryptor.encrypt('secret-data')

    expect(() => decryptor.decrypt(encrypted)).toThrow()
  })

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const { sut } = makeSut()
    const a = sut.encrypt('same-token')
    const b = sut.encrypt('same-token')

    expect(a.ct).not.toBe(b.ct)
    expect(a.iv).not.toBe(b.iv)
  })
})
```

### 5.2 SSRF Protection

```typescript
describe('SSRF Protection', () => {
  it('should allow whitelisted domains', async () => {
    expect(isAllowedUrl('https://store.myshopify.com/admin/api')).toBe(true)
    expect(isAllowedUrl('https://api.nuvemshop.com.br/v1/products')).toBe(true)
    expect(isAllowedUrl('https://onesignal.com/api/v1/notifications')).toBe(true)
  })

  it('should block private IPs', async () => {
    expect(isAllowedUrl('http://127.0.0.1:8080')).toBe(false)
    expect(isAllowedUrl('http://10.0.0.1/admin')).toBe(false)
    expect(isAllowedUrl('http://172.16.0.1/internal')).toBe(false)
    expect(isAllowedUrl('http://192.168.1.1/secret')).toBe(false)
  })

  it('should block localhost variants', async () => {
    expect(isAllowedUrl('http://localhost:3000')).toBe(false)
    expect(isAllowedUrl('http://0.0.0.0:8080')).toBe(false)
    expect(isAllowedUrl('http://[::1]:3000')).toBe(false)
  })

  it('should block non-whitelisted external domains', async () => {
    expect(isAllowedUrl('https://evil.com/steal-tokens')).toBe(false)
    expect(isAllowedUrl('https://myshopify.com.evil.com')).toBe(false)
  })
})
```

### 5.3 Rate Limiting

```typescript
describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    const limiter = new RateLimiter(redis, { max: 100, windowMs: 60000 })

    for (let i = 0; i < 100; i++) {
      const result = await limiter.check('user-1')
      expect(result.allowed).toBe(true)
    }
  })

  it('should block requests exceeding limit', async () => {
    const limiter = new RateLimiter(redis, { max: 3, windowMs: 60000 })

    await limiter.check('user-1') // 1
    await limiter.check('user-1') // 2
    await limiter.check('user-1') // 3
    const result = await limiter.check('user-1') // 4 = blocked

    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('should track limits per user independently', async () => {
    const limiter = new RateLimiter(redis, { max: 1, windowMs: 60000 })

    await limiter.check('user-1') // user-1 at limit
    const result = await limiter.check('user-2') // user-2 fresh

    expect(result.allowed).toBe(true)
  })
})
```

### 5.4 JWT Validation

```typescript
describe('Auth Middleware', () => {
  it('should reject request without Authorization header', async () => {
    const res = await app.request('/api/notifications')
    expect(res.status).toBe(401)
  })

  it('should reject expired JWT', async () => {
    const jwt = await createTestJwt({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) - 3600 })
    const res = await app.request('/api/notifications', {
      headers: { 'Authorization': `Bearer ${jwt}` },
    })
    expect(res.status).toBe(401)
  })

  it('should reject JWT signed with wrong secret', async () => {
    const jwt = await createJwtWithWrongSecret({ sub: 'user-1' })
    const res = await app.request('/api/notifications', {
      headers: { 'Authorization': `Bearer ${jwt}` },
    })
    expect(res.status).toBe(401)
  })

  it('should reject JWT without tenant_id on protected routes', async () => {
    const jwt = await createTestJwt({ sub: 'user-1' }) // sem tenant_id
    const res = await app.request('/api/notifications', {
      headers: { 'Authorization': `Bearer ${jwt}` },
    })
    expect(res.status).toBe(400) // X-Tenant-Id missing
  })
})
```

### 5.5 XSS/Injection

```typescript
describe('XSS Sanitization', () => {
  it('should strip HTML tags from notification title', () => {
    const input = '<script>alert("xss")</script>Promoção!'
    expect(sanitizeNotificationText(input)).toBe('Promoção!')
  })

  it('should strip HTML from notification body', () => {
    const input = '<img src=x onerror=alert(1)>Compre agora'
    expect(sanitizeNotificationText(input)).toBe('Compre agora')
  })

  it('should preserve safe characters', () => {
    const input = 'Tênis Nike Air Max 90 — R$599,90 (50% OFF!)'
    expect(sanitizeNotificationText(input)).toBe(input)
  })

  it('should handle emoji correctly', () => {
    const input = 'Promoção imperdível! 🔥🛒'
    expect(sanitizeNotificationText(input)).toBe(input)
  })
})
```

---

## 6. Stripe Webhook Tests

### 6.1 Subscription Lifecycle

```typescript
describe('StripeWebhookHandler', () => {
  const makeSut = () => {
    const tenantRepo = new TenantRepositorySpy()
    const automationRepo = new AutomationConfigRepositorySpy()
    const auditLog = new AuditLogSpy()
    const sut = new StripeWebhookHandler(tenantRepo, automationRepo, auditLog)

    return { sut, tenantRepo, automationRepo, auditLog }
  }

  describe('invoice.payment_succeeded', () => {
    it('should activate tenant and reset notification counters', async () => {
      // Given: tenant com pagamento pendente
      const { sut, tenantRepo } = makeSut()
      tenantRepo.seedTenant({ id: 'tenant-1', stripeCustomerId: 'cus_123', isActive: false, notificationCountCurrentPeriod: 42 })

      // When: webhook invoice.payment_succeeded recebido
      await sut.handle('invoice.payment_succeeded', {
        customer: 'cus_123',
        subscription: 'sub_456',
      })

      // Then: tenant ativado e contadores resetados
      const tenant = tenantRepo.findByStripeCustomerId('cus_123')
      expect(tenant.isActive).toBe(true)
      expect(tenant.notificationCountCurrentPeriod).toBe(0)
    })
  })

  describe('invoice.payment_failed', () => {
    it('should alert tenant and set 3-day grace period', async () => {
      // Given: tenant ativo
      const { sut, tenantRepo, auditLog } = makeSut()
      tenantRepo.seedTenant({ id: 'tenant-1', stripeCustomerId: 'cus_123', isActive: true })

      // When: webhook invoice.payment_failed recebido
      await sut.handle('invoice.payment_failed', {
        customer: 'cus_123',
        subscription: 'sub_456',
      })

      // Then: tenant permanece ativo com grace period
      const tenant = tenantRepo.findByStripeCustomerId('cus_123')
      expect(tenant.isActive).toBe(true)
      expect(tenant.gracePeriodEndsAt).toBeDefined()

      const gracePeriodDays = Math.round(
        (tenant.gracePeriodEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      expect(gracePeriodDays).toBe(3)

      // Then: audit log registrado
      expect(auditLog.entries).toContainEqual(
        expect.objectContaining({ action: 'payment_failed', resource: 'tenant-1' })
      )
    })
  })

  describe('customer.subscription.deleted', () => {
    it('should deactivate tenant and pause all automations', async () => {
      // Given: tenant ativo com automações habilitadas
      const { sut, tenantRepo, automationRepo } = makeSut()
      tenantRepo.seedTenant({ id: 'tenant-1', stripeCustomerId: 'cus_123', isActive: true })
      automationRepo.seedConfigs('tenant-1', [
        { flowType: 'cart_abandoned', isEnabled: true },
        { flowType: 'welcome', isEnabled: true },
      ])

      // When: webhook customer.subscription.deleted recebido
      await sut.handle('customer.subscription.deleted', {
        customer: 'cus_123',
        id: 'sub_456',
      })

      // Then: tenant desativado
      const tenant = tenantRepo.findByStripeCustomerId('cus_123')
      expect(tenant.isActive).toBe(false)

      // Then: todas as automações pausadas
      const configs = automationRepo.findAllByTenant('tenant-1')
      configs.forEach((config) => {
        expect(config.isEnabled).toBe(false)
      })
    })
  })

  describe('customer.subscription.updated', () => {
    it('should apply upgrade limits immediately', async () => {
      // Given: tenant no plano Starter (limite 15)
      const { sut, tenantRepo } = makeSut()
      tenantRepo.seedTenant({
        id: 'tenant-1', stripeCustomerId: 'cus_123',
        notificationLimit: 15, planId: 'plan-starter',
      })

      // When: upgrade para Business (ilimitado)
      await sut.handle('customer.subscription.updated', {
        customer: 'cus_123',
        id: 'sub_456',
        items: { data: [{ price: { id: 'price_business' } }] },
        previous_attributes: { items: { data: [{ price: { id: 'price_starter' } }] } },
      })

      // Then: limite ampliado imediatamente
      const tenant = tenantRepo.findByStripeCustomerId('cus_123')
      expect(tenant.notificationLimit).toBeNull() // null = ilimitado
    })

    it('should apply downgrade limits only at next billing cycle', async () => {
      // Given: tenant no plano Business (ilimitado)
      const { sut, tenantRepo } = makeSut()
      tenantRepo.seedTenant({
        id: 'tenant-1', stripeCustomerId: 'cus_123',
        notificationLimit: null, planId: 'plan-business',
      })

      // When: downgrade para Starter (limite 15)
      await sut.handle('customer.subscription.updated', {
        customer: 'cus_123',
        id: 'sub_456',
        items: { data: [{ price: { id: 'price_starter' } }] },
        previous_attributes: { items: { data: [{ price: { id: 'price_business' } }] } },
      })

      // Then: limite NÃO muda agora (mantém ilimitado até próximo ciclo)
      const tenant = tenantRepo.findByStripeCustomerId('cus_123')
      expect(tenant.notificationLimit).toBeNull()
      expect(tenant.pendingPlanChange).toEqual({
        planId: 'plan-starter',
        notificationLimit: 15,
        effectiveAt: expect.any(Date),
      })
    })
  })
})
```

### 6.2 Webhook Security

```typescript
describe('Stripe Webhook Security', () => {
  const makeSut = () => {
    const sut = new StripeWebhookVerifier('whsec_test_secret')
    return { sut }
  }

  it('should reject webhook with invalid Stripe-Signature header', async () => {
    const { sut } = makeSut()
    const payload = JSON.stringify({ type: 'invoice.payment_succeeded' })

    // When: assinatura inválida
    const result = sut.verify(payload, 'invalid-signature')

    // Then: rejeitado
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Invalid signature')
  })

  it('should accept webhook with valid Stripe-Signature header', async () => {
    const { sut } = makeSut()
    const payload = JSON.stringify({ type: 'invoice.payment_succeeded' })
    const validSignature = createValidStripeSignature(payload, 'whsec_test_secret')

    // When: assinatura válida
    const result = sut.verify(payload, validSignature)

    // Then: aceito
    expect(result.valid).toBe(true)
  })

  it('should reject webhook with timestamp older than 5 minutes (replay protection)', async () => {
    const { sut } = makeSut()
    const payload = JSON.stringify({ type: 'invoice.payment_succeeded' })
    const oldTimestamp = Math.floor(Date.now() / 1000) - 301 // 5min + 1s atrás
    const signature = createValidStripeSignature(payload, 'whsec_test_secret', oldTimestamp)

    // When: evento com timestamp antigo
    const result = sut.verify(payload, signature)

    // Then: rejeitado por replay
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Timestamp too old')
  })
})
```

### 6.3 Webhook Idempotency

```typescript
describe('Stripe Webhook Idempotency', () => {
  const makeSut = () => {
    const tenantRepo = new TenantRepositorySpy()
    const idempotencyStore = new IdempotencyStoreSpy()
    const sut = new StripeWebhookHandler(tenantRepo, undefined, undefined, idempotencyStore)

    return { sut, tenantRepo, idempotencyStore }
  }

  it('should process same event only once (idempotent)', async () => {
    // Given: tenant válido
    const { sut, tenantRepo, idempotencyStore } = makeSut()
    tenantRepo.seedTenant({ id: 'tenant-1', stripeCustomerId: 'cus_123', notificationCountCurrentPeriod: 10 })

    const event = {
      id: 'evt_unique_123',
      type: 'invoice.payment_succeeded',
      data: { object: { customer: 'cus_123', subscription: 'sub_456' } },
    }

    // When: mesmo evento processado 2x
    await sut.handleEvent(event)
    await sut.handleEvent(event)

    // Then: contador resetado apenas 1x (não duplo reset)
    expect(idempotencyStore.processedCount('evt_unique_123')).toBe(1)
    expect(tenantRepo.updateCallsCount).toBe(1)
  })

  it('should allow different events to be processed independently', async () => {
    const { sut, idempotencyStore } = makeSut()

    const event1 = { id: 'evt_1', type: 'invoice.payment_succeeded', data: { object: { customer: 'cus_123' } } }
    const event2 = { id: 'evt_2', type: 'invoice.payment_succeeded', data: { object: { customer: 'cus_456' } } }

    await sut.handleEvent(event1)
    await sut.handleEvent(event2)

    expect(idempotencyStore.processedCount('evt_1')).toBe(1)
    expect(idempotencyStore.processedCount('evt_2')).toBe(1)
  })
})
```

---

## 7. Frequency Capping Tests

```typescript
describe('FrequencyCappingService', () => {
  const makeSut = (overrides?: Partial<FrequencyCappingDeps>) => {
    const pushCountRepo = overrides?.pushCountRepo ?? new PushCountRepositorySpy()
    const planRepo = overrides?.planRepo ?? new PlanRepositorySpy()
    const sut = new FrequencyCappingService(pushCountRepo, planRepo)

    return { sut, pushCountRepo, planRepo }
  }

  beforeAll(() => { vi.useFakeTimers() })
  afterAll(() => { vi.useRealTimers() })

  describe('Daily Limit', () => {
    it('should block 4th push when user daily limit is 3', async () => {
      // Given: app_user já recebeu 3 pushes hoje
      const { sut, pushCountRepo } = makeSut()
      pushCountRepo.setDailyCount('app-user-1', 3)

      // When: tentativa de enviar 4o push
      const result = await sut.canSend('app-user-1', 'tenant-1')

      // Then: bloqueado
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('daily_limit_exceeded')
    })

    it('should allow push when user is within daily limit', async () => {
      // Given: app_user recebeu 2 pushes hoje, limite é 3
      const { sut, pushCountRepo, planRepo } = makeSut()
      pushCountRepo.setDailyCount('app-user-1', 2)
      planRepo.setLimit('tenant-1', { dailyPushPerUser: 3 })

      // When: tentativa de enviar push
      const result = await sut.canSend('app-user-1', 'tenant-1')

      // Then: permitido
      expect(result.allowed).toBe(true)
    })

    it('should reset daily counter at midnight UTC', async () => {
      // Given: app_user no limite (3/3) antes da meia-noite
      const { sut, pushCountRepo, planRepo } = makeSut()
      planRepo.setLimit('tenant-1', { dailyPushPerUser: 3 })
      pushCountRepo.setDailyCount('app-user-1', 3)

      vi.setSystemTime(new Date('2026-03-10T23:59:59Z'))
      const beforeMidnight = await sut.canSend('app-user-1', 'tenant-1')
      expect(beforeMidnight.allowed).toBe(false)

      // When: meia-noite UTC
      vi.setSystemTime(new Date('2026-03-11T00:00:00Z'))
      pushCountRepo.resetDailyCounters() // simula cron job de reset

      // Then: contador resetado, push permitido
      const afterMidnight = await sut.canSend('app-user-1', 'tenant-1')
      expect(afterMidnight.allowed).toBe(true)
    })
  })

  describe('Plan-Based Limits', () => {
    it('should enforce Starter limit: 2 pushes/day per user', async () => {
      const { sut, pushCountRepo, planRepo } = makeSut()
      planRepo.setLimit('tenant-starter', { dailyPushPerUser: 2, planName: 'starter' })
      pushCountRepo.setDailyCount('app-user-1', 2)

      const result = await sut.canSend('app-user-1', 'tenant-starter')

      expect(result.allowed).toBe(false)
    })

    it('should enforce Business limit: 4 pushes/day per user', async () => {
      const { sut, pushCountRepo, planRepo } = makeSut()
      planRepo.setLimit('tenant-business', { dailyPushPerUser: 4, planName: 'business' })
      pushCountRepo.setDailyCount('app-user-1', 3)

      const result = await sut.canSend('app-user-1', 'tenant-business')

      expect(result.allowed).toBe(true)
    })

    it('should allow unlimited pushes for Elite plan', async () => {
      const { sut, pushCountRepo, planRepo } = makeSut()
      planRepo.setLimit('tenant-elite', { dailyPushPerUser: null, planName: 'elite' }) // null = ilimitado
      pushCountRepo.setDailyCount('app-user-1', 100)

      const result = await sut.canSend('app-user-1', 'tenant-elite')

      expect(result.allowed).toBe(true)
    })
  })

  describe('Flow Type Capping', () => {
    it('should allow max 1 cart_abandoned push per session', async () => {
      // Given: app_user já recebeu 1 cart_abandoned nesta sessão
      const { sut, pushCountRepo } = makeSut()
      pushCountRepo.setFlowCount('app-user-1', 'cart_abandoned', 1)

      // When: tentativa de enviar outro cart_abandoned
      const result = await sut.canSendFlow('app-user-1', 'tenant-1', 'cart_abandoned')

      // Then: bloqueado (max 1 por sessão)
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('flow_type_limit_exceeded')
    })

    it('should allow different flow types independently', async () => {
      // Given: app_user já recebeu 1 cart_abandoned
      const { sut, pushCountRepo } = makeSut()
      pushCountRepo.setFlowCount('app-user-1', 'cart_abandoned', 1)

      // When: tentativa de enviar welcome (flow diferente)
      const result = await sut.canSendFlow('app-user-1', 'tenant-1', 'welcome')

      // Then: permitido
      expect(result.allowed).toBe(true)
    })
  })

  describe('Admin Override', () => {
    it('should allow admin to override frequency capping for manual campaigns', async () => {
      // Given: app_user no limite diário
      const { sut, pushCountRepo, planRepo } = makeSut()
      planRepo.setLimit('tenant-1', { dailyPushPerUser: 3 })
      pushCountRepo.setDailyCount('app-user-1', 3)

      // When: admin envia campanha manual com override
      const result = await sut.canSend('app-user-1', 'tenant-1', { adminOverride: true })

      // Then: permitido apesar do limite
      expect(result.allowed).toBe(true)
    })

    it('should NOT allow admin override for automated flows', async () => {
      // Given: app_user no limite diário
      const { sut, pushCountRepo, planRepo } = makeSut()
      planRepo.setLimit('tenant-1', { dailyPushPerUser: 3 })
      pushCountRepo.setDailyCount('app-user-1', 3)

      // When: tentativa de override em flow automático
      const result = await sut.canSendFlow('app-user-1', 'tenant-1', 'cart_abandoned', { adminOverride: true })

      // Then: bloqueado (override só para manuais)
      expect(result.allowed).toBe(false)
    })
  })

  describe('Counter Scope', () => {
    it('should track frequency per app_user, NOT per device', async () => {
      // Given: app_user com 2 devices, já recebeu 3 pushes (contagem no app_user)
      const { sut, pushCountRepo, planRepo } = makeSut()
      planRepo.setLimit('tenant-1', { dailyPushPerUser: 3 })
      pushCountRepo.setDailyCount('app-user-1', 3)

      // When: tentativa de enviar para device-2 do mesmo app_user
      const result = await sut.canSend('app-user-1', 'tenant-1')

      // Then: bloqueado (limite é por app_user, não por device)
      expect(result.allowed).toBe(false)
    })

    it('should allow push to different app_user on same tenant', async () => {
      // Given: app-user-1 no limite, app-user-2 sem pushes
      const { sut, pushCountRepo, planRepo } = makeSut()
      planRepo.setLimit('tenant-1', { dailyPushPerUser: 3 })
      pushCountRepo.setDailyCount('app-user-1', 3)
      pushCountRepo.setDailyCount('app-user-2', 0)

      // When: enviar para app-user-2
      const result = await sut.canSend('app-user-2', 'tenant-1')

      // Then: permitido (contadores independentes por app_user)
      expect(result.allowed).toBe(true)
    })
  })
})
```

---

## 8. Push Opt-Out / LGPD Tests

```typescript
describe('Push Opt-Out & LGPD Compliance', () => {
  const makeSut = () => {
    const appUserRepo = new AppUserRepositorySpy()
    const deliveryRepo = new DeliveryRepositorySpy()
    const auditLog = new AuditLogSpy()
    const pushService = new PushProviderSpy()
    const sut = new PushOptOutService(appUserRepo, deliveryRepo, auditLog, pushService)

    return { sut, appUserRepo, deliveryRepo, auditLog, pushService }
  }

  describe('Opt-Out Enforcement', () => {
    it('should NOT send push to app_user with push_opt_in = false', async () => {
      // Given: app_user com opt-out
      const { sut, appUserRepo, pushService } = makeSut()
      appUserRepo.seedUser({ id: 'user-1', tenantId: 'tenant-1', pushOptIn: false })

      // When: tentativa de enviar push
      const result = await sut.canSendPush('user-1', 'tenant-1')

      // Then: push bloqueado
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('user_opted_out')
      expect(pushService.sendCallsCount).toBe(0)
    })

    it('should send push to app_user with push_opt_in = true', async () => {
      // Given: app_user com opt-in
      const { sut, appUserRepo } = makeSut()
      appUserRepo.seedUser({ id: 'user-1', tenantId: 'tenant-1', pushOptIn: true })

      // When: verificar se pode enviar push
      const result = await sut.canSendPush('user-1', 'tenant-1')

      // Then: permitido
      expect(result.allowed).toBe(true)
    })
  })

  describe('Opt-Out Flow', () => {
    it('should update status and block future notifications on opt-out', async () => {
      // Given: app_user com opt-in ativo
      const { sut, appUserRepo, auditLog } = makeSut()
      appUserRepo.seedUser({ id: 'user-1', tenantId: 'tenant-1', pushOptIn: true })

      // When: app_user faz opt-out
      await sut.optOut('user-1', 'tenant-1')

      // Then: status atualizado
      const user = appUserRepo.findById('tenant-1', 'user-1')
      expect(user.pushOptIn).toBe(false)

      // Then: futuras notificações bloqueadas
      const canSend = await sut.canSendPush('user-1', 'tenant-1')
      expect(canSend.allowed).toBe(false)
    })

    it('should resume notifications on opt-in after previous opt-out', async () => {
      // Given: app_user que fez opt-out previamente
      const { sut, appUserRepo } = makeSut()
      appUserRepo.seedUser({ id: 'user-1', tenantId: 'tenant-1', pushOptIn: false })

      // When: app_user faz opt-in novamente
      await sut.optIn('user-1', 'tenant-1')

      // Then: status atualizado e notificações retomam
      const user = appUserRepo.findById('tenant-1', 'user-1')
      expect(user.pushOptIn).toBe(true)

      const canSend = await sut.canSendPush('user-1', 'tenant-1')
      expect(canSend.allowed).toBe(true)
    })
  })

  describe('Audit Trail', () => {
    it('should log opt-out change in audit log', async () => {
      const { sut, appUserRepo, auditLog } = makeSut()
      appUserRepo.seedUser({ id: 'user-1', tenantId: 'tenant-1', pushOptIn: true })

      await sut.optOut('user-1', 'tenant-1')

      expect(auditLog.entries).toContainEqual(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'push_opt_out',
          resource: 'app_user',
          details: expect.objectContaining({ appUserId: 'user-1', previousValue: true, newValue: false }),
        })
      )
    })

    it('should log opt-in change in audit log', async () => {
      const { sut, appUserRepo, auditLog } = makeSut()
      appUserRepo.seedUser({ id: 'user-1', tenantId: 'tenant-1', pushOptIn: false })

      await sut.optIn('user-1', 'tenant-1')

      expect(auditLog.entries).toContainEqual(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'push_opt_in',
          resource: 'app_user',
          details: expect.objectContaining({ appUserId: 'user-1', previousValue: false, newValue: true }),
        })
      )
    })
  })

  describe('LGPD Data Exclusion', () => {
    it('should delete all app_user data on LGPD exclusion request', async () => {
      // Given: app_user com dados completos
      const { sut, appUserRepo } = makeSut()
      appUserRepo.seedUser({
        id: 'user-1', tenantId: 'tenant-1', pushOptIn: true,
        email: 'user@example.com', name: 'João Silva',
      })

      // When: endpoint de exclusão LGPD chamado
      await sut.deleteUserData('user-1', 'tenant-1')

      // Then: dados do app_user deletados
      const user = appUserRepo.findById('tenant-1', 'user-1')
      expect(user).toBeNull()
    })

    it('should anonymize deliveries instead of deleting (preserve metrics)', async () => {
      // Given: app_user com deliveries registradas
      const { sut, appUserRepo, deliveryRepo } = makeSut()
      appUserRepo.seedUser({ id: 'user-1', tenantId: 'tenant-1' })
      deliveryRepo.seedDeliveries('tenant-1', [
        { id: 'del-1', appUserId: 'user-1', status: 'delivered' },
        { id: 'del-2', appUserId: 'user-1', status: 'opened' },
      ])

      // When: exclusão LGPD
      await sut.deleteUserData('user-1', 'tenant-1')

      // Then: deliveries anonimizadas (app_user_id = null), NÃO deletadas
      const deliveries = deliveryRepo.findByTenant('tenant-1')
      expect(deliveries).toHaveLength(2)
      deliveries.forEach((d) => {
        expect(d.appUserId).toBeNull()
      })

      // Then: métricas preservadas (status intacto)
      expect(deliveries[0].status).toBe('delivered')
      expect(deliveries[1].status).toBe('opened')
    })

    it('should log LGPD exclusion in audit log', async () => {
      const { sut, appUserRepo, auditLog } = makeSut()
      appUserRepo.seedUser({ id: 'user-1', tenantId: 'tenant-1', email: 'user@example.com' })

      await sut.deleteUserData('user-1', 'tenant-1')

      expect(auditLog.entries).toContainEqual(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'lgpd_data_exclusion',
          resource: 'app_user',
          details: expect.objectContaining({
            appUserId: 'user-1',
            deliveriesAnonymized: true,
          }),
        })
      )
    })
  })
})
```

---

## 9. Padrões e Convenções de Teste

### AAA Pattern (Arrange, Act, Assert)

```typescript
it('should create notification for tenant', async () => {
  // Arrange
  const { sut, notificationRepo } = makeSut()
  const input = { title: 'Promoção', body: '50% off', type: 'manual' as const }

  // Act
  const result = await sut.create('tenant-1', input)

  // Assert
  expect(result.id).toBeDefined()
  expect(result.status).toBe('draft')
  expect(notificationRepo.callsCount).toBe(1)
})
```

### SUT Convention

```typescript
// ✅ Correto: variável principal = sut
const { sut, notificationRepo } = makeSut()
await sut.perform({ tenantId: 'tenant-1' })

// ❌ Errado: nome genérico
const service = new NotificationService(repo)
await service.perform({ tenantId: 'tenant-1' })
```

### makeSut Factory

```typescript
// Centralizado — muda construtor em 1 lugar
function makeSut(overrides?: Partial<SutDeps>) {
  const notificationRepo = overrides?.notificationRepo ?? new NotificationRepositorySpy()
  const pushService = overrides?.pushService ?? new PushProviderSpy()
  const configRepo = overrides?.configRepo ?? new AutomationConfigRepositorySpy()

  const sut = new SendNotificationUseCase(notificationRepo, pushService, configRepo)

  return { sut, notificationRepo, pushService, configRepo }
}
```

### Test Doubles: Quando Usar Cada

| Tipo | Quando | Exemplo no AppFy |
|---|---|---|
| **Spy** | Verificar chamadas + controlar retorno | NotificationRepositorySpy (input + output) |
| **Stub** | Só controlar retorno, sem verificar chamada | AutomationConfigStub (retorna config fixa) |
| **Mock** | Verificar que método FOI chamado com params | AuditLogMock (verificar que log foi criado) |
| **Fake** | Implementação simplificada funcional | InMemoryNotificationRepo (Map<string, Notification>) |

### Boundary Testing

```typescript
// SEMPRE testar nos limites exatos
describe('Plan Limit', () => {
  it('should allow at limit - 1', () => { /* count: 14, limit: 15 → OK */ })
  it('should allow at exactly limit', () => { /* count: 15, limit: 15 → OK (automáticos não contam) */ })
  it('should block at limit + 1 for manual', () => { /* count: 16, limit: 15 → BLOCK */ })
  it('should allow automated even over limit', () => { /* count: 20, limit: 15, type: automated → OK */ })
})
```

---

## 10. Estratégia de Regressão

### Ao Modificar Código Existente

1. **Antes de mudar:** rodar `vitest run` — todos os testes devem passar
2. **Escrever teste que reproduz o cenário:** se é bug fix, teste que falha sem o fix
3. **Implementar a mudança:** fazer o novo teste passar SEM quebrar existentes
4. **Boundary check:** adicionar testes nos limites se a mudança envolve comparações
5. **Rodar suite completa:** `vitest run` — zero falhas

### Platform Adapter Changes

Quando Shopify ou Nuvemshop mudar API:
1. Atualizar fixtures de webhook (`shopifyWebhookFixtures`)
2. Rodar contract tests (`platformAdapterContractTest`)
3. Se contrato quebrou → adapter precisa de nova versão
4. Manter adapter antigo até migrar todos os tenants

### Retention Job

```typescript
describe('Retention Job Regression', () => {
  it('should NOT delete deliveries newer than 180 days', async () => {
    const recent = await createDelivery({ createdAt: daysAgo(10) })
    await runRetentionJob()
    expect(await getDelivery(recent.id)).toBeDefined()
  })

  it('should delete deliveries older than 180 days', async () => {
    const old = await createDelivery({ createdAt: daysAgo(181) })
    await runRetentionJob()
    expect(await getDelivery(old.id)).toBeNull()
  })

  it('should only delete for the correct tenant', async () => {
    const oldA = await createDelivery({ tenantId: 'a', createdAt: daysAgo(200) })
    const oldB = await createDelivery({ tenantId: 'b', createdAt: daysAgo(200) })

    await runRetentionJob('a') // só tenant A

    expect(await getDelivery(oldA.id)).toBeNull()
    expect(await getDelivery(oldB.id)).toBeDefined() // tenant B intacto
  })
})
```

---

## 11. Gestão de Dados de Teste

### Builders (Pattern Fluent)

```typescript
// packages/api/test/helpers/builders.ts
class NotificationBuilder {
  private data: Partial<Notification> = {
    id: randomUUID(),
    tenantId: 'default-tenant',
    title: 'Default Title',
    body: 'Default Body',
    type: 'manual',
    status: 'draft',
    createdAt: new Date(),
  }

  withTenant(tenantId: string) { this.data.tenantId = tenantId; return this }
  withTitle(title: string) { this.data.title = title; return this }
  withStatus(status: string) { this.data.status = status; return this }
  withType(type: 'manual' | 'automated') { this.data.type = type; return this }
  scheduled(at: Date) { this.data.scheduledAt = at; this.data.status = 'scheduled'; return this }

  build(): Notification { return this.data as Notification }

  async persist(db: DrizzleClient): Promise<Notification> {
    const [result] = await db.insert(notifications).values(this.data).returning()
    return result
  }
}

// Uso:
const notif = new NotificationBuilder()
  .withTenant('tenant-1')
  .withTitle('Promoção Especial')
  .withStatus('approved')
  .build()
```

### Seed Functions

```typescript
// packages/api/test/helpers/seed.ts
export async function seedTestTenants(db: DrizzleClient) {
  const tenantA = await db.insert(tenants).values({
    id: 'tenant-aaa', name: 'Loja A', slug: 'loja-a',
    platform: 'shopify', isActive: true,
  }).returning()

  const tenantB = await db.insert(tenants).values({
    id: 'tenant-bbb', name: 'Loja B', slug: 'loja-b',
    platform: 'nuvemshop', isActive: true,
  }).returning()

  const tenantC = await db.insert(tenants).values({
    id: 'tenant-ccc', name: 'Loja Vazia', slug: 'loja-vazia',
    platform: 'shopify', isActive: true,
  }).returning()
  // Tenant C propositalmente sem dados — testa edge cases de estado vazio

  return { tenantA: tenantA[0], tenantB: tenantB[0], tenantC: tenantC[0] }
}

export async function seedFullData(db: DrizzleClient, tenantId: string) {
  // Users
  const appUser = await db.insert(appUsers).values({
    tenantId, userIdExternal: 'shopify-customer-123',
    pushOptIn: true, totalPurchases: 5, totalSpent: 1500,
  }).returning()

  // Devices
  await db.insert(devices).values({
    tenantId, appUserId: appUser[0].id,
    deviceToken: 'player-id-123', platform: 'android', isActive: true,
  })

  // Notifications
  await db.insert(notifications).values({
    tenantId, title: 'Push Test', body: 'Body test',
    type: 'manual', status: 'sent',
  })

  // Automation configs (defaults para todos os 9 flows)
  const flowTypes = [
    'cart_abandoned', 'pix_recovery', 'boleto_recovery', 'welcome',
    'checkout_abandoned', 'order_confirmed', 'tracking_created',
    'browse_abandoned', 'upsell',
  ]
  for (const flowType of flowTypes) {
    await db.insert(automationConfigs).values({
      tenantId, flowType, isEnabled: true, delaySeconds: 3600,
      templateTitle: `Default {{store_name}}`,
      templateBody: `Default body for ${flowType}`,
    })
  }
}
```

### Cleanup: Transaction Rollback

```typescript
// Para testes de integração: cada teste roda em transação que faz rollback
export function withTransaction(db: DrizzleClient) {
  let tx: Transaction

  beforeEach(async () => {
    tx = await db.transaction()
  })

  afterEach(async () => {
    await tx.rollback()
  })

  return () => tx // getter para usar nos testes
}
```
