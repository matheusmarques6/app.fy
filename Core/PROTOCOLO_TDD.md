# Protocolo TDD — AppFy Mobile Revenue Engine

## Filosofia

```
O teste é a especificação. O código é a implementação.

Não escrevemos testes para validar código.
Escrevemos testes para DEFINIR o que o código deve fazer.
Depois escrevemos o mínimo de código para satisfazer a definição.

Se você não sabe escrever o teste, você não entendeu o requisito.
```

---

## 1. Ciclo Fundamental: Red → Green → Refactor

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│   ┌───────┐     ┌───────┐     ┌──────────┐              │
│   │  RED  │ ──→ │ GREEN │ ──→ │ REFACTOR │ ──→ repeat  │
│   └───────┘     └───────┘     └──────────┘              │
│                                                          │
│   RED:      Escrever teste que FALHA                     │
│             (prova que o comportamento não existe)        │
│                                                          │
│   GREEN:    Escrever o MÍNIMO de código para passar      │
│             (sem otimizar, sem abstrair, sem "melhorar")  │
│                                                          │
│   REFACTOR: Limpar o código SEM mudar comportamento      │
│             (extrair, renomear, simplificar)              │
│             Testes continuam verdes.                      │
│                                                          │
└─────────────────────────────────────────────────────────┘

Tempo por ciclo: 5-15 minutos.
Se passou de 15 min sem verde → o passo é grande demais. Quebre menor.
```

### Regras Invioláveis

```
1. NUNCA escrever código de produção sem teste falhando primeiro
2. NUNCA escrever mais teste do que o necessário para falhar
   (1 assertion por vez — não 10 cenários de uma vez)
3. NUNCA escrever mais código do que o necessário para passar
   (hardcode se for preciso — refactor depois)
4. NUNCA refatorar com teste falhando
   (verde é pré-requisito para refactor)
5. NUNCA pular o refactor
   (código feio que passa é dívida técnica imediata)
6. Commits frequentes: 1 commit por ciclo GREEN
   (se quebrar, volta 1 commit, não 30 minutos de trabalho)
```

---

## 2. Ordem de Desenvolvimento por Feature

### 2.1 — Fluxo Completo (Outside-In TDD)

```
Para cada feature nova, a ordem é SEMPRE:

1. CONTRATO    → Definir interface/tipo (o que entra, o que sai)
2. TESTE E2E   → Escrever 1 teste de integração que falha (o fluxo completo)
3. CAMADA MAIS EXTERNA → TDD da rota/controller
4. CAMADA DO MEIO      → TDD do service
5. CAMADA MAIS INTERNA → TDD do repository
6. VERDE NO E2E        → Quando tudo conectar, o teste de integração passa
7. REFACTOR            → Limpar tudo com confiança (testes são a rede)

Isso é "Outside-In" ou "London School" TDD.
Começamos pelo que o usuário vê, descemos até o banco.
```

### 2.2 — Exemplo Concreto: "Listar notificações de um tenant"

```
Passo 1: CONTRATO
─────────────────
// packages/shared/types/notification.ts
interface Notification {
  id: string
  tenantId: string
  title: string
  body: string
  status: 'draft' | 'approved' | 'scheduled' | 'sending' | 'sent' | 'failed'
  createdAt: Date
}

interface ListNotificationsInput {
  tenantId: string
  page: number
  limit: number
  status?: Notification['status']
}

interface ListNotificationsOutput {
  data: Notification[]
  total: number
  page: number
  totalPages: number
}


Passo 2: TESTE DE INTEGRAÇÃO (Red)
───────────────────────────────────
// packages/api/routes/notifications.integration.spec.ts
describe('GET /api/notifications', () => {
  it('retorna notificações paginadas do tenant autenticado', async () => {
    // Arrange
    const { tenantA, tenantB } = await createIsolationPair()
    await seedNotifications(tenantA.id, 25)
    await seedNotifications(tenantB.id, 10)
    const token = await loginAsTenant(tenantA.id)

    // Act
    const res = await app.request('/api/notifications?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-Id': tenantA.id,
      },
    })
    const body = await res.json()

    // Assert
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(10)
    expect(body.total).toBe(25)
    expect(body.totalPages).toBe(3)
    // ISOLAMENTO: nenhuma notificação de tenantB
    body.data.forEach(n => {
      expect(n.tenantId).toBe(tenantA.id)
    })
  })
})
// ❌ FALHA — rota não existe ainda. Perfeito.


