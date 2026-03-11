# AppFy — Resumo Consolidado (Projeto + TDD + UX)

## O que é

SaaS que transforma lojas e-commerce em apps móveis nativos com push notifications automatizadas. **O produto é revenue automation via push** — o app é infraestrutura.

---

## Tech Stack

| Componente | Tecnologia |
|---|---|
| Backend API | Hono (TypeScript-native) |
| Console | Next.js 14 (App Router) |
| ORM | Drizzle |
| DB | Supabase PostgreSQL |
| Auth | Supabase Auth (JWT, MFA) |
| Push | OneSignal (1 app por cliente) |
| Queue/Workers | Redis + BullMQ |
| App | Capacitor (WebView nativo) |
| Storage | Cloudflare R2 |
| Linter | Biome |
| Tests | Vitest |
| Billing | Stripe |
| UI | shadcn/ui + Tailwind CSS |
| Monitoring | Sentry + Railway logs |
| Deploy API/Workers | Railway |
| Deploy Console | Vercel |
| Secrets | Supabase Vault |

---

## Princípios Invioláveis

1. **Multi-tenant isolado** — toda tabela tem `tenant_id`. RLS + Repository Pattern
2. **Zero acesso sem OAuth** — nunca scraping
3. **Audit trail** em toda notificação (pending → sent → delivered → opened → clicked → converted → failed)
4. **Templates com variáveis** no MVP (IA = Fase 2)
5. **Build idempotente** — mesmo input = mesmo output
6. **API-first** — console é consumidor, não o sistema
7. **Graceful degradation** — se OneSignal cai, enfileira
8. **Nunca push direto do app** — sempre server → OneSignal → device
9. **Dados do Klaviyo são read-only** — consome dados, nunca escreve/modifica campanhas

---

## Monorepo — Estrutura

```
apps/
  api/          → Hono HTTP (:3000), organizado por domínio
  console/      → Next.js 14, Supabase Auth SSR
  workers/      → BullMQ processors (Railway)
  mobile/       → Capacitor template

packages/
  core/         → Lógica de domínio (services, repos, pipeline, queues, errors)
  integrations/ → Adapters (Shopify, Nuvemshop, Klaviyo)
  db/           → Drizzle schema, migrations, seed, client
  shared/       → Types puros, constants, utils (ZERO lógica)
  test-utils/   → Builders, helpers, isolation, architecture tests
```

### API — Organização por Domínio

Cada domínio em `apps/api/src/domains/`: `routes.ts` + `handlers.ts` + `schemas.ts`

Domínios: auth, tenants, notifications, app-users, devices, automations, analytics, billing, integrations, app-configs

### API Endpoints

```
POST   /auth/switch-tenant           → JWT sem tenant → JWT com tenant_id

/api/notifications
  GET    /                            → Listar (paginado)
  POST   /                            → Criar manual (draft)
  GET    /:id                         → Detalhe + métricas
  DELETE /:id                         → Remover (requireRoles('owner','editor'))

/api/app-users                         → CRUD app users
/api/devices                           → Registro de devices
/api/automations                       → CRUD automation_configs por flow_type
/api/analytics                         → Métricas agregadas
/api/billing                           → Stripe checkout/portal
/api/integrations                      → OAuth callbacks, webhook receivers
/api/tenants                           → CRUD tenant, config
/api/app-configs                       → Personalização visual do app

GET /health                            → Health check (sem auth)
```

Middleware: `validate(zodSchema)` injeta `validatedBody` no context.

### Grafo de Dependências

```
shared → (nenhuma dep — folha)
db → shared
core → db + shared
integrations → core + shared
api → core + integrations + db + shared
workers → core + integrations + db + shared
test-utils → core + db + shared
```

### Conditional Exports (dev sem rebuild)

```jsonc
// packages/*/package.json
{ "exports": { ".": { "import": "./src/index.ts", "default": "./dist/index.js" } } }
```

---

## Design Patterns

### Middleware Chain (Hono)

```
requestLogger → errorHandler → authMiddleware → tenantMiddleware → [roles por rota]
```

- `authMiddleware`: JWT → `userId`
- `tenantMiddleware`: `X-Tenant-Id` header → valida membership → `tenantId` + `userRole`
- `requireRoles('owner', 'editor')`: por rota, não global

### Factory DI (sem container)

```typescript
createDependencies(overrides?: Partial<Dependencies>)
// Produção: createApp()
// Testes:   createApp({ notificationRepo: mock, pushService: mock })
```

### Repository Pattern

`tenantId` é parâmetro obrigatório em TODA operação. Nenhum módulo acessa banco sem repository.

### Adapter Pattern

