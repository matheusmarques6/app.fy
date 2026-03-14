# QA Scaffold Review: Steps 1-6

**Date:** 2026-03-13
**Reviewer:** Quinn (QA Agent)
**Scope:** Root config, packages/shared, packages/db, packages/core, packages/integrations, packages/test-utils, vitest.workspace.ts, docker-compose files
**Gate Decision:** PASS WITH CONCERNS

---

## Executive Summary

The scaffold is **well-structured and architecturally sound**. The monorepo layout, dependency graph, type system, and test infrastructure all align closely with the CLAUDE.md specification. The 9 notification flows, pipeline, templates, and multi-tenant repository pattern are all correctly scaffolded. There are **0 critical failures** but **13 concerns** (5 HIGH, 8 MEDIUM) that should be addressed before real implementation begins.

---

## 1. MONOREPO STRUCTURE & ROOT CONFIG

### PASS

| Item | Status | Notes |
|---|---|---|
| Package scope `@appfy/*` | PASS | All 5 packages use correct scope |
| pnpm-workspace.yaml | PASS | Includes `apps/*` and `packages/*` |
| turbo.json pipeline | PASS | `build` depends on `^build`; test, lint, db tasks correct |
| tsconfig.base.json | PASS | Strict mode with all strict flags, `ES2022`, `NodeNext`, `useUnknownInCatchVariables: true` |
| biome.json | PASS | Enabled formatter + linter, single-quote, trailing commas, 100 line width |
| Conditional exports | PASS | All packages use `"import": "./src/index.ts"` + `"default": "./dist/index.js"` |
| .env.example | PASS | All required env vars present per spec |

### CONCERNS

- **C1 (MEDIUM):** `package.json` declares `"packageManager": "pnpm@10.32.1"` but CLAUDE.md spec says `pnpm 9`. The `engines` field says `"pnpm": ">=9"` which is compatible, but the lockfile is pnpm 10. This may cause issues if CI pins pnpm 9. Verify CI uses the same pnpm version.

---

## 2. PACKAGES/SHARED

### PASS

| Item | Status | Notes |
|---|---|---|
| Flow types (9) | PASS | All 9 flow types match spec exactly |
| Event types (6) | PASS | app_opened, product_viewed, add_to_cart, purchase_completed, push_opened, push_clicked |
| Delivery statuses (7) | PASS | pending, sent, delivered, opened, clicked, converted, failed |
| Notification statuses (6) | PASS | draft, approved, scheduled, sending, sent, failed |
| Plan configs | PASS | starter=15 manual, business/elite=null (unlimited), all `unlimitedAutomated: true` |
| Role permissions | PASS | viewer=read-only, editor=read+write, owner=total. Matches RBAC matrix |
| Prices | PASS | R$127/R$197/R$297 in cents |
| Types: JwtPayload, AuthSession, DeviceJwtPayload | PASS | Include `tenantId`, `role` per spec |
| TenantSwitchRequest/Response | PASS | Matches switch-tenant flow |
| Utils: formatCentsToBrl, slugify, truncate, date utils | PASS | Correct implementations |
| ZERO logic in shared | PASS | Only types, constants, pure utilities |
| Tests (4 spec files) | PASS | plans, roles, format, date -- all properly structured |

### CONCERNS

- **C2 (LOW):** `shared` has no `tsconfig.build.json` visible via glob but the directory listing confirms it exists. No issue.

---

## 3. PACKAGES/DB (Drizzle Schema)

### PASS