Passo 3: TDD DA ROTA (Red → Green → Refactor)
───────────────────────────────────────────────
// packages/api/routes/notifications.spec.ts
describe('notificationsRouter', () => {
  it('chama service com params corretos e retorna resultado', async () => {
    // Red: teste falha porque a rota não existe
    const mockService = { list: vi.fn().mockResolvedValue({ data: [], total: 0 }) }
    const app = createNotificationsRouter(mockService)

    const res = await app.request('/?page=1&limit=10', {
      headers: { 'X-Tenant-Id': 'tenant-123' },
    })
    const body = await res.json()

    expect(mockService.list).toHaveBeenCalledWith({
      tenantId: 'tenant-123',
      page: 1,
      limit: 10,
    })
    expect(res.status).toBe(200)
  })
})

// Green: implementar o MÍNIMO
// notifications.router.ts
app.get('/', async (c) => {
  const result = await service.list({
    tenantId: c.req.header('X-Tenant-Id'),
    page: Number(c.req.query('page')),
    limit: Number(c.req.query('limit')),
  })
  return c.json(result)
})

// Refactor: extrair validação, adicionar error handling
// Testes continuam verdes.


Passo 4: TDD DO SERVICE (Red → Green → Refactor)
─────────────────────────────────────────────────
// packages/api/services/notification.service.spec.ts
describe('NotificationService.list', () => {
  it('delega para repository com tenant_id obrigatório', async () => {
    const mockRepo = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    }
    const service = new NotificationService(mockRepo)

    await service.list({ tenantId: 'tenant-123', page: 1, limit: 10 })

    expect(mockRepo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-123' })
    )
  })

  it('calcula paginação corretamente', async () => {
    const mockRepo = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(25),
    }
    const service = new NotificationService(mockRepo)

    const result = await service.list({ tenantId: 't', page: 2, limit: 10 })

    expect(result.page).toBe(2)
    expect(result.totalPages).toBe(3)
    expect(result.total).toBe(25)
  })

  it('rejeita se tenantId não fornecido', async () => {
    const service = new NotificationService({})

    await expect(
      service.list({ tenantId: '', page: 1, limit: 10 })
    ).rejects.toThrow('tenantId is required')
  })
})

// Green → Refactor → próxima camada


Passo 5: TDD DO REPOSITORY (Red → Green → Refactor)
────────────────────────────────────────────────────
// packages/db/repositories/notification.repository.spec.ts
describe('NotificationRepository', () => {
  it('SEMPRE filtra por tenantId', async () => {
    const { tenantA, tenantB } = await createIsolationPair()
    await seedNotifications(tenantA.id, 5)
    await seedNotifications(tenantB.id, 3)

    const repo = new NotificationRepository(db)
    const results = await repo.findMany(tenantA.id, { page: 1, limit: 100 })

    expect(results).toHaveLength(5)
    results.forEach(n => expect(n.tenantId).toBe(tenantA.id))
  })

  it('NUNCA retorna dados de outro tenant', async () => {
    // Este teste é REDUNDANTE de propósito.
    // Isolamento multi-tenant é testado de múltiplos ângulos.
    const { tenantA, tenantB } = await createIsolationPair()
    await seedNotifications(tenantB.id, 10)

    const repo = new NotificationRepository(db)
    const results = await repo.findMany(tenantA.id, { page: 1, limit: 100 })

    expect(results).toHaveLength(0) // TenantA não tem dados
  })
})


Passo 6: VERDE NO INTEGRAÇÃO
─────────────────────────────
Ao conectar router → service → repository → DB:
O teste de integração do Passo 2 agora PASSA. ✅

Se não passar → algo não conectou → debugar a costura, não a lógica.
A lógica já está provada pelos unit tests.


Passo 7: REFACTOR FINAL
────────────────────────
Com tudo verde:
- Extrair constantes (page size default, etc.)
- Renomear variáveis para clareza
- Remover duplicação entre testes (helpers)
- Testes continuam verdes após cada mudança
```

---

## 3. TDD por Camada do Projeto

### 3.1 — packages/api (Rotas + Services)

```
Padrão por rota:

