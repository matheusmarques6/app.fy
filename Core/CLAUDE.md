# CLAUDE.md — AppFy Mobile Revenue Engine

## Project Overview

SaaS que transforma lojas de e-commerce em aplicativos móveis nativos (1 app por cliente, publicado nas stores com a marca do cliente), com sistema de notificações push automatizadas. O diferencial não é o app — é o **motor de receita**: recuperação de carrinho, PIX, boleto, boas-vindas, upsell, browse abandonment.

**Posicionamento:** Não é app builder. É **revenue automation via push notification** — o app é infraestrutura, o produto é geração de receita mensurável.

**Produto separado**, mas com integração fácil entre as soluções.

---

## Architecture Principles (Invioláveis)

1. **Multi-tenant com isolamento total** — dados de uma loja nunca vazam para outra. Toda tabela tem `tenant_id` obrigatório. RLS aplicado via Postgres + Repository Pattern como defesa primária.
2. **Zero acesso a dados sem OAuth** — toda integração (Shopify, Nuvemshop, Klaviyo) via autenticação oficial. Nunca scraping.
3. **Toda notificação tem audit trail** — quem criou, quando, para quem, resultado (entregue, aberta, clicada, converteu).
4. **Templates com variáveis no MVP** — IA generativa é Fase 2. MVP usa templates pré-escritos com variáveis (nome do produto, preço, etc.).
5. **Build pipeline é idempotente** — rodar o build do mesmo cliente 2x produz o mesmo resultado.
6. **API-first** — tudo que o painel faz, a API faz. O painel é um consumidor da API, não o sistema em si.
7. **Dados do Klaviyo são read-only** — o sistema consome dados, nunca escreve/modifica campanhas do cliente.
8. **Graceful degradation** — se OneSignal cair, notificações são enfileiradas. Se o Klaviyo cair, o app continua operando.

---

## Tech Stack

| Componente | Tecnologia |
|---|---|
| Painel Admin | Next.js 14+ (App Router, Server Components) |
| **Backend API** | **Hono** (TypeScript-native, 14KB, multi-runtime) |
| Linguagem | TypeScript (strict mode) |
| UI | shadcn/ui + Tailwind CSS |
| Validação | Zod (input validation, env vars, API schemas) |
| Banco de dados | Supabase (PostgreSQL gerenciado) |
| ORM/Migrations | Drizzle ORM |
| Auth | Supabase Auth (JWT, MFA via TOTP) |
| **Push Notifications** | **OneSignal** (1 app OneSignal por cliente) |
| Queue/Workers | Redis + BullMQ |
| App Wrapper | Capacitor (WebView nativo) |
| Build Pipeline | Fastlane + GitHub Actions (Fase 2, semi-manual no MVP) |
| Storage (assets) | Cloudflare R2 (logos, splashs, imagens de notificação) |
| Deploy (painel) | Vercel |
| **Deploy (workers)** | **Railway** (long-running processes) |
| Linting | Biome (lint + format unificado) |
| **Test runner** | **Vitest** |
| Supply Chain | Dependabot + npm audit no CI |
| **Secrets** | **Supabase Vault** |
| WAF | Cloudflare WAF |
| **Monitoring** | **Sentry** (error tracking + performance) + logs nativos Railway |
| Integrações | Shopify Admin API, Nuvemshop API (OAuth + Webhooks) |
| **Billing** | Stripe |

### Decisão: Hono sobre NestJS (2026-03-10)

**Contexto:** Projeto anterior usava NestJS. Avaliadas 5 opções: NestJS, Hono, Express/Fastify raw, Next.js API Routes, outros.

**Decisão:** Hono.

**Motivos:**
1. **Redundância eliminada** — CLAUDE.md já define Repository + Adapter + Pipeline patterns. NestJS adicionaria modules/providers/decorators como segunda camada de organização redundante.
2. **TypeScript nativo** — Tipos inferidos pelo compilador, não por decorators runtime. Elimina a classe de bugs que gerou `@ts-nocheck` no projeto anterior.
3. **Workers leves** — ~50MB RAM vs ~150-200MB (NestJS). Com 5+ workers em Railway = R$600-1200/ano economizados.
4. **Opcionalidade de runtime** — Hono roda em Node, Bun, Cloudflare Workers, Vercel Edge. Migração futura para edge = 0 reescrita.
5. **Testabilidade** — Funções puras + middleware explícito = mocks simples. Sem DI container para configurar em cada teste.

**Trade-offs aceitos:**
- Sem DI container nativo → factory functions manuais (aceitável para tamanho do projeto)
- Sem decorators → middleware chain explícito (mais verboso, mais debugável)
- Menos tutorials PT-BR → documentação oficial em inglês é excelente
- Sem módulos Swagger auto-gen → usar @hono/zod-openapi para docs automáticas

