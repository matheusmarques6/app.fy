# AppFy MVP — QA Cross-Reference Findings Backlog

> Generated: 2026-03-14 | Source: QA Cross-Reference Audit
> Total Findings: 21 | Priorities: P0 (5), P1 (8), P2 (8)

> **Cross-reference key:** Numeric references (e.g., `10.1`, `9.1`) refer to stories in `BACKLOG.md`. `F`-prefixed references (e.g., `F7`, `F14`) refer to findings within this file.

---

## Summary

| Finding | Title | Size | Priority | Blocked-by | Phase |
|---------|-------|------|----------|------------|-------|
| F1 | Data Ingestion Worker Implementation | L | P0 | 10.1, 8.2 | 4 |
| F2 | Push Dispatch Worker Delivery Tracking | S | P0 | 9.1 | 4 |
| F3 | Tenant List Handler | S | P0 | 4.2, 5.1 | 2 |
| F4 | Shopify/Nuvemshop OAuth Handlers | L | P0 | 3.1, 3.2, 12.1, 12.2 | 5 |
| F5 | Platform Webhook BullMQ Enqueue | S | P0 | 12.5 | 5 |
| F6 | RLS/Isolation Tests Activation | L | P1 | 2.2, 2.4 | 1 |
| F7 | OneSignal Webhook Endpoint | M | P1 | 9.2, 12.4 | 4 |
| F8 | Segment Refresh Worker | M | P1 | 6.4 | 3 |
| F9 | Membership Management Endpoints | L | P1 | 4.2, 5.1 | 2 |
| F10 | Rate Limit Retry-After Header | XS | P1 | 3.3 | 1 |
| F11 | Repository Integration Tests (Layer 3) | XL | P1 | 2.1, 2.3, 2.4, F12 | 1 |
| F12 | Seed Helpers Directory | M | P1 | 2.1, 2.4 | 1 |
| F13 | Console API Integration | XL | P1 | 4.1, 5.1 | 6 |
| F14 | OneSignal Provider Relocation | S | P2 | 12.4 | 5 |
| F15 | OneSignal Contract Test | S | P2 | 12.4, F14 | 5 |
| F16 | R2 Presigned URL for App Config | M | P2 | 14.1 | 6 |
| F17 | Playwright E2E in CI G6 | L | P2 | 16.3 | 7 |
| F18 | Structured Logger in Error Handler | S | P2 | 5B.1 | 2 |
| F19 | X-Request-Id Header | S | P2 | 5B.1 | 2 |
| F20 | Pending Plan Change for Downgrades | M | P2 | 11.2 | 5 |
| F21 | Build Worker for Capacitor | L | P2 | 14.2 | 6 |

---

## P0 — Critical Blockers

---

### F1 — Data Ingestion Worker Implementation [L]

**Como** sistema, **quero** que o worker de data-ingestion persista eventos, deduplicar e roteie para triggers de automacao, **para** que webhooks de plataformas realmente disparem fluxos de receita.

**Acceptance Criteria:**
- [ ] Uncomment and implement event persistence via `deps.eventService.create()` in `data-ingestion.worker.ts` (line 77)
- [ ] Implement dedup check: same `(tenantId, eventType, payload hash)` within 5s window → skip
- [ ] Route events by type to `deps.automationService.triggerFlow()` for all 9 event-to-flow mappings
- [ ] `app_opened` special case: first occurrence triggers `welcome` flow, subsequent ones do NOT
- [ ] `product_viewed` special case: schedule `browse_abandoned` check after 2-4h delay
- [ ] Unknown event types are logged as warnings but NOT rejected (forward compatibility)
- [ ] All 3 sections (dedup, persist, route) work atomically — if persist fails, no trigger fires

**blocked-by:** [10.1, 8.2]
**blocks:** [F7]

#### Arquiteto
- File: `apps/workers/src/ingestion/data-ingestion.worker.ts` (lines 69-108 are commented out)
- Dedup strategy: hash `JSON.stringify(payload)` + Redis key `dedup:{tenantId}:{eventType}:{hash}` with 5s TTL
- Event-to-flow mapping must match CLAUDE.md spec exactly (9 flows)
- `app_opened` welcome detection: query `app_events` for prior `app_opened` by same `app_user_id`
- `browse_abandoned` check: enqueue delayed BullMQ job (2-4h) that verifies no `add_to_cart` followed

#### Database
- INSERT into `app_events` table via EventRepository
- Dedup lookup via Redis (not DB query — performance)
- No schema changes required

#### Dev
- Layer 1: event-to-flow mapping function (pure)
- Layer 2: processor with spy EventRepository, spy AutomationService, spy BullMQ
- Layer 3: integration test with real Redis for dedup TTL behavior
- TDD scenarios:
  - Event received → persisted via EventRepository
  - Duplicate event within 5s → skipped, not persisted
  - `cart_abandoned` → triggers `cart_abandoned` flow
  - `order_paid` → triggers `order_confirmed` flow
  - First `app_opened` → triggers `welcome` flow
  - Second `app_opened` → does NOT trigger `welcome`
  - `product_viewed` → schedules delayed `browse_abandoned` check
  - Unknown event type → logged as warning, still persisted

#### QA
- [ ] Event ingested → appears in `app_events` table
- [ ] Same event within 5s → only 1 record in DB
- [ ] Same event after 5s → 2 records in DB (dedup expired)
- [ ] Each of 9 event types triggers the correct flow
- [ ] `app_opened` first → welcome, second → no trigger
- [ ] Persist failure → no automation triggered (atomicity)
- [ ] Unknown event → warning logged, no crash

---

### F2 — Push Dispatch Worker Delivery Tracking [S]

**Como** sistema, **quero** que o worker de push-dispatch atualize o status das deliveries para "sent" apos envio bem-sucedido, **para** que o tracking de push funcione end-to-end.