test: "retorna 401 sem token"
test: "retorna 403 com tenant errado"
test: "retorna 400 com input inválido"
test: "retorna 200 com dados corretos"
test: "retorna 404 para recurso inexistente"
test: "isolamento: não acessa dados de outro tenant"

Nessa ordem. Comece pelos erros, termine pelo happy path.
Erros são mais fáceis de implementar e dão feedback rápido.

Nomenclatura de testes:
  describe('GET /api/notifications')
    it('retorna 401 sem authorization header')
    it('retorna 403 quando tenant_id não pertence ao usuário')
    it('retorna 400 quando page não é número')
    it('retorna 200 com lista paginada de notificações')
    it('retorna array vazio quando não há notificações')
    it('nunca retorna notificações de outro tenant')
```

### 3.2 — packages/notifications (Pipeline + Flows)

```
O pipeline de notificações tem 6 etapas. Cada etapa é um unit test isolado.

Para cada etapa:
  RED:   testar que a etapa transforma input → output corretamente
  GREEN: implementar a transformação
  REFACTOR: simplificar

Etapa 1 — Geração
  test: "template gera notificação com título e corpo via variáveis"
  test: "manual recebe título e corpo do usuário"
  test: "geração inclui tenant context (nome da loja, produtos)"

Etapa 2 — Validação
  test: "rejeita título > X caracteres" (usar push_limits.json)
  test: "rejeita corpo > Y caracteres"
  test: "sanitiza HTML no título e corpo"
  test: "rejeita se tenant excedeu limite do plano (manual)"
  test: "permite automática mesmo se limite atingido"

Etapa 3 — Aprovação
  test: "human-in-the-loop: status muda para 'approved'"
  test: "regra automática: auto-aprova se flow_type configurado"
  test: "rejeição: status muda para 'draft' com motivo"

Etapa 4 — Agendamento
  test: "cria delayed job no BullMQ com scheduled_at"
  test: "job contém: notification_id, tenant_id, batch_tokens"
  test: "agendamento imediato se scheduled_at é null"

Etapa 5 — Envio
  test: "agrupa tokens em batches de N" (resultado Teste 3)
  test: "retry com backoff exponencial em falha temporária"
  test: "move para DLQ após max retries"
  test: "marca device como inativo se token inválido"
  test: "usa credencial OneSignal correta para o tenant"
  test: "NUNCA usa credencial de outro tenant"

Etapa 6 — Tracking
  test: "registra delivery status: sent"
  test: "atualiza status quando OneSignal confirma delivery"
  test: "registra opened_at quando callback recebido"
  test: "registra clicked_at quando deep link ativado"
  test: "registra converted_at quando purchase detectada"

Integração do pipeline:
  test: "notificação percorre todas as 6 etapas"
  test: "falha na etapa 2 impede etapa 3"
  test: "falha na etapa 5 registra em etapa 6 como 'failed'"
```

### 3.3 — packages/integrations (Adapters)

```
Cada adapter (Shopify, Nuvemshop) segue o mesmo padrão de testes.
Interface PlatformAdapter garante que os testes são iguais.

Para CADA método da interface:

describe('ShopifyAdapter')
  describe('getProducts')
    test: "retorna produtos no formato padronizado"
    test: "pagina corretamente com cursor"
    test: "retorna array vazio se loja sem produtos"
    test: "faz retry em 429 (rate limit)"
    test: "lança erro em 401 (token inválido)"
    test: "timeout após 5s sem resposta"

  describe('getAbandonedCarts')
    test: "retorna carrinhos com produtos e valor"
    test: "filtra por período (últimas 24h)"
    test: "ignora carrinhos já convertidos"

  describe('registerWebhooks')
    test: "registra topics corretos"
    test: "usa URL do nosso server"
    test: "não duplica webhook já existente"

  describe('validateWebhook')
    test: "aceita webhook com HMAC válido"
    test: "rejeita webhook com HMAC inválido"
    test: "rejeita webhook sem header HMAC"

Contract test (roda para TODOS os adapters):
  test: "adapter implementa PlatformAdapter completa"
  test: "getProducts retorna Product[] (não formato nativo)"
  test: "getOrders retorna Order[] (não formato nativo)"