### Decisão: OneSignal sobre FCM direto (2026-03-10)

**Contexto:** FCM direto exigiria 1 Firebase project por cliente (200+ service accounts, provisionamento complexo).

**Decisão:** OneSignal (1 app OneSignal por cliente).

**Motivos:**
1. **Provisionamento simplificado** — API do OneSignal cria apps programaticamente. Sem Firebase Management API.
2. **Dashboard nativo** — Cliente pode ver métricas de push sem painel custom.
3. **Delivery tracking** — OneSignal fornece callbacks de delivered/opened/clicked nativamente.
4. **Cross-platform** — Android + iOS + Web push com uma integração.

**Trade-offs aceitos:**
- Dependência de terceiro para push core → mitigado por adapter pattern (pode trocar para FCM futuro)
- Custo por volume → incluído no pricing dos planos

---

## Repository Layout

```
/
├── apps/
│   ├── web/                    # Painel admin (Next.js)
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   ├── components/     # UI components
│   │   │   ├── hooks/          # Feature-specific hooks
│   │   │   ├── lib/            # Shared utilities
│   │   │   ├── services/       # API service layer
│   │   │   └── types/          # TypeScript types
│   │   └── tests/
│   │
│   └── mobile/                 # Template Capacitor (base para builds)
│       ├── src/                # WebView wrapper code
│       ├── android/            # Android shell
│       ├── ios/                # iOS shell
│       └── configs/            # JSON configs por tenant (gerados)
│
├── packages/
│   ├── api/                    # API server (Hono)
│   │   ├── src/
│   │   │   ├── app.ts          # Hono app factory (cria app com middlewares)
│   │   │   ├── routes/         # Route handlers agrupados por domínio
│   │   │   ├── middleware/     # Auth, tenant, roles, validation, logging
│   │   │   ├── repositories/  # Data access layer (SEMPRE filtra tenant_id)
│   │   │   ├── services/      # Business logic (pura, sem HTTP)
│   │   │   └── factories/     # DI manual via factory functions
│   │   └── test/               # Helpers, builders, fixtures
│   │
│   ├── notifications/          # Sistema de notificações
│   │   ├── pipeline/           # Geração → Validação → Agendamento → Envio → Tracking → Feedback
│   │   ├── flows/              # Fluxos automáticos (carrinho, PIX, boleto, welcome, etc.)
│   │   ├── templates/          # Templates de notificação com variáveis (MVP)
│   │   ├── push/               # OneSignal integration (1 app por tenant)
│   │   └── inapp/              # Notificações in-app (popups)
│   │
│   ├── integrations/           # Adapter pattern por plataforma
│   │   ├── shopify/            # Shopify Admin API adapter
│   │   ├── nuvemshop/          # Nuvemshop API adapter
│   │   ├── klaviyo/            # Klaviyo API adapter (read-only)
│   │   └── types.ts            # Interface comum: { products, orders, abandonedCarts }
│   │
│   ├── db/                     # Drizzle schema, migrations, seed
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── seed/
│   │
│   └── shared/                 # Tipos, utils, constants compartilhados
│
├── workers/
│   ├── push-dispatcher/        # Worker BullMQ: batching, retry, dead letter
│   ├── data-ingestion/         # Worker: ingestão de dados Klaviyo, Shopify webhooks
│   └── analytics/              # Worker: processamento de métricas
│
├── infra/
│   ├── ci/                     # GitHub Actions workflows
│   ├── fastlane/               # Build pipeline de apps (Fase 2)
│   └── sentry/                 # Config Sentry (source maps, alerts)
│
├── docs/
│   ├── architecture.md
│   ├── onboarding.md
│   └── api.md
│
├── CLAUDE.md                   # Este arquivo
├── biome.json                  # Config Biome (lint + format)
├── drizzle.config.ts
├── package.json                # Monorepo root (workspaces)
└── turbo.json                  # Turborepo config
```

**Nota:** `packages/ai/` não existe no MVP. IA generativa entra na Fase 2. MVP usa templates com variáveis em `packages/notifications/templates/`.

---

## Environment Variables

