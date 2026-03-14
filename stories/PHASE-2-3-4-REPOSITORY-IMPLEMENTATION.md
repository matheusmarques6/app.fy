# Story: Implement All Drizzle Repository Methods (Phases 2-4)

> **Priority:** P0 — CRITICAL BLOCKER
> **Size:** XL (55 methods across 10 repositories)
> **Blocks:** Every CRUD operation, push dispatch, analytics, audit trail
> **Date:** 2026-03-14

---

## Context

All **services** (Layer 2) and **API handlers** (Layer 4) are complete. The entire application is wired end-to-end — middleware chain, DI factory, routes, error handling. But every repository method throws `"Not implemented"`. Nothing can persist to the database.

This story implements all 55 Drizzle query methods across 10 repositories, unlocking the full MVP.

---

## Current State

| Layer | Status |
|-------|--------|
| DB Schema (Drizzle tables) | ✅ 15 tables defined |
| Repositories (Drizzle queries) | ❌ 55 methods throw "Not implemented" |
| Services (business logic) | ✅ ~99% complete |
| API Handlers (HTTP layer) | ✅ ~97% complete |
| Tests (Layer 2 with spies) | ✅ 735 passing |

---

## Scope — 10 Repositories, 55 Methods

### Group A — Phase 2: Auth & Tenants (6 methods)

#### A1. TenantRepository (5 methods)
**File:** `packages/core/src/tenants/repository.ts`
**Schema:** `packages/db/src/schema/tenants.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 1 | `findById(tenantId, id?)` | `SELECT * FROM tenants WHERE id = tenantId` |
| 2 | `findBySlug(tenantId, slug)` | `SELECT * FROM tenants WHERE slug = ? AND id = tenantId` |
| 3 | `create(tenantId, input)` | `INSERT INTO tenants (name, slug, platform) VALUES (...) RETURNING *` |
| 4 | `update(tenantId, input)` | `UPDATE tenants SET ... WHERE id = tenantId RETURNING *` |
| 5 | `incrementNotificationCount(tenantId, amount)` | `UPDATE tenants SET notification_count_current_period = notification_count_current_period + amount WHERE id = tenantId` |

**Special:** `incrementNotificationCount` must be atomic (SQL `col = col + N`, not read-modify-write).

#### A2. MembershipRepository (1 method)
**File:** `packages/core/src/memberships/repository.ts`
**Schema:** `packages/db/src/schema/memberships.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 6 | `findByUserAndTenant(tenantId, userId)` | `SELECT * FROM memberships WHERE tenant_id = ? AND user_id = ?` |

---

### Group B — Phase 3: App Users & Devices (17 methods)