| Item | Status | Notes |
|---|---|---|
| 14 tables exist | PASS | tenants, users, memberships, plans, app_users, devices, app_user_segments, app_events, notifications, notification_deliveries, automation_configs, audit_log, app_user_products, app_configs |
| `tenant_id` on multi-tenant tables | PASS | Present on: app_users, devices, app_user_segments, app_events, notifications, notification_deliveries, automation_configs, audit_log, app_user_products, app_configs |
| `tenants.slug` UNIQUE | PASS | `.unique()` applied |
| `automation_configs` UNIQUE(tenant_id, flow_type) | PASS | Composite unique constraint defined |
| `app_configs.tenantId` UNIQUE | PASS | One config per tenant |
| Foreign keys | PASS | All properly defined (devices->app_users, memberships->users+tenants, etc.) |
| Composite index on notification_deliveries | PASS | `(tenant_id, status, created_at)` -- matches spec |
| Composite index on app_events | PASS | `(tenant_id, event_type, created_at)` -- matches spec |
| Encrypted credentials as JSONB | PASS | `platformCredentials`, `klaviyoCredentials`, `onesignalApiKeyEncrypted` all JSONB |
| Delivery status timestamps | PASS | sentAt, deliveredAt, openedAt, clickedAt, convertedAt |
| Drizzle config in packages/db | PASS | `drizzle.config.ts` with correct migration path |
| DB client + test client | PASS | createDrizzleClient, createTestClient present |
| Seed helpers | PASS | seedTenant, seedUser, seedAppUser, seedDevice, truncateAll |

### CONCERNS

- **C3 (HIGH): `automationConfigs.flowType` is `text()` instead of using `flowTypeEnum`.** The notifications table correctly uses `flowTypeEnum` for its `flow_type` column, but `automation_configs` uses raw `text('flow_type')`. This means invalid flow types can be inserted. Should be `flowTypeEnum('flow_type').notNull()` for database-level enforcement.

- **C4 (HIGH): DB test client has wrong default credentials.** `packages/db/src/test-client.ts` defaults to `postgresql://postgres:postgres@localhost:5433/appfy_test` but `docker-compose.test.yml` uses user `test` / password `test`. The `.env.test` file has the correct URL (`test:test`), but if someone runs without `.env.test` the fallback will fail to connect.

- **C5 (MEDIUM): Missing `seedNotification` and `seedDelivery` seed helpers.** The CLAUDE.md TDD spec requires `seedNotification()` and `seedDelivery()` helpers, plus `seed10KDeliveries()` for performance tests. Only seedTenant, seedUser, seedAppUser, and seedDevice are implemented.

- **C6 (MEDIUM): `users.id` is `uuid().primaryKey()` without `.defaultRandom()`.** This is intentional (Supabase Auth provides the ID), but differs from all other tables which use `.defaultRandom()`. Should be documented with a comment since it could trip up seed helpers that expect auto-generated IDs.

---

## 4. PACKAGES/CORE

### PASS

| Item | Status | Notes |
|---|---|---|
| All 9 flows defined | PASS | cart_abandoned, pix_recovery, boleto_recovery, welcome, checkout_abandoned, order_confirmed, tracking_created, browse_abandoned, upsell |
| Flow delays match spec | PASS | cart=1h, pix=30m, boleto=1h, welcome=5m, checkout=1h, order=60s, tracking=60s, browse=2h, upsell=3d |
| All 9 templates defined | PASS | One per flow with variables and Portuguese content |
| Pipeline: 5 steps in order | PASS | generate -> validate -> schedule -> send -> track |
| Pipeline immutability | PASS | `readonly` array with `as const` |
| executePipeline error handling | PASS | Returns failed result on throw |
| BaseRepository with assertTenantId | PASS | Validates non-empty, non-whitespace tenantId |
| MissingTenantIdError | PASS | Custom error with code `MISSING_TENANT_ID` |
| All repositories extend BaseRepository | PASS | Notification, Tenant, Device, AppUser, Automation, Analytics -- all extend correctly |
| All repos call assertTenantId | PASS | Every method starts with `this.assertTenantId(tenantId)` |
| DomainError hierarchy | PASS | 10 domain errors with unique codes |
| NotificationService status transitions | PASS | Correct state machine: draft->approved->scheduled/sending->sent/failed |
| EncryptionService validates 32-char secret | PASS | Throws on short secret |
| EncryptedCredential interface { ct, iv, tag, alg } | PASS | Matches JSONB spec |
| PushProvider interface | PASS | createApp, sendNotification, getDeliveryStatus, registerDevice |
| OneSignalProvider implements PushProvider | PASS | Correctly stubbed |
| BillingService + StripeProvider | PASS | Checkout, webhook, subscription stubs |
| Queue configs (3 queues) | PASS | push-dispatch, data-ingestion, analytics with exponential backoff x3 |
| Pagination utilities | PASS | normalizePagination, paginationOffset, buildPaginatedResponse |
| Factory DI pattern | CONCERNS | See below |