**Acceptance Criteria:**
- [ ] After successful OneSignal send, call `deps.deliveryService.markAsSent(notificationId, batchTokens)` to update delivery records
- [ ] Each delivery record in the batch updated from `pending` → `sent` with `sent_at` timestamp
- [ ] If OneSignal send fails, delivery records remain `pending` (BullMQ retries)
- [ ] If delivery update fails after successful send, log error but do NOT retry push (idempotent)
- [ ] `externalId` from OneSignal response stored on delivery records for future status lookups

**blocked-by:** [9.1]
**blocks:** [F7, 13.1]

#### Arquiteto
- File: `apps/workers/src/push/push-dispatch.worker.ts` line 70 (TODO comment)
- Use `DeliveryRepository.bulkUpdateStatus(notificationId, tokens, 'sent', { sentAt, externalId })`
- Optimistic locking: `UPDATE ... WHERE status = 'pending'` (skip already-sent)
- Store OneSignal `externalId` for webhook correlation (F7)

#### Database
- UPDATE `notification_deliveries` SET `status = 'sent'`, `sent_at = NOW()`, `external_id = ?` WHERE `notification_id = ?` AND `device_token IN (?)` AND `status = 'pending'`
- No schema changes required (columns already exist)

#### Dev
- Layer 2: processor with spy DeliveryRepository + spy PushProvider
- TDD scenarios:
  - Successful send → deliveries updated to `sent`
  - OneSignal failure → deliveries remain `pending`, error thrown (BullMQ retries)
  - Partial batch (some already sent) → only pending ones updated
  - `externalId` captured from OneSignal response

#### QA
- [ ] Send push → all delivery records status=`sent` with `sent_at` set
- [ ] OneSignal error → delivery records still `pending`
- [ ] Retry after failure → idempotent (already-sent records not double-sent)
- [ ] `external_id` stored on delivery records

---

### F3 — Tenant List Handler [S]

**Como** usuario autenticado, **quero** ver a lista de tenants dos quais sou membro, **para** poder escolher em qual operar (switch tenant).