Os contract tests garantem que novos adapters (VTEX, WooCommerce)
seguem o mesmo padrão sem quebrar o sistema.
```

### 3.4 — packages/db (Schema + Repositories)

```
describe('Schema')
  test: "migration roda em banco fresh"
  test: "migration roda em banco existente com dados"
  test: "rollback não perde dados (quando reversível)"
  test: "índices existem nas colunas esperadas"
  test: "constraints de FK funcionam"
  test: "enums aceitam apenas valores válidos"

describe('Repository')
  Para CADA repository:
  test: "create insere com tenant_id obrigatório"
  test: "create rejeita sem tenant_id"
  test: "findById retorna apenas se mesmo tenant"
  test: "findById retorna null para id de outro tenant"
  test: "findMany filtra por tenant_id sempre"
  test: "update só atualiza se mesmo tenant"
  test: "update rejeita se tenant diferente"
  test: "delete só remove se mesmo tenant"
  test: "count filtra por tenant_id"

O padrão é repetitivo de propósito.
Multi-tenant isolation é testado em CADA operação de CADA tabela.
Redundância aqui é segurança, não desperdício.
```

### 3.5 — apps/web (Frontend)

```
Frontend TDD é diferente. Menos unit, mais component + integration.

describe('Component: NotificationList')
  test: "renderiza loading state"
  test: "renderiza lista de notificações"
  test: "renderiza empty state quando lista vazia"
  test: "renderiza error state quando API falha"
  test: "paginação funciona: próxima página carrega"
  test: "filtro por status funciona"

describe('Hook: useNotifications')
  test: "faz fetch com tenant_id correto"
  test: "retorna loading true durante fetch"
  test: "retorna data após fetch bem-sucedido"
  test: "retorna error em falha"
  test: "refetch ao mudar filtros"

describe('Page: /dashboard/notifications')
  test: "redireciona para login se não autenticado"
  test: "exibe NotificationList com dados do tenant"
  test: "botão 'Novo' abre formulário"

Framework: Vitest + @testing-library/react + MSW (mock service worker).
MSW intercepta requests de API → retorna dados mockados.
Não precisa de backend rodando para testar frontend.
```

---

## 4. Padrões de Teste

### 4.1 — Arrange-Act-Assert (AAA)

```typescript
// SEMPRE nesta estrutura. Sem exceção.

it('retorna notificações paginadas', async () => {
  // Arrange — preparar dados e dependências
  const tenant = await createTestTenant()
  await seedNotifications(tenant.id, 25)
  const service = new NotificationService(new NotificationRepository(db))

  // Act — executar a ação sendo testada
  const result = await service.list({ tenantId: tenant.id, page: 1, limit: 10 })

  // Assert — verificar resultado
  expect(result.data).toHaveLength(10)
  expect(result.total).toBe(25)
})
```

### 4.2 — Um Conceito por Teste

```typescript
// ❌ ERRADO: testa múltiplos conceitos
it('valida notificação', () => {
  expect(validate({ title: '' })).toThrow('title required')
  expect(validate({ title: 'a'.repeat(200) })).toThrow('title too long')
  expect(validate({ title: 'ok', body: '' })).toThrow('body required')
  expect(validate({ title: 'ok', body: 'ok' })).not.toThrow()
})

// ✅ CORRETO: um conceito por teste
it('rejeita título vazio', () => {
  expect(() => validate({ title: '' })).toThrow('title required')
})

it('rejeita título acima do limite', () => {
  expect(() => validate({ title: 'a'.repeat(200) })).toThrow('title too long')
})

it('rejeita corpo vazio', () => {
  expect(() => validate({ title: 'ok', body: '' })).toThrow('body required')
})

it('aceita notificação válida', () => {
  expect(() => validate({ title: 'ok', body: 'ok' })).not.toThrow()
})
```

### 4.3 — Nomenclatura

```
Formato: "verbo + condição + resultado esperado"

✅ Bons:
  "retorna 401 sem token de autenticação"
  "rejeita título com mais de 50 caracteres"
  "cria job no BullMQ com delay de 1 hora"
  "nunca retorna dados de outro tenant"
  "faz retry 3 vezes antes de mover para DLQ"