```bash
# === Database ===
DATABASE_URL=                    # Supabase PostgreSQL connection string
DIRECT_URL=                      # Supabase direct connection (migrations)

# === Auth ===
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # NUNCA no frontend

# === Integrações E-commerce ===
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
NUVEMSHOP_APP_ID=
NUVEMSHOP_APP_SECRET=

# === Klaviyo ===
KLAVIYO_API_KEY=                 # Read-only, dados de performance

# === Push (OneSignal) ===
ONESIGNAL_API_KEY=               # REST API key (gerencia todos os apps)
ONESIGNAL_USER_AUTH_KEY=         # User Auth key (cria/deleta apps)
# App IDs são POR TENANT — armazenados no banco (tabela tenants)

# === Queue ===
REDIS_URL=

# === Storage ===
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=

# === Billing ===
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# === Monitoring ===
SENTRY_DSN=                      # Sentry error tracking
SENTRY_AUTH_TOKEN=               # Source maps upload

# === Encryption ===
ENCRYPTION_SECRET=               # ≥32 chars, AES-256-GCM para credenciais
```

---

## Database Schema (Core Tables)

### RLS Strategy

**Abordagem:** `auth.jwt() ->> 'tenant_id'` — stateless, nativo do Supabase, sem round-trip.

**Switch tenant flow:**
1. Login retorna JWT **sem** tenant_id
2. Frontend chama `POST /auth/switch-tenant` com tenant_id desejado
3. Backend valida membership do userId nesse tenant
4. Backend emite novo JWT com `tenant_id` preenchido no claim

**Defense-in-depth:** Queries do backend com `service_role` key bypassam RLS. O Repository Pattern com `tenantId` obrigatório é a defesa primária na aplicação. RLS é a segunda camada.

```sql
-- RLS obrigatório em TODAS as tabelas (exceto plans)
CREATE POLICY tenant_isolation ON [table]
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### Credenciais Encriptadas — Padrão JSONB

Em vez de 3 colunas separadas (encrypted, iv, tag), toda credencial usa **1 coluna JSONB**:

```typescript
// Tipo: EncryptedCredential
type EncryptedCredential = {
  ct: string   // ciphertext (base64)
  iv: string   // initialization vector (base64)
  tag: string  // auth tag GCM (base64) — CRÍTICO, sem isso = AES-CTR, não GCM
  alg: string  // "aes-256-gcm"
}
```

**Vantagem:** Impossível salvar credencial incompleta (sem auth_tag). Uma coluna = um objeto atômico.

### Tabelas

```
tenants
├── id (uuid, PK)
├── name
├── slug (unique)
├── platform ("shopify" | "nuvemshop")
├── platform_store_url
├── platform_credentials (jsonb, EncryptedCredential)  # OAuth token encriptado
├── klaviyo_credentials (jsonb, EncryptedCredential)    # API key encriptada
├── onesignal_app_id                                    # ID do app OneSignal deste tenant
├── onesignal_api_key_encrypted (jsonb, EncryptedCredential)
├── plan_id (FK)
├── stripe_customer_id
├── stripe_subscription_id
├── notification_count_current_period
├── notification_limit
├── is_active
├── created_at
└── updated_at

users
├── id (uuid, PK, Supabase Auth)
├── email
├── name
├── avatar_url
└── created_at

memberships
├── id (uuid, PK)
├── user_id (FK → users)
├── tenant_id (FK → tenants)
├── role ("owner" | "editor" | "viewer")
├── created_at
└── updated_at

app_configs
├── id (uuid, PK)
├── tenant_id (FK, unique)
├── app_name
├── icon_url (Cloudflare R2)
├── splash_url
├── primary_color
├── secondary_color
├── menu_items (jsonb)
├── store_url
├── android_package_name
├── ios_bundle_id
├── build_status ("pending" | "building" | "ready" | "published")
└── last_build_at

app_users                         # Usuários do app do cliente (consumidores finais)
├── id (uuid, PK)
├── tenant_id (FK)
├── user_id_external              # ID do cliente na loja (se logado)
├── email                         # Se disponível
├── name                          # Se disponível
├── push_opt_in (boolean, default true)
├── last_active_at
├── total_purchases (default 0)
├── total_spent (default 0)
├── created_at
└── updated_at

devices                           # SEPARADO de app_users (1 user → N devices)
├── id (uuid, PK)
├── tenant_id (FK)
├── app_user_id (FK → app_users)
├── device_token                  # OneSignal player ID
├── platform ("android" | "ios")
├── os_version
├── app_version
├── is_active (boolean, default true)
├── last_seen_at
├── created_at
└── updated_at

app_user_segments                 # N:N entre app_users e segments
├── id (uuid, PK)
├── tenant_id (FK)
├── app_user_id (FK → app_users)
├── segment_name                  # ex: "high_value", "inactive_30d", "new_user"
├── assigned_at
└── expires_at (nullable)

app_user_products                 # Produtos favoritos / visualizados do usuário
├── id (uuid, PK)
├── tenant_id (FK)
├── app_user_id (FK → app_users)
├── product_id_external           # ID do produto na plataforma
├── product_name
├── product_image_url
├── interaction_type ("viewed" | "favorited" | "purchased")
├── last_interaction_at
└── created_at