**Acceptance Criteria:**
- [ ] `GET /tenants` returns list of tenants where the authenticated user has active membership
- [ ] Each tenant in response includes: `id`, `name`, `slug`, `platform`, `role` (user's role in that tenant)
- [ ] User with no memberships → `{ data: [] }` (empty array, not error)
- [ ] Only active memberships returned (future: soft-delete/deactivated excluded)
- [ ] Response sorted by tenant name alphabetically

**blocked-by:** [4.2, 5.1]
**blocks:** [F9]

#### Arquiteto
- File: `apps/api/src/domains/tenants/handlers.ts` line 13 (currently returns hardcoded `{ data: [] }`)
- Query: `MembershipRepository.findByUserId(userId)` → join with tenants table
- Pattern: handler extracts `userId` from context (already set by auth middleware), queries membership repo
- Return shape: `{ data: [{ id, name, slug, platform, role }] }`

#### Database
- SELECT from `memberships` JOIN `tenants` WHERE `user_id = ?` ORDER BY `tenants.name`
- No schema changes required

#### Dev
- Layer 2: handler with spy MembershipRepository
- Layer 4: HTTP test with real Hono app
- TDD scenarios:
  - User with 2 memberships → returns 2 tenants with roles
  - User with 0 memberships → returns empty array
  - Each tenant includes role (owner/editor/viewer)
  - Unauthorized → 401

#### QA
- [ ] Authenticated user → sees their tenants with roles
- [ ] User with no memberships → `{ data: [] }`
- [ ] Tenant data includes id, name, slug, platform, role
- [ ] No auth header → 401

---

### F4 — Shopify/Nuvemshop OAuth Handlers [L]

**Como** owner, **quero** conectar minha loja Shopify ou Nuvemshop via OAuth, **para** que o sistema receba webhooks e dados da plataforma.

**Acceptance Criteria:**
- [ ] `POST /integrations/shopify/connect` generates correct Shopify OAuth URL with `client_id`, `redirect_uri`, `state` (CSRF), `scope` (read_products, read_orders, read_customers)
- [ ] `POST /integrations/nuvemshop/connect` generates correct Nuvemshop OAuth URL with `app_id`, `redirect_uri`, `state`
- [ ] `GET /integrations/:platform/callback` exchanges authorization `code` for access token via platform API
- [ ] Access token encrypted via EncryptionService and stored as tenant `platformCredentials`
- [ ] `state` parameter validated on callback (CSRF protection) — mismatch → 403
- [ ] SSRF validation on redirect URL (must match whitelist)
- [ ] After successful connection, platform webhooks registered via `PlatformAdapter.registerWebhooks()`
- [ ] Missing `code` on callback → 400 (already implemented)

**blocked-by:** [3.1, 3.2, 12.1, 12.2]
**blocks:** []

#### Arquiteto
- File: `apps/api/src/domains/integrations/handlers.ts` — `connect()` (line ~47) and `callback()` (line ~62) handlers (TODO stubs)
- OAuth state: store in Redis with 10min TTL, key `oauth:{state}:{tenantId}`
- Token exchange: HTTP POST to platform token endpoint (Shopify: `https://{shop}.myshopify.com/admin/oauth/access_token`, Nuvemshop: `https://www.tiendanube.com/apps/authorize/token`)
- SSRF: validate `redirectUrl` via `validateUrl()` from `packages/core/src/security/ssrf.ts`
- After token exchange: `EncryptionService.encrypt(JSON.stringify({ accessToken, webhookSecret }))` → store in tenant

#### Database
- UPDATE `tenants` SET `platform_credentials = ?` (encrypted JSONB)
- No schema changes required

#### Dev
- Layer 2: handler with spy EncryptionService, spy PlatformAdapter, MSW for platform API
- Layer 4: HTTP tests for full OAuth flow (connect → callback → credentials stored)
- TDD scenarios:
  - Connect → returns valid OAuth URL with correct params
  - Callback with valid code → token exchanged, encrypted, stored
  - Callback with invalid state → 403
  - Callback with missing code → 400
  - Token exchange failure → 502
  - After connect → webhooks registered via adapter

#### QA
- [ ] Shopify connect → URL contains client_id, scope, state, redirect_uri
- [ ] Nuvemshop connect → URL contains app_id, state, redirect_uri
- [ ] Valid callback → credentials encrypted and stored
- [ ] Invalid state → 403
- [ ] Token exchange HTTP error → 502
- [ ] SSRF: redirect to `http://127.0.0.1` → blocked

---

### F5 — Platform Webhook BullMQ Enqueue [S]

**Como** sistema, **quero** que webhooks recebidos de plataformas sejam enfileirados no BullMQ, **para** que o worker de data-ingestion os processe assincronamente.

**Acceptance Criteria:**
- [ ] After successful HMAC verification and payload parsing, enqueue job to `data-ingestion` queue via `deps.queue.add()`
- [ ] Job payload includes: `tenantId`, `platform`, `topic`, `flowType`, `shopDomain`, `data` (parsed body), `receivedAt`, `queue`
- [ ] Queue name uses `QUEUE_NAMES.dataIngestion` constant from `@appfy/shared`
- [ ] Return `{ received: true }` with 200 only AFTER successful enqueue
- [ ] If enqueue fails → return 503 (service unavailable, platform will retry)

**blocked-by:** [12.5]
**blocks:** [F1]

#### Arquiteto
- File: `apps/api/src/domains/integrations/handlers.ts` line 171 (job payload built but not enqueued)
- Wire `deps.queue` (BullMQ Queue instance) into integration handlers via `createDependencies()`
- Job options: `{ removeOnComplete: true, removeOnFail: 100, attempts: 3, backoff: { type: 'exponential', delay: 1000 } }`
- The `jobPayload` is already built correctly (line 159-168) — just needs the actual `queue.add()` call

#### Database
- No database changes — BullMQ uses Redis

#### Dev
- Layer 2: handler with BullMQSpy to verify job creation
- Layer 4: HTTP test — send valid webhook → verify job enqueued with correct payload
- TDD scenarios:
  - Valid webhook → job enqueued with correct payload shape
  - Job payload contains tenantId, platform, topic, flowType, shopDomain, data, receivedAt, queue
  - Queue add failure → 503 returned
  - Invalid HMAC → no job enqueued (existing behavior)

#### QA
- [ ] Valid Shopify webhook → job in `data-ingestion` queue
- [ ] Job payload has tenantId, platform, topic, flowType, shopDomain, data, receivedAt, queue
- [ ] Invalid HMAC → no job created
- [ ] Redis down → 503 (not 200)

---

## P1 — Important

---

### F6 — RLS/Isolation Tests Activation [L]

**Como** QA engineer, **quero** que os testes de isolamento cubram todos os 60 cenarios obrigatorios (10 tabelas x 6 operacoes), **para** validar que RLS policies funcionam corretamente.

**Acceptance Criteria:**
- [ ] Expand isolation tests from current 48 to 60 scenarios (10 tables x 6 operations per CLAUDE.md spec)
- [ ] Testcontainers setup configured: PostgreSQL 16 with migrations applied
- [ ] Each test uses real DB connections with different JWT claims per tenant
- [ ] All 60 isolation scenarios pass (10 tables x 6 operations)
- [ ] RLS policy tests validate the 6 mandatory scenarios per table
- [ ] Tests run in CI gate G2 (integration test step)
- [ ] Total test execution < 120s

**blocked-by:** [2.2, 2.4]
**blocks:** []

#### Arquiteto
- Files: `packages/test-utils/src/isolation/*.isolation.spec.ts` (currently 48 tests, target 60)
- Testcontainers: `@testcontainers/postgresql` for PG 16 instance
- RLS testing pattern: `SET LOCAL request.jwt.claims = '{"tenant_id": "...", "sub": "..."}'` before each query
- Global setup: start PG container, run Drizzle migrations, export connection string
- Each test file: `beforeEach` → truncate tables + seed multi-tenant data

#### Database
- Verify `pg_class.relrowsecurity = true` for all tenant-scoped tables
- Verify policies via `pg_policies` catalog
- Test with both `anon` and `authenticated` roles

#### Dev
- Layer 3: all tests are integration tests with real PG
- Setup: `packages/test-utils/src/setup/testcontainers.ts` for shared PG lifecycle
- Parameterized test factory: `isolationTestSuite(tableName, repo, seedFn)` to avoid duplication
- TDD: convert each `.todo` to real test, verify it fails without RLS (red), passes with RLS (green)

#### QA
- [ ] 60 isolation scenarios pass (expanded from current 48)
- [ ] Each of 10 tables has isolation tests for all applicable operations
- [ ] Cross-tenant SELECT returns zero rows
- [ ] Cross-tenant UPDATE affects zero rows
- [ ] Cross-tenant DELETE affects zero rows
- [ ] No JWT → access denied for all tables
- [ ] Tests execute in < 120s

---

### F7 — OneSignal Webhook Endpoint [M]

**Como** sistema, **quero** receber callbacks de status do OneSignal (delivered, opened, clicked), **para** atualizar o status de delivery em tempo real.

**Acceptance Criteria:**
- [ ] `POST /api/webhooks/onesignal` endpoint created
- [ ] Endpoint receives delivery status callbacks from OneSignal
- [ ] OneSignal signature verification on incoming webhooks
- [ ] Status updates: `sent → delivered`, `delivered → opened`, `opened → clicked`
- [ ] Delivery record matched by `external_id` (stored during push dispatch — F2)
- [ ] Invalid status transition → logged and ignored (not error)
- [ ] Unknown `external_id` → 200 (acknowledge but ignore)
- [ ] Endpoint is public (no auth middleware — OneSignal cannot authenticate)

**blocked-by:** [9.2, 12.4]
**blocks:** [13.1]

#### Arquiteto
- New file: `apps/api/src/domains/webhooks/onesignal/routes.ts` + `handlers.ts` + `schemas.ts`
- OneSignal webhook format: `{ event: 'notification.delivered', data: { id, external_id, ... } }`
- Signature: OneSignal sends `X-OneSignal-Signature` header (HMAC-SHA256)
- Lookup delivery by `external_id` → update status via `DeliveryStatusService.transition()`
- Route registered WITHOUT auth/tenant middleware (public endpoint)

#### Database
- UPDATE `notification_deliveries` SET status, `delivered_at`/`opened_at`/`clicked_at` WHERE `external_id = ?`
- Optimistic locking: only update if current status allows transition

#### Dev
- Layer 2: handler with spy DeliveryRepository + spy DeliveryStatusService
- Layer 4: HTTP test with real Hono app (public endpoint, no auth)
- TDD scenarios:
  - `notification.delivered` → delivery status updated to `delivered`
  - `notification.opened` → status updated to `opened` with `opened_at`
  - `notification.clicked` → status updated to `clicked` with `clicked_at`
  - Invalid signature → 401
  - Unknown external_id → 200 (no error)
  - Invalid transition (e.g., `pending → opened`) → logged, ignored

#### QA
- [ ] OneSignal `delivered` callback → delivery record status=`delivered`
- [ ] OneSignal `opened` callback → status=`opened`, `opened_at` set
- [ ] Invalid signature → 401
- [ ] Unknown delivery → 200 (graceful)
- [ ] Duplicate callback → idempotent (no error)

---

### F8 — Segment Refresh Worker [M]

**Como** sistema, **quero** um worker BullMQ que processe a fila de segment-refresh, **para** manter segmentos de usuarios atualizados automaticamente.

**Acceptance Criteria:**
- [ ] Worker file created at `apps/workers/src/segment/`
- [ ] Worker processes `segment-refresh` queue (uses `QUEUE_NAMES.segmentRefresh`)
- [ ] Calls `SegmentRefreshService.refresh(tenantId, segmentId)` from `packages/core`
- [ ] Worker follows same pattern as push-dispatch and data-ingestion workers (factory, logger, graceful shutdown)
- [ ] BullMQ retry: 3 attempts with exponential backoff
- [ ] Batch processing: evaluates rules in chunks of 1000 users
- [ ] Graceful: if worker fails mid-refresh, next run corrects state (idempotent)

**blocked-by:** [6.4]
**blocks:** []

#### Arquiteto
- New files: `apps/workers/src/segment/index.ts`, `processor.ts`
- Core service already exists: `packages/core/src/segments/refresh.service.ts`
- Worker is a thin shell: receives job → calls core service → logs result
- Entry point: `node dist/segment/index.js` (separate Railway service or co-hosted with ingestion)
- Use `createWorkerFactory()` from `apps/workers/src/shared/worker-factory.ts`

#### Database
- Bulk INSERT/DELETE on `app_user_segments` (handled by core service)
- Transaction per segment refresh (atomicity)

#### Dev
- Layer 2: worker processor with spy SegmentRefreshService
- Layer 3: real DB test — seed 100 users, create segment, verify membership changes
- TDD scenarios:
  - Job received → calls SegmentRefreshService.refresh()
  - Service failure → job retried (BullMQ backoff)
  - Large segment (1000+ users) → batched processing
  - Idempotent: run twice → same result

#### QA
- [ ] Worker starts and connects to Redis queue
- [ ] Job processed → segment membership updated
- [ ] Service throws → job retried with backoff
- [ ] Run twice → same membership result (idempotent)

---

### F9 — Membership Management Endpoints [L]

**Como** owner de um tenant, **quero** convidar membros, alterar roles e remover membros, **para** gerenciar minha equipe.

**Acceptance Criteria:**
- [ ] `GET /tenants/:id/members` — list all members (all roles can view)
- [ ] `POST /tenants/:id/members/invite` — invite member by email + role (owner only)
- [ ] `PUT /tenants/:id/members/:memberId/role` — change member role (owner only)
- [ ] `DELETE /tenants/:id/members/:memberId` — remove member (owner only)
- [ ] Invite creates membership record with `pending` status + sends invite email (or placeholder)
- [ ] Cannot remove the last owner (at least 1 owner must remain)
- [ ] Cannot change own role if only owner
- [ ] Every membership change recorded in `audit_log`
- [ ] RBAC: viewer/editor → 403 on invite/role/remove

**blocked-by:** [4.2, 5.1]
**blocks:** []

#### Arquiteto
- New routes in `apps/api/src/domains/tenants/routes.ts` (sub-routes under `/tenants/:id/members`)
- Or new domain: `apps/api/src/domains/members/` (prefer sub-routes for cohesion)
- MembershipService in `packages/core/src/tenants/membership.service.ts`
- Audit log: every invite, role change, and removal logged
- Invite flow MVP: create membership record. Email notification = Phase 2

#### Database
- `memberships` table: `user_id`, `tenant_id`, `role`, `status` (active/pending), `invited_at`, `joined_at`
- Constraint: at least 1 owner per tenant (enforced in service layer, not DB)

#### Dev
- Layer 1: business rule tests (cannot remove last owner, role validation)
- Layer 2: MembershipService with spy MembershipRepository + spy AuditLogService
- Layer 4: HTTP tests with RBAC verification
- TDD scenarios:
  - Owner invites → membership created + audit logged
  - Editor invites → 403
  - Viewer invites → 403
  - Remove last owner → 400
  - Change own role as only owner → 400
  - Remove member → membership deleted + audit logged
  - List members → returns all members with roles

#### QA
- [ ] Owner invites user → membership record created with role
- [ ] Non-owner attempts invite → 403
- [ ] Change role → role updated + audit logged
- [ ] Remove last owner → 400 error
- [ ] Remove regular member → success + audit logged
- [ ] Audit log entries for all membership operations

---

### F10 — Rate Limit Retry-After Header [XS]

**Como** cliente da API, **quero** receber o header `Retry-After` quando sou rate-limited (429), **para** saber quando posso tentar novamente.

**Acceptance Criteria:**
- [ ] All 429 responses include `Retry-After` header (value in seconds)
- [ ] `Retry-After` value = remaining time in current rate limit window (ceiling to nearest second)
- [ ] Header present on both rate limit tiers (admin: 100/min, public: 20/s)
- [ ] Value is always a positive integer (minimum 1)

**blocked-by:** [3.3]
**blocks:** []

#### Arquiteto
- File: `apps/api/src/middleware/rate-limit.ts`
- When rate limit exceeded, calculate: `windowEnd - now` in seconds, round up
- Set response header: `c.header('Retry-After', String(retryAfterSeconds))`
- Spec reference: RFC 7231 Section 7.1.3

#### Dev
- Layer 4: HTTP test verifying header presence and value
- TDD scenarios:
  - Rate limited → 429 with `Retry-After` header
  - Header value is positive integer
  - Different tiers produce correct window-based values

#### QA
- [ ] 429 response includes `Retry-After` header
- [ ] Header value is positive integer in seconds
- [ ] After waiting `Retry-After` seconds → next request succeeds

---

### F11 — Repository Integration Tests (Layer 3) [XL]

**Como** desenvolvedor, **quero** testes de integracao para todos os 55 metodos dos 10 repositorios, **para** garantir que queries Drizzle funcionam corretamente com PostgreSQL real.

**Acceptance Criteria:**
- [ ] Integration tests for all 10 repositories: TenantRepo, MembershipRepo, AppUserRepo, DeviceRepo, NotificationRepo, DeliveryRepo, AutomationConfigRepo, AppEventRepo, AppConfigRepo, AuditLogRepo
- [ ] Each CRUD method tested: `findAll`, `findById`, `create`, `update`, `delete`, `count` (where applicable)
- [ ] Tests run against real PostgreSQL via testcontainers
- [ ] Verify: correct data returned, constraints enforced (unique, FK), atomic transactions
- [ ] `EXPLAIN ANALYZE` on key queries: verify Index Scan (not Seq Scan) for indexed columns
- [ ] Tests in `packages/test-utils/src/integration/repositories/`
- [ ] Total: ~55 tests across 10 repositories

**blocked-by:** [2.1, 2.3, 2.4, F12]
**blocks:** [F6]

#### Arquiteto
- Each repo test file: `{name}.repository.integration.spec.ts`
- Shared testcontainers setup (same PG instance as isolation tests)
- Each test: `beforeEach` truncate tables → seed → execute → assert
- Performance validation: key queries must use Index Scan on `(tenant_id, status, created_at)` and `(tenant_id, event_type, created_at)`

#### Database
- Verify constraints: unique slug, unique (tenant_id, flow_type), FK cascades
- Verify defaults: `devices.is_active = true`, `notifications.status = 'draft'`
- Verify indexes via `EXPLAIN ANALYZE` output

#### Dev
- Layer 3: real DB integration tests
- Use seed helpers from Story 2.4 for test data
- TDD: for each repo method → write test first → verify against real PG
- Group by repo: 1 test file per repository

#### QA
- [ ] All 55 repository methods have integration tests
- [ ] Unique constraint violations throw expected errors
- [ ] FK cascade behavior verified (e.g., delete tenant → cascades)
- [ ] Indexed queries use Index Scan (EXPLAIN ANALYZE)
- [ ] All tests pass against real PG in < 60s

---

### F12 — Seed Helpers Directory [M]

**Como** desenvolvedor, **quero** seed helpers dedicados para testes, **para** criar dados de teste completos em testes de integracao sem duplicar setup.

**Acceptance Criteria:**
- [ ] Directory: `packages/test-utils/src/seeds/`
- [ ] `seedTenant(db, overrides?)` — creates tenant with unique slug via `randomUUID().slice(0,8)`
- [ ] `seedAppUser(db, tenantId, overrides?)` — creates app user for tenant
- [ ] `seedDevice(db, { tenantId, appUserId, isActive?, deviceToken? })` — creates device
- [ ] `seedNotification(db, { tenantId, title?, status?, type?, createdAt? })` — creates notification
- [ ] `seedDelivery(db, { tenantId, status?, createdAt? })` — creates notification + user + device + delivery (full chain)
- [ ] `seed10KDeliveries(db, tenantId)` — bulk insert 10K deliveries for performance tests
- [ ] All helpers use Drizzle to insert into real DB (not builders — these are DB seeders)
- [ ] Each helper returns the created record(s) for test assertions

**blocked-by:** [2.1, 2.4]
**blocks:** [F6, F11]

#### Arquiteto
- Separate from builders (which produce in-memory objects): seed helpers INSERT into real DB
- `seedDelivery` must create the full dependency chain: tenant → app_user → device → notification → delivery
- `seed10KDeliveries` uses batch INSERT for performance (not 10K individual inserts)
- All seeds respect existing data (no TRUNCATE — caller manages cleanup)

#### Database
- INSERT operations for all core tables
- Must respect FK constraints (create parent before child)
- Unique values generated per call (no collisions in parallel tests)

#### Dev
- Layer 3: each seed helper tested against real PG
- TDD: seed → query → verify record exists with correct values
- Edge: seed with overrides → custom values applied

#### QA
- [ ] `seedTenant()` creates tenant with unique slug
- [ ] `seedDelivery()` creates full chain (tenant + user + device + notification + delivery)
- [ ] `seed10KDeliveries()` creates 10K records efficiently (< 10s)
- [ ] All returned records have valid UUIDs and timestamps

---

### F13 — Console API Integration [XL]

**Como** usuario do console, **quero** que o painel conecte com a API real (nao mock data), **para** ver dados reais de meus tenants.

**Acceptance Criteria:**
- [ ] Remove or replace `apps/console/src/lib/mock-data.ts` with real API calls
- [ ] API client in `apps/console/src/lib/api-client.ts` configured with Supabase Auth token injection
- [ ] SWR hooks created for all data-fetching pages: dashboard, notifications, automations, app-users, devices, analytics, integrations, app-config, billing
- [ ] Error handling: API errors shown via sonner toasts
- [ ] Loading states: skeleton components while data loads
- [ ] Auth flow: redirect to `/login` if API returns 401
- [ ] Tenant context: `X-Tenant-Id` header sent on every API request
- [ ] At minimum, these pages fetch real data: Dashboard (analytics overview), Notifications (list), Tenants (list/switch)

**blocked-by:** [4.1, 5.1]
**blocks:** []

#### Arquiteto
- `api-client.ts` pattern: `setAuthTokenProvider()` injects Supabase session token
- SWR pattern: `useSWR('/api/notifications', fetcher)` with revalidation
- Zustand store for tenant context (current tenant ID, role)
- Error interceptor: 401 → clear session + redirect, 429 → toast with retry-after, 5xx → toast with retry

#### Dev
- Console-specific work — no TDD layers apply (frontend)
- Integration: verify console can call API and render responses
- Replace mock data incrementally (page by page)
- Test: Playwright E2E for critical flows (login → dashboard → see data)

#### QA
- [ ] Dashboard loads with real API data (not mock)
- [ ] Notification list shows actual notifications from API
- [ ] Tenant switch updates all data
- [ ] API error → toast notification shown
- [ ] 401 → redirect to login
- [ ] Loading state → skeleton visible before data arrives

---

## P2 — Minor

---

### F14 — OneSignal Provider Relocation [S]

**Como** arquiteto, **quero** que o OneSignal provider viva em `packages/integrations/`, **para** respeitar o grafo de dependencias do monorepo.

**Acceptance Criteria:**
- [ ] Move `packages/core/src/push/onesignal.provider.ts` to `packages/integrations/src/onesignal/provider.ts`
- [ ] Create barrel: `packages/integrations/src/onesignal/index.ts` exporting provider
- [ ] Update all imports across the monorepo
- [ ] `packages/core/src/push/` retains only the `PushProvider` interface (contract)
- [ ] `packages/integrations` depends on `packages/core` (for the interface) — NOT the reverse

**blocked-by:** [12.4]
**blocks:** [F15]

#### Arquiteto
- Current location: `packages/core/src/push/onesignal.provider.ts`
- Target location: `packages/integrations/src/onesignal/provider.ts`
- `packages/core` exports `PushProvider` interface
- `packages/integrations` implements `PushProvider` with `OneSignalProvider`
- This follows the dependency graph: `integrations → core` (never `core → integrations`)

#### Dev
- Mechanical refactor: move file, update imports, verify build
- No logic changes — pure relocation
- Verify: `pnpm --filter @appfy/integrations build` succeeds
- Verify: `pnpm --filter @appfy/core build` succeeds (no circular dep)

#### QA
- [ ] `OneSignalProvider` importable from `@appfy/integrations`
- [ ] `PushProvider` interface stays in `@appfy/core`
- [ ] No circular dependency between packages
- [ ] All existing tests pass after relocation

---

### F15 — OneSignal Contract Test [S]

**Como** QA engineer, **quero** um contract test para o OneSignal provider, **para** garantir que ele implementa corretamente a interface PushProvider.

**Acceptance Criteria:**
- [ ] `pushProviderContractTest('OneSignal', () => new OneSignalProvider(mockConfig))` created
- [ ] Contract test follows same pattern as `platformAdapterContractTest` (Shopify/Nuvemshop)
- [ ] Tests: `createApp()`, `sendNotification()`, `getDeliveryStatus()`, `registerDevice()`
- [ ] Uses MSW for OneSignal API mocking
- [ ] Contract test is reusable: can test any `PushProvider` implementation

**blocked-by:** [12.4, F14]
**blocks:** []

#### Arquiteto
- File: `packages/test-utils/src/contracts/push-provider.contract.ts`
- Pattern: factory function receives provider instance, runs all interface methods
- MSW handlers for OneSignal API: `https://onesignal.com/api/v1/notifications`, `https://onesignal.com/api/v1/apps`

#### Dev
- Layer 2: contract test with MSW mocks
- TDD: write contract spec → OneSignal provider must satisfy all assertions
- Reusable: `pushProviderContractTest(name, factoryFn)` — same pattern as platform adapter

#### QA
- [ ] Contract test passes for OneSignal provider
- [ ] All PushProvider interface methods covered
- [ ] MSW mocks realistic OneSignal responses
- [ ] Contract is reusable for future providers

---

### F16 — R2 Presigned URL for App Config [M]

**Como** owner, **quero** fazer upload de icone e splash screen para o app, **para** personalizar a aparencia do meu aplicativo.

**Acceptance Criteria:**
- [ ] `POST /api/app-configs/upload-url` — generates presigned upload URL for Cloudflare R2
- [ ] Supports file types: `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`
- [ ] Max file size: 5MB (enforced via presigned URL conditions)
- [ ] Upload target: `{tenantId}/icon.{ext}` or `{tenantId}/splash.{ext}` in R2 bucket
- [ ] Returns: `{ uploadUrl, publicUrl, expiresIn }` (presigned URL valid for 15 minutes)
- [ ] After upload, `PUT /api/app-configs` updates `icon_url` or `splash_url` with the public URL
- [ ] R2 client configured via env vars: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY`, `CLOUDFLARE_R2_SECRET_KEY`, `CLOUDFLARE_R2_BUCKET`

**blocked-by:** [14.1]
**blocks:** []

#### Arquiteto
- R2 client: `@aws-sdk/client-s3` with S3-compatible endpoint (`https://{accountId}.r2.cloudflarestorage.com`)
- Presigned URL: `PutObjectCommand` with conditions (content-type, max size)
- Service: `packages/core/src/storage/r2.service.ts`
- Never accept file directly — always presigned upload (no server memory pressure)

#### Database
- No schema changes — `icon_url` and `splash_url` columns already exist on `app_configs`

#### Dev
- Layer 2: R2Service with mock S3 client
- Layer 3: MinIO container for integration tests (S3-compatible)
- TDD: presigned URL generation, file type validation, size limits

#### QA
- [ ] Request upload URL → returns valid presigned URL
- [ ] Upload via presigned URL → file accessible at public URL
- [ ] Wrong content type → rejected by presigned URL conditions
- [ ] File > 5MB → rejected
- [ ] Presigned URL expired (> 15min) → upload fails

---

### F17 — Playwright E2E in CI G6 [L]

**Como** QA engineer, **quero** testes E2E com Playwright no gate G6 do CI, **para** validar fluxos criticos end-to-end.

**Acceptance Criteria:**
- [ ] Playwright configured in monorepo root: `playwright.config.ts`
- [ ] E2E tests for critical flows: login, dashboard loads, tenant switch, notification list
- [ ] Tests run against staging deployment (not local dev)
- [ ] CI G6 step in `.github/workflows/deploy.yml` runs Playwright after staging deploy
- [ ] Automatic rollback triggered on Playwright failure
- [ ] Test artifacts (screenshots, traces) uploaded as CI artifacts on failure
- [ ] Tests complete in < 5min

**blocked-by:** [16.3]
**blocks:** []

#### Arquiteto
- Config: `playwright.config.ts` at repo root
- Tests: `tests/e2e/*.e2e.spec.ts`
- Base URL from env: `STAGING_URL`
- Auth: test user credentials stored as GitHub Actions secrets
- Pattern: login once via API → store auth state → reuse in all tests

#### Dev
- E2E tests (not TDD layers — Playwright framework)
- Minimum tests: login → dashboard → verify hero metrics → tenant switch → verify data changes
- Use Playwright's `expect(page.locator(...))` for assertions
- Trace on first retry for debugging

#### QA
- [ ] Login flow works end-to-end
- [ ] Dashboard displays real data after login
- [ ] Tenant switch updates displayed data
- [ ] Navigation to all main pages works
- [ ] CI G6 blocks deploy on E2E failure
- [ ] Screenshots/traces available on failure

---

### F18 — Structured Logger in Error Handler [S]

**Como** operador, **quero** que erros 500 usem um logger estruturado (nao console.error), **para** melhorar observabilidade em producao.

**Acceptance Criteria:**
- [ ] Replace `console.error` in `apps/api/src/middleware/error-handler.ts` with structured logger
- [ ] Logger outputs JSON format: `{ level, message, error, stack, timestamp, requestId? }`
- [ ] Logger abstraction: `Logger` interface in `packages/core` (not tied to specific library)
- [ ] Default implementation: `pino` (lightweight, JSON-native)
- [ ] Logger injected via middleware (Hono context) — not imported as global singleton
- [ ] Log levels: `debug`, `info`, `warn`, `error`, `fatal`
- [ ] In development: pretty-print output. In production: JSON only

**blocked-by:** [5B.1]
**blocks:** [F19]

#### Arquiteto
- File: `apps/api/src/middleware/error-handler.ts` line 69 (currently `console.error`)
- Logger interface: `packages/core/src/logger/logger.interface.ts`
- Pino implementation: `apps/api/src/lib/logger.ts`
- Inject logger into Hono context via middleware: `c.set('logger', logger)`
- Workers already have their own logger (`apps/workers/src/shared/logger.ts`) — unify interface

#### Dev
- Layer 2: error handler test with spy logger
- Verify: 500 error → logger.error called with structured data
- Verify: no `console.error` calls in production code (architecture test)

#### QA
- [ ] 500 error → structured JSON logged (not console.error)
- [ ] Log includes: level=error, message, error name, stack, timestamp
- [ ] Development mode → pretty-printed output
- [ ] Production mode → single-line JSON

---

### F19 — X-Request-Id Header [S]

**Como** operador, **quero** um header X-Request-Id em cada request/response, **para** correlacionar logs com requests de clientes.

**Acceptance Criteria:**
- [ ] Generate UUID v4 per request if no `X-Request-Id` header present
- [ ] If client sends `X-Request-Id`, use it (propagation)
- [ ] Set `X-Request-Id` on response headers
- [ ] Request ID available in Hono context: `c.get('requestId')`
- [ ] Request ID included in all log entries (structured logger)
- [ ] Middleware: `apps/api/src/middleware/request-id.ts`
- [ ] Applied BEFORE all other middleware (first in chain)

**blocked-by:** [5B.1]
**blocks:** []

#### Arquiteto
- New middleware: `apps/api/src/middleware/request-id.ts`
- Pattern: `const requestId = c.req.header('X-Request-Id') ?? randomUUID()`
- Set: `c.set('requestId', requestId)` + `c.header('X-Request-Id', requestId)`
- Must be first middleware in chain (before logger, auth, tenant)
- Logger should auto-include `requestId` from context

#### Dev
- Layer 4: HTTP test verifying header generation and propagation
- TDD scenarios:
  - No header sent → UUID generated, returned in response
  - Header sent → same value returned in response
  - Request ID accessible in context
  - Request ID appears in log entries

#### QA
- [ ] Response always includes `X-Request-Id` header
- [ ] No client header → server generates UUID
- [ ] Client sends header → same value echoed back
- [ ] Log entries include request ID

---

### F20 — Pending Plan Change for Downgrades [M]

**Como** sistema, **quero** armazenar downgrades pendentes no tenant, **para** aplicar a mudanca de plano apenas no proximo ciclo de cobranca.

**Acceptance Criteria:**
- [ ] Add `pending_plan_change` JSONB column to `tenants` table
- [ ] On downgrade request: store `{ targetPlanId, effectiveAt, requestedAt, requestedBy }` in `pending_plan_change`
- [ ] On `invoice.payment_succeeded` Stripe webhook: if `pending_plan_change` exists, apply it and clear
- [ ] On upgrade: apply immediately (existing behavior), clear any pending downgrade
- [ ] `GET /tenants/:id` includes `pendingPlanChange` in response (if present)
- [ ] Audit log entry on downgrade request and on application

**blocked-by:** [11.2]
**blocks:** []

#### Arquiteto
- Migration: add `pending_plan_change JSONB DEFAULT NULL` to tenants
- JSONB shape: `{ targetPlanId: string, effectiveAt: string (ISO), requestedAt: string (ISO), requestedBy: string (userId) }`
- Billing webhook handler: check `pending_plan_change`, apply if `effectiveAt <= now()`
- Upgrade clears pending: `UPDATE tenants SET pending_plan_change = NULL` on upgrade

#### Database
- Migration: `ALTER TABLE tenants ADD COLUMN pending_plan_change JSONB DEFAULT NULL`
- No RLS changes (column on existing tenant row)

#### Dev
- Layer 1: downgrade scheduling logic (pure — when to apply)
- Layer 2: BillingService with spy TenantRepository
- TDD scenarios:
  - Downgrade requested → pending stored
  - Payment webhook + pending exists → plan changed + pending cleared
  - Upgrade requested + pending exists → upgrade applied + pending cleared
  - Payment webhook + no pending → no change

#### QA
- [ ] Downgrade request → `pending_plan_change` stored on tenant
- [ ] Next billing cycle → plan changed to target plan
- [ ] Upgrade overrides pending downgrade
- [ ] Audit log for downgrade request and application
- [ ] `GET /tenants/:id` shows pending change when present

---

### F21 — Build Worker for Capacitor [L]

**Como** sistema, **quero** um worker que gere configuracoes Capacitor por tenant e inicie o build, **para** automatizar a criacao de apps moveis.

**Acceptance Criteria:**
- [ ] Worker file at `apps/workers/src/build/`
- [ ] Processes `build` queue (uses `QUEUE_NAMES.build`)
- [ ] Generates Capacitor `config.json` from tenant's `app_configs` record
- [ ] Config includes: `app_name`, `app_id` (derived from tenant slug), `icon_url`, `splash_url`, `primary_color`, `secondary_color`, `menu_config`
- [ ] Config output: `apps/mobile/configs/{tenantId}.json`
- [ ] Build is idempotent: same `app_configs` → same `config.json` output
- [ ] Build status tracked on `app_configs`: `idle → building → ready → failed`
- [ ] MVP: generates config only (actual Capacitor build is semi-manual). Phase 2: triggers Fastlane

**blocked-by:** [14.2]
**blocks:** []

#### Arquiteto
- New files: `apps/workers/src/build/index.ts`, `processor.ts`, `config-generator.ts`
- `ConfigGenerator.generate(appConfig)` → deterministic JSON output
- Status update via `AppConfigRepository.updateBuildStatus(tenantId, status)`
- Idempotent: hash the input config, compare with last build hash, skip if same
- Output directory: `apps/mobile/configs/` (or R2 for production)

#### Database
- UPDATE `app_configs` SET `build_status`, `last_build_at`, `last_build_hash`
- Consider adding `build_status` column if not present (check schema)

#### Dev
- Layer 1: ConfigGenerator (pure function — config → JSON output)
- Layer 2: BuildProcessor with spy AppConfigRepository + spy ConfigGenerator
- TDD scenarios:
  - AppConfig → valid Capacitor config JSON
  - Same input → same output (idempotent, deterministic)
  - Build status transitions: idle → building → ready
  - Build failure → status=failed, error logged
  - Invalid app config (missing required fields) → error thrown, status=failed

#### QA
- [ ] Worker processes build job → config.json generated
- [ ] Same app config → identical output (idempotent)
- [ ] Build status updated to `ready` on success
- [ ] Build status updated to `failed` on error
- [ ] Config contains all required fields (app_name, colors, menu)

---

## Execution Priority Order

```
P0 — Must fix before MVP launch (core pipeline broken)
  F3 (Tenant List)        → S, Phase 2
  F5 (Webhook Enqueue)    → S, Phase 5
  F2 (Delivery Tracking)  → S, Phase 4
  F1 (Data Ingestion)     → L, Phase 4
  F4 (OAuth Handlers)     → L, Phase 5

P1 — Important gaps in testing and features
  F10 (Retry-After)       → XS, Phase 1
  F12 (Seed Helpers)      → M, Phase 1
  F11 (Repo Integration)  → XL, Phase 1
  F6 (RLS Tests)          → L, Phase 1
  F8 (Segment Worker)     → M, Phase 3
  F9 (Membership Mgmt)    → L, Phase 2
  F7 (OneSignal Webhook)  → M, Phase 4
  F13 (Console API)       → XL, Phase 6

P2 — Polish and hardening
  F18 (Structured Logger) → S, Phase 2
  F19 (X-Request-Id)      → S, Phase 2
  F14 (Provider Move)     → S, Phase 5
  F15 (Contract Test)     → S, Phase 5
  F16 (R2 Upload)         → M, Phase 6
  F20 (Plan Change)       → M, Phase 5
  F17 (Playwright E2E)    → L, Phase 7
  F21 (Build Worker)      → L, Phase 6
```

---

## Size Estimates

| Size | Count | Stories |
|------|-------|---------|
| XS | 1 | F10 |
| S | 7 | F2, F3, F5, F14, F15, F18, F19 |
| M | 5 | F7, F8, F12, F16, F20 |
| L | 6 | F1, F4, F6, F9, F17, F21 |
| XL | 2 | F11, F13 |
| **Total** | **21** | |

Estimated effort: ~30-40 dev-days

---

*Generated by QA Cross-Reference Audit 2026-03-14*