❌ Ruins:
  "test notification"
  "should work"
  "handles error"
  "validates input correctly"
```

### 4.4 — Mocks vs Stubs vs Fakes

```
Quando usar cada um:

STUB: retorna valor fixo. Usar para dependências que não são o foco.
  const fakeRepo = { findMany: () => Promise.resolve([]) }

MOCK: verifica que foi chamado corretamente. Usar para verificar interações.
  const mockPush = vi.fn().mockResolvedValue({ success: true })
  // ... código ...
  expect(mockPush).toHaveBeenCalledWith({ appId: '...', notification: {...} })

FAKE: implementação simplificada real. Usar para DB em unit tests.
  class InMemoryNotificationRepository implements NotificationRepository {
    private data: Notification[] = []
    async create(n: Notification) { this.data.push(n); return n }
    async findMany(query) { return this.data.filter(n => n.tenantId === query.tenantId) }
  }

REAL: a dependência real. Usar em integration tests.
  const repo = new NotificationRepository(db) // DB real (test database)

Regra:
  Unit test   → mocks/stubs/fakes (rápido, isolado)
  Integration → real DB, real Redis, mock de APIs externas
  E2E/Smoke   → tudo real
```

### 4.5 — Test Data Builders

```typescript
// packages/db/test/builders.ts

// Builder pattern para criar dados de teste com defaults sensatos.
// Só override o que importa para o teste.

class NotificationBuilder {
  private data: Partial<Notification> = {
    id: randomUUID(),
    title: 'Test notification',
    body: 'Test body',
    status: 'draft',
    type: 'manual',
    createdAt: new Date(),
  }

  withTenant(tenantId: string) {
    this.data.tenantId = tenantId
    return this
  }

  withStatus(status: Notification['status']) {
    this.data.status = status
    return this
  }

  withTitle(title: string) {
    this.data.title = title
    return this
  }

  scheduled(at: Date) {
    this.data.scheduledAt = at
    this.data.status = 'scheduled'
    return this
  }

  build(): Notification {
    if (!this.data.tenantId) throw new Error('tenantId required — use .withTenant()')
    return this.data as Notification
  }
}

// Uso no teste:
const notification = new NotificationBuilder()
  .withTenant(tenantA.id)
  .withStatus('approved')
  .build()

// O teste só especifica o que importa para ele.
// O builder cuida do resto com defaults válidos.
```

---

## 5. Isolation Tests — Padrão Obrigatório

```
Estes testes existem em TODAS as camadas.
São o coração da segurança do sistema.

Template reutilizável para qualquer resource:
```

```typescript
// packages/db/test/isolation.template.spec.ts

function createIsolationSuite(
  resourceName: string,
  createResource: (tenantId: string) => Promise<{ id: string }>,
  getResource: (tenantId: string, resourceId: string) => Promise<unknown>,
  listResources: (tenantId: string) => Promise<unknown[]>,
) {
  describe(`${resourceName} — Multi-tenant Isolation`, () => {
    let tenantA: TestTenant
    let tenantB: TestTenant
    let resourceOfA: { id: string }

    beforeEach(async () => {
      const pair = await createIsolationPair()
      tenantA = pair.tenantA
      tenantB = pair.tenantB
      resourceOfA = await createResource(tenantA.id)
    })

    it(`tenant B não consegue ler ${resourceName} de tenant A`, async () => {
      const result = await getResource(tenantB.id, resourceOfA.id)
      expect(result).toBeNull()
    })

    it(`listagem de tenant B não inclui ${resourceName} de tenant A`, async () => {
      const results = await listResources(tenantB.id)
      const ids = results.map((r: any) => r.id)
      expect(ids).not.toContain(resourceOfA.id)
    })

    it(`tenant A consegue ler seu próprio ${resourceName}`, async () => {
      const result = await getResource(tenantA.id, resourceOfA.id)
      expect(result).not.toBeNull()
    })
  })
}

// Uso:
createIsolationSuite(
  'notification',
  (tid) => notificationRepo.create(new NotificationBuilder().withTenant(tid).build()),
  (tid, id) => notificationRepo.findById(tid, id),
  (tid) => notificationRepo.findMany(tid, { page: 1, limit: 100 }),
)