app_events                        # Eventos do app (MVP — necessário para flows)
├── id (uuid, PK)
├── tenant_id (FK)
├── app_user_id (FK → app_users, nullable)
├── device_id (FK → devices, nullable)
├── event_type ("app_opened" | "product_viewed" | "add_to_cart" | "purchase_completed" | "push_opened" | "push_clicked")
├── properties (jsonb)            # Dados do evento (product_id, value, etc.)
├── created_at
└── INDEX (tenant_id, event_type, created_at)

notifications
├── id (uuid, PK)
├── tenant_id (FK)
├── type ("manual" | "automated")
├── flow_type ("cart_abandoned" | "pix_recovery" | "boleto_recovery" | "welcome" | "checkout_abandoned" | "order_confirmed" | "tracking_created" | "browse_abandoned" | "upsell" | null)
├── title
├── body
├── image_url
├── target_url
├── segment_rules (jsonb)         # Snapshot imutável das regras de segmentação
├── scheduled_at
├── sent_at
├── created_by (uuid, FK → users, nullable para automated)
├── ab_variant ("a" | "b" | null)
├── status ("draft" | "approved" | "scheduled" | "sending" | "sent" | "failed")
├── created_at
└── updated_at

notification_deliveries
├── id (uuid, PK)
├── notification_id (FK)
├── device_id (FK → devices)
├── tenant_id (FK)
├── status ("pending" | "sent" | "delivered" | "opened" | "clicked" | "converted" | "failed")
├── error_message
├── sent_at
├── delivered_at
├── opened_at
├── clicked_at
├── converted_at
├── created_at
└── INDEX (tenant_id, status, created_at)  # Para retention job e queries

automation_configs                # Config simplificada de fluxos automáticos (MVP)
├── id (uuid, PK)
├── tenant_id (FK)
├── flow_type ("cart_abandoned" | "pix_recovery" | "boleto_recovery" | "welcome" | "checkout_abandoned" | "order_confirmed" | "tracking_created" | "browse_abandoned" | "upsell")
├── is_enabled (boolean, default true)
├── delay_seconds (int)           # Delay antes de enviar (ex: 3600 = 1h)
├── template_title (text)         # Template com variáveis: "Ei {{name}}, seu carrinho te espera!"
├── template_body (text)          # Template com variáveis: "{{product_name}} está esperando por você"
├── created_at
└── updated_at
└── UNIQUE (tenant_id, flow_type) # 1 config por flow por tenant

plans
├── id (uuid, PK)
├── name ("starter" | "business" | "elite")
├── notification_limit (int, null = ilimitado)
├── price_monthly (decimal)
├── price_yearly (decimal)
├── features (jsonb)
└── stripe_price_id

audit_log
├── id (uuid, PK)
├── tenant_id (FK)
├── user_id (FK, nullable)
├── action (text)
├── resource (text)
├── details (jsonb)
└── created_at
```

### Data Retention (notification_deliveries)

Sem particionamento no dia 1 (Drizzle não suporta nativamente).

**Estratégia:**
1. Índice composto: `(tenant_id, status, created_at)`
2. Retention job (cron worker): `DELETE FROM notification_deliveries WHERE created_at < NOW() - INTERVAL '180 days'`
3. **Gatilho para particionamento:** >50M rows total

---

## Design Patterns

### Hono Middleware Chain — API

A cadeia de middleware é explícita e composável. Sem decorators, sem DI container.

```typescript
// packages/api/src/app.ts
import { Hono } from 'hono'
import { authMiddleware } from './middleware/auth'
import { tenantMiddleware } from './middleware/tenant'
import { requestLogger } from './middleware/logger'
import { errorHandler } from './middleware/error'
import { createDependencies } from './factories/dependencies'

type AppEnv = {
  Variables: {
    userId: string
    tenantId: string
    userRole: 'owner' | 'editor' | 'viewer'
    requestId: string
  }
}

export function createApp(deps = createDependencies()) {
  const app = new Hono<AppEnv>()

  // Middleware global (ordem importa)
  app.use('*', requestLogger())           // 1. Log + requestId
  app.use('*', errorHandler())            // 2. Catch-all errors
  app.use('/api/*', authMiddleware())      // 3. JWT validation
  app.use('/api/*', tenantMiddleware())    // 4. Tenant isolation
  // roles é por rota, não global

  // Routes
  app.route('/api/notifications', createNotificationRoutes(deps))
  app.route('/api/app-users', createAppUserRoutes(deps))
  app.route('/api/integrations', createIntegrationRoutes(deps))

  // Health
  app.get('/health', (c) => c.json({ status: 'ok' }))

  return app
}
```

```typescript
// packages/api/src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'

