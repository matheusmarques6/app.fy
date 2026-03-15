# AppFy MVP — Findings Sprint Plan

> Generated: 2026-03-15 | Scrum Master: River
> Source: `Fend-backlog.md` (21 findings from QA Cross-Reference Audit)
> Total Effort: ~30-40 dev-days across 5 sprints

---

## Summary Table

| Sprint | Stories | Size | Effort | Goal |
|--------|---------|------|--------|------|
| 1 | F2, F3, F5 | S+S+S | 2-3 days | Unblock revenue pipeline + tenant functionality |
| 2 | F1, F4 | L+L | 5-7 days | Complete revenue engine + integrations |
| 3 | F7, F8, F9, F10 | M+M+L+XS | 5-7 days | Delivery tracking loop + team management |
| 4 | F12, F6, F11, F13 | M+L+XL+XL | 8-10 days | Multi-tenant security + console integration |
| 5 | F14-F21 | mixed | 8-12 days | Polish, observability, CI hardening |
| **Total** | **21 stories** | | **~30-40 days** | |

---

## Dependency Graph (ASCII)

```
Sprint 1 (P0 Quick Wins)              Sprint 2 (P0 Heavy Lifts)
  F3 (Tenant List) ──────────────────────────────────────────────┐
  F5 (Webhook Enqueue) ──→ F1 (Data Ingestion) ──→ F7 ──┐       │
  F2 (Delivery Tracking) ────────────────────────→ F7 ──┤       │
                             F4 (OAuth Handlers)        │       │
                                                        │       │
Sprint 3 (P1 Features)                                  │       │
  F7 (OneSignal Webhook) ◄──────────────────────────────┘       │
  F8 (Segment Worker)                                           │
  F9 (Membership Mgmt) ◄───────────────────────────────────────┘
  F10 (Rate Limit Header)

Sprint 4 (P1 Testing)                 Sprint 5 (P2 Polish)
  F12 (Seed Helpers) ──┬→ F6 (RLS)    F14 (Provider Move) → F15 (Contract)
                       └→ F11 (Repos)  F16 (R2 Upload)
  F13 (Console API)                    F17 (Playwright E2E)
                                       F18 (Logger) → F19 (Request-Id)
                                       F20 (Plan Change)
                                       F21 (Build Worker)
```

---

## Sprint 1 — P0 Quick Wins

**Goal:** Unblock the revenue pipeline and basic tenant functionality
**Estimated effort:** 2-3 dev-days
**Parallelism:** F2 + F5 can run in parallel (independent workers). F3 is standalone.

### Definition of Done
- All 3 stories merged to main with passing tests
- Push dispatch writes delivery status to DB
- Webhooks enqueue jobs to BullMQ
- Tenant list returns real membership data

---

### F2 — Push Dispatch Worker Delivery Tracking [S]

**What:** After successful OneSignal send, update delivery records from `pending` to `sent` with `sent_at` timestamp and store OneSignal `externalId` for webhook correlation.

**Key files:**
- `apps/workers/src/push/push-dispatch.worker.ts` (line 70 TODO)

**Acceptance test:** Send push successfully, query `notification_deliveries` — all batch records have `status='sent'`, `sent_at` set, `external_id` populated. OneSignal failure leaves records as `pending`.

---

### F5 — Platform Webhook BullMQ Enqueue [S]

**What:** Wire the already-built job payload (lines 159-168) to an actual `queue.add()` call in the webhook handler. Return 503 if enqueue fails.

**Key files:**
- `apps/api/src/domains/integrations/handlers.ts` (line 171)
- Wire `deps.queue` via `createDependencies()`

**Acceptance test:** Send valid Shopify webhook with correct HMAC, verify job appears in `data-ingestion` queue with correct payload shape. Redis down returns 503.

---

### F3 — Tenant List Handler [S]

**What:** Replace hardcoded `{ data: [] }` with a real query joining `memberships` + `tenants` for the authenticated user, sorted alphabetically.

**Key files:**
- `apps/api/src/domains/tenants/handlers.ts` (line 13)

**Acceptance test:** Authenticated user with 2 memberships gets `{ data: [{id, name, slug, platform, role}, ...] }`. User with 0 memberships gets `{ data: [] }`. No auth returns 401.

---

## Sprint 2 — P0 Heavy Lifts

**Goal:** Complete the revenue engine and platform integrations
**Estimated effort:** 5-7 dev-days
**Order:** F1 before F4 (ingestion worker processes the webhooks that OAuth enables)

### Definition of Done
- Data ingestion worker processes all 9 event types with correct flow routing
- Dedup via Redis works (5s TTL)
- OAuth connect + callback flows work for Shopify and Nuvemshop
- Credentials encrypted and stored, webhooks registered post-connect

---

### F1 — Data Ingestion Worker Implementation [L]