### CONCERNS

- **C7 (HIGH): Missing `createDependencies()` factory function.** The CLAUDE.md spec explicitly defines the Factory DI pattern: `createDependencies(overrides?: Partial<Dependencies>)` for production and testing. This function does not exist anywhere in the scaffold. Services are constructed manually. This is the core DI mechanism for the entire project and needs to be added.

- **C8 (MEDIUM): Pipeline steps are stubs that don't enforce the spec's pipeline rule.** The spec says "NEVER skip a step" and the pipeline must go: Generation -> Validation -> Approval -> Scheduling -> Sending -> Tracking -> Feedback. The implemented pipeline has 5 steps (generate, validate, schedule, send, track) but is **missing "Approval" and "Feedback" steps**. The spec lists 7 stages: `Generation -> Validation -> Approval -> Scheduling -> Sending -> Tracking -> Feedback`. This is a semantic gap.

- **C9 (MEDIUM): No `DeliveryRepository` in core.** While there's a `DeliveryRepositorySpy` in test-utils and the `notification_deliveries` schema in db, there's no actual `DeliveryRepository` class in `packages/core`. The spec's isolation matrix includes `notification_deliveries` as a first-class entity needing CRUD operations.

---

## 5. PACKAGES/INTEGRATIONS

### PASS

| Item | Status | Notes |
|---|---|---|
| PlatformAdapter interface | PASS | getProducts, getOrders, getAbandonedCarts, getCustomer, registerWebhooks |
| ShopifyAdapter implements PlatformAdapter | PASS | Domain validation with SSRF whitelist |
| NuvemshopAdapter implements PlatformAdapter | PASS | Supports both `.nuvemshop.com` and `.lojavirtualnuvem.com.br` |
| Klaviyo is separate (NOT PlatformAdapter) | PASS | KlaviyoAdapter is its own interface -- read-only |
| Klaviyo is read-only | PASS | Only getProfiles, getMetrics, getSegments -- no write methods |
| Domain validation (SSRF) | PASS | `SHOPIFY_DOMAIN_PATTERN` and `NUVEMSHOP_DOMAIN_PATTERN` enforce `*.myshopify.com` / `*.nuvemshop.com` |
| Contract test | PASS | `platformAdapterContractTest()` factory verifies both adapters |
| Webhook verification stubs | PASS | `verifyShopifyWebhook`, `verifyNuvemshopWebhook` with HMAC placeholders |
| Webhook topics | PASS | Comprehensive list for both platforms |
| Normalized types | PASS | Product, Order, AbandonedCart, Customer, LineItem -- platform-agnostic |
| OAuth scopes | PASS | `SHOPIFY_REQUIRED_SCOPES = ['read_products', 'read_orders', 'read_customers']` |

### CONCERNS

- **C10 (MEDIUM): SSRF domain patterns may be too strict.** The patterns `^[\w-]+\.myshopify\.com$` and `^[\w-]+\.(nuvemshop\.com|lojavirtualnuvem\.com\.br)$` reject subdomains with dots (e.g., `my.store.myshopify.com`). While Shopify standard domains don't use dots, this should be documented as intentional.

---

## 6. PACKAGES/TEST-UTILS

### PASS