export function authMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) return c.json({ error: 'Unauthorized' }, 401)

    const payload = await verify(token)
    if (!payload) return c.json({ error: 'Invalid token' }, 401)

    c.set('userId', payload.sub)
    await next()
  })
}
```

```typescript
// packages/api/src/middleware/tenant.ts
export function tenantMiddleware() {
  return createMiddleware<AppEnv>(async (c, next) => {
    const tenantId = c.req.header('X-Tenant-Id')
    if (!tenantId) return c.json({ error: 'X-Tenant-Id header required' }, 400)

    const membership = await deps.membershipRepo.find(c.get('userId'), tenantId)
    if (!membership) return c.json({ error: 'Forbidden' }, 403)

    c.set('tenantId', tenantId)
    c.set('userRole', membership.role)
    await next()
  })
}
```

```typescript
// packages/api/src/middleware/roles.ts
export function requireRoles(...roles: Array<'owner' | 'editor' | 'viewer'>) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const userRole = c.get('userRole')
    if (!roles.includes(userRole)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }
    await next()
  })
}

// Uso na rota:
app.delete('/api/notifications/:id', requireRoles('owner', 'editor'), handler)
```

```typescript
// packages/api/src/middleware/validate.ts
import { ZodSchema } from 'zod'

export function validate<T>(schema: ZodSchema<T>) {
  return createMiddleware(async (c, next) => {
    const body = await c.req.json()
    const result = schema.safeParse(body)
    if (!result.success) {
      return c.json({ error: 'Validation failed', details: result.error.flatten() }, 400)
    }
    c.set('validatedBody', result.data)
    await next()
  })
}
```

### Factory Pattern — DI Manual

```typescript
// packages/api/src/factories/dependencies.ts
export function createDependencies(overrides?: Partial<Dependencies>) {
  const db = overrides?.db ?? createDrizzleClient()
  const redis = overrides?.redis ?? createRedisClient()

  return {
    db,
    redis,
    notificationRepo: overrides?.notificationRepo ?? new NotificationRepository(db),
    appUserRepo: overrides?.appUserRepo ?? new AppUserRepository(db),
    deviceRepo: overrides?.deviceRepo ?? new DeviceRepository(db),
    membershipRepo: overrides?.membershipRepo ?? new MembershipRepository(db),
    notificationService: overrides?.notificationService ?? new NotificationService(/*...*/),
    pushService: overrides?.pushService ?? new OneSignalPushService(/*...*/),
  }
}

// Em produção:
const app = createApp() // usa defaults reais

// Em testes:
const app = createApp({
  notificationRepo: mockNotificationRepo,
  pushService: mockPushService,
}) // injeta mocks sem DI container
```

### Adapter Pattern — Integrações E-commerce

Toda plataforma (Shopify, Nuvemshop, futura VTEX) implementa a mesma interface:

```typescript
interface PlatformAdapter {
  getProducts(params: ProductQuery): Promise<Product[]>
  getOrders(params: OrderQuery): Promise<Order[]>
  getAbandonedCarts(): Promise<AbandonedCart[]>
  getCustomer(id: string): Promise<Customer>
  registerWebhooks(hooks: WebhookConfig[]): Promise<void>
}
```

Novo adapter = novo arquivo. Resto do sistema não muda.

### Adapter Pattern — Push

Push provider é plugável (OneSignal no MVP, FCM como backup futuro):

```typescript
interface PushProvider {
  createApp(config: PushAppConfig): Promise<{ appId: string }>
  sendNotification(appId: string, notification: PushPayload): Promise<PushResult>
  getDeliveryStatus(appId: string, notificationId: string): Promise<DeliveryStatus>
  registerDevice(appId: string, deviceToken: string): Promise<{ playerId: string }>
}

class OneSignalProvider implements PushProvider { ... }
// Fase futura: class FCMProvider implements PushProvider { ... }
```

### Pipeline Pattern — Notificações

Toda notificação, sem exceção, passa por estas etapas:

```
Geração (template com variáveis no MVP / IA na Fase 2)
  → Validação (sanitização, limites do plano, conteúdo)
  → Aprovação (human-in-the-loop ou regra automática do automation_configs)
  → Agendamento (BullMQ delayed job, delay_seconds do automation_configs)
  → Envio (OneSignal API, retry com backoff)
  → Tracking (delivery, open, click via OneSignal webhooks + custom tracking)
  → Feedback Loop (dados voltam para métricas, Fase 2: voltam para IA)