#### B1. AppUserRepository (9 methods)
**File:** `packages/core/src/app-users/repository.ts`
**Schema:** `packages/db/src/schema/app-users.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 7 | `findById(tenantId, id)` | `SELECT * FROM app_users WHERE tenant_id = ? AND id = ?` |
| 8 | `findByExternalId(tenantId, externalId)` | `SELECT * FROM app_users WHERE tenant_id = ? AND user_id_external = ?` |
| 9 | `create(tenantId, input)` | `INSERT INTO app_users (...) RETURNING *` |
| 10 | `update(tenantId, id, input)` | `UPDATE app_users SET ... WHERE tenant_id = ? AND id = ? RETURNING *` |
| 11 | `upsertByExternalId(tenantId, externalId, input)` | `INSERT ... ON CONFLICT (tenant_id, user_id_external) DO UPDATE RETURNING *` |
| 12 | `updatePushOptIn(tenantId, id, optIn)` | `UPDATE app_users SET push_opt_in = ? WHERE tenant_id = ? AND id = ?` |
| 13 | `list(tenantId, pagination)` | `SELECT * FROM app_users WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?` + COUNT |
| 14 | `delete(tenantId, id)` | `DELETE FROM app_users WHERE tenant_id = ? AND id = ?` |
| 15 | `count(tenantId)` | `SELECT COUNT(*) FROM app_users WHERE tenant_id = ?` |

#### B2. DeviceRepository (8 methods)
**File:** `packages/core/src/devices/repository.ts`
**Schema:** `packages/db/src/schema/devices.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 16 | `findById(tenantId, id)` | `SELECT * FROM devices WHERE tenant_id = ? AND id = ?` |
| 17 | `findActiveByUser(tenantId, appUserId)` | `SELECT * FROM devices WHERE tenant_id = ? AND app_user_id = ? AND is_active = true` |
| 18 | `findByTokenAndPlatform(tenantId, appUserId, platform)` | `SELECT * FROM devices WHERE tenant_id = ? AND app_user_id = ? AND platform = ?` |
| 19 | `register(tenantId, input)` | `INSERT INTO devices (...) RETURNING *` |
| 20 | `deactivate(tenantId, id)` | `UPDATE devices SET is_active = false WHERE tenant_id = ? AND id = ?` |
| 21 | `deactivateByUserAndPlatform(tenantId, appUserId, platform)` | `UPDATE devices SET is_active = false WHERE tenant_id = ? AND app_user_id = ? AND platform = ?` |
| 22 | `updateLastSeen(tenantId, id)` | `UPDATE devices SET last_seen_at = NOW() WHERE tenant_id = ? AND id = ?` |
| 23 | `countByUser(tenantId, appUserId)` | `SELECT COUNT(*) FROM devices WHERE tenant_id = ? AND app_user_id = ?` |

---

### Group C — Phase 3: Notifications & Automations (10 methods)

#### C1. NotificationRepository (6 methods)
**File:** `packages/core/src/notifications/repository.ts`
**Schema:** `packages/db/src/schema/notifications.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 24 | `create(tenantId, input)` | `INSERT INTO notifications (tenant_id, title, body, type, ...) RETURNING *` |
| 25 | `findById(tenantId, id)` | `SELECT * FROM notifications WHERE tenant_id = ? AND id = ?` |
| 26 | `list(tenantId, pagination, filters?)` | `SELECT + WHERE tenant_id + optional status/type filters + ORDER BY + LIMIT/OFFSET` + COUNT |
| 27 | `updateStatus(tenantId, id, status, sentAt?)` | `UPDATE notifications SET status = ?, sent_at = ? WHERE tenant_id = ? AND id = ? RETURNING *` |
| 28 | `delete(tenantId, id)` | `DELETE FROM notifications WHERE tenant_id = ? AND id = ?` |
| 29 | `count(tenantId, filters?)` | `SELECT COUNT(*) FROM notifications WHERE tenant_id = ? + filters` |

#### C2. AutomationRepository (4 methods)
**File:** `packages/core/src/automations/repository.ts`
**Schema:** `packages/db/src/schema/automation-configs.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 30 | `findByFlow(tenantId, flowType)` | `SELECT * FROM automation_configs WHERE tenant_id = ? AND flow_type = ?` |
| 31 | `listByTenant(tenantId)` | `SELECT * FROM automation_configs WHERE tenant_id = ? ORDER BY flow_type` |
| 32 | `update(tenantId, flowType, input)` | `UPDATE automation_configs SET ... WHERE tenant_id = ? AND flow_type = ? RETURNING *` |
| 33 | `toggleEnabled(tenantId, flowType, enabled)` | `UPDATE automation_configs SET is_enabled = ? WHERE tenant_id = ? AND flow_type = ?` |

---

### Group D — Phase 3: Segments & Events (16 methods)