```typescript
interface PlatformAdapter { getProducts, getOrders, getAbandonedCarts, getCustomer, registerWebhooks }
interface PushProvider { createApp, sendNotification, getDeliveryStatus, registerDevice }
```

### Pipeline de Notificações (nunca pula etapa)

```
Geração → Validação → Aprovação → Agendamento (BullMQ) → Envio (OneSignal) → Tracking → Feedback
```

### Push Tracking Completo

```
1. Push enviado     → OneSignal webhook    → status: "sent"
2. Push entregue    → OneSignal webhook    → status: "delivered"
3. Push aberto      → OneSignal callback + deep link ?ref=push_{id} → status: "opened"
4. Link clicado     → App registra push_clicked com notification_id  → status: "clicked"
5. Compra realizada → Webhook plataforma + janela atribuição         → status: "converted"
```

---

## Workers — Detalhe

```
apps/workers/src/
  push/         → Entrypoint: node dist/push/index.js
  ingestion/    → Entrypoint: node dist/ingestion/index.js
  analytics/    → Entrypoint: node dist/analytics/index.js
  shared/       → worker-factory.ts (queue setup, Redis, graceful shutdown)
```

**Queues** (em `packages/core/src/queues/`):
- `push-dispatch.queue.ts` — Envio de push via OneSignal
- `data-ingestion.queue.ts` — Processamento de webhooks e eventos
- `analytics.queue.ts` — Cálculo de métricas agregadas

**Deploy:** 3 services separados no Railway, cada com start command diferente.
**Retry:** Backoff exponencial (3 tentativas). Dead letter queue para falhas permanentes.
**Alerta:** Queue depth > 10K jobs pendentes.
**Credenciais:** Worker carrega OneSignal credentials dinamicamente por `tenant_id`.

---

## Console — Rotas e Arquitetura

### Rotas (Next.js App Router)

```
/dashboard              → Home (Hero Metrics de receita)
/notifications          → Histórico e listagem
  /[id]                 → Detalhe + funil + A/B
/automations            → Grid dos 9 flows
/analytics              → Dashboards e funis
/app                    → Config visual + Preview + Build
/integrations           → Conexões third-party
/customers              → Base app_users + segmentos
/billing                → Portal Stripe
/settings               → Conta, time, segurança
```

### Stack

- State: Zustand + SWR
- API client: `src/lib/api-client.ts` (injeta token Supabase Auth automaticamente)
- Auth SSR: `src/lib/supabase.ts` (middleware Next.js)
- Forms: React Hook Form + Zod (validação inline)
- Componentes: `components/ui/` (shadcn primitives) + `components/features/` (composites por feature)

---

## Mobile (Capacitor)

```
apps/mobile/
  capacitor.config.ts    → Config Capacitor
  src/                   → WebView wrapper code
  android/               → Android shell
  ios/                   → iOS shell
  configs/               → JSON configs por tenant (gerados pelo build)
```

- 1 código base, config JSON por tenant (parametrizado)
- MVP: build semi-manual. Fase 2: Fastlane + GitHub Actions
- Deep links com `?ref=push_{id}` para tracking
- App nunca fala direto com OneSignal — server-only
- Dados coletados: device_token, user_id, events, purchase_value, product_views
- Dados proibidos: localização precisa, contatos, dados do telefone

---

## UX Architecture (Console)

### Design System — Dark Premium Theme

- **Fundo:** `#050505`–`#0A0A0A`, cards `#121214`
- **Accent:** Roxo neon (`#A855F7` / Violet / Fuchsia)
- **Efeitos:** Neon glows (sem box-shadow tradicional), bordas `border-white/5`
- **Glassmorphism:** `backdrop-blur` em modals, dropdowns, top bar
- **Border-radius:** `lg`/`xl`/`2xl` (ultra-moderno)
- **Tipografia:** Inter/Geist/SF Pro, `tabular-nums` para valores financeiros
- **Sidebar:** Ultra-slim (ícones), retrátil

### Padrões UX

- **Drawers laterais** para edição contextual (automações, detalhes de usuário)
- **Alert Dialogs** (shadcn) para ações destrutivas
- **Tabelas server-side** paginadas com skeletons glow
- **Tenant Switcher** no header (multi-tenant)
- **Central de Notificações** (sino) para alertas do sistema

### Telas Chave