createIsolationSuite(
  'app_user',
  (tid) => appUserRepo.create(new AppUserBuilder().withTenant(tid).build()),
  (tid, id) => appUserRepo.findById(tid, id),
  (tid) => appUserRepo.findMany(tid, { page: 1, limit: 100 }),
)

// Aplicar para CADA resource: notifications, deliveries, app_users,
// app_configs, audit_log
```

---

## 6. TDD para Fluxos Automáticos (Notifications)

### Exemplo: Carrinho Abandonado

```
O fluxo completo de carrinho abandonado testado step by step:

Ciclo 1 (Red → Green → Refactor):
  test: "webhook carts/create cria evento no banco"
  → implementar webhook handler mínimo
  → refactor: extrair parser do payload Shopify

Ciclo 2:
  test: "evento de carrinho agenda job com delay de 1h"
  → implementar agendamento BullMQ
  → refactor: extrair delay config

Ciclo 3:
  test: "job executa após delay e verifica se carrinho ainda está abandonado"
  → implementar worker que checa status do carrinho
  → refactor: extrair verificação de status

Ciclo 4:
  test: "se carrinho converteu, cancela notificação"
  → implementar cancelamento
  → refactor: logs estruturados

Ciclo 5:
  test: "se carrinho ainda abandonado, gera notificação via template"
  → implementar geração via template com variáveis
  → refactor: extrair template resolver

Ciclo 6:
  test: "notificação gerada passa pela validação (limites, sanitização)"
  → implementar validação
  → refactor: extrair validators reutilizáveis

Ciclo 7:
  test: "notificação validada é aprovada automaticamente (flow config)"
  → implementar auto-aprovação
  → refactor: extrair regras de aprovação

Ciclo 8:
  test: "notificação aprovada é enviada via OneSignal"
  → implementar envio (mock OneSignal)
  → refactor: extrair batching logic

Ciclo 9:
  test: "delivery registra status no banco"
  → implementar tracking
  → refactor: extrair status manager

Ciclo 10 (INTEGRAÇÃO):
  test: "fluxo completo: webhook → delay → check → template → validação → envio → tracking"
  → DEVE PASSAR porque cada etapa já foi provada
  → Se não passar: problema de costura, não de lógica

Total: 10 ciclos de ~10 min = ~1.5 horas para um fluxo completo testado.
```

---

## 7. Quando NÃO Fazer TDD Puro

```
TDD funciona para lógica de negócio. Não funciona bem para:

1. Exploração / Spike
   Quando você não sabe COMO fazer algo (ex: "Capacitor push funciona?")
   → Spike primeiro (código descartável), depois TDD na versão real
   → Os testes pré-MVP (Plano de Testes) são spikes

2. UI pura
   Layout, cores, animações → testa visualmente, não com TDD
   Mas: lógica de UI (hooks, state, validação de form) → TDD normal

3. Configuração / Infra
   biome.json, turbo.json, GitHub Actions → não precisa de teste
   Mas: scripts custom de CI (coverage check) → TDD se tiver lógica

4. Migrations
   Testar com banco fresh + existente, mas não TDD no sentido clássico
   Migration é testada por existir e rodar sem erro

Regra: se tem IF, LOOP, ou TRANSFORM → TDD.
Se é config ou layout → não precisa.
```

---

## 8. Métricas de Saúde do TDD

```
Monitorar no CI para garantir que TDD está sendo seguido:

| Métrica                          | Saudável       | Preocupante      |
|----------------------------------|----------------|------------------|
| Ratio testes:código              | > 1:1          | < 0.5:1          |
| % commits com testes             | > 90%          | < 70%            |
| Tempo médio do ciclo R-G-R       | 5-15 min       | > 30 min         |
| Testes flaky (falham aleatório)  | 0              | > 2              |
| Coverage trend                   | subindo        | caindo           |
| Testes de isolamento             | 100% pass      | qualquer fail    |
| Tempo total do test suite        | < 5 min        | > 10 min         |

Se test suite passa de 5 min:
  → Paralelizar com Vitest workers
  → Mover integration tests lentos para pipeline separado
  → NUNCA remover testes para "acelerar"