| Item | Status | Notes |
|---|---|---|
| All required builders present | PASS | Tenant, User, Membership, Notification, Device, AppUser, AppEvent, Delivery, AutomationConfig (9 builders) |
| Fluent API with sensible defaults | PASS | All builders use `.withX()` chainable methods |
| Random UUIDs for IDs | PASS | `crypto.randomUUID()` by default |
| TenantId validation in builders | PASS | Most builders throw if tenantId not set |
| All required spies present | PASS | NotificationRepository, PushProvider, BullMQ, Cache, Device, Tenant, AutomationConfig, Membership, Delivery, AppEvent, AuditLog (11 spies) |
| SpyBase with callCount/lastCallArgs/wasCalled/reset | PASS | Clean tracking abstraction |
| PushProviderSpy implements PushProvider | PASS | Configurable results + shouldFail flag |
| BullMQSpy captures jobs with opts.delay | PASS | getJobs(), getJobsByName() |
| Auth helpers (JWT) | PASS | createTestJwt, createTenantJwt, createExpiredJwt using jose |
| RequestBuilder for Hono | PASS | Fluent API with withAuth, withTenant, withBody, sendJson |
| RLS assertion templates | PASS | 6 standard scenarios per table templated |
| Architecture test: repos extend BaseRepository | PASS | File-system scan verifying convention |
| Isolation test templates | PASS | .todo() placeholders for all entities |
| RLS policy test templates | PASS | .todo() for 7 tables x 6 scenarios |

### CONCERNS

- **C11 (HIGH): DeliveryBuilder schema mismatch with DB.** The `DeliveryRow` interface in the builder has `failedAt: Date | null` and `failureReason: string | null`, but the DB schema (`notification_deliveries`) has `errorMessage: text('error_message')` and **no `failedAt` or `failureReason` column**. The builder produces data that does not match the database schema. This will cause integration test failures.

- **C12 (HIGH): Test database URL env var inconsistency.** `setup-db.ts` expects `TEST_DATABASE_URL`, `.env.test` sets `DATABASE_URL`, and `test-client.ts` reads `TEST_DATABASE_URL`. The `.env.test` file does NOT set `TEST_DATABASE_URL` -- it sets `DATABASE_URL`. This means `setupTestDatabase()` will throw "TEST_DATABASE_URL is required" even when `.env.test` is loaded. Either `.env.test` should set `TEST_DATABASE_URL` or `setup-db.ts` should fall back to `DATABASE_URL`.

---

## 7. VITEST CONFIGURATION

### PASS

| Item | Status | Notes |
|---|---|---|
| 3 test projects (unit, integration, isolation) | PASS | Correct include/exclude patterns |
| File naming convention (*.spec.ts) | PASS | Unit excludes integration/isolation/e2e |
| Integration includes e2e | PASS | `*.integration.spec.ts` + `*.e2e.spec.ts` |
| Setup files for integration/isolation | PASS | Both use `setup-db.ts` |

### CONCERNS

- **C13 (MEDIUM): Missing pool strategy configuration.** The spec requires `unit: pool='threads'` (parallel), `integration: pool='forks', singleFork=true` (sequential), `isolation: pool='forks', singleFork=true`. The `vitest.workspace.ts` defines NO pool configuration for any project. This means all three will use the default pool (threads), which will cause database contention in integration/isolation tests. Must add `pool: 'forks'` and `singleFork: true` to integration and isolation projects.

- **C14 (MEDIUM): Missing coverage thresholds.** The spec requires `{ lines: 80, branches: 80, functions: 80 }` with `provider: 'v8'`. No coverage configuration exists in `vitest.workspace.ts`.

---

## 8. DOCKER COMPOSE

### PASS

| Item | Status | Notes |
|---|---|---|
| docker-compose.yml: PostgreSQL 16 Alpine | PASS | Port 5432, healthcheck |
| docker-compose.yml: Redis 7 Alpine | PASS | Port 6379, healthcheck |
| docker-compose.test.yml: PG on 5433 | PASS | tmpfs, fsync=off, synchronous_commit=off |
| docker-compose.test.yml: Redis on 6380 | PASS | No persistence (save "", appendonly no) |

### CONCERNS

- **C15 (MEDIUM): Missing MinIO in docker-compose.yml.** The CLAUDE.md spec says `docker-compose up` should include "PostgreSQL 16, Redis 7, MinIO". MinIO is not in `docker-compose.yml`. The TDD spec also lists `minio-test` and `stripe-mock` in `docker-compose.test.yml`, neither of which are present. Since these are for storage (R2) and billing testing, they are needed before those features are implemented.