- **Dashboard:** Hero Metric "Receita gerada por push (R$)" + gráfico 30d + Top 5 notificações + automações ativas + status app
- **Automações:** Grid 9 cards com toggle on/off, badge status, delay, métricas resumo. Sheet lateral com editor template (chips variáveis), seletor delay, preview push
- **Analytics:** 4 sub-abas (Visão Geral, Por Notificação, Por Flow, Eventos). Funil visual, receita por flow, heatmap engajamento, comparativo A/B, distribuição plataforma
- **App:** 3 sub-abas (Config com dropzone R2 + color pickers + menu builder D&D, Preview mockup celular, Build com stepper + histórico)
- **Integrações:** Grid cards (Shopify, Nuvemshop, Klaviyo, OneSignal, Stripe) com badge status, última sync, accordion webhooks ativos
- **Usuários:** Tabela alta densidade + drawer com timeline eventos. Sub-aba Segmentos com regras visíveis
- **Billing:** Badge plano, barra progresso uso, ciclo cobrança, CTA upgrade, histórico faturas
- **Settings:** 3 sub-abas (Conta, Time com RBAC visual owner/editor/viewer + convite, Segurança com MFA TOTP + sessões ativas + mini audit log)

---

## Integrações — Detalhe

### Shopify

- OAuth flow (`SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`)
- Webhooks via `registerWebhooks()` do adapter
- Scope mínimo: `read_products`, `read_orders`, `read_customers`
- HMAC verification obrigatório, SSRF whitelist: `*.myshopify.com`
- Retry backoff + polling como backup se webhook falha

### Nuvemshop

- OAuth flow (`NUVEMSHOP_APP_ID`, `NUVEMSHOP_APP_SECRET`)
- Mesma interface `PlatformAdapter` do Shopify
- SSRF whitelist: `*.nuvemshop.com`

### Klaviyo

- **Read-only** — consome dados, nunca escreve/modifica campanhas
- Se Klaviyo cair, app continua operando (graceful degradation)

### OneSignal

- 1 app por cliente (provisionamento via REST API)
- `ONESIGNAL_API_KEY` (REST) + `ONESIGNAL_USER_AUTH_KEY` (cria/deleta apps)
- HMAC Identity Verification habilitado
- App IDs por tenant (armazenados no banco)

### Stripe

- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- `stripe_customer_id` e `stripe_subscription_id` na tabela tenants
- Mock em testes: stripe-mock (container)

---

## Database

### RLS

`auth.jwt() ->> 'tenant_id'` — stateless, nativo Supabase. Repository Pattern é defesa primária, RLS é defense-in-depth.

**Tabela `tenants` é caso especial:** RLS baseado em membership lookup (`EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.jwt() ->> 'sub')`), não em `tenant_id` no JWT.
- SELECT: qualquer membro ativo
- UPDATE: somente `owner`
- INSERT/DELETE: somente `service_role`

### 6 Cenários RLS Obrigatórios (por tabela)

1. Tenant A lê só dados de A
2. Tenant B lê só dados de B
3. Tenant A NÃO consegue ler dados de B
4. Sem JWT → acesso negado
5. JWT com tenant_id inválido → zero resultados
6. Tenant A INSERT com `tenant_id` de B → deve falhar

### Switch Tenant Flow

Login → JWT sem tenant → `POST /auth/switch-tenant` → valida membership → novo JWT com tenant_id

### Credenciais Encriptadas

Coluna JSONB única: `{ ct, iv, tag, alg }` (AES-256-GCM). Impossível salvar incompleto.

### Tabelas Core

- `tenants` — platform, credentials (encrypted), onesignal_app_id, plan_id, stripe IDs, notification limits
- `users` — Supabase Auth ID, email, name
- `memberships` — user_id + tenant_id + role (owner/editor/viewer)
- `app_configs` — app_name, icon, colors, build_status, per tenant (unique)
- `app_users` — usuários do app do cliente (push_opt_in, purchases, spent)
- `devices` — 1 user → N devices (device_token = OneSignal player ID)
- `app_user_segments` — N:N users↔segments (assigned_at, expires_at)
- `app_user_products` — viewed/favorited/purchased
- `app_events` — app_opened, product_viewed, add_to_cart, purchase_completed, push_opened, push_clicked
- `notifications` — manual/automated, flow_type (9 tipos), segment_rules JSONB, ab_variant, status machine
- `notification_deliveries` — per device, status tracking completo, INDEX (tenant_id, status, created_at)
- `automation_configs` — por flow_type por tenant (UNIQUE), is_enabled, delay_seconds, template_title/body
- `plans` — starter/business/elite, limits, stripe_price_id
- `audit_log` — action, resource, details JSONB

### Concorrência

1. **Incremento atômico** — `notification_count_current_period`: usa `SET col = col + 1` (atômico no PG)
2. **Registro concorrente de devices** — 5 devices simultâneos para mesmo `app_user_id`: todos criados (1 user → N devices)
3. **Optimistic locking em delivery status** — `UPDATE ... SET status = X WHERE id = Y AND status = Z RETURNING *`. Se retorna 0 rows, outro worker já processou

