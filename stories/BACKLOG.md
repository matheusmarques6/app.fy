# AppFy MVP Backlog

> Generated: 2026-03-14 | Product Owner: Pax
> Total Epics: 16 | Total Stories: 52 | Estimated: ~45-55 dev-days

---

## Execution Priority Order

The order follows the dependency graph (leaf-first) and business value. Each phase unlocks the next.

```
Phase 1 — Foundation (must be first, everything depends on it)
  Epic 1: packages/shared (types, constants, utils)
  Epic 2: packages/db (Drizzle schema, migrations, RLS, seeds)
  Epic 3: Security & Encryption (AES-256-GCM, SSRF, sanitization)

Phase 2 — Auth & Multi-Tenancy (unlocks all API work)
  Epic 4: Auth (JWT, Supabase Auth, switch-tenant, membership)
  Epic 5: Tenants (CRUD, RBAC, middleware chain)
  Epic 5B: API Infrastructure (middleware chain, env validation, audit log service)

Phase 3 — Core Domain (the product's core logic)
  Epic 6: App Users, Devices & Segments (registration, token rotation, segment rules)
  Epic 7: Notifications (pipeline, templates, A/B, manual dispatch)
  Epic 8: Automations (9 flow configs, BullMQ scheduling)
  Story 12.4: OneSignal Provisioning (executed here — prerequisite for Push Dispatch)

Phase 4 — Push & Tracking (revenue engine)
  Epic 9: Push Dispatch (delivery tracking, frequency capping)
  Epic 10: Events & Ingestion (app events, dedup, triggers)

Phase 5 — Business Operations
  Epic 11: Billing (Stripe, plans, limits, webhooks)
  Epic 12: Integrations (Shopify, Nuvemshop, Klaviyo)

Phase 6 — Analytics & Console
  Epic 13: Analytics (metrics aggregation, dashboards)
  Epic 14: App Config & Build (visual customization, Capacitor)

Phase 7 — Compliance & Hardening
  Epic 15: LGPD & Data Retention
  Epic 16: CI/CD Pipeline (Gates G0-G7)
```

### Dependency Graph (Critical Path)

```
shared ──→ db ──→ core (auth + tenants) ──→ app-users/devices ──→ notifications ──→ automations
                                                                       │                  │
                                                                       ▼                  ▼
                                                                  push-dispatch ◄── events/ingestion
                                                                       │
                                                                       ▼
                                                              billing + integrations
                                                                       │
                                                                       ▼
                                                              analytics + app-config
```

---

## Epic 1 — Shared Package (`packages/shared`)

> Foundation types, constants, and utilities shared across all packages.
> **Priority:** P0 | **Total Size:** M

### Story 1.1 — Core Types & Interfaces [S]

**Como** desenvolvedor, **quero** tipos TypeScript compartilhados exportados de `@appfy/shared`, **para** garantir type safety em todo o monorepo.

**Acceptance Criteria:**
- [ ] Export all domain types: Tenant, User, Membership, AppUser, Device, Notification, Delivery, AutomationConfig, AppConfig, Plan, AuditLog, AppEvent
- [ ] Export enums: UserRole (owner/editor/viewer), NotificationStatus, DeliveryStatus, FlowType (9 types), EventType, PlanTier
- [ ] Export interface contracts: PlatformAdapter, PushProvider
- [ ] Zero runtime dependencies (types only + pure utils)
- [ ] `pnpm --filter @appfy/shared build` succeeds

**blocks:** [1.2, 2.1, 4.1]

#### Arquiteto
- Define all interfaces as `type` or `interface` (prefer `type` for unions, `interface` for contracts)
- DeliveryStatus must model the state machine: `pending | sent | delivered | opened | clicked | converted | failed`
- FlowType: `cart_abandoned | pix_recovery | boleto_recovery | welcome | checkout_abandoned | order_confirmed | tracking_created | browse_abandoned | upsell`

#### Database
- No DB involvement — pure types

#### Dev
- Layer 1 only (pure domain types)
- Files: `packages/shared/src/types/`, `packages/shared/src/enums/`, `packages/shared/src/interfaces/`
- Test: type compilation tests (ensure types are correctly exported)

#### QA
- `tsc --noEmit` passes
- All types importable from `@appfy/shared`
- No `any` usage

---

### Story 1.2 — Constants & Configuration Values [XS]

**Como** desenvolvedor, **quero** constantes centralizadas (JWT config, rate limits, queue names, allowed events), **para** evitar magic strings e duplicacao.

**Acceptance Criteria:**
- [ ] JWT constants: token expiry, issuer, audience values
- [ ] Queue names: `push-dispatch`, `data-ingestion`, `analytics` (matching BullMQ queue config)
- [ ] Rate limit tiers: 100/min admin, 20/s public API
- [ ] Allowed event types: `app_opened`, `product_viewed`, `add_to_cart`, `purchase_completed`, `push_opened`, `push_clicked`
- [ ] Plan limits: Starter (15 manual/month, 2 push/day), Business (unlimited, 4/day), Elite (unlimited, null)
- [ ] Frequency capping defaults per plan
- [ ] All values exported as `const` (frozen objects)

**blocked-by:** [1.1]
**blocks:** [4.1, 7.1, 9.3]

#### Arquiteto
- Use `as const` satisfies pattern for type-safe constants
- Group by domain: `AUTH_CONFIG`, `QUEUE_NAMES`, `RATE_LIMITS`, `PLAN_LIMITS`, `EVENT_TYPES`

#### Dev
- Layer 1: test that constants have expected values and are frozen
- Files: `packages/shared/src/constants/`

#### QA
- Verify no mutable exports
- Verify plan limits match spec exactly

---

### Story 1.3 — Utility Functions (Validation, Sanitization) [S]

**Como** desenvolvedor, **quero** funcoes utilitarias puras (sanitizeHtml, validateEmail, slugify), **para** reutilizar logica sem duplicar.

**Acceptance Criteria:**
- [ ] `sanitizeText(input)` — strips `<script>`, `<img onerror>`, preserves accents/emojis/currency symbols
- [ ] `slugify(name)` — URL-safe slug generation
- [ ] `isValidUUID(str)` — UUID v4 validation
- [ ] `formatCurrency(value, locale)` — BRL formatting
- [ ] All functions are pure (no side effects)
- [ ] 95% test coverage on shared package

**blocked-by:** [1.1]
**blocks:** [7.2]

#### Arquiteto
- XSS sanitization is critical — must handle all OWASP top vectors
- Do NOT use DOMPurify server-side (DOM dependency); use regex-based approach or `sanitize-html` library

#### Dev
- Layer 1 only: pure function tests
- TDD scenarios: XSS vectors from CLAUDE.md (script tags, img onerror, preserving safe chars)

#### QA
- [ ] `<script>alert(1)</script>` in title → stripped
- [ ] `<img onerror="alert(1)">` in body → stripped
- [ ] Accents (acai, cafe) → preserved
- [ ] Currency symbols (R$, $, EUR) → preserved
- [ ] Emojis → preserved

---

## Epic 2 — Database Package (`packages/db`)

> Drizzle schema, migrations, RLS policies, seed helpers, and base repository.
> **Priority:** P0 | **Total Size:** XL

### Story 2.1 — Drizzle Schema: Core Tables [L]

**Como** desenvolvedor, **quero** o schema Drizzle completo com todas as tabelas core, **para** que migrations possam ser geradas e aplicadas.

**Acceptance Criteria:**
- [ ] All 14 tables defined in Drizzle: `tenants`, `users`, `memberships`, `app_configs`, `app_users`, `devices`, `app_user_segments`, `app_user_products`, `app_events`, `notifications`, `notification_deliveries`, `automation_configs`, `plans`, `audit_log`
- [ ] Every table with tenant data has `tenant_id` column (NOT NULL, FK to tenants)
- [ ] Unique constraints: `tenants.slug`, `automation_configs(tenant_id, flow_type)`, `app_configs(tenant_id)`
- [ ] Foreign keys: `devices.app_user_id → app_users.id`, `memberships.user_id + tenant_id`, etc.
- [ ] Correct defaults: `devices.is_active = true`, `notifications.status = 'draft'`, timestamps
- [ ] Composite indexes: `notification_deliveries(tenant_id, status, created_at)`, `app_events(tenant_id, event_type, created_at)`
- [ ] `notifications` has JSONB columns: `segment_rules`, `ab_config`
- [ ] `tenants` has encrypted JSONB column: `credentials { ct, iv, tag, alg }`
- [ ] `drizzle-kit generate` produces valid migration SQL

**blocked-by:** [1.1]
**blocks:** [2.2, 2.3, 2.4, 4.1, 5.1, 6.1, 7.1]

#### Arquiteto
- Use `pgTable` from drizzle-orm/pg-core
- Delivery status as enum type in PG (not string)
- `notification_count_current_period` on tenants for atomic increment
- `stripe_customer_id`, `stripe_subscription_id` on tenants
- Credential column: single JSONB `{ ct, iv, tag, alg }` — AES-256-GCM

#### Database
- Schema file: `packages/db/src/schema/`
- Split by domain: `tenants.ts`, `users.ts`, `notifications.ts`, `devices.ts`, `events.ts`, `automations.ts`, `billing.ts`, `audit.ts`
- Migration: `packages/db/drizzle/`
- Test: schema structure tests against `information_schema.columns` (Layer 3)

#### Dev
- Layer 1: type exports compile correctly
- Layer 3: migration applies to real PG (testcontainers), verify columns/constraints via `information_schema`

#### QA
- [ ] All 14 tables exist after migration
- [ ] Every tenant-scoped table has `tenant_id` NOT NULL
- [ ] Unique constraints enforced (duplicate slug → error)
- [ ] FK cascade behavior verified
- [ ] Indexes exist (check `pg_indexes`)

---

### Story 2.2 — RLS Policies for All Tables [L]

**Como** engenheiro de seguranca, **quero** RLS policies em todas as tabelas com `tenant_id`, **para** garantir isolamento de dados mesmo se o Repository Pattern falhar.

**Acceptance Criteria:**
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for all tenant-scoped tables
- [ ] Standard policy: `USING (tenant_id = auth.jwt() ->> 'tenant_id')` for SELECT/UPDATE/DELETE
- [ ] INSERT policy: `WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id')`
- [ ] Special case: `tenants` table uses membership lookup for SELECT, owner-only for UPDATE
- [ ] `pg_class.relrowsecurity = true` verified for all tenant tables
- [ ] 6 mandatory RLS scenarios tested per table (60+ tests total)