```

---

## 9. Workflow Diário com TDD

```
Início do dia:
  1. Puxar main → rodar testes → tudo verde? Bom.
  2. Ler a feature/story do dia
  3. Escrever o primeiro teste (o mais simples)

Durante o dia:
  4. Ciclo Red → Green → Refactor (repetir)
  5. Commit a cada GREEN (commits pequenos e frequentes)
  6. Se travou > 15 min → parar, repensar, quebrar menor
  7. Se teste é difícil de escrever → interface ruim → refactor primeiro

Fim do dia:
  8. Todos os testes verdes
  9. Push para branch → CI roda
  10. Se CI falha → corrigir ANTES de sair
  11. Nunca deixar branch com teste falhando overnight
```

---

## 10. Checklist TDD por PR

```
Antes de abrir PR, verificar:

- [ ] Todo código novo tem teste correspondente
- [ ] Testes foram escritos ANTES do código (verificar timestamps dos commits)
- [ ] Cada teste testa UM conceito
- [ ] Nomes dos testes descrevem comportamento, não implementação
- [ ] Arrange-Act-Assert em todos os testes
- [ ] Mocks/stubs para dependências externas (nunca chamar API real)
- [ ] Teste de isolamento multi-tenant para novo resource/endpoint
- [ ] Sem console.log nos testes (usar logger ou remover)
- [ ] Testes rodam em < 30s individualmente
- [ ] Nenhum teste depende de ordem de execução
- [ ] Nenhum teste depende de estado compartilhado
- [ ] Coverage do código novo > 80%
- [ ] CI pipeline completo verde
```

---

## 11. Anti-patterns — O Que Não Fazer

```
❌ Test After (escrever código primeiro, teste depois)
   Por que é ruim: teste vira confirmação do que existe, não especificação
   O que acontece: testes frágeis que quebram com refactor

❌ Testes que testam implementação (não comportamento)
   Exemplo ruim: expect(service.repo.findMany).toHaveBeenCalledTimes(1)
   Exemplo bom:  expect(result.data).toHaveLength(10)
   Por que: se mudar implementação interna, teste quebra sem motivo

❌ Testes com muitos mocks
   Se precisa mockar 5+ dependências → classe tem responsabilidades demais
   → Refatorar para classes menores antes de continuar

❌ Testes intermitentes (flaky)
   Causas comuns: tempo (setTimeout), ordem de execução, estado compartilhado
   Regra: teste flaky detectado → corrigir IMEDIATAMENTE ou deletar
   Flaky test é pior que nenhum teste (gera desconfiança)

❌ Testes que precisam de infraestrutura externa
   Unit test NUNCA precisa de: DB real, Redis real, API externa
   Usar: in-memory fakes, mocks, stubs
   Integration test pode usar: DB de teste, Redis local

❌ 100% coverage como objetivo
   Coverage é métrica, não objetivo
   80% com testes bons > 100% com testes ruins
   Não testar getters/setters triviais, tipos puros, re-exports

❌ Describe gigante com 50 testes
   Se um describe tem > 15 testes → módulo grande demais
   → Quebrar em sub-describes ou refatorar código
```

---

## 12. Resumo Visual

```
┌─────────────────────────────────────────────────────────────┐
│                    WORKFLOW POR FEATURE                       │
│                                                              │
│  1. Ler requisito                                            │
│  2. Escrever CONTRATO (tipos/interfaces)                     │
│  3. Escrever teste de integração (RED)                       │
│  4. TDD da camada externa (route)                            │
│     └─ RED → GREEN → REFACTOR → commit                      │
│  5. TDD da camada do meio (service)                          │
│     └─ RED → GREEN → REFACTOR → commit                      │
│  6. TDD da camada interna (repository)                       │
│     └─ RED → GREEN → REFACTOR → commit                      │
│  7. Teste de integração PASSA (GREEN)                        │
│  8. Teste de isolamento multi-tenant → commit                │
│  9. Refactor final com tudo verde → commit                   │
│ 10. Push → CI verde → PR → review → merge                   │
│                                                              │
│  Tempo: 2-4h por feature simples, 1-2 dias por feature      │
│  complexa (fluxo de notificação completo)                    │
└─────────────────────────────────────────────────────────────┘
```