### Transactions

1. Rollback on error — throw no meio de `db.transaction()` reverte tudo
2. Commit on success — transação completa = dados persistidos
3. Atomicidade notification + delivery — se delivery INSERT falha, notification INSERT na mesma transação reverte (0 órfãs)

### Matriz RBAC (por endpoint)

| Endpoint | Viewer | Editor | Owner |
|---|---|---|---|
| `GET /api/notifications` | 200 | 200 | 200 |
| `POST /api/notifications` | 403 | 200 | 200 |
| `DELETE /api/notifications/:id` | 403 | 403 | 200 |
| `POST /api/billing/upgrade` | 403 | 403 | 200 |
| `POST /api/members/invite` | 403 | 403 | 200 |
| `PUT /api/settings` | 403 | 200 | 200 |
| `GET /api/analytics/overview` | 200 | 200 | 200 |

**Regra:** viewer=leitura, editor=leitura+escrita (sem delete/billing/members), owner=total.

### Index Performance

| Query | Index esperado |
|---|---|
| `notification_deliveries WHERE tenant_id AND status AND created_at` | `(tenant_id, status, created_at)` |
| `app_events WHERE tenant_id AND event_type AND created_at` | `(tenant_id, event_type, created_at)` |
| `automation_configs WHERE tenant_id AND flow_type` | Unique Index |

Testes com EXPLAIN ANALYZE + seed 10K rows → verificar Index Scan (nunca Seq Scan).

### Data Retention

- notification_deliveries: 180 dias (retention job)
- app_events: 90 dias
- Boundary: exatamente 180 dias → mantido. 181 dias → deletado
- Retention é global (não por tenant)
- Particionamento: trigger >50M rows (não dia 1)

### Migration Rules (Drizzle)

- Nunca editar migração existente
- Nunca modificar coluna shipped
- Toda migração idempotente
- Testar banco fresh + existente
- Verificar RLS policies pós-migration (`pg_policies`)
- Verificar `pg_class.relrowsecurity = true` para tabelas com tenant_id

### Schema Structure Tests

Para cada tabela, verificar contra PG real via `information_schema.columns`:
1. Colunas obrigatórias existem
2. Unique constraints (ex: `tenants.slug`, `automation_configs(tenant_id, flow_type)`)
3. Foreign keys (ex: `devices.app_user_id → app_users.id`)
4. Defaults (ex: `devices.is_active` default `true`)
5. Indexes via `pg_indexes`

### Seed Helpers

- `seedTenant(db, overrides?)` — slug único via `randomUUID().slice(0,8)`
- `seedAppUser(db, tenantId, overrides?)`
- `seedDevice(db, { tenantId, appUserId, isActive?, deviceToken? })`
- `seedNotification(db, { tenantId, title?, status?, type?, createdAt? })`
- `seedDelivery(db, { tenantId, status?, createdAt? })` — cria notif + user + device automaticamente
- `seed10KDeliveries(db, tenantId)` — bulk insert para testes de performance

---

## Notification Flows (9 tipos)

| Flow | Trigger | Delay |
|---|---|---|
| Carrinho abandonado | Webhook cart abandoned | 1-3h |
| PIX recovery | Webhook order pending (PIX) | 30min, 2h, 24h |
| Boleto recovery | Webhook order pending (boleto) | 1h, 24h, 48h |
| Boas-vindas | App install + primeiro acesso | 5min |
| Checkout abandonado | Webhook checkout abandoned | 1h |
| Pedido confirmado | Webhook order paid | Imediato |
| Rastreio criado | Webhook fulfillment created | Imediato |
| Browse abandoned | product_viewed sem add_to_cart | 2-4h |
| Upsell | Webhook order delivered | 3-7 dias |

### Conversion Attribution

- Multi-campanha: janela 1h (atribui à mais recente). Boundary: exatamente 1h = inclusive
- Normal: janela 24h. Boundary: exatamente 24h = inclusive. Após 24h = NÃO atribui

### Frequency Capping

| Plano | Limite diário por usuário |
|---|---|
| Starter | 2 pushes/dia |
| Business | 4 pushes/dia |
| Elite | Ilimitado (null) |

- Max 1 cart_abandoned por sessão
- Flow types independentes (cart_abandoned não bloqueia welcome)
- Contagem por `app_user`, NÃO por device
- Admin override para campanhas manuais (NÃO para flows automáticos)
- Reset de contadores à meia-noite UTC

### Plan Limits

- **Automáticas NUNCA param**, mesmo se limite atingido
- Só manuais são bloqueadas com soft limit + upsell
- Starter: 15 notificações/mês manuais
- Business/Elite: ilimitado