**What:** Implement the commented-out worker logic (lines 69-108): dedup via Redis hash + 5s TTL, persist to `app_events`, route to correct automation flow. Handle `app_opened` welcome (first-only) and `product_viewed` browse-abandoned (delayed check).

**Key files:**
- `apps/workers/src/ingestion/data-ingestion.worker.ts` (lines 69-108)

**Acceptance test:** Each of 9 event types triggers correct flow. Duplicate within 5s is skipped. First `app_opened` triggers welcome, second does not. Persist failure prevents automation trigger (atomicity).

**Dependencies:** Blocked by 10.1, 8.2 (from BACKLOG). Blocks F7.

---

### F4 — Shopify/Nuvemshop OAuth Handlers [L]

**What:** Implement `connect()` and `callback()` stubs: generate OAuth URL with CSRF state (stored in Redis 10min TTL), exchange code for token, encrypt via EncryptionService, store on tenant, register platform webhooks.

**Key files:**
- `apps/api/src/domains/integrations/handlers.ts` (connect ~line 47, callback ~line 62)
- SSRF validation via `packages/core/src/security/ssrf.ts`

**Acceptance test:** Connect returns valid OAuth URL with all params. Callback with valid code stores encrypted credentials. Invalid state returns 403. SSRF redirect to `127.0.0.1` blocked. After connect, `registerWebhooks()` called.

**Dependencies:** Blocked by 3.1, 3.2, 12.1, 12.2 (from BACKLOG).

---

## Sprint 3 — P1 User-Facing Features

**Goal:** Complete delivery tracking loop and team management
**Estimated effort:** 5-7 dev-days
**Parallelism:** F7 depends on F1+F2 (Sprint 1-2). F8, F9, F10 are independent of each other.

### Definition of Done
- OneSignal webhook updates delivery status in real-time
- Segment refresh worker processes membership changes
- Owners can invite, change roles, and remove members (with audit trail)
- 429 responses include Retry-After header

---

### F7 — OneSignal Webhook Endpoint [M]

**What:** New public endpoint `POST /api/webhooks/onesignal` that receives delivery status callbacks, verifies HMAC signature, matches by `external_id`, and transitions delivery status (delivered/opened/clicked).

**Key files:** New domain `apps/api/src/domains/webhooks/onesignal/` (routes.ts, handlers.ts, schemas.ts)

**Dependencies:** F2 (needs `external_id` stored), 9.2, 12.4

---

### F8 — Segment Refresh Worker [M]

**What:** New BullMQ worker at `apps/workers/src/segment/` that calls `SegmentRefreshService.refresh()` from core. Follows same factory pattern as push-dispatch worker. Batch processing in chunks of 1000 users.

**Key files:** New `apps/workers/src/segment/index.ts`, `processor.ts`

**Dependencies:** 6.4

---

### F9 — Membership Management Endpoints [L]

**What:** CRUD sub-routes under `/tenants/:id/members`: list (all roles), invite/role-change/remove (owner only). Business rules: cannot remove last owner, cannot change own role if only owner. All changes audited.

**Key files:** `apps/api/src/domains/tenants/routes.ts` (new sub-routes), `packages/core/src/tenants/membership.service.ts`

**Dependencies:** 4.2, 5.1. Depends on F3 (tenant list must work first).

---

### F10 — Rate Limit Retry-After Header [XS]

**What:** When rate limit is hit (429), calculate `windowEnd - now`, round up, set `Retry-After` header on response. Minimum value 1.

**Key files:** `apps/api/src/middleware/rate-limit.ts`

**Dependencies:** 3.3

---

## Sprint 4 — P1 Testing & Quality

**Goal:** Verify multi-tenant security and connect console to API
**Estimated effort:** 8-10 dev-days
**Order:** F12 MUST come before F6 and F11 (seed helpers needed for tests)

### Definition of Done
- Seed helpers cover all core tables with full dependency chains
- 60 isolation tests pass (10 tables x 6 operations)
- 55 repository integration tests pass against real PG
- Console fetches real data from API (no mock-data.ts)

---

### F12 — Seed Helpers Directory [M] — DO FIRST

**What:** Create `packages/test-utils/src/seeds/` with DB-inserting seed helpers: `seedTenant`, `seedAppUser`, `seedDevice`, `seedNotification`, `seedDelivery` (full chain), `seed10KDeliveries` (bulk). All use Drizzle, return created records.

**Key files:** New `packages/test-utils/src/seeds/*.ts`

**Dependencies:** 2.1, 2.4. **Blocks F6 and F11.**

---

### F6 — RLS/Isolation Tests Activation [L]

**What:** Expand isolation tests from 48 to 60 scenarios (10 tables x 6 operations). Testcontainers PG 16 with migrations. Each test uses `SET LOCAL request.jwt.claims` for tenant isolation.

**Key files:** `packages/test-utils/src/isolation/*.isolation.spec.ts`

**Dependencies:** 2.2, 2.4, F12

---