**blocked-by:** [2.1]
**blocks:** [2.5]

#### Arquiteto
- RLS is defense-in-depth (Repository Pattern is primary defense)
- `tenants` table: SELECT via `EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.jwt() ->> 'sub' AND tenant_id = tenants.id)`
- INSERT/DELETE on tenants: `service_role` only

#### Database
- Migration file(s) for RLS policies
- Verify via `pg_policies` system catalog
- Test with different JWT claims using `set_config('request.jwt.claims', ...)`

#### Dev
- Layer 3: real DB tests with testcontainers
- Test each of the 6 scenarios per table from the spec
- Use `seedTenant` helpers to create multi-tenant test data

#### QA
- [ ] Tenant A reads only tenant A data (10 tables)
- [ ] Tenant A cannot read tenant B data (10 tables)
- [ ] No JWT → access denied (10 tables)
- [ ] Invalid tenant_id in JWT → zero results
- [ ] Cross-tenant INSERT fails
- [ ] `tenants` table: member can SELECT, non-member cannot

---

### Story 2.3 — Base Repository & Factory DI [M]

**Como** desenvolvedor, **quero** um BaseRepository generico com `tenantId` obrigatorio e factory DI, **para** garantir isolamento em toda operacao de dados.

**Acceptance Criteria:**
- [ ] `BaseRepository<T>` with mandatory `tenantId` parameter on every method
- [ ] Methods: `findAll(tenantId, filters?)`, `findById(tenantId, id)`, `create(tenantId, data)`, `update(tenantId, id, data)`, `delete(tenantId, id)`, `count(tenantId, filters?)`
- [ ] All methods add `WHERE tenant_id = ?` automatically
- [ ] `createDependencies(overrides?)` factory function for DI
- [ ] 100% coverage on BaseRepository

**blocked-by:** [2.1]
**blocks:** [4.2, 5.1, 6.1, 7.1]

#### Arquiteto
- BaseRepository lives in `packages/core/src/repositories/base.repository.ts`
- Factory DI in `packages/core/src/create-dependencies.ts`
- Pattern: `createDependencies({ notificationRepo: spy })` for test overrides

#### Dev
- Layer 1: interface tests
- Layer 2: service tests with spy repos
- Layer 3: real DB integration tests
- Architecture test: every `*.repository.ts` must extend BaseRepository

#### QA
- [ ] Cannot call any repo method without tenantId
- [ ] findAll with tenantA returns only tenantA data
- [ ] 100% branch coverage on BaseRepository

---

### Story 2.4 — Seed Helpers & Test Builders [M]

**Como** desenvolvedor, **quero** seed helpers e builders fluent, **para** criar dados de teste resistentes a mudancas de schema.

**Acceptance Criteria:**
- [ ] Seed helpers: `seedTenant`, `seedAppUser`, `seedDevice`, `seedNotification`, `seedDelivery`, `seed10KDeliveries`
- [ ] Builders (fluent API): `TenantBuilder`, `AppUserBuilder`, `DeviceBuilder`, `NotificationBuilder`, `DeliveryBuilder`, `AutomationConfigBuilder`, `AppEventBuilder`
- [ ] Every builder generates valid data with zero `.with*()` calls
- [ ] Every builder generates unique `id: randomUUID()` by default
- [ ] Seed helpers create full dependency chain (e.g., `seedDelivery` creates notification + user + device)
- [ ] All Spy classes implemented: `NotificationRepositorySpy`, `PushProviderSpy`, `MembershipRepositorySpy`, `BullMQSpy`, `AuditLogRepositorySpy`, `DeviceRepositorySpy`, `TenantRepositorySpy`, `AutomationConfigRepositorySpy`, `AppEventRepositorySpy`, `DeliveryRepositorySpy`, `CacheSpy`

**blocked-by:** [2.1, 1.1]
**blocks:** [4.2, 6.2, 7.2, 8.1]

#### Arquiteto
- Builders in `packages/test-utils/src/builders/`
- Spies in `packages/test-utils/src/spies/`
- Seed helpers in `packages/test-utils/src/seeds/`
- Builders must produce objects matching Drizzle insert types

#### Dev
- Layer 1: builder produces valid objects
- Layer 3: seed helpers insert into real DB

#### QA
- [ ] `new NotificationBuilder().build()` is valid without any `.with*()`
- [ ] Builders are resistant to schema changes (add column → only builder changes)
- [ ] Spies capture call counts and arguments correctly

---

### Story 2.5 — Multi-Tenant Isolation Tests [M]

**Como** QA engineer, **quero** a matriz completa de 60 testes de isolamento, **para** garantir que nenhuma operacao vaza dados entre tenants.

**Acceptance Criteria:**
- [ ] 10 tables x 6 operations = 60 isolation tests (per the isolation matrix)
- [ ] Each test: create data for tenant A and B, verify tenant A operations only see tenant A data
- [ ] Tests run against real PG (testcontainers)
- [ ] All tests in `packages/test-utils/src/isolation/`
- [ ] Tests are parameterized (table-driven, not copy-paste)

**blocked-by:** [2.1, 2.2, 2.3, 2.4]
**blocks:** [] (validation gate, does not block features)

#### Database
- Tables: notifications, notification_deliveries, app_users, devices, app_events, app_user_segments, app_user_products, automation_configs, app_configs, audit_log
- Operations: findAll, findById, create, update, delete, count (where applicable)

#### Dev
- Layer 3: integration tests with real DB
- Use seed helpers to create parallel tenant data
- Parameterized test factory: `isolationTestSuite(tableName, repo, seedFn)`

#### QA
- [ ] 60 tests pass
- [ ] Zero cross-tenant data leaks
- [ ] Tests run in < 60s total

---

## Epic 3 — Security & Encryption

> Encryption service, SSRF protection, input sanitization.
> **Priority:** P0 | **Total Size:** L

### Story 3.1 — AES-256-GCM Encryption Service [M]

**Como** engenheiro de seguranca, **quero** um servico de encriptacao AES-256-GCM, **para** armazenar credenciais OAuth de forma segura.

**Acceptance Criteria:**
- [ ] `encrypt(plaintext, secret)` → `{ ct, iv, tag, alg }` JSONB
- [ ] `decrypt(encrypted, secret)` → original plaintext
- [ ] Same plaintext → different ciphertext (random IV)
- [ ] Reject: missing auth_tag, tampered ciphertext, wrong key
- [ ] `ENCRYPTION_SECRET` must be >= 32 chars (Zod validated at startup)
- [ ] Service in `packages/core/src/security/encryption.service.ts`

**blocks:** [5.2, 12.1]

#### Arquiteto
- Use Node.js `crypto` module (no external deps)
- JSONB format: `{ ct: base64, iv: base64, tag: base64, alg: 'aes-256-gcm' }`
- Never log plaintext credentials

#### Dev
- Layer 1: 6 mandatory test scenarios from spec
- TDD: write tests first, then implement
- Edge cases: empty string, very long string, unicode

#### QA
- [ ] Round-trip: encrypt → decrypt = original
- [ ] JSONB output contains ct, iv, tag, alg
- [ ] Tampered ciphertext → throws
- [ ] Missing auth_tag → throws
- [ ] Wrong key → throws
- [ ] Same input → different outputs (run 10x, all different)

---

### Story 3.2 — SSRF Protection Utility [S]

**Como** engenheiro de seguranca, **quero** validacao de URLs antes de requests externos, **para** prevenir ataques SSRF.

**Acceptance Criteria:**
- [ ] `validateUrl(url)` function that checks against whitelist and blocks private IPs
- [ ] Whitelist: `*.myshopify.com`, `*.nuvemshop.com`, `onesignal.com`, `api.stripe.com`
- [ ] Block: `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `0.0.0.0`, `[::1]`
- [ ] Block subdomain spoofing: `myshopify.com.evil.com` → rejected
- [ ] Utility in `packages/core/src/security/ssrf.ts`

**blocks:** [12.1, 12.2]

#### Dev
- Layer 1: pure function tests
- 4 test categories from spec (whitelist, private IPs, localhost variants, subdomain spoofing)

#### QA
- [ ] `https://store.myshopify.com/admin/api` → allowed
- [ ] `http://127.0.0.1:8080` → blocked
- [ ] `http://[::1]` → blocked
- [ ] `https://myshopify.com.evil.com` → blocked
- [ ] `http://10.0.0.1/internal` → blocked

---

### Story 3.3 — Rate Limiting Middleware [S]

**Como** operador do sistema, **quero** rate limiting com Redis sliding window, **para** proteger a API contra abuso.

**Acceptance Criteria:**
- [ ] Redis sliding window implementation
- [ ] 3 tiers: admin (100/min), public API (20/s), webhook receivers (50/min)
- [ ] Returns `429 Too Many Requests` with `Retry-After` header
- [ ] Hono middleware: `rateLimitMiddleware(tier)`
- [ ] Graceful fallback if Redis is down (allow traffic, log warning)

**blocked-by:** [1.2]
**blocks:** []

#### Arquiteto
- Middleware in `apps/api/src/middleware/rate-limit.ts`
- Redis key: `rl:{tier}:{identifier}:{window}`
- Use MULTI/EXEC for atomic increment + expire

#### Dev
- Layer 2: mock Redis, test rate counting logic
- Layer 4: HTTP tests verifying 429 responses

#### QA
- [ ] 101st request in 1 min → 429
- [ ] After window expires → allowed again
- [ ] Redis down → requests pass through (degraded mode)

---

## Epic 4 — Auth

> JWT validation, Supabase Auth integration, tenant switching, membership.
> **Priority:** P0 | **Total Size:** L

### Story 4.1 — Auth Middleware (JWT Validation) [M]

**Como** usuario autenticado, **quero** que meu JWT Supabase seja validado em cada request, **para** garantir acesso seguro.

**Acceptance Criteria:**
- [ ] `authMiddleware` extracts and validates JWT from `Authorization: Bearer <token>`
- [ ] Sets `userId` in Hono context
- [ ] Missing Authorization header → 401
- [ ] Expired JWT → 401
- [ ] Invalid signature → 401
- [ ] Uses `SUPABASE_JWT_SECRET` for verification
- [ ] Middleware in `apps/api/src/middleware/auth.ts`