#### D1. SegmentRepository (11 methods)
**File:** `packages/core/src/segments/repository.ts`
**Schema:** `packages/db/src/schema/segments.ts` + `app-user-segments.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 34 | `findById(tenantId, id)` | `SELECT * FROM segments WHERE tenant_id = ? AND id = ?` |
| 35 | `create(tenantId, input)` | `INSERT INTO segments (...) RETURNING *` |
| 36 | `update(tenantId, id, input)` | `UPDATE segments SET ... WHERE tenant_id = ? AND id = ? RETURNING *` |
| 37 | `delete(tenantId, id)` | `DELETE FROM segments WHERE tenant_id = ? AND id = ?` |
| 38 | `list(tenantId, pagination)` | `SELECT + COUNT + LIMIT/OFFSET` |
| 39 | `addMembers(tenantId, segmentId, userIds)` | `INSERT INTO app_user_segments (tenant_id, segment_id, app_user_id) VALUES ... ON CONFLICT DO NOTHING` |
| 40 | `removeMembers(tenantId, segmentId, userIds)` | `DELETE FROM app_user_segments WHERE tenant_id = ? AND segment_id = ? AND app_user_id IN (...)` |
| 41 | `getMembers(tenantId, segmentId, pagination)` | `SELECT app_users.* FROM app_user_segments JOIN app_users + LIMIT/OFFSET` |
| 42 | `getMemberIds(tenantId, segmentId)` | `SELECT app_user_id FROM app_user_segments WHERE tenant_id = ? AND segment_id = ?` |
| 43 | `removeExpiredMembers(tenantId, segmentId)` | `DELETE FROM app_user_segments WHERE tenant_id = ? AND segment_id = ? AND expires_at < NOW()` |
| 44 | `replaceMembers(tenantId, segmentId, userIds)` | DELETE all + INSERT new (transaction) |

#### D2. EventRepository (5 methods)
**File:** `packages/core/src/events/repository.ts`
**Schema:** `packages/db/src/schema/app-events.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 45 | `create(tenantId, input)` | `INSERT INTO app_events (...) RETURNING *` |
| 46 | `findById(tenantId, id)` | `SELECT * FROM app_events WHERE tenant_id = ? AND id = ?` |
| 47 | `findRecent(tenantId, appUserId, eventType, withinSeconds)` | `SELECT * FROM app_events WHERE tenant_id = ? AND app_user_id = ? AND event_type = ? AND created_at > NOW() - interval` |
| 48 | `list(tenantId, pagination, filters?)` | `SELECT + WHERE + filters + LIMIT/OFFSET` + COUNT |
| 49 | `count(tenantId, filters?)` | `SELECT COUNT(*) + WHERE + filters` |

---

### Group E — Phase 4: Push & Audit (6 methods)

#### E1. DeliveryRepository (4 methods — defined in push-dispatch.service.ts interface)
**Schema:** `packages/db/src/schema/notification-deliveries.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 50 | `create(tenantId, notificationId, deviceId, appUserId?)` | `INSERT INTO notification_deliveries (...) RETURNING *` |
| 51 | `createMany(tenantId, records[])` | Batch `INSERT INTO notification_deliveries VALUES ...` |
| 52 | `updateStatus(tenantId, id, status, timestamp?)` | `UPDATE notification_deliveries SET status = ?, {status}_at = ? WHERE tenant_id = ? AND id = ? AND status = {prev}` (optimistic locking) |
| 53 | `updateManyStatus(tenantId, ids[], status, timestamp?)` | Batch status update |

**Special:** `updateStatus` uses optimistic locking — `WHERE status = currentStatus` prevents double-processing.

#### E2. AuditLogRepository (3 methods)
**File:** `packages/core/src/audit/audit-log.repository.ts`
**Schema:** `packages/db/src/schema/audit-log.ts`

| # | Method | Drizzle Query |
|---|--------|---------------|
| 54 | `create(tenantId, input)` | `INSERT INTO audit_log (...) RETURNING *` |
| 55 | `list(tenantId, pagination)` | `SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?` + COUNT |
| 56 | `findById(tenantId, id)` | `SELECT * FROM audit_log WHERE tenant_id = ? AND id = ?` |

---

## Bonus — OneSignal Provider (4 HTTP methods)

**File:** `packages/core/src/push/onesignal.provider.ts`
**Not a repo, but critical for Phase 4.**

| # | Method | OneSignal API |
|---|--------|---------------|
| O1 | `createApp(config)` | `POST https://onesignal.com/api/v1/apps` |
| O2 | `sendNotification(appId, payload)` | `POST https://onesignal.com/api/v1/notifications` |
| O3 | `getDeliveryStatus(appId, notifId)` | `GET https://onesignal.com/api/v1/notifications/{id}?app_id={appId}` |
| O4 | `registerDevice(appId, token)` | `POST https://onesignal.com/api/v1/players` |