### F11 — Repository Integration Tests (Layer 3) [XL]

**What:** Integration tests for all 10 repositories (~55 methods) against real PG. Verify CRUD, constraints, FK cascades, and `EXPLAIN ANALYZE` confirms Index Scan on key queries.

**Key files:** `packages/test-utils/src/integration/repositories/*.integration.spec.ts`

**Dependencies:** 2.1, 2.3, 2.4, F12. Blocks F6.

---

### F13 — Console API Integration [XL]

**What:** Replace `mock-data.ts` with real API calls. Configure SWR hooks, Supabase Auth token injection, `X-Tenant-Id` header, error handling (toasts), loading states (skeletons), 401 redirect.

**Key files:** `apps/console/src/lib/api-client.ts`, `apps/console/src/lib/mock-data.ts` (remove)

**Dependencies:** 4.1, 5.1

---

## Sprint 5 — P2 Polish & Hardening

**Goal:** Code organization, observability, CI hardening
**Estimated effort:** 8-12 dev-days
**Parallelism:** Most stories are independent. F14 must precede F15. F18 must precede F19.

### Definition of Done
- OneSignal provider lives in correct package (integrations)
- Contract test validates PushProvider interface
- R2 presigned upload works for app icons/splash
- Structured JSON logging replaces console.error
- X-Request-Id correlates logs with requests
- Downgrade scheduling works via pending plan change
- Playwright E2E runs in CI G6
- Build worker generates Capacitor configs

---

### F14 — OneSignal Provider Relocation [S]
Move `onesignal.provider.ts` from `packages/core/src/push/` to `packages/integrations/src/onesignal/`. Update imports. No logic changes.

### F15 — OneSignal Contract Test [S]
`pushProviderContractTest()` with MSW. Depends on F14.

### F16 — R2 Presigned URL for App Config [M]
Presigned upload URL endpoint for icon/splash. `@aws-sdk/client-s3` with R2 endpoint. Max 5MB, 15min expiry.

### F17 — Playwright E2E in CI G6 [L]
Configure Playwright at repo root. E2E for login, dashboard, tenant switch. Runs against staging. Auto-rollback on failure.

### F18 — Structured Logger in Error Handler [S]
Replace `console.error` with pino-based structured logger. JSON in prod, pretty-print in dev. Logger injected via Hono context.

### F19 — X-Request-Id Header [S]
UUID v4 per request, propagate client header if present. Set on response. Include in all log entries. Must be first middleware. Depends on F18.

### F20 — Pending Plan Change for Downgrades [M]
Add `pending_plan_change` JSONB to tenants. Store on downgrade request, apply on next `invoice.payment_succeeded`, clear on upgrade.

### F21 — Build Worker for Capacitor [L]
New BullMQ worker at `apps/workers/src/build/`. Generates deterministic `config.json` per tenant. Tracks build status on `app_configs`. MVP: config only, no Fastlane.

---

## Gantt-Style Timeline

```
Week 1          Week 2          Week 3          Week 4          Week 5-6
|── Sprint 1 ──|── Sprint 2 ──|── Sprint 3 ──|── Sprint 4 ────|── Sprint 5 ──────|

F2 ████          F1 ████████    F7 ██████       F12 ████         F14 ██
F5 ████          F4 ████████    F8 ██████       F6  ████████     F15 ██
F3 ████                         F9 ████████     F11 ████████████ F16 ██████
                                F10 █                            F17 ████████
                                                F13 ████████████ F18 ██
                                                                 F19 ██
                                                                 F20 ██████
                                                                 F21 ████████
```

---

## Critical Path

```
F5 → F1 → F7 (webhook pipeline: enqueue → ingest → track delivery)
F2 → F7        (delivery tracking: store external_id → correlate webhook)
F12 → F6       (seed helpers → isolation tests)
F12 → F11      (seed helpers → repo integration tests)
F18 → F19      (structured logger → request-id correlation)
F14 → F15      (provider move → contract test)
```

The critical path for MVP launch runs through **F5 → F1 → F7** (the push revenue pipeline) and **F12 → F11/F6** (multi-tenant security validation). Sprint 1-2 unblock the revenue engine; Sprint 3-4 ensure it is secure and testable.

---

## Risk Notes

1. **F1 and F4 are the riskiest stories** — both L-sized with multiple external dependencies (Redis dedup, platform OAuth APIs). Allocate buffer in Sprint 2.
2. **F11 (XL) and F13 (XL) are the largest stories** — consider splitting F11 into 2 sub-stories (5 repos each) if Sprint 4 runs long.
3. **F13 (Console API)** has no backend dependency on other F-stories but requires all API endpoints to be functional. Best started late in Sprint 4 when API is stable.
4. **Sprint 5 is flexible** — all P2 stories are independent (except F14/F15 and F18/F19 pairs). Can be reordered based on team capacity.

---

*Generated by River, Scrum Master — removendo obstaculos*