---

## 9. EXISTING TESTS

### PASS

| Item | Status | Notes |
|---|---|---|
| All tests use `*.spec.ts` naming | PASS | No `*.test.ts` files |
| Tests use `describe/it/expect` from vitest | PASS | Correct imports |
| Contract tests use factory pattern | PASS | `platformAdapterContractTest()` |
| Base repository test uses concrete subclass | PASS | `TestRepository extends BaseRepository` |
| Pipeline integrity test verifies step count and order | PASS | Asserts 5 steps by name |

### CONCERNS

- **C16 (MEDIUM): Existing tests are shallow (structure checks only).** The 8 spec files (4 in shared, 3 in core, 1 in integrations) mostly verify "is defined" and "has expected methods". Only `base.repository.spec.ts` actually tests behavior (tenantId validation). The notification service and repository specs don't test any behavior -- they only check that classes and methods exist. This is acceptable for scaffold phase but should not be mistaken for actual test coverage.

- **C17 (MEDIUM): No `makeSut()` pattern in tests.** The TDD spec mandates `makeSut()` + AAA in every test. None of the current specs use `makeSut()`. The `base.repository.spec.ts` comes closest (creates `TestRepository` in each test) but doesn't use the `makeSut()` naming convention.

---

## 10. CROSS-CUTTING

### PASS

| Item | Status | Notes |
|---|---|---|
| No secrets committed | PASS | `.env.example` uses placeholders, `.env.test` has only test credentials |
| No `any` types in production code | PASS | Only in test code and setup-db with biome-ignore comments |
| biome.json configured | PASS | Linter + formatter enabled |
| turbo.json pipeline correct | PASS | Build dependencies, cache config, all tasks |
| Dependency graph correct | PASS | shared -> db -> core -> integrations -> test-utils |
| `type: "module"` on all packages | PASS | ESM throughout |
| TypeScript strict mode | PASS | All strict flags enabled in tsconfig.base |

---

## SUMMARY OF FINDINGS

### By Severity

| Severity | Count | Items |
|---|---|---|
| HIGH | 5 | C3 (automationConfigs flowType), C4 (test DB credentials), C7 (missing createDependencies), C11 (DeliveryBuilder mismatch), C12 (env var inconsistency) |
| MEDIUM | 8 | C5 (missing seed helpers), C6 (users.id doc), C8 (pipeline missing steps), C9 (no DeliveryRepository), C13 (pool strategy), C14 (coverage thresholds), C15 (missing MinIO), C16 (shallow tests) |
| LOW | 2 | C1 (pnpm version), C10 (SSRF strictness), C17 (no makeSut) |

### Fix Priority (recommended order)

1. **C11** - DeliveryBuilder schema mismatch (will cause immediate test failures)
2. **C12** - Test database URL env var inconsistency (blocks integration test setup)
3. **C4** - Test client default credentials mismatch (blocks fallback connection)
4. **C3** - automationConfigs.flowType should use enum (data integrity risk)
5. **C13** - Add pool strategy to vitest workspace (blocks parallel vs sequential test isolation)
6. **C14** - Add coverage thresholds to vitest workspace
7. **C7** - Create `createDependencies()` factory (needed before service implementation)
8. **C9** - Create DeliveryRepository in core
9. **C5** - Add seedNotification/seedDelivery/seed10KDeliveries
10. **C8** - Document pipeline step decision (5 vs 7 stages)
11. **C15** - Add MinIO + stripe-mock to docker-compose files

---

## GATE DECISION

**PASS WITH CONCERNS**

The scaffold demonstrates strong alignment with the project specification. All 14 database tables, 9 notification flows, 9 templates, the pipeline, the multi-tenant repository pattern, the adapter contracts, and the test infrastructure are correctly structured. The 5 HIGH concerns are all fixable within a single dev session and should be resolved before real feature implementation begins on any module that touches deliveries, automation configs, or integration tests.

The scaffold is approved to proceed to Step 7 (apps/api) provided the HIGH items are resolved first.

---

-- Quinn, guardiao da qualidade