### Delivery Status Machine

```
pending → sent → delivered → opened → clicked → converted
                                               → failed (de qualquer estado)
```

Transição inválida (ex: pending → converted) → throw. Timestamps individuais: sent_at, delivered_at, opened_at, clicked_at, converted_at.

---

## Security

- OAuth tokens: AES-256-GCM, Supabase Vault para chave
- Push: server-only (app → backend → OneSignal → device)
- SSRF: whitelist `*.myshopify.com`, `*.nuvemshop.com`, `onesignal.com` + bloquear IPs privados
- Rate limiting: Redis sliding window (100/min admin, 20/s API pública)
- XSS: DOMPurify, input = texto puro, Zod server-side
- LGPD: opt-in push, opt-out fácil, endpoint de exclusão

### Testes de Segurança Obrigatórios

**AES-256-GCM (6 cenários):**
- Encrypt/decrypt roundtrip, JSONB deve conter ct/iv/tag/alg
- Rejeitar decrypt sem auth_tag, com ciphertext adulterado, com chave errada
- Mesmo plaintext → ciphertext diferente (IV aleatório)

**SSRF (4 categorias):**
- Permitir domínios whitelisted
- Bloquear IPs privados (127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Bloquear variantes de localhost (0.0.0.0, [::1])
- Bloquear subdomain spoofing (`myshopify.com.evil.com`)

**JWT (4 cenários):**
- Sem Authorization header → 401
- JWT expirado → 401
- JWT com secret errado → 401
- JWT sem tenant_id em rotas protegidas → 400

**XSS/Injection (4 cenários):**
- Remover `<script>` de título, `<img onerror>` do body
- Preservar caracteres seguros (acentos, símbolos monetários) e emojis

### Stripe Webhooks

**Lifecycle:**
- `invoice.payment_succeeded` → ativa tenant + reseta notification_count para 0
- `invoice.payment_failed` → mantém ativo + grace period 3 dias + audit log
- `customer.subscription.deleted` → desativa tenant + pausa TODAS automações
- Upgrade → aplica limites ampliados IMEDIATAMENTE
- Downgrade → registra `pendingPlanChange` para próximo ciclo

**Security:**
- Rejeitar Stripe-Signature inválida
- Rejeitar timestamp >5min (replay attack protection)
- Idempotency: mesmo evento 2x = update apenas 1x

### LGPD

- Push opt-out atualiza status e bloqueia futuras notificações
- Toda mudança opt-in/opt-out registrada no audit_log
- Exclusão de dados: deletar TODOS dados do app_user
- Anonimizar deliveries (`app_user_id = null`), NÃO deletar — preservar métricas
- Registrar exclusão no audit_log com flag `deliveriesAnonymized`

---

## Coding Conventions

- TypeScript strict mode
- Biome (lint + format, sem ESLint/Prettier)
- camelCase (TypeScript + Drizzle)
- Nunca `any` → `unknown` + type guard
- Imports: `@/` prefix (absolute)
- Async/await (nunca .then chains)
- Env vars: Zod no startup (fail fast)
- Logs: structured JSON (nunca console.log em prod)
- Package scope: `@appfy/*`

---

## Environment Variables

```
DATABASE_URL, DIRECT_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, NUVEMSHOP_APP_ID, NUVEMSHOP_APP_SECRET,
KLAVIYO_API_KEY, ONESIGNAL_API_KEY, ONESIGNAL_USER_AUTH_KEY, REDIS_URL,
CLOUDFLARE_R2_ACCOUNT_ID/ACCESS_KEY/SECRET_KEY/BUCKET,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SENTRY_DSN, SENTRY_AUTH_TOKEN,
ENCRYPTION_SECRET (>=32 chars)
```

Todas validadas com Zod no startup (fail fast).

---

## O que NUNCA Fazer

1. Remover RLS policies sem migração substituta
2. Tokens/credenciais em plaintext
3. Push direto do app
4. Acessar banco sem repository (bypass tenant_id)
5. Editar migração Drizzle existente
6. Commitar secrets
7. Remover audit trail de notificações
8. Pular validação no pipeline
9. Tratar input como HTML
10. Deploy sem CI verde

---

# TDD — Guia Prático

## Fluxo de Trabalho

```
1. Recebeu task → Consulte TDD_ARQUITETURA (como testar)
2. Implemente → Consulte TDD_DEV (cenários do módulo)
3. Envolveu banco → Consulte TDD_DATABASE
4. RED-GREEN-REFACTOR: Layer 1 → 2 → 3 → 4
5. Antes do PR → Consulte TDD_QA (gates G0-G7)
```

## 4 Layers de Teste

| Layer | O que testa | Deps |
|---|---|---|
| Layer 1 — Domain puro | Validações, regras de negócio, tipos | Zero deps externas |
| Layer 2 — Use Cases | Services com repos/providers mockados | Mocks via factory DI |
| Layer 3 — Infra real | Repos com DB real, providers com MSW | Testcontainers, MSW |
| Layer 4 — HTTP Hono | Rotas end-to-end | `app.request()` com deps mockadas/reais |

**Regra:** Sempre comece pelo Layer 1. Nunca pule do Layer 1 para o Layer 4.

## Convenções de Teste

| Tipo | Sufixo | Gate CI | Localização |
|---|---|---|---|
| Unitário | `.spec.ts` | G1 | Co-locado (junto ao fonte) |
| Integração | `.integration.spec.ts` | G2 | Co-locado ou test-utils |
| Isolamento | `.isolation.spec.ts` | G2 | `packages/test-utils/src/isolation/` |
| E2E | `.e2e.spec.ts` | G6 | `packages/test-utils/src/e2e/` |
| Arquitetura | `.arch.spec.ts` | G1 | `packages/test-utils/src/architecture/` |

### Padrão Obrigatório

- `makeSut()` + AAA (Arrange/Act/Assert) em todo teste
- Naming: `*.spec.ts` (nunca `*.test.ts`)
- Builders (não fixtures estáticas) — resistentes a mudanças de schema
- Pirâmide: 70% unit / 20% integration / 10% E2E

## Builders — Pattern de Dados de Teste

Fluent API com defaults sensatos. Cada builder gera `id: randomUUID()` por default.

```typescript
new NotificationBuilder().withTenant('t-1').withTitle('Promo').automated('cart_abandoned').build()
new DeviceBuilder().withTenant('t-1').withUser('u-1').ios().inactive().build()
new AppUserBuilder().withTenant('t-1').highValue().optedOut().build()
```

**Regra:** Dados mínimos válidos sem nenhum `.with*()`. Resistentes a mudanças de schema.

## Spies — Alternativa a Mocks

Classes Spy com contadores e captura de input (em vez de `vi.fn()` ou `vi.mock()`).

**Spies disponíveis:**
- `NotificationRepositorySpy` — create, updateStatus
- `PushProviderSpy` — sendNotification, createApp, getDeliveryStatus (implements PushProvider)
- `MembershipRepositorySpy` — find (configura findResult)
- `BullMQSpy` — add (captura addedJobs com opts.delay)
- `AuditLogRepositorySpy`, `DeviceRepositorySpy`, `TenantRepositorySpy`
- `AutomationConfigRepositorySpy`, `AppEventRepositorySpy`, `DeliveryRepositorySpy`, `CacheSpy`

**Test Doubles — quando usar:**

| Tipo | Quando | Exemplo |
|---|---|---|
| Spy | Verificar chamadas + controlar retorno | NotificationRepositorySpy |
| Stub | Só controlar retorno | AutomationConfigStub |
| Mock | Verificar que método FOI chamado | AuditLogMock |
| Fake | Implementação simplificada funcional | InMemoryNotificationRepo |

## Mock Strategy

| Serviço | Como mockar |
|---|---|
| Supabase Auth | jose (gerar JWTs) |
| OneSignal | MSW (interceptar HTTP) |
| Shopify | MSW + HMAC verification |
| Stripe | stripe-mock (container) |
| Redis/PG | testcontainers |
| Klaviyo | MSW |
| Cloudflare R2 | MinIO (container) |

**MSW centralizado:** `test/mocks/server.ts` combina onesignalHandlers + shopifyHandlers + stripeHandlers.

## Vitest Config

### Pool Strategy
- **unit**: `pool: 'threads'` (paralelo, máxima velocidade)
- **integration**: `pool: 'forks'`, `singleFork: true` (sequencial, isolamento)
- **isolation**: `pool: 'forks'`, `singleFork: true`

### Coverage
- Provider: `v8`
- Thresholds: `{ lines: 80, branches: 80, functions: 80 }`

### Coverage por Package

| Package | Mínimo | Alvo |
|---|---|---|
| `core/services` | 85% | 90% |
| `core/repositories` | 80% | 85% |
| `api/middleware` | 80% | 90% |
| `core/notifications` | 85% | 90% |
| `integrations` | 75% | 80% |
| `db` | 70% | 80% |
| `shared` | 90% | 95% |
| `workers` | 75% | 85% |

### Global Setup
- `test/global-setup.ts`: sobe PG 16 + Redis 7 via testcontainers, roda migrations
- `test/setup-integration.ts`: cria DrizzleClient, trunca tabelas em `beforeEach`

### Path Aliases
```typescript
alias: { '@': 'packages/api/src', '@db': 'packages/db/src', '@integrations': '...', '@shared': '...' }
```

## Docker Compose Test

```yaml
postgres-test:  PG 16 Alpine, porta 5433, tmpfs (RAM), fsync=off
redis-test:     Redis 7 Alpine, porta 6380, sem persistência
minio-test:     MinIO, porta 9001, tmpfs
stripe-mock:    stripe/stripe-mock, porta 12111
```

```bash
# .env.test
DATABASE_URL=postgresql://test:test@localhost:5433/appfy_test
REDIS_URL=redis://localhost:6380
ENCRYPTION_SECRET=test-32-char-encryption-secret!!
```

## CI Pipeline — 8 Gates (G0-G7)

| Gate | Onde | O que valida | Se falhar |
|---|---|---|---|
| G0 | Pre-commit (local) | `biome format --check` + `biome lint` + `tsc --noEmit` | Commit bloqueado |
| G1 | CI (push) | `vitest run --project unit` + coverage ≥ 80% + delta | PR bloqueado |
| G2 | CI (push) | Integration + isolation + migrations (dry-run) | PR bloqueado |
| G3 | CI (push) | `pnpm audit` + CodeQL + `trufflehog --only-verified` | PR bloqueado |
| G4 | CI (push) | Build API + Console + Shared | PR bloqueado |
| G5 | CI (merge) | Deploy staging + `curl /health` → 200 | Deploy bloqueado |
| G6 | CI (post-deploy) | Smoke tests + Playwright E2E | Rollback automático |
| G7 | Manual | Review humano + rollback plan + Sentry | Deploy cancelado |

**Nenhum merge em main se qualquer gate falhar.**

## Cenários TDD Críticos por Módulo

### Auth
- JWT expirado/inválido → 401
- Switch tenant sem membership → throw
- Switch tenant com membership → JWT com tenant_id + role

### Notifications
- Sanitização XSS (título e body)
- Título vazio → throw
- Audit log em toda criação
- Status inicial sempre `draft`

### Plan Limits
- Manual no limite → bloqueada
- Manual no `limite - 1` → permitida (boundary)
- **Automated NUNCA bloqueia**
- Plano ilimitado (`null`) → sempre permite

### Push Dispatch
- Busca apenas devices ativos
- Cria delivery record por device com status `sent`
- Zero devices ativos → não chama pushProvider

### Events (Ingest)
- `product_viewed` → agenda check `browse_abandoned`
- Primeiro `app_opened` → trigger `welcome`. Segundo+ → NÃO
- **Dedup**: mesmo evento dentro de 5s → não cria

### Devices
- User não existe → cria app_user + device
- Token rotacionado → desativa device antigo

### Billing
- Nova subscription → Stripe + salva IDs no tenant
- Upgrade → atualiza subscription + reseta notification count

### Encryption
- Round-trip: encrypt → decrypt = original
- Mesmo input → outputs diferentes (IV aleatório)
- Ciphertext adulterado / auth_tag ausente / chave errada → throw

### A/B Testing
- 2 variantes max no MVP, split 50/50 default ou custom
- Split que não soma 100% → throw
- Winner por conversion rate — amostra mínima 100 deliveries
- Diferença < 1% → empate

### Segments
- Avaliação regras JSONB (gte, lt, eq), AND/OR
- Refresh: adiciona quem qualifica, remove quem não

### Analytics/Metrics
- Division by zero: delivered=0 → rates=0
- Worker de agregação idempotente (UPSERT)

### Template Variables
- Substituir todas variáveis conhecidas
- Variável obrigatória ausente → throw
- Sanitizar XSS dentro de variáveis

### Automation Flows (9 tipos — testes obrigatórios)
Para CADA flow:
1. Cria delayed job no BullMQ com delay correto
2. NÃO dispara se `is_enabled = false`
3. Usa delay customizado de `automation_configs`
4. Usa template customizado
**Total: 36 testes mínimos (4 × 9)**

## Testes de Workers (BullMQ)

1. **Timing:** Jobs assíncronos — usar `waitForJob()` helpers
2. **Retry:** Backoff exponencial — testar com clock mockado
3. **Dead Letter Queue:** Jobs que falham 3x → DLQ
4. **MetricsWorker idempotente:** UPSERT, reprocessamento não duplica

## Matriz de Isolamento (60 testes)

| Tabela | findAll | findById | create | update | delete | count |
|---|---|---|---|---|---|---|
| notifications | X | X | X | X | X | X |
| notification_deliveries | X | X | X | X | X | X |
| app_users | X | X | X | X | X | X |
| devices | X | X | X | X | X | X |
| app_events | X | X | X | — | — | X |
| app_user_segments | X | X | X | X | X | X |
| app_user_products | X | X | X | X | X | X |
| automation_configs | X | X | X | X | — | X |
| app_configs | X | X | X | X | — | X |
| audit_log | X | X | X | — | — | X |

## Contract Testing

Função reutilizável valida que qualquer adapter implementa a interface:
```typescript
platformAdapterContractTest('Shopify', () => new ShopifyAdapter(mockConfig))
platformAdapterContractTest('Nuvemshop', () => new NuvemshopAdapter(mockConfig))
pushProviderContractTest('OneSignal', () => new OneSignalProvider(mockConfig))
```

## Performance Tests

| Métrica | Limite |
|---|---|
| API response time | p95 < 200ms |
| Push dispatch latency | < 5s |
| Worker queue depth | alerta > 10K |
| DB query time | p95 < 50ms |
| Push delivery rate | > 95% |
| Error rate por tenant | alerta > 5% |

Load test semanal com k6: 50 VUs, sustain 1min, thresholds p95<200ms, error rate <1%.

## Distribuição Esperada de Testes

| Package | Unit | Integration | E2E | Total |
|---|---|---|---|---|
| API (routes + middleware) | 40 | 30 | 20 | 90 |
| API (services) | 80 | 10 | — | 90 |
| API (repositories) | 20 | 40 | — | 60 |
| Core (notifications) | 60 | 15 | 10 | 85 |
| Integrations | 50 | 20 | 5 | 75 |
| DB | 10 | 30 | — | 40 |
| Shared | 30 | — | — | 30 |
| Workers | 20 | 15 | 5 | 40 |
| **Total** | **310** | **160** | **40** | **~510** |

**Tempos:** Unit < 5s, Integration < 60s, E2E < 5min. **Total CI < 7min.**

## Regras Estruturais (verificadas por teste)

1. Todo `*.repository.ts` em core DEVE estender `BaseRepository`
2. Toda tabela com `tenant_id` DEVE ter teste de isolamento (SELECT/UPDATE/DELETE cross-tenant)
3. `base.repository.ts` DEVE ter cobertura de 100%
4. Pipeline de notificações DEVE ter teste de integridade (steps não podem ser pulados)

## Checklist Pré-PR

- [ ] Testes começam no Layer 1 (domain puro)?
- [ ] `makeSut()` + AAA em todos os testes?
- [ ] Arquivos nomeados `*.spec.ts`?
- [ ] Coverage ≥ 80%?
- [ ] Isolamento multi-tenant testado (se envolveu dados)?
- [ ] RLS policy testada (se criou/alterou tabela)?
- [ ] Mock strategy correta (spy → MSW → real)?
- [ ] Nenhum `.only` ou `.skip` esquecido?
- [ ] `biome check` + `tsc --noEmit` passando?
- [ ] Sentry configurado para novo módulo?

---

## Docs de Referência (consultar sob demanda)

| Doc | Quando usar |
|---|---|
| `TDD/TDD_ARQUITETURA.md` | Antes de criar qualquer teste (como testar, layers, mocks, DI) |
| `TDD/TDD_DEV.md` | Ao iniciar módulo específico (cenários RED-GREEN-REFACTOR por módulo) |
| `TDD/TDD_DATABASE.md` | Ao criar/alterar tabelas, RLS, migrations, queries |
| `TDD/TDD_QA.md` | Antes de abrir PR, rodar CI, validar segurança |
| `docs/ux_architecture.md` | Ao implementar telas do console (layout, componentes, rotas) |

---

## Bootstrap Order

```
1. Root config (package.json, pnpm-workspace, turbo.json, tsconfig.base, biome.json)
2. packages/shared
3. packages/db
4. packages/core
5. packages/integrations
6. packages/test-utils
7. vitest.workspace.ts
8. docker-compose.yml + docker-compose.test.yml
9. .env.example + scripts/setup.sh
10. apps/api (Hono + health)
11. apps/workers (BullMQ + Redis)
12. apps/console (Next.js + Supabase Auth)
13. apps/mobile (Capacitor)
```

## Turborepo Pipeline

Tasks: `build` (dependsOn ^build), `dev`, `typecheck`, `lint`, `test`, `test:integration`, `test:isolation`, `db:generate`, `db:push`, `db:migrate`.

## Workflow por Feature

```
PLAN → TEST (TDD, antes do código) → BUILD → REVIEW → TEST (todos) → CI verde → DEPLOY
```

- Cada commit é production-ready
- Nunca "commit que quebra, conserto no próximo"
- O humano decide O QUÊ, o agente decide O COMO