**blocked-by:** [1.1, 1.2]
**blocks:** [4.2, 4.3]

#### Arquiteto
- Use `jose` library for JWT verification (same as Supabase Auth)
- Extract `sub` claim as `userId`
- Do NOT verify tenant_id here (that's tenant middleware)

#### Dev
- Layer 1: JWT parsing logic (pure functions)
- Layer 4: Hono `app.request()` tests with valid/invalid/expired JWTs
- Mock: generate test JWTs with `jose`

#### QA
- [ ] Valid JWT → 200 + userId in context
- [ ] No header → 401 `{ error: 'Missing authorization header' }`
- [ ] Expired JWT → 401
- [ ] Wrong secret → 401

---

### Story 4.2 — Tenant Middleware & Switch Tenant [M]

**Como** usuario com multiplas lojas, **quero** trocar de tenant via `POST /auth/switch-tenant`, **para** acessar dados da loja correta.

**Acceptance Criteria:**
- [ ] `tenantMiddleware` reads `X-Tenant-Id` header and validates membership
- [ ] Sets `tenantId` and `userRole` in Hono context
- [ ] `POST /auth/switch-tenant` accepts `{ tenantId }`, validates membership, returns new JWT with tenant_id claim
- [ ] Missing X-Tenant-Id on protected routes → 400
- [ ] User without membership for tenant → 403
- [ ] MembershipRepository: `findByUserAndTenant(userId, tenantId)` → membership with role

**blocked-by:** [2.3, 4.1]
**blocks:** [4.3, 5.1, 6.1, 7.1]

#### Arquiteto
- Tenant middleware in `apps/api/src/middleware/tenant.ts`
- Switch-tenant handler in `apps/api/src/domains/auth/handlers.ts`
- New JWT includes: `sub`, `tenant_id`, `role`
- Membership lookup via MembershipRepository

#### Database
- `memberships` table: `user_id`, `tenant_id`, `role`, `is_active`
- Query: `SELECT * FROM memberships WHERE user_id = ? AND tenant_id = ? AND is_active = true`

#### Dev
- Layer 2: MembershipRepositorySpy, test switch-tenant logic
- Layer 4: HTTP tests for /auth/switch-tenant endpoint
- TDD scenarios from spec: no membership → throw, with membership → JWT with tenant_id + role

#### QA
- [ ] Switch tenant with valid membership → JWT with tenant_id
- [ ] Switch tenant without membership → 403
- [ ] Inactive membership → 403
- [ ] JWT after switch contains correct role

---

### Story 4.3 — Roles Middleware (RBAC) [S]

**Como** owner de loja, **quero** que certas acoes (delete, billing, invite) sejam restritas por role, **para** proteger operacoes criticas.

**Acceptance Criteria:**
- [ ] `requireRoles('owner', 'editor')` middleware checks `userRole` from context
- [ ] viewer=read only, editor=read+write (no delete/billing/members), owner=total
- [ ] Insufficient role → 403
- [ ] RBAC matrix from spec enforced (7 endpoint patterns)

**blocked-by:** [4.2]
**blocks:** [5.1, 7.1]

#### Arquiteto
- Middleware in `apps/api/src/middleware/roles.ts`
- Applied per-route, not globally
- Pattern: `app.delete('/notifications/:id', requireRoles('owner'), handler)`

#### Dev
- Layer 1: role check logic (pure function)
- Layer 4: HTTP tests for each RBAC matrix entry

#### QA
- [ ] GET /notifications: viewer=200, editor=200, owner=200
- [ ] POST /notifications: viewer=403, editor=200, owner=200
- [ ] DELETE /notifications/:id: viewer=403, editor=403, owner=200
- [ ] POST /billing/upgrade: viewer=403, editor=403, owner=200
- [ ] POST /members/invite: viewer=403, editor=403, owner=200

---

## Epic 5 — Tenants

> Multi-tenant CRUD, membership management.
> **Priority:** P1 | **Total Size:** M

### Story 5.1 — Tenant CRUD & Membership Management [M]

**Como** owner, **quero** criar e gerenciar minha loja (tenant), **para** configurar minha conta no sistema.

**Acceptance Criteria:**
- [ ] `POST /api/tenants` — create tenant (sets creator as owner)
- [ ] `GET /api/tenants/:id` — get tenant details (member access)
- [ ] `PUT /api/tenants/:id` — update tenant (editor+ only)
- [ ] `GET /api/tenants/:id/members` — list members
- [ ] `POST /api/tenants/:id/members/invite` — invite member (owner only)
- [ ] `PUT /api/tenants/:id/members/:memberId/role` — change role (owner only)
- [ ] `DELETE /api/tenants/:id/members/:memberId` — remove member (owner only, cannot remove self)
- [ ] Tenant creation initializes: plan=starter, notification_count=0, all automation_configs (9 types, disabled)
- [ ] Audit log for membership changes

**blocked-by:** [2.3, 4.2, 4.3]
**blocks:** [7.1, 11.1]

#### Database
- `tenants` table CRUD
- `memberships` table management
- Transaction: create tenant + create owner membership atomically

#### Dev
- Layer 2: TenantService with spy repos
- Layer 4: HTTP endpoint tests
- Edge: owner cannot remove themselves, cannot have 0 owners

#### QA
- [ ] Create tenant → owner membership created
- [ ] Invite member → new membership with specified role
- [ ] Remove last owner → rejected
- [ ] Non-owner invite → 403

---

### Story 5.2 — Encrypted Credentials Storage [S]

**Como** owner, **quero** que credenciais OAuth sejam armazenadas encriptadas, **para** proteger tokens de acesso.

**Acceptance Criteria:**
- [ ] `CredentialService.store(tenantId, provider, credentials)` encrypts and saves to tenants.credentials JSONB
- [ ] `CredentialService.retrieve(tenantId, provider)` decrypts and returns
- [ ] Uses AES-256-GCM from Story 3.1
- [ ] Stored format: `{ shopify: { ct, iv, tag, alg }, nuvemshop: { ct, iv, tag, alg } }`
- [ ] Cannot save incomplete encrypted object (Zod validation on JSONB structure)

**blocked-by:** [3.1, 5.1]
**blocks:** [12.1, 12.2]

#### Dev
- Layer 2: mock encryption service, test store/retrieve flow
- Layer 3: real DB + real encryption integration test

#### QA
- [ ] Store → retrieve → matches original
- [ ] Incomplete JSONB → validation error
- [ ] Different tenants have different IVs

---

## Epic 5B — API Infrastructure

> Cross-cutting middleware, env validation, audit log service, and health check.
> **Priority:** P1 | **Total Size:** L

### Story 5B.1 — Middleware Chain (requestLogger, errorHandler) [M]

**Como** desenvolvedor, **quero** middleware de logging e error handling centralizado, **para** ter observabilidade e respostas de erro consistentes.

**Acceptance Criteria:**
- [ ] `requestLogger` middleware: structured JSON logs (method, path, status, duration_ms, request_id)
- [ ] `errorHandler` middleware: catches all errors, returns JSON `{ error, message, statusCode }`
- [ ] Request ID generated and propagated via `X-Request-Id` header
- [ ] Sensitive data redacted in logs (Authorization header, credentials, tokens)
- [ ] Chain order enforced: `requestLogger → errorHandler → authMiddleware → tenantMiddleware → [roles]`
- [ ] Integration test verifying chain order (request passes through all middleware in sequence)
- [ ] `GET /health` endpoint returns 200 with `{ status: 'ok', timestamp }` (no auth required)
- [ ] Never `console.log` — all output via structured logger

**blocked-by:** [4.1, 4.2, 4.3]
**blocks:** [7.1, 9.1]

#### Arquiteto
- Logger interface in `packages/core/src/logger/` — abstract, no direct dependency on specific logger lib
- Error handler maps domain errors to HTTP status codes (NotFoundError → 404, ForbiddenError → 403, ValidationError → 400)
- Sentry integration point in error handler (capture exception with request context)
- Request ID: `crypto.randomUUID()` or from incoming `X-Request-Id` header

#### Database
- No DB involvement

#### Dev
- Layer 1: error mapping logic (domain error → HTTP status)
- Layer 2: middleware unit tests with mock context
- Layer 4: full chain integration test with Hono `app.request()`
- Test: request without auth → 401 (not 500), malformed JSON → 400, unhandled error → 500 with structured response

#### QA
- [ ] Structured log output contains method, path, status, duration_ms, request_id
- [ ] Authorization header NOT logged
- [ ] Domain error → correct HTTP status (not 500)
- [ ] Unhandled error → 500 + Sentry capture
- [ ] GET /health → 200 without auth
- [ ] Chain order: request hits logger → error handler → auth → tenant → roles (verify via test)

---

### Story 5B.2 — Env Validation & Startup Config [S]

**Como** desenvolvedor, **quero** validacao Zod de TODAS as env vars no startup, **para** falhar rapido se configuracao estiver incompleta.

**Acceptance Criteria:**
- [ ] Zod schema validates all env vars from `.env.example`
- [ ] Missing required var → process exits with clear error message listing missing vars
- [ ] Invalid format (e.g., ENCRYPTION_SECRET < 32 chars) → process exits with validation error
- [ ] Validated config exported as typed object (not `process.env` access everywhere)
- [ ] Separate schemas per app: API, Workers, Console (each validates only what it needs)

**blocked-by:** [1.2]
**blocks:** [4.1, 5.1]

#### Arquiteto
- Config module in `packages/core/src/config/env.ts`
- Pattern: validate once on startup, export typed singleton
- Never access `process.env` directly outside this module

#### Database
- No DB involvement

#### Dev
- Layer 1: Zod schema tests (valid config passes, missing var throws, invalid format throws)
- Test: missing DATABASE_URL → throws with "DATABASE_URL is required"
- Test: ENCRYPTION_SECRET = "short" → throws with "must be >= 32 chars"

#### QA
- [ ] All vars from .env.example are validated
- [ ] Missing var → clear error message
- [ ] Invalid ENCRYPTION_SECRET → validation error
- [ ] Config object is fully typed (no `string | undefined`)

---

### Story 5B.3 — Audit Log Service & Repository [S]

**Como** sistema, **quero** um AuditLogService centralizado, **para** registrar acoes em todo o sistema de forma consistente.

**Acceptance Criteria:**
- [ ] `AuditLogRepository` extends BaseRepository
- [ ] `AuditLogService.log(action, resource, resourceId, userId, tenantId, details?)` → creates audit entry
- [ ] Actions: `create`, `update`, `delete`, `login`, `switch_tenant`, `invite_member`, `change_role`, `opt_out`, `data_deletion`
- [ ] `GET /api/audit-log` — list paginated (owner only)
- [ ] Details stored as JSONB (flexible per action)
- [ ] Audit log is append-only (no update/delete operations)

**blocked-by:** [2.1, 2.3]
**blocks:** [5.1, 7.1, 11.2, 15.1]

#### Arquiteto
- Service in `packages/core/src/audit/audit-log.service.ts`
- Repository in `packages/core/src/audit/audit-log.repository.ts`
- Fire-and-forget pattern: audit log failures should NOT block the main operation (try/catch, log error)

#### Database
- `audit_log` table: id, tenant_id, user_id, action, resource, resource_id, details (JSONB), created_at
- Index on (tenant_id, created_at) for paginated queries
- No UPDATE/DELETE operations ever

#### Dev
- Layer 1: action type validation
- Layer 2: AuditLogService with AuditLogRepositorySpy
- Layer 3: real DB insert + query
- Layer 4: GET /api/audit-log endpoint (owner only, 403 for editor/viewer)

#### QA
- [ ] log() creates entry with correct fields
- [ ] Audit log is append-only (no update/delete methods exposed)
- [ ] GET /api/audit-log → owner: 200, editor: 403, viewer: 403
- [ ] Failure in audit log does NOT block main operation
- [ ] AuditLogRepositorySpy captures calls correctly

---

### Story 5B.4 — Architecture Tests [S]

**Como** QA engineer, **quero** testes de arquitetura automatizados, **para** garantir que convencoes estruturais sao respeitadas.

**Acceptance Criteria:**
- [ ] Every `*.repository.ts` in packages/core MUST extend `BaseRepository`
- [ ] Every table with `tenant_id` column MUST have an isolation test in test-utils
- [ ] `BaseRepository` has 100% coverage
- [ ] Notification pipeline has integrity test (steps cannot be skipped)
- [ ] No `any` types in source code (only `unknown` + type guards)
- [ ] No `console.log` in source code (only structured logger)
- [ ] All tests use `makeSut()` pattern
- [ ] No `.only` or `.skip` in committed test files

**blocked-by:** [2.3, 2.5]
**blocks:** [] (CI gate, does not block features)

#### Arquiteto
- Tests in `packages/test-utils/src/architecture/`
- Use AST parsing or file scanning to verify structural rules
- These run as part of G1 gate in CI

#### Dev
- Layer 1: file system scanning tests
- Pattern: glob for `*.repository.ts`, read imports, verify extends BaseRepository
- Pattern: grep for `console.log`, `.only`, `.skip`, `any` in source files

#### QA
- [ ] New repository without `extends BaseRepository` → test fails
- [ ] New table with tenant_id without isolation test → test fails
- [ ] `console.log` in source → test fails
- [ ] `.only` in test file → test fails

---

## Epic 6 — App Users, Devices & Segments

> End-user registration, device management, token rotation, segments.
> **Priority:** P1 | **Total Size:** L

### Story 6.1 — App User Registration & CRUD [S]

**Como** sistema, **quero** registrar usuarios do app (app_users), **para** rastrear quem recebe push notifications.

**Acceptance Criteria:**
- [ ] `POST /api/app-users` — register app user (from mobile app)
- [ ] `GET /api/app-users` — list app users (paginated, tenant-scoped)
- [ ] `GET /api/app-users/:id` — user detail with event timeline
- [ ] `PUT /api/app-users/:id` — update (push_opt_in, metadata)
- [ ] Fields: `tenant_id`, `external_id` (platform user ID), `email`, `name`, `push_opt_in`, `total_purchases`, `total_spent`, `first_seen_at`, `last_seen_at`

**blocked-by:** [2.3, 4.2]
**blocks:** [6.2, 7.3]

#### Database
- `app_users` table with tenant isolation
- Index on `(tenant_id, external_id)` for lookup

#### Dev
- Layer 2: AppUserService with spy repo
- Layer 4: HTTP endpoint tests

#### QA
- [ ] Register user → 201
- [ ] Duplicate external_id same tenant → update (upsert)
- [ ] List respects tenant isolation

---

### Story 6.2 — Device Registration & Token Rotation [M]

**Como** sistema, **quero** registrar devices e rotacionar tokens, **para** manter push delivery atualizado.

**Acceptance Criteria:**
- [ ] `POST /api/devices` — register device for app_user
- [ ] If app_user doesn't exist → create app_user + device atomically
- [ ] Fields: `tenant_id`, `app_user_id`, `device_token` (OneSignal player ID), `platform` (ios/android), `is_active`, `app_version`, `os_version`
- [ ] Token rotation: new token for same user+platform → deactivate old device, create new
- [ ] 1 user → N devices (concurrent registration of 5 devices OK)
- [ ] `DELETE /api/devices/:id` — deactivate device (soft delete: `is_active = false`)

**blocked-by:** [2.4, 6.1]
**blocks:** [9.1]

#### Database
- `devices` table, FK to `app_users`
- Default `is_active = true`
- Index on `(tenant_id, app_user_id)`

#### Dev
- Layer 2: DeviceService with spy repos
- TDD: user not exists → creates both, token rotation deactivates old
- Concurrency: 5 simultaneous registrations for same user all succeed

#### QA
- [ ] Register device → 201 with device_token
- [ ] User not found → creates app_user + device (transaction)
- [ ] Same user, new token → old device `is_active = false`
- [ ] 5 concurrent registrations → 5 devices created

---

### Story 6.3 — Segment CRUD & Rules Engine [M]

**Como** editor, **quero** criar segmentos com regras JSONB, **para** direcionar notificacoes a grupos especificos de usuarios.

**Acceptance Criteria:**
- [ ] `POST /api/segments` — create segment with rules JSONB (editor+)
- [ ] `GET /api/segments` — list segments with user count
- [ ] `GET /api/segments/:id` — segment detail with rules and user list
- [ ] `PUT /api/segments/:id` — update rules (editor+)
- [ ] `DELETE /api/segments/:id` — remove segment (owner only)
- [ ] Rules engine: supports `gte`, `lt`, `eq`, `neq`, `contains` operators
- [ ] Rules composition: `AND` / `OR` groups
- [ ] Example rule: `{ "operator": "AND", "conditions": [{"field": "total_spent", "op": "gte", "value": 100}, {"field": "push_opt_in", "op": "eq", "value": true}] }`
- [ ] Segment evaluation: given rules + app_users → returns matching user IDs
- [ ] `app_user_segments` N:N table with `assigned_at`, `expires_at`

**blocked-by:** [2.3, 6.1]
**blocks:** [6.4, 7.1]

#### Arquiteto
- SegmentService in `packages/core/src/segments/`
- Rules engine: pure function `evaluateSegmentRules(rules, userData) → boolean`
- Keep rules evaluation in Layer 1 (pure logic, no DB)
- Segment rules are snapshots in notifications (copied at send time, not referenced)

#### Database
- `app_user_segments` table: id, tenant_id, app_user_id, segment_id, assigned_at, expires_at
- Unique constraint: (tenant_id, app_user_id, segment_id)
- Index on (tenant_id, segment_id) for user count queries

#### Dev
- Layer 1: rules engine evaluation (pure functions)
- Layer 2: SegmentService with spy repos
- Layer 4: HTTP endpoint tests
- TDD: AND/OR composition, gte/lt/eq operators, nested conditions
- Edge: empty rules → matches all users, invalid operator → throw

#### QA
- [ ] Create segment → rules saved correctly
- [ ] Evaluate `total_spent >= 100 AND push_opt_in = true` → correct user set
- [ ] OR composition works: `A OR B` matches users from both
- [ ] Invalid operator → 400
- [ ] viewer cannot POST, editor can, owner can delete

---

### Story 6.4 — Segment Refresh Worker [M]

**Como** sistema, **quero** um worker que recalcule memberships de segmentos periodicamente, **para** manter segmentos atualizados com mudancas nos dados dos usuarios.

**Acceptance Criteria:**
- [ ] `segment-refresh` BullMQ queue processes refresh jobs
- [ ] Refresh: re-evaluate rules against all app_users for tenant
- [ ] Add users that now qualify (INSERT into app_user_segments)
- [ ] Remove users that no longer qualify (DELETE from app_user_segments)
- [ ] Job triggered: on segment create/update, on schedule (configurable interval)
- [ ] Idempotent: running refresh twice produces same result
- [ ] Supports `expires_at` — expired memberships auto-removed

**blocked-by:** [6.3, 8.1]
**blocks:** []

#### Arquiteto
- Worker in `apps/workers/src/segment/`
- Uses SegmentService.evaluateRules() from packages/core
- Batch processing: evaluate in chunks of 1000 users
- Graceful: if worker fails mid-refresh, next run corrects state (idempotent)

#### Database
- Bulk INSERT/DELETE on `app_user_segments`
- Transaction per segment refresh (atomicity)
- Index on `(segment_id, expires_at)` for expiration queries

#### Dev
- Layer 2: worker processor with spy repos
- Layer 3: real DB test — seed 100 users, create segment, verify membership
- TDD: user qualifies → added, user disqualifies → removed, expired → removed
- Mock BullMQ job context

#### QA
- [ ] Refresh adds qualifying users
- [ ] Refresh removes non-qualifying users
- [ ] Expired memberships removed
- [ ] Idempotent: run twice → same result
- [ ] 1000+ users → completes within timeout

---

## Epic 7 — Notifications

> The notification pipeline, templates, A/B testing, manual dispatch.
> **Priority:** P0 | **Total Size:** XL

### Story 7.1 — Notification Service & Pipeline Core [L]

**Como** editor, **quero** criar notificacoes manuais (draft), **para** enviar campanhas push.

**Acceptance Criteria:**
- [ ] `POST /api/notifications` — create manual notification (status=draft)
- [ ] `GET /api/notifications` — list paginated (filter by status, type, date range)
- [ ] `GET /api/notifications/:id` — detail with metrics
- [ ] `DELETE /api/notifications/:id` — owner only
- [ ] Pipeline stages enforced: draft → scheduled → sending → sent → completed (+ failed from any state, cannot skip)
- [ ] XSS sanitization on title and body
- [ ] Empty title → 400
- [ ] Audit log entry on every creation
- [ ] Zod validation on request body

**blocked-by:** [2.3, 4.3, 5.1]
**blocks:** [7.2, 7.3, 7.4, 9.1]

#### Arquiteto
- NotificationService in `packages/core/src/notifications/`
- Pipeline pattern: each stage validates preconditions before advancing
- Status machine: `draft → scheduled → sending → sent → completed` (+ `failed` from any state)

#### Database
- `notifications` table with status enum, flow_type, segment_rules JSONB
- `audit_log` entry on creation

#### Dev
- Layer 1: status machine transitions (pure logic)
- Layer 2: NotificationService with spy repos
- Layer 4: HTTP endpoint tests
- TDD: sanitize XSS, empty title throws, audit log created, status=draft on creation

#### QA
- [ ] Create notification → status=draft, audit log created
- [ ] Title with `<script>` → sanitized in response
- [ ] Empty title → 400
- [ ] Skip pipeline stage → error
- [ ] viewer cannot POST, editor can, owner can
- [ ] owner-only DELETE

---

### Story 7.2 — Template Variables Engine [M]

**Como** editor, **quero** usar variaveis em templates de notificacao (nome do produto, preco), **para** personalizar mensagens.

**Acceptance Criteria:**
- [ ] `renderTemplate(template, variables)` replaces `{{variable_name}}` with values
- [ ] Known variables: `customer_name`, `product_name`, `product_price`, `product_image_url`, `order_id`, `cart_url`, `store_name`
- [ ] Missing required variable → throw with variable name
- [ ] XSS sanitization applied to variable VALUES (not just template)
- [ ] Unknown variables left as-is (for forward compatibility)
- [ ] Service in `packages/core/src/notifications/template.service.ts`

**blocked-by:** [1.3, 7.1]
**blocks:** [8.1, 9.1]

#### Dev
- Layer 1 (pure domain logic): template rendering tests
- TDD scenarios: all vars replaced, missing required → throw, XSS in variable value → sanitized

#### QA
- [ ] `Hello {{customer_name}}` + `{ customer_name: 'Ana' }` → `Hello Ana`
- [ ] `{{product_name}}` missing → throws with `product_name`
- [ ] `{{ customer_name }}` (with spaces) → still replaced
- [ ] Variable value `<script>alert(1)</script>` → sanitized

---

### Story 7.3 — Plan Limits & Notification Count [M]

**Como** sistema, **quero** aplicar limites de notificacoes manuais por plano, **para** enforcar o modelo de negocio.

**Acceptance Criteria:**
- [ ] Manual notification at limit → blocked with 402 + upsell message
- [ ] Manual notification at `limit - 1` → allowed (boundary test)
- [ ] **Automated notifications NEVER blocked** even if limit reached
- [ ] Plan limits: Starter=15/month manual, Business/Elite=unlimited (null)
- [ ] `notification_count_current_period` uses atomic increment (`SET col = col + 1`)
- [ ] Count reset on billing cycle (via Stripe webhook — Story 11.2)

**blocked-by:** [7.1, 1.2]
**blocks:** [9.3]

#### Arquiteto
- PlanLimitService in `packages/core/src/billing/plan-limit.service.ts`
- Check before scheduling (not before creating draft)
- Atomic increment prevents race conditions

#### Dev
- Layer 1: plan limit checking logic
- Layer 2: PlanLimitService with spy TenantRepository
- Boundary tests: exactly at limit, at limit-1, automated bypass

#### QA
- [ ] Starter at 15 manual → 402
- [ ] Starter at 14 manual → 200
- [ ] Starter automated at 15+ → 200 (NEVER blocked)
- [ ] Business/Elite → always 200
- [ ] Null limit (Elite) → always allows
- [ ] Concurrent increment → no race condition

---

### Story 7.4 — A/B Testing [M]

**Como** editor, **quero** criar variantes A/B em notificacoes, **para** otimizar conversion rate.

**Acceptance Criteria:**
- [ ] Max 2 variants in MVP
- [ ] Default split: 50/50, custom split allowed
- [ ] Split that doesn't sum to 100% → throw
- [ ] Winner determined by conversion rate
- [ ] Minimum sample: 100 deliveries per variant before declaring winner
- [ ] Difference < 1% → tie (no winner)
- [ ] A/B config stored in notification JSONB: `ab_config: { variants: [{...}], split: [50, 50] }`

**blocked-by:** [7.1]
**blocks:** [9.1]

#### Dev
- Layer 1: split validation, winner calculation (pure functions)
- Layer 2: A/B service with spy delivery repo
- Edge: exactly 100 deliveries boundary, exactly 1% difference boundary

#### QA
- [ ] [60, 40] split → valid
- [ ] [60, 50] split → throws (sum != 100)
- [ ] 99 deliveries → no winner yet
- [ ] 100 deliveries, A=10% B=9.5% → tie (< 1% diff)
- [ ] 100 deliveries, A=10% B=8% → A wins

---

## Epic 8 — Automations

> 9 flow type configurations, scheduling via BullMQ.
> **Priority:** P1 | **Total Size:** L

### Story 8.1 — Automation Config CRUD [M]

**Como** editor, **quero** configurar cada um dos 9 flows de automacao (ativar/desativar, delay, template), **para** personalizar o motor de receita.

**Acceptance Criteria:**
- [ ] `GET /api/automations` — list all 9 automation configs for tenant
- [ ] `GET /api/automations/:flowType` — get specific config
- [ ] `PUT /api/automations/:flowType` — update config (is_enabled, delay_seconds, template_title, template_body)
- [ ] Each tenant has exactly 9 automation_configs (created on tenant creation)
- [ ] Unique constraint: `(tenant_id, flow_type)`
- [ ] Toggle on/off via `is_enabled`
- [ ] Custom delay in seconds (overrides default)
- [ ] Template with variable chips (stored as `{{variable_name}}`)

**blocked-by:** [2.4, 5.1]
**blocks:** [8.2]

#### Database
- `automation_configs` table: `tenant_id`, `flow_type`, `is_enabled`, `delay_seconds`, `template_title`, `template_body`, `created_at`, `updated_at`
- Unique index on `(tenant_id, flow_type)`

#### Dev
- Layer 2: AutomationConfigService with spy repo
- Layer 4: HTTP endpoint tests
- Verify 9 configs created on tenant creation

#### QA
- [ ] New tenant → 9 configs created (all disabled)
- [ ] Update delay → persisted
- [ ] Update template → persisted
- [ ] Toggle is_enabled → persisted
- [ ] Invalid flow_type → 400

---

### Story 8.2 — Automation Flow Trigger & BullMQ Scheduling [L]

**Como** sistema, **quero** que eventos (webhooks, app events) disparem jobs BullMQ com o delay correto, **para** enviar pushes automaticos.

**Acceptance Criteria:**
- [ ] Each of 9 flow types creates a delayed BullMQ job when triggered
- [ ] Job uses delay from `automation_configs` (custom) or default from spec
- [ ] `is_enabled = false` → no job created
- [ ] Custom template from `automation_configs` used in job payload
- [ ] Default delays per flow: cart_abandoned=1h, pix=30min, boleto=1h, welcome=5min, checkout=1h, order_confirmed=0, tracking=0, browse_abandoned=2h, upsell=3d
- [ ] 36 minimum tests (4 per flow x 9 flows)
- [ ] Job payload includes: `tenantId`, `flowType`, `targetUserId`, `templateData`, `notificationId`

**blocked-by:** [8.1, 7.2]
**blocks:** [9.1, 10.1]

#### Arquiteto
- AutomationTriggerService in `packages/core/src/automations/trigger.service.ts`
- Queue: `push-dispatch` with BullMQ `delay` option
- Each flow type has a trigger function matching its event source

#### Dev
- Layer 2: BullMQSpy captures added jobs with delay
- TDD: 4 tests per flow (creates job, respects is_enabled, uses custom delay, uses custom template)
- Total: 36 tests minimum

#### QA
- [ ] cart_abandoned trigger → job with 3600000ms delay
- [ ] cart_abandoned disabled → no job
- [ ] Custom delay 7200s → job with 7200000ms delay
- [ ] Custom template → template in job payload
- [ ] All 9 flows tested (36 scenarios)

---

## Epic 9 — Push Dispatch

> OneSignal integration, delivery tracking, frequency capping.
> **Priority:** P0 | **Total Size:** XL

### Story 9.1 — Push Dispatch Service (OneSignal) [L]

**Como** sistema, **quero** enviar push notifications via OneSignal, **para** alcancar devices dos usuarios.

**Acceptance Criteria:**
- [ ] `PushDispatchService.dispatch(tenantId, notificationId)` sends push to all active devices
- [ ] Fetches only active devices (`is_active = true`) for target users
- [ ] Creates `notification_delivery` record per device with status `pending`
- [ ] Calls OneSignal REST API with tenant-specific `onesignal_app_id`
- [ ] On success: update delivery status to `sent`
- [ ] On failure: update delivery status to `failed`, queue for retry
- [ ] Zero active devices → does NOT call OneSignal (no-op)
- [ ] OneSignal down → queue for retry (graceful degradation)

**blocked-by:** [6.2, 7.1, 7.2, 7.4]
**blocks:** [9.2, 9.3]

#### Arquiteto
- PushProvider interface: `sendNotification(appId, data)`, `getDeliveryStatus(appId, notifId)`
- OneSignalProvider implements PushProvider (adapter pattern)
- Credentials loaded dynamically per tenant_id
- Push is ALWAYS server → OneSignal → device (never app direct)

#### Dev
- Layer 2: PushProviderSpy, test dispatch logic
- Layer 3: MSW for OneSignal API mocking
- TDD: active devices only, delivery record per device, zero devices no-op, retry on failure

#### QA
- [ ] 3 active devices → 3 delivery records + 3 OneSignal calls
- [ ] 0 active devices → 0 OneSignal calls
- [ ] OneSignal 500 → delivery status=failed + retry queued
- [ ] Delivery record has correct notification_id, device_id, tenant_id

---

### Story 9.2 — Delivery Status Tracking [M]

**Como** operador, **quero** rastrear o status de cada delivery (sent/delivered/opened/clicked/converted), **para** medir performance.

**Acceptance Criteria:**
- [ ] Status machine: `pending → sent → delivered → opened → clicked → converted` (+ `failed` from any state)
- [ ] Invalid transition (e.g., pending → converted) → throw
- [ ] Individual timestamps: `sent_at`, `delivered_at`, `opened_at`, `clicked_at`, `converted_at`
- [ ] Optimistic locking: `UPDATE WHERE id = ? AND status = ? RETURNING *` (0 rows = already processed)
- [ ] Webhook endpoint for OneSignal callbacks: `POST /api/webhooks/onesignal`
- [ ] Deep link tracking: `?ref=push_{notification_id}` in push payload

**blocked-by:** [9.1]
**blocks:** [9.4, 13.1]

#### Arquiteto
- DeliveryStatusService in `packages/core/src/notifications/delivery-status.service.ts`
- Optimistic locking prevents duplicate processing by concurrent workers
- Status transitions validated before update

#### Database
- `notification_deliveries` with status enum and individual timestamp columns
- Index: `(tenant_id, status, created_at)`

#### Dev
- Layer 1: status machine validation (pure function)
- Layer 2: service with spy repo
- Layer 3: optimistic locking with real DB
- TDD: valid transitions, invalid transitions throw, optimistic lock conflict returns 0

#### QA
- [ ] pending → sent → delivered → opened → clicked → converted (happy path)
- [ ] pending → converted → throws
- [ ] sent → failed → OK
- [ ] Concurrent update → only one succeeds (0 rows for loser)
- [ ] Each transition sets corresponding timestamp

---

### Story 9.3 — Frequency Capping [M]

**Como** sistema, **quero** limitar pushes por usuario por dia conforme o plano, **para** evitar spam e respeitar limites.

**Acceptance Criteria:**
- [ ] Starter: max 2 pushes/day per app_user
- [ ] Business: max 4 pushes/day per app_user
- [ ] Elite: unlimited (null = no cap)
- [ ] Count per `app_user` NOT per device
- [ ] Flow types are independent (cart_abandoned doesn't block welcome)
- [ ] Max 1 cart_abandoned per session
- [ ] Admin override for manual campaigns (NOT for automated flows)
- [ ] Counter reset at midnight UTC
- [ ] Checked BEFORE dispatch (not after)

**blocked-by:** [1.2, 9.1]
**blocks:** []

#### Arquiteto
- FrequencyCappingService in `packages/core/src/notifications/frequency-capping.service.ts`
- Redis counter: `fc:{tenantId}:{appUserId}:{date}` with TTL 86400s
- Separate counter for cart_abandoned per session: `fc:cart:{tenantId}:{appUserId}:{sessionId}`

#### Dev
- Layer 1: capping logic (pure)
- Layer 2: CacheSpy for Redis counters
- Edge: exactly at limit (boundary), midnight reset, null limit (unlimited)

#### QA
- [ ] Starter user at 2 pushes today → 3rd blocked
- [ ] Business user at 4 pushes today → 5th blocked
- [ ] Elite user at 100 pushes today → 101st allowed
- [ ] 2nd cart_abandoned same session → blocked
- [ ] Admin manual override → bypasses daily cap
- [ ] After midnight UTC → counter reset

---

### Story 9.4 — Conversion Attribution [M]

**Como** analista, **quero** atribuir conversoes a notificacoes especificas, **para** medir ROI de cada push.

**Acceptance Criteria:**
- [ ] Multi-campaign window: 1h (attributes to most recent push)
- [ ] Normal flow window: 24h
- [ ] Boundary: exactly 1h/24h = inclusive
- [ ] After window expires → no attribution
- [ ] Attribution service: `attributeConversion(tenantId, appUserId, purchaseEvent)`
- [ ] Updates delivery status to `converted` with `converted_at` timestamp

**blocked-by:** [9.2]
**blocks:** [13.1]

#### Dev
- Layer 1: attribution logic (pure, time-based)
- Layer 2: service with spy repos
- Boundary tests: exactly 1h, 1h+1ms, exactly 24h, 24h+1ms

#### QA
- [ ] Purchase 30min after push → attributed
- [ ] Purchase exactly 1h after push (multi-campaign) → attributed (inclusive)
- [ ] Purchase 1h+1s after push (multi-campaign) → NOT attributed
- [ ] Purchase exactly 24h after push (normal) → attributed
- [ ] Purchase 24h+1s after push → NOT attributed
- [ ] Multiple pushes in 1h → attributed to most recent

---

## Epic 10 — Events & Ingestion

> App event tracking, deduplication, automation triggers.
> **Priority:** P1 | **Total Size:** L

### Story 10.1 — Event Ingestion Service [M]

**Como** sistema, **quero** ingerir eventos do app (app_opened, product_viewed, add_to_cart, purchase_completed), **para** disparar automacoes e rastrear comportamento.

**Acceptance Criteria:**
- [ ] `POST /api/events` — ingest app event (from mobile app)
- [ ] Event types: `app_opened`, `product_viewed`, `add_to_cart`, `purchase_completed`, `push_opened`, `push_clicked`
- [ ] Deduplication: same event within 5s → rejected (not created)
- [ ] Events stored in `app_events` table
- [ ] BullMQ job created on `data-ingestion` queue for async processing

**blocked-by:** [2.3, 6.1]
**blocks:** [10.2]

#### Database
- `app_events` table: `tenant_id`, `app_user_id`, `event_type`, `properties` (JSONB), `created_at`
- Index: `(tenant_id, event_type, created_at)`

#### Dev
- Layer 2: EventIngestionService with spy repos
- TDD: dedup within 5s, all event types accepted, JSONB properties stored

#### QA
- [ ] product_viewed event → stored in app_events
- [ ] Same event within 5s → rejected (dedup)
- [ ] Same event after 5s → accepted
- [ ] Unknown event type → 400

---

### Story 10.2 — Event-Driven Automation Triggers [L]

**Como** sistema, **quero** que eventos disparem automacoes (browse_abandoned, welcome), **para** enviar pushes contextuais automaticamente.

**Acceptance Criteria:**
- [ ] `product_viewed` without `add_to_cart` within window → schedules `browse_abandoned` check
- [ ] First `app_opened` ever → triggers `welcome` flow. Second+ → does NOT trigger
- [ ] `purchase_completed` → triggers `upsell` flow (delayed)
- [ ] Each trigger checks `automation_configs.is_enabled` before scheduling
- [ ] Worker processes ingested events and dispatches appropriate triggers

**blocked-by:** [8.2, 10.1]
**blocks:** []

#### Arquiteto
- EventProcessorWorker in `apps/workers/src/ingestion/`
- Maps event types to automation flow types
- First `app_opened` detection: check if any previous `app_opened` exists for this app_user

#### Dev
- Layer 2: EventProcessor with spies for automation trigger service and event repo
- TDD: first app_opened triggers welcome, second does not, product_viewed schedules browse check

#### QA
- [ ] First app_opened → welcome BullMQ job created
- [ ] Second app_opened → no job
- [ ] product_viewed → browse_abandoned check scheduled
- [ ] product_viewed + add_to_cart within window → no browse_abandoned
- [ ] Disabled automation → no job even when triggered

---

## Epic 11 — Billing

> Stripe integration, plan management, webhook lifecycle.
> **Priority:** P1 | **Total Size:** L

### Story 11.1 — Stripe Checkout & Subscription Management [M]

**Como** owner, **quero** assinar um plano via Stripe, **para** ativar minha conta.

**Acceptance Criteria:**
- [ ] `POST /api/billing/checkout` — create Stripe checkout session (owner only)
- [ ] `POST /api/billing/portal` — create Stripe billing portal session
- [ ] `GET /api/billing/subscription` — get current subscription details
- [ ] On successful checkout: save `stripe_customer_id` and `stripe_subscription_id` to tenant
- [ ] Plans: Starter (R$127), Business (R$197), Elite (R$297)
- [ ] Upgrade → updates subscription, resets notification_count immediately
- [ ] Downgrade → registers `pendingPlanChange` for next billing cycle

**blocked-by:** [5.1]
**blocks:** [11.2]

#### Arquiteto
- BillingService in `packages/core/src/billing/billing.service.ts`
- Stripe SDK for checkout/portal/subscription management
- Mock: stripe-mock container in tests

#### Dev
- Layer 2: BillingService with Stripe SDK mocked
- Layer 3: stripe-mock container for integration tests
- TDD: create subscription, upgrade resets count, downgrade is deferred

#### QA
- [ ] Checkout → redirects to Stripe
- [ ] Successful payment → stripe IDs saved to tenant
- [ ] Upgrade → immediate plan change + count reset
- [ ] Downgrade → pendingPlanChange set, no immediate change
- [ ] Non-owner → 403

---

### Story 11.2 — Stripe Webhook Lifecycle [L]

**Como** sistema, **quero** processar webhooks do Stripe, **para** gerenciar lifecycle de subscricoes.

**Acceptance Criteria:**
- [ ] `POST /api/webhooks/stripe` — webhook endpoint
- [ ] Signature verification: reject invalid `Stripe-Signature`
- [ ] Replay protection: reject timestamp > 5 min
- [ ] Idempotency: same event 2x → update only 1x
- [ ] `invoice.payment_succeeded` → activate tenant + reset notification_count to 0
- [ ] `invoice.payment_failed` → keep active + 3-day grace period + audit log
- [ ] `customer.subscription.deleted` → deactivate tenant + pause ALL automations
- [ ] Audit log for all billing events

**blocked-by:** [11.1, 8.1]
**blocks:** []

#### Arquiteto
- Webhook handler in `apps/api/src/domains/billing/handlers.ts`
- Use Stripe SDK `constructEvent()` for signature verification
- Idempotency: store processed event IDs or check current state before updating

#### Dev
- Layer 2: webhook handler logic with spy repos
- Layer 3: stripe-mock for real webhook payloads
- TDD: signature invalid → 400, replay → 400, each event type handler

#### QA
- [ ] Invalid signature → 400
- [ ] Timestamp > 5min → 400
- [ ] payment_succeeded → tenant active, count=0
- [ ] payment_failed → tenant still active, grace period set, audit logged
- [ ] subscription.deleted → tenant inactive, all automations paused
- [ ] Same event 2x → only 1 update (idempotent)

---

## Epic 12 — Integrations

> Shopify, Nuvemshop, Klaviyo adapters, OneSignal provisioning.
> **Priority:** P1 | **Total Size:** XL

### Story 12.1 — Shopify OAuth & Adapter [L]

**Como** owner, **quero** conectar minha loja Shopify via OAuth, **para** receber webhooks de pedidos e carrinhos.

**Acceptance Criteria:**
- [ ] OAuth flow: `GET /api/integrations/shopify/auth` → redirect to Shopify
- [ ] OAuth callback: `GET /api/integrations/shopify/callback` → exchange code for token, encrypt and store
- [ ] HMAC verification on all Shopify requests
- [ ] `ShopifyAdapter` implements `PlatformAdapter` interface
- [ ] Methods: `getProducts`, `getOrders`, `getAbandonedCarts`, `getCustomer`, `registerWebhooks`
- [ ] Webhook registration for: orders/create, orders/paid, carts/create, checkouts/create, fulfillments/create
- [ ] SSRF whitelist: `*.myshopify.com`
- [ ] Scope: `read_products`, `read_orders`, `read_customers`
- [ ] Contract test: `platformAdapterContractTest('Shopify', ...)`

**blocked-by:** [3.2, 5.2]
**blocks:** [12.4]

#### Dev
- Layer 2: ShopifyAdapter with MSW mocks
- Layer 3: MSW + HMAC verification tests
- Contract tests for PlatformAdapter compliance

#### QA
- [ ] OAuth flow → token stored encrypted
- [ ] HMAC invalid → 401
- [ ] SSRF to private IP → blocked
- [ ] Webhook registration → all required hooks registered
- [ ] Contract test passes

---

### Story 12.2 — Nuvemshop OAuth & Adapter [M]

**Como** owner, **quero** conectar minha loja Nuvemshop via OAuth, **para** receber webhooks de pedidos.

**Acceptance Criteria:**
- [ ] OAuth flow: `GET /api/integrations/nuvemshop/auth` → redirect
- [ ] OAuth callback: exchange code for token, encrypt and store
- [ ] `NuvemshopAdapter` implements same `PlatformAdapter` interface
- [ ] SSRF whitelist: `*.nuvemshop.com`
- [ ] Contract test: `platformAdapterContractTest('Nuvemshop', ...)`

**blocked-by:** [3.2, 5.2]
**blocks:** [12.4]

#### Dev
- Layer 2: NuvemshopAdapter with MSW mocks
- Contract tests for PlatformAdapter compliance
- Share test patterns with Shopify (same interface)

#### QA
- [ ] OAuth flow → token stored encrypted
- [ ] Contract test passes (same interface as Shopify)

---

### Story 12.3 — Klaviyo Read-Only Integration [S]

**Como** analista, **quero** importar dados do Klaviyo (segmentos, metricas), **para** enriquecer analytics.

**Acceptance Criteria:**
- [ ] Klaviyo API client (read-only, NEVER write)
- [ ] Fetch: profiles, segments, metrics, events
- [ ] API key stored encrypted
- [ ] If Klaviyo is down → graceful degradation (app continues, data stale)
- [ ] MSW mock for tests

**blocked-by:** [5.2]
**blocks:** []

#### Dev
- Layer 2: KlaviyoClient with MSW mocks
- Graceful degradation: try/catch with fallback to cached data

#### QA
- [ ] Fetch profiles → returns data
- [ ] Klaviyo 500 → returns empty/cached, no crash
- [ ] NEVER writes to Klaviyo (no POST/PUT/DELETE)

---

### Story 12.4 — OneSignal App Provisioning [M]

**Como** sistema, **quero** criar um app OneSignal por tenant automaticamente, **para** cada cliente ter push isolado.

**Acceptance Criteria:**
- [ ] `OneSignalProvider.createApp(tenantName)` → creates OneSignal app, returns `onesignal_app_id`
- [ ] `onesignal_app_id` saved to tenant record
- [ ] HMAC Identity Verification enabled on created app
- [ ] `OneSignalProvider` implements `PushProvider` interface
- [ ] Contract test: `pushProviderContractTest('OneSignal', ...)`
- [ ] Credentials loaded dynamically per tenant

**blocked-by:** [2.3, 5.1]
**blocks:** [9.1]
**phase:** Phase 3 (moved from Phase 5 — prerequisite for Push Dispatch)

#### Arquiteto
- OneSignalProvider in `packages/integrations/src/onesignal/`
- Uses `ONESIGNAL_USER_AUTH_KEY` for app creation, `ONESIGNAL_API_KEY` per tenant for push
- MSW for API mocking in tests

#### Dev
- Layer 2: OneSignalProvider with MSW mocks
- Contract tests for PushProvider compliance

#### QA
- [ ] createApp → returns valid app ID
- [ ] App ID stored in tenant
- [ ] sendNotification uses correct tenant app ID
- [ ] Contract test passes

---

### Story 12.5 — Platform Webhook Receiver [L]

**Como** sistema, **quero** receber webhooks de plataformas (Shopify, Nuvemshop), **para** disparar automacoes em tempo real.

**Acceptance Criteria:**
- [ ] `POST /api/webhooks/shopify` — receives and validates Shopify webhooks
- [ ] `POST /api/webhooks/nuvemshop` — receives and validates Nuvemshop webhooks
- [ ] HMAC signature verification on all webhooks
- [ ] Webhook types: `orders/create`, `orders/paid`, `carts/create`, `checkouts/create`, `fulfillments/create`
- [ ] Each webhook creates a `data-ingestion` BullMQ job
- [ ] Maps webhook to flow type (e.g., `orders/paid` → `order_confirmed`)
- [ ] Retry with backoff + polling as backup if webhook fails

**blocked-by:** [12.1, 12.2, 10.1]
**blocks:** []

#### Dev
- Layer 4: HTTP tests with real Hono app
- HMAC verification tests (valid, invalid, missing)
- Job creation verification via BullMQSpy

#### QA
- [ ] Valid Shopify webhook → 200 + job created
- [ ] Invalid HMAC → 401
- [ ] orders/paid → maps to order_confirmed flow
- [ ] carts/create → maps to cart_abandoned flow

---

## Epic 13 — Analytics

> Metrics aggregation, dashboard data, funnel calculations.
> **Priority:** P2 | **Total Size:** L

### Story 13.1 — Metrics Aggregation Worker [M]

**Como** analista, **quero** metricas agregadas (sent, delivered, opened, clicked, converted rates), **para** visualizar performance no dashboard.

**Acceptance Criteria:**
- [ ] Analytics worker processes `analytics` queue
- [ ] Aggregates: total sent, delivered, opened, clicked, converted per notification per tenant
- [ ] Calculates rates: delivery_rate, open_rate, click_rate, conversion_rate
- [ ] Division by zero: delivered=0 → all rates=0
- [ ] Worker is idempotent: UPSERT (reprocessing doesn't duplicate)
- [ ] Revenue attribution: sum of `converted` delivery values

**blocked-by:** [9.2, 9.4]
**blocks:** [13.2]

#### Arquiteto
- MetricsWorker in `apps/workers/src/analytics/`
- UPSERT pattern: `INSERT ... ON CONFLICT (tenant_id, notification_id) DO UPDATE`
- Rates as percentages (0-100, 2 decimal places)

#### Dev
- Layer 2: MetricsAggregator with spy repos
- Layer 3: real DB UPSERT tests
- TDD: division by zero, idempotent reprocessing, correct rate calculation

#### QA
- [ ] 100 sent, 90 delivered, 45 opened, 10 clicked, 2 converted → rates correct
- [ ] 0 delivered → all rates = 0 (no division by zero)
- [ ] Process same data twice → same result (idempotent)

---

### Story 13.2 — Analytics API Endpoints [M]

**Como** usuario do console, **quero** endpoints de analytics, **para** alimentar dashboards.

**Acceptance Criteria:**
- [ ] `GET /api/analytics/overview` — hero metrics (revenue, sent, open rate, click rate, conversion rate) for period
- [ ] `GET /api/analytics/by-notification/:id` — per-notification funnel
- [ ] `GET /api/analytics/by-flow` — per flow type comparison
- [ ] `GET /api/analytics/revenue` — revenue chart data (30 days)
- [ ] `GET /api/analytics/top-notifications` — top 5 by conversion
- [ ] All endpoints respect tenant isolation
- [ ] Period filter: `?from=&to=` query params

**blocked-by:** [13.1]
**blocks:** []

#### Dev
- Layer 4: HTTP endpoint tests
- Use seed helpers to create test data with known metrics

#### QA
- [ ] Overview returns all hero metrics
- [ ] Per-notification shows full funnel
- [ ] By-flow compares all 9 flow types
- [ ] Tenant isolation on all endpoints
- [ ] Empty data → zeros (not errors)

---

## Epic 14 — App Config & Build

> Visual customization, Capacitor build management.
> **Priority:** P2 | **Total Size:** L

### Story 14.1 — App Config CRUD [M]

**Como** owner, **quero** configurar a aparencia do meu app (nome, icone, cores, menu), **para** personalizar a marca.

**Acceptance Criteria:**
- [ ] `GET /api/app-configs` — get current app config for tenant
- [ ] `PUT /api/app-configs` — update app config (editor+)
- [ ] Fields: `app_name`, `icon_url`, `splash_url`, `primary_color`, `secondary_color`, `menu_config` (JSONB)
- [ ] Unique per tenant (`app_configs.tenant_id` unique constraint)
- [ ] Icon/splash upload to Cloudflare R2 (presigned URL generation)
- [ ] Default config created on tenant creation

**blocked-by:** [5.1]
**blocks:** [14.2]

#### Database
- `app_configs` table with unique constraint on `tenant_id`
- JSONB `menu_config` for drag-and-drop menu builder

#### Dev
- Layer 2: AppConfigService with spy repo
- Layer 4: HTTP endpoint tests
- R2 upload: mock in Layer 2, MinIO in Layer 3

#### QA
- [ ] Get config → returns current config
- [ ] Update config → persisted
- [ ] Icon upload → presigned URL returned
- [ ] viewer → can read, cannot update

---

### Story 14.2 — Build Management (MVP Semi-Manual) [M]

**Como** owner, **quero** iniciar um build do meu app, **para** publicar na App Store e Google Play.

**Acceptance Criteria:**
- [ ] `POST /api/app-configs/build` — trigger build (owner only)
- [ ] Build status tracking: `idle → building → ready → published → failed`
- [ ] Build is idempotent: same config → same output
- [ ] Build creates Capacitor config JSON from app_config
- [ ] `GET /api/app-configs/build/status` — current build status
- [ ] `GET /api/app-configs/build/history` — build history
- [ ] BullMQ job on `build` queue

**blocked-by:** [14.1]
**blocks:** []

#### Arquiteto
- MVP: build is semi-manual (creates config, manual Capacitor build)
- Phase 2: Fastlane + GitHub Actions automation
- Build queue job generates tenant-specific Capacitor config

#### Dev
- Layer 2: BuildService with BullMQSpy
- TDD: idempotent build, status transitions

#### QA
- [ ] Trigger build → status=building, job created
- [ ] Same config twice → same output (idempotent)
- [ ] Build history shows all past builds
- [ ] Non-owner → 403

---

## Epic 15 — LGPD & Data Retention

> Privacy compliance, data deletion, retention jobs.
> **Priority:** P2 | **Total Size:** M

### Story 15.1 — LGPD Compliance (Push Opt-Out & Data Deletion) [M]

**Como** app_user, **quero** poder opt-out de push e solicitar exclusao dos meus dados, **para** exercer meus direitos LGPD.

**Acceptance Criteria:**
- [ ] Push opt-out: updates `app_users.push_opt_in = false`, blocks future notifications
- [ ] Every opt-in/opt-out change recorded in `audit_log`
- [ ] Data deletion endpoint: `DELETE /api/app-users/:id/data` (owner only)
- [ ] Deletion: removes ALL app_user data (events, segments, products, devices)
- [ ] Anonymize deliveries: set `app_user_id = null` (do NOT delete — preserve metrics)
- [ ] Record deletion in audit_log with `deliveriesAnonymized` flag
- [ ] Opt-out user skipped in push dispatch

**blocked-by:** [6.1, 9.1]
**blocks:** []

#### Dev
- Layer 2: LGPDService with spy repos
- Transaction: delete user data + anonymize deliveries + audit log atomically

#### QA
- [ ] Opt-out → push_opt_in=false, audit logged
- [ ] Opt-out user → excluded from dispatch
- [ ] Delete data → all user data gone
- [ ] Deliveries anonymized (app_user_id=null), NOT deleted
- [ ] Audit log records deletion with flag

---

### Story 15.2 — Data Retention Jobs [S]

**Como** operador, **quero** jobs automaticos de retencao de dados, **para** limpar dados antigos conforme politica.

**Acceptance Criteria:**
- [ ] notification_deliveries: delete after 180 days
- [ ] app_events: delete after 90 days
- [ ] Boundary: exactly 180/90 days → kept. 181/91 days → deleted
- [ ] Retention is global (not per tenant)
- [ ] Cron job (daily at 3am UTC)
- [ ] Batch delete (1000 rows per iteration) to avoid locking

**blocked-by:** [2.1]
**blocks:** []

#### Dev
- Layer 2: RetentionService with spy repos
- Layer 3: real DB with seeded old data
- Boundary tests: exactly at retention limit, 1 day over

#### QA
- [ ] 180-day-old delivery → kept
- [ ] 181-day-old delivery → deleted
- [ ] 90-day-old event → kept
- [ ] 91-day-old event → deleted
- [ ] Batch delete doesn't lock tables

---

## Epic 16 — CI/CD Pipeline

> Gates G0-G7, pre-commit hooks, GitHub Actions workflows.
> **Priority:** P2 | **Total Size:** L

### Story 16.1 — Pre-Commit Hooks (Gate G0) [S]

**Como** desenvolvedor, **quero** pre-commit hooks que bloqueiam commits invalidos, **para** garantir qualidade antes do push.

**Acceptance Criteria:**
- [ ] `biome format --check` on staged files
- [ ] `biome lint` on staged files
- [ ] `tsc --noEmit` on affected packages
- [ ] Commit blocked if any check fails
- [ ] Uses `husky` + `lint-staged`

**blocks:** [16.2]

#### Dev
- Configure husky + lint-staged in root package.json
- Test: create file with formatting error → commit blocked

---

### Story 16.2 — CI Pipeline (Gates G1-G4) [L]

**Como** engenheiro, **quero** um pipeline CI no GitHub Actions, **para** bloquear PRs que falham em qualquer gate.

**Acceptance Criteria:**
- [ ] G1: `vitest run --project unit` + coverage >= 80% + coverage delta check
- [ ] G2: Integration + isolation tests + migration dry-run
- [ ] G3: `pnpm audit` + CodeQL + `trufflehog --only-verified`
- [ ] G4: Build API + Console + Shared
- [ ] All gates must pass for PR merge
- [ ] Workflow file: `.github/workflows/ci.yml`
- [ ] Uses docker-compose.test.yml for test services

**blocked-by:** [16.1]
**blocks:** []

#### Dev
- GitHub Actions workflow with matrix strategy
- Docker compose services for PG, Redis, MinIO, stripe-mock
- Cache: pnpm store, turbo cache

#### QA
- [ ] Failing test → PR blocked
- [ ] Coverage < 80% → PR blocked
- [ ] Audit vulnerability → PR blocked
- [ ] Build failure → PR blocked

---

### Story 16.3 — Deploy Pipeline (Gates G5-G7) [M]

**Como** operador, **quero** deploy automatizado com smoke tests, **para** garantir que producao esta saudavel apos deploy.

**Acceptance Criteria:**
- [ ] G5: Deploy to staging + health check (`curl /health` → 200)
- [ ] G6: Smoke tests + E2E (Playwright) on staging
- [ ] G7: Manual approval gate + rollback plan
- [ ] Automatic rollback on G6 failure
- [ ] Workflow file: `.github/workflows/deploy.yml`

**blocked-by:** [16.2]
**blocks:** []

---

## Audit Log (Cross-Cutting)

> Audit logging is required across multiple epics. It is NOT a separate epic but a cross-cutting concern built into Stories 5.1, 7.1, 9.2, 11.2, 15.1.

**Required audit log entries:**
- Tenant membership changes (invite, role change, removal)
- Every notification creation
- Every delivery status change
- All billing events (payment, failure, subscription change)
- LGPD: opt-in/opt-out changes, data deletion
- All actions include: `action`, `resource`, `resource_id`, `user_id`, `tenant_id`, `details` (JSONB), `created_at`

---

## Summary

| Epic | Stories | Total Size | Phase |
|------|---------|-----------|-------|
| 1. Shared | 3 | M | 1 |
| 2. Database | 5 | XL | 1 |
| 3. Security | 3 | L | 1 |
| 4. Auth | 3 | L | 2 |
| 5. Tenants | 2 | M | 2 |
| 6. App Users & Devices | 2 | M | 3 |
| 7. Notifications | 4 | XL | 3 |
| 8. Automations | 2 | L | 3 |
| 9. Push Dispatch | 4 | XL | 4 |
| 10. Events & Ingestion | 2 | L | 4 |
| 11. Billing | 2 | L | 5 |
| 12. Integrations | 5 | XL | 5 |
| 13. Analytics | 2 | L | 6 |
| 14. App Config & Build | 2 | L | 6 |
| 15. LGPD & Data Retention | 2 | M | 7 |
| 16. CI/CD Pipeline | 3 | L | 7 |
| **Total** | **46** | | |

### Critical Path (Minimum Viable Flow)

```
1.1 → 2.1 → 2.3 → 4.1 → 4.2 → 5.1 → 6.1 → 6.2 → 7.1 → 8.1 → 8.2 → 9.1 → 9.2
                                                              ↓
                                                           7.2 → 7.3
```

This path delivers: auth → tenants → users → devices → notifications → automations → push dispatch → delivery tracking.

### Test Count Estimate

| Category | Count |
|----------|-------|
| Unit (Layer 1+2) | ~310 |
| Integration (Layer 3) | ~160 |
| Isolation (multi-tenant) | ~60 |
| E2E (Layer 4) | ~40 |
| **Total** | **~570** |

---

## Stories Pendentes (Fases 1-3) — Status 2026-03-14

### P0 — Bloqueadores — DONE

- ~~**Story 3.1** — AES-256-GCM Encryption Service~~ — 14 tests (round-trip, tamper, wrong key, unique IV)
- ~~**Story 3.2** — SSRF Protection Utility~~ — 27 tests (whitelist, private IPs, localhost, spoofing)
- ~~**Story 5.2** — Encrypted Credentials Storage~~ — 7 tests (store, retrieve, empty, propagation)
- ~~**Story 5B.3** — Audit Log Service~~ — 9 tests (log, list, getById, AuditLogger interface) + API endpoint (owner-only)

### P1 — Importantes — DONE

- ~~**Story 3.3** — Rate Limiting Middleware~~ — 7 tests (limit, per-IP isolation, window expiry, Redis store)
- ~~**Story 4.1** — Auth Middleware JWT~~ — 7 tests (missing header, expired, wrong secret, missing sub, valid)
- ~~**Story 4.2** — Tenant Middleware & Switch-Tenant~~ — 7 tests + JWT signing with jose (membership validation + role)
- ~~**Story 4.3** — Roles Middleware RBAC~~ — 11 tests (full owner/editor/viewer matrix)
- ~~**Story 5B.1** — Middleware Chain~~ — 7 tests (chain order: auth→tenant→roles, health bypass, error handling)
- ~~**Story 5B.4** — Architecture Tests~~ — 4 tests (no console.log, no .only/.skip, naming convention)
- **Story 6.4** — Segment Refresh Worker — ALREADY DONE (10 tests)
- **Story 8.2** — Automation Trigger & BullMQ — ALREADY DONE (48 tests)
- **Story 2.2** — RLS Policies — SQL migration done, 129 tests marked .todo (require Docker DB)

### Summary

**Total new tests added: 100** (14+27+7+9+7+7+7+11+7+4)
**Total project tests: 677 passing, 129 todo**

---

*Pax, equilibrando prioridades*