```

Nunca pula etapa. Nunca envia direto.

### Repository Pattern — Dados

Toda query ao banco passa por repository que aplica filtro de tenant automaticamente:

```typescript
class NotificationRepository {
  constructor(private db: DrizzleClient) {}

  async findAll(tenantId: string) {
    return this.db.query.notifications.findMany({
      where: eq(notifications.tenantId, tenantId) // SEMPRE
    })
  }

  async findById(tenantId: string, id: string) {
    return this.db.query.notifications.findFirst({
      where: and(
        eq(notifications.tenantId, tenantId), // SEMPRE
        eq(notifications.id, id)
      )
    })
  }
}
```

Nenhum módulo acessa o banco diretamente sem passar pelo repository.
O `tenantId` é parâmetro obrigatório em TODA operação — nunca campo da classe.

---

## Push Tracking — Sistema Custom (MVP)

OneSignal fornece callbacks nativos de delivered/opened. Para tracking completo:

### Fluxo de tracking
```
1. Push enviado → OneSignal webhook → status: "sent"
2. Push entregue → OneSignal webhook → status: "delivered"
3. Push aberto → OneSignal callback + deep link com ?ref=push_{id} → status: "opened"
4. Link clicado → App registra evento push_clicked com notification_id → status: "clicked"
5. Compra realizada → Webhook da plataforma + janela de atribuição → status: "converted"
```

### Conversion Attribution
- **Multi-campanha (mesmo dia):** janela de 1h — se várias campanhas foram enviadas, atribui à mais recente antes da compra
- **Fluxo normal:** janela de 24h — push → abertura → compra dentro de 24h = conversão atribuída

### Frequency Capping
Controlado por plano do cliente via `automation_configs`. Tenant configura limites por tipo de flow.

---

## Notification Templates (MVP)

MVP usa templates pré-escritos com variáveis. Sem IA generativa.

```typescript
// packages/notifications/templates/cart-abandoned.ts
export const cartAbandonedTemplate = {
  title: "{{store_name}} - Você esqueceu algo! 🛒",
  body: "{{product_name}} está esperando por você. Finalize sua compra agora!",
  variables: ["store_name", "product_name", "product_image_url", "checkout_url"]
}
```

Templates são armazenados em `automation_configs.template_title` e `automation_configs.template_body` por tenant, com defaults do sistema.

**Fase 2:** IA gera variantes de texto + sugere produtos. Templates como fallback.

---

## Notification Flows (Automáticos)

| Flow | Trigger | Delay Default | Dados necessários |
|---|---|---|---|
| Carrinho abandonado | Webhook: cart abandoned | 1-3h | Produtos no carrinho, valor |
| PIX recovery | Webhook: order pending (PIX) | 30min, 2h, 24h | Pedido, valor, código PIX |
| Boleto recovery | Webhook: order pending (boleto) | 1h, 24h, 48h | Pedido, valor, link boleto |
| Boas-vindas | App install + primeiro acesso | 5min | Nome (se disponível) |
| Checkout abandonado | Webhook: checkout abandoned | 1h | Produtos, valor |
| Pedido confirmado | Webhook: order paid | Imediato | Número do pedido, produtos |
| Rastreio criado | Webhook: fulfillment created | Imediato | Código de rastreio, transportadora |
| Browse abandoned | Evento: product_viewed sem add_to_cart | 2-4h | Produtos visualizados |
| Upsell | Webhook: order delivered | 3-7 dias | Produtos comprados, recomendações |

Cada flow usa `automation_configs` para: `is_enabled`, `delay_seconds`, `template_title`, `template_body`.

---

## Security Policies

### OAuth Token Storage
- AES-256-GCM encryption at rest
- **Formato:** coluna JSONB única `{ct, iv, tag, alg}` — impossível salvar incompleto
- Chave em Supabase Vault, nunca em ENV
- Rotation automático quando API suporta refresh
- Revocation: DELETE credencial do banco quando cliente desconecta
- Scope mínimo: `read_products`, `read_orders`, `read_customers`

### OneSignal Credentials
- 1 app OneSignal por cliente (provisionamento via OneSignal REST API)
- API key encriptada no banco (formato JSONB EncryptedCredential)
- App ID em plaintext (não é secret)
- Worker carrega credenciais dinamicamente por tenant_id

### Push Security
- Server-only: app → backend → OneSignal → device (nunca app → OneSignal direto)
- Revogar credenciais isoladamente por tenant se comprometido
- OneSignal HMAC Identity Verification habilitado

### SSRF Protection
- Whitelist: `*.myshopify.com`, `*.nuvemshop.com`, `onesignal.com`
- Bloquear IPs privados: 127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
- HTTP client isolado, timeout 3-5s

### Rate Limiting
- Painel admin: 100 req/min por usuário
- API pública: 20 req/s por cliente
- Push dispatch: controlado pela queue (nunca direto)
- Implementação: Redis sliding window

### XSS/Injection
- Todo input de texto de notificação sanitizado com DOMPurify
- Input sempre tratado como texto, nunca HTML
- Validação server-side obrigatória (Zod)

### Data Collected from App Users
- Permitido: device_token, user_id (uuid), events, purchase_value, product_views
- Proibido: localização precisa, contatos, dados do telefone
- TLS obrigatório (HTTPS only)
- User IDs sempre uuid, nunca email puro

### Data Retention
| Tipo | Período |
|---|---|
| Logs operacionais | 30 dias |
| Métricas agregadas | 12-24 meses |
| Eventos de usuário (app_events) | 90 dias |
| Notificações enviadas | 180 dias |
| notification_deliveries | 180 dias (retention job) |

### Incident Response
- Disable tenant: bloqueia API, push, dashboard instantaneamente
- Revogação de push credentials isolada por tenant (delete OneSignal app)
- Audit trail em toda ação importante: user, timestamp, action, resource

### LGPD
- Template automático de política de privacidade por app (preenchido com dados da loja)
- Opt-in obrigatório para push no primeiro acesso
- Opt-out fácil (no app + link na notificação)
- Direito de exclusão: endpoint para apagar dados do usuário

---

## CI Pipeline (Roda em CADA commit)

```
1. biome check (lint + format)
2. tsc --noEmit (type check)
3. pnpm audit (vulnerabilidades de dependências)
4. vitest run (testes unitários)
5. vitest run --project integration (testes de integração)
6. vitest run --project isolation (testes de isolamento multi-tenant)
7. coverage check (mínimo 80%, não pode diminuir)
```

**Nenhum merge em main se qualquer etapa falhar.**

---

## Development Workflow (Por Feature)

```
1. PLAN    → Descrever: o que faz, critérios de aceitação, edge cases
2. TEST    → Escrever testes ANTES do código (TDD)
3. BUILD   → Desenvolver a feature
4. REVIEW  → Revisar o código gerado (humano é o freio)
5. TEST    → Rodar TODOS os testes (novos + existentes)
6. CI      → Pipeline completo verde
7. DEPLOY  → Só depois de tudo verde
```

**Regras invioláveis do workflow:**
- Cada commit é production-ready (small releases)
- Nunca "commit que quebra, conserto no próximo"
- Refactoring contínuo em commits pequenos (nunca "parar tudo e refatorar")
- O humano decide O QUÊ. O agente decide O COMO. Inverter piora o resultado.
- O agente nunca diz "não" — isso é bug, não feature. VOCÊ é o freio.

---

## Post-Implementation Checklist (Por Feature)

- [ ] Testes escritos e passando (unitários + integração)
- [ ] Biome sem erros (lint + format)
- [ ] Type check sem erros (tsc --noEmit)
- [ ] CI pipeline completo verde
- [ ] Coverage ≥80% e não diminuiu
- [ ] pnpm audit limpo
- [ ] Migration testada em banco fresh + existente
- [ ] RLS policy aplicada e testada (teste de isolamento)
- [ ] Sentry configurado para novo módulo
- [ ] Deploy em staging
- [ ] Verificação manual em staging
- [ ] Deploy em produção
- [ ] Smoke test em produção
- [ ] Audit trail registrando ações corretamente

---

## Common Hurdles (Aprendidos do Projeto Anterior)

### 1. Arquitetura espaguete
**Problema:** Código sem separação de responsabilidades, tudo misturado.
**Solução:** Monorepo com packages separados (api, notifications, integrations, db, shared). Cada package tem responsabilidade única. Repository pattern para dados. Adapter pattern para integrações.

### 2. Sem testes
**Problema:** Código quebrava sem ninguém saber. Mudanças introduziam regressões silenciosas.
**Solução:** TDD obrigatório. Testes escritos ANTES do código. CI bloqueia merge sem testes. Testes de isolamento multi-tenant em cada tabela.

### 3. Push falhava silenciosamente
**Problema:** Notificações não chegavam e ninguém sabia.
**Solução:** Audit trail em toda notificação (status: pending → sent → delivered → opened → clicked → converted → failed). Dead letter queue para falhas. Alertas via Sentry. Error_message registrado em toda falha.

### 4. Integração com plataformas quebrava
**Problema:** Mudanças na API da Shopify/Nuvemshop quebravam o sistema.
**Solução:** Adapter pattern (interface comum, implementação por plataforma). Retry com backoff exponencial. Health checks periódicos. Fallback graceful (se webhook falha, polling como backup).

### 5. OneSignal com 200+ apps
**Problema potencial:** Gerenciar credenciais e apps de muitos clientes.
**Solução:** Provisionamento automático via OneSignal REST API. Credenciais encriptadas no banco (JSONB). Worker carrega credencial dinâmica por tenant. Pipeline de build parametrizado (1 código base, config JSON por tenant).

---

## Database Migration Rules (Drizzle)

1. **Nunca editar migração existente** — elas são identificadas por timestamp
2. **Nunca modificar coluna existente** em migração shipped
3. **Para adicionar coluna:** nova migração com ALTER TABLE + DEFAULT
4. **Toda migração deve ser idempotente** quando possível
5. **Testar com banco fresh E banco existente**
6. **Nunca deletar dados sem consentimento** explícito do usuário
7. **Nunca dropar coluna** sem migração de fallback

---

## Coding Conventions

- **TypeScript strict mode** em todo o projeto
- **Biome** para lint e format (config única, sem ESLint/Prettier)
- **camelCase** para TypeScript, matching com Drizzle schema
- **Nunca `any`** — usar `unknown` + type guard quando necessário
- **Error handling:** Result pattern ou try/catch com tipos específicos
- **Imports:** absolute paths com `@/` prefix
- **Async:** sempre async/await, nunca .then() chains
- **Env vars:** validadas com Zod no startup (fail fast)
- **Logs:** structured logging (JSON), nunca console.log em produção
- **Package scope:** `@appfy/*` (ex: `@appfy/api`, `@appfy/shared`)

---

## MVP Scope

### O que ENTRA no MVP
- Setup monorepo (Turborepo + packages)
- Drizzle schema + migrations iniciais (todas as tabelas acima)
- Supabase Auth + RLS policies
- Painel admin básico (login, config da loja, envio de push)
- Shopify OAuth + webhooks
- Nuvemshop adapter
- Push manual (OneSignal)
- Push automático: todos os 9 flows (com templates + variáveis)
- Notificações in-app (popup)
- A/B testing (2 variantes por notificação)
- Dashboard de métricas (entregas, aberturas, cliques, conversão)
- Stripe billing
- Capacitor build (Android + iOS/TestFlight)
- CI pipeline completo (7 gates)
- Onboarding flow
- Custom push tracking (delivery → opened → clicked → converted)

### O que NÃO entra no MVP (Fase 2+)
- IA generativa para texto de push
- RAG com pgvector
- Cérebro de IA (4 camadas)
- Build pipeline automatizado (Fastlane + GitHub Actions)
- Segmentação automática por IA
- Calendário de notificações por IA
- Gamificação
- Chat IA no app
- Banners no site
- OTel + Grafana (Sentry cobre o MVP)

---

## Pricing (Referência)

| Plano | Preço Mensal | Notificações/mês | Features |
|---|---|---|---|
| Starter | ~R$127 | 15 | Push manual + automático básico, métricas básicas |
| Business | ~R$197 | Ilimitado | + A/B test, + métricas avançadas |
| Elite | ~R$297 | Ilimitado | + IA (Fase 2), + segmentação avançada, + dados cross-loja |

**Notificações automáticas (carrinho, boas-vindas, etc.) nunca param**, mesmo se limite do plano atingido. Só manuais são bloqueadas com soft limit + upsell.

**Sem trial gratuito.** Aquisição via indicação de clientes existentes.

Shopify App Store retém 20% até US$1M — incluído no cálculo de unit economics.

---

## What NOT to Change

1. **Nunca remover RLS policies** sem migração de substituição
2. **Nunca armazenar tokens/credenciais em plaintext** no banco — sempre JSONB EncryptedCredential
3. **Nunca permitir push direto do app** — sempre server-only via OneSignal
4. **Nunca acessar banco sem repository** (bypassar tenant_id)
5. **Nunca editar migração Drizzle existente**
6. **Nunca commitar secrets** no repositório (Supabase Vault obrigatório)
7. **Nunca remover audit trail** de notificações
8. **Nunca pular a etapa de validação** no pipeline de notificações
9. **Nunca tratar input de notificação como HTML** — sempre texto + DOMPurify
10. **Nunca fazer deploy sem CI verde**

---

## Key Metrics to Track

### Business
- Receita gerada por push (por tenant)
- ROI do app: receita push vs. custo do plano
- Churn rate por plano
- Notificações enviadas / abertas / clicadas / convertidas

### Technical
- Push delivery rate (deve ser > 95%)
- Push latency (< 5s do agendamento ao envio)
- API response time (< 200ms p95)
- Worker queue depth (alerta se > 10K jobs pendentes)
- Error rate por tenant (alerta se > 5%)