---

## Acceptance Criteria

### Per Repository Method:
- [ ] Drizzle query replaces `throw new Error('Not implemented')`
- [ ] Uses `this.assertTenantId(tenantId)` before every query
- [ ] WHERE clause always includes `tenant_id = ?`
- [ ] Returns correct type (matches existing Row interface)
- [ ] Handles not-found (returns `undefined` for findById, not throw)

### Integration Tests (Layer 3):
- [ ] Each repository has `*.integration.spec.ts` with real DB (testcontainers)
- [ ] CRUD round-trip: create → findById → update → delete
- [ ] Tenant isolation: tenant A cannot read tenant B data
- [ ] Pagination: correct offset/limit with total count
- [ ] Atomic operations: `incrementNotificationCount` is race-safe
- [ ] Optimistic locking: delivery status update returns 0 rows on conflict

### Global:
- [ ] All 735+ existing tests still pass
- [ ] `tsc --noEmit` — 0 errors (all 5 packages)
- [ ] No `any` types
- [ ] Every query uses parameterized values (no SQL injection)

---

## Execution Order

```
Group A (6 methods)  — TenantRepo + MembershipRepo
    ↓
Group B (17 methods) — AppUserRepo + DeviceRepo
    ↓
Group C (10 methods) — NotificationRepo + AutomationRepo
    ↓
Group D (16 methods) — SegmentRepo + EventRepo
    ↓
Group E (6 methods)  — DeliveryRepo + AuditLogRepo
    ↓
Bonus (4 methods)    — OneSignalProvider HTTP calls
```

Each group can be a separate PR. Groups A→B→C are the critical path.

---

## Files to Modify

**Repositories (implement queries):**
- `packages/core/src/tenants/repository.ts`
- `packages/core/src/memberships/repository.ts`
- `packages/core/src/app-users/repository.ts`
- `packages/core/src/devices/repository.ts`
- `packages/core/src/notifications/repository.ts`
- `packages/core/src/automations/repository.ts`
- `packages/core/src/segments/repository.ts`
- `packages/core/src/events/repository.ts`
- `packages/core/src/audit/audit-log.repository.ts`

**New file (DeliveryRepository):**
- `packages/core/src/notifications/delivery.repository.ts`

**Provider (HTTP calls):**
- `packages/core/src/push/onesignal.provider.ts`

**Factory (wire DeliveryRepo):**
- `packages/core/src/factory.ts`

**DB exports (if needed):**
- `packages/db/src/index.ts`

---

## Test Strategy

| Layer | What | Count |
|-------|------|-------|
| Existing Layer 2 (spies) | Already passing — no changes needed | 735 |
| New Layer 3 (integration) | Each repo method against real PG via testcontainers | ~55 |
| New Isolation | Cross-tenant queries return 0 rows | ~30 |
| OneSignal | MSW mock for HTTP calls | ~12 |

**Total new tests: ~97**

---

## Dependencies

- `drizzle-orm` must be added to `packages/core/package.json` (or queries go through `@appfy/db`)
- Docker must be running for integration tests (testcontainers)
- OneSignal API key needed for provider (use MSW mock in tests)

---

## NOT in Scope

- Stripe integration (Epic 11) — separate story
- Console UI — already done
- Workers — already wired
- RLS policies — separate story (2.2)
- CI/CD — separate story (16.x)
- LGPD — separate story (15.x)
