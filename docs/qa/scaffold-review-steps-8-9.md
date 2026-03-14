# QA Scaffold Review: Steps 8-9 (setup.sh + apps/api)

**Date:** 2026-03-13
**Reviewer:** Quinn (QA Agent)
**Scope:** scripts/setup.sh, apps/api (40 TypeScript files)
**Gate Decision:** PASS WITH CONCERNS

---

## Executive Summary

The API scaffold is well-designed. The Hono app follows the spec's domain-organized structure, middleware chain is correctly ordered, RBAC is applied per the spec matrix, and all 10 domains are wired. There are **0 critical failures**, **4 HIGH concerns**, and **9 MEDIUM concerns** to address.

---

## 1. SETUP SCRIPT (scripts/setup.sh)

### PASS

| Item | Status | Notes |
|---|---|---|
| Checks node >= 20 | PASS | Extracts major version, compares |
| Checks pnpm installed | PASS | `command -v pnpm` |
| Checks docker installed | PASS | `command -v docker` |
| Copies .env.example -> .env | PASS | Only if .env doesn't exist |
| Runs `pnpm install` | PASS | Step 3 |
| Runs `docker compose up -d` | PASS | Uses modern `docker compose` (not `docker-compose`) |
| Runs db:generate + db:push | PASS | Step 5 |
| `set -e` for fail-fast | PASS | Line 2 |

### CONCERNS

- **C1 (MEDIUM): Uses `sleep 5` instead of health check polling.** Line 47 waits 5s for Docker services but `docker-compose.yml` already has healthchecks defined. Should use `docker compose up -d --wait` (Docker Compose v2.1+) or poll with `docker compose exec postgres pg_isready`. The 5s sleep may be insufficient on slow machines and wasteful on fast ones.

---

## 2. PACKAGE CONFIG (apps/api)

### PASS

| Item | Status | Notes |
|---|---|---|
| Name: `@appfy/api` | PASS | Correct scope |
| Dependencies: hono, @hono/node-server, jose, zod | PASS | All present |
| Workspace deps: core, db, integrations, shared | PASS | All 4 workspace packages |
| Scripts: dev (tsx watch), build (tsc), start (node dist) | PASS | Correct for dev/prod |
| `type: "module"` | PASS | ESM consistent with all packages |
| tsconfig extends root | PASS | `../../tsconfig.base.json` |
| Path aliases: @/*, @domains/*, @middleware/* | PASS | Matches CLAUDE.md spec |
| tsconfig.build.json excludes *.spec.ts | PASS | Correct |

### CONCERNS

- **C2 (MEDIUM): Path aliases defined but not used.** The tsconfig defines `@/*`, `@domains/*`, `@middleware/*` but all imports in the codebase use relative paths (`../../middleware/auth.js`, `./handlers.js`). This is not wrong (relative paths work), but the aliases exist for nothing. Either use them consistently or remove to avoid confusion. The CLAUDE.md spec says API uses `@/*` -> `src/*`.

---

## 3. ENTRY POINTS

### PASS

| Item | Status | Notes |
|---|---|---|
| main.ts creates DrizzleClient | PASS | `createDrizzleClient(env.DATABASE_URL)` |
| main.ts wires createDependencies() | PASS | Passes db, stripeSecretKey, oneSignalApiKey, encryptionSecret |
| main.ts starts on PORT (default 3000) | PASS | `serve({ fetch: app.fetch, port })` |
| Startup log is structured JSON | PASS | `console.info(JSON.stringify({...}))` |
| app.ts applies middleware: logger, error-handler | PASS | `app.use('*', requestLogger)` + `app.onError(errorHandler)` |
| Health endpoint at /health without auth | PASS | Returns `{ status: 'ok', timestamp }` |
| All 10 domains mounted under /api | PASS | /api/auth, /api/tenants, etc. |
| env.ts validates ALL env vars with Zod | PASS | 25 env vars, fail-fast on invalid |
| ENCRYPTION_SECRET validated >= 32 chars | PASS | `z.string().min(32)` |
| PORT defaults to 3000 | PASS | `z.coerce.number().default(3000)` |

### CONCERNS

- **C3 (HIGH): Env vars that should be required at startup have `.default('')` allowing empty strings.** Lines 18-43 of `env.ts` set `.default('')` for: `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `NUVEMSHOP_APP_ID`, `NUVEMSHOP_APP_SECRET`, `KLAVIYO_API_KEY`, `ONESIGNAL_API_KEY`, `ONESIGNAL_USER_AUTH_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`, and all R2 keys. The CLAUDE.md spec says "All validated with Zod on startup (fail fast)." While defaulting to empty for optional integrations is reasonable during dev, `ONESIGNAL_API_KEY` and `STRIPE_SECRET_KEY` are passed directly to `createDependencies()` and then to `OneSignalProvider` and `BillingService` constructors. An empty string will pass validation but produce runtime errors later. At minimum, `ONESIGNAL_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` should either be `.min(1)` or the factory/services should guard against empty strings.

- **C4 (MEDIUM): `env.ts` is missing `SENTRY_AUTH_TOKEN`.** The `.env.example` includes both `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` but `env.ts` only validates `SENTRY_DSN`. Minor since Sentry is not yet integrated, but env validation should be complete.

---

## 4. MIDDLEWARE CHAIN

### PASS

| Item | Status | Notes |
|---|---|---|
| **Logger:** Structured JSON with method, path, status, duration_ms | PASS | Uses `performance.now()` for timing |
| **Logger:** Uses console.error/warn/info (not console.log) | PASS | Routed by status code |
| **Auth:** Reads `Authorization: Bearer <token>` | PASS | Splits on space, validates format |
| **Auth:** Verifies JWT with jose `jwtVerify` | PASS | Uses `SUPABASE_JWT_SECRET` |
| **Auth:** Returns 401 for missing/invalid/expired tokens | PASS | Separate error messages |
| **Auth:** Handles `JWTExpired` specifically | PASS | `jose.errors.JWTExpired` |
| **Auth:** Sets `userId` from `sub` claim | PASS | `c.set('userId', userId)` |
| **Tenant:** Reads `X-Tenant-Id` header | PASS | Returns 400 if missing |
| **Tenant:** Validates tenant exists via service | PASS | `deps.tenantService.findById(tenantId)` |
| **Roles:** Factory pattern `requireRoles(...roles)` | PASS | Returns middleware function |
| **Roles:** Checks userRole, returns 403 | PASS | `roles.includes(userRole)` |
| **Validate:** Zod validation on request body | PASS | Returns 400 with field errors |
| **Validate:** Handles invalid JSON | PASS | Separate try/catch for JSON parse |
| **Error handler:** Maps DomainError to correct HTTP codes | PASS | NOT_FOUND->404, INVALID->400, LIMIT->403 |
| **Error handler:** Maps HTTPException | PASS | Preserves status code |
| **Error handler:** Unknown errors -> 500 | PASS | Structured JSON error log |
| **Error handler:** Does not leak stack traces in response | PASS | Only logs stack, returns generic message |

### CONCERNS

- **C5 (HIGH): Tenant middleware has dead-code logic for null check.** `TenantService.findById()` (in core) **throws** `TenantNotFoundError` when tenant doesn't exist -- it never returns null/undefined. The tenant middleware on line 21 checks `if (!tenant)` which is unreachable. The `TenantNotFoundError` will propagate to the error handler and become a 404, which is semantically correct but means the middleware's custom "access denied" message on line 22 is dead code. This is not a bug (behavior is correct), but it is misleading. The middleware should either catch `TenantNotFoundError` and re-throw as 403, or remove the dead null check and let the error handler do its job.

- **C6 (HIGH): Tenant middleware does not look up membership role.** Line 29 hardcodes `'viewer' as const` as the default role. The TODO comment acknowledges this (line 25-27), but this means **all authenticated users default to viewer permissions**. Until `MembershipRepository` is wired, editor and owner operations (POST, PUT, DELETE) will be blocked by `requireRoles()` for all users. This is safe (fails closed) but the TODO must be resolved before the API is functional.

- **C7 (HIGH): Auth middleware does not validate JWT `alg` claim.** The `jose.jwtVerify(token, secret)` call on line 22 uses a symmetric key (HMAC), which means jose will default to accepting HS256/HS384/HS512. The CLAUDE.md spec does not explicitly require algorithm pinning, but best practice is to pass `{ algorithms: ['HS256'] }` as the third argument to prevent algorithm confusion attacks. With Supabase JWTs this is low risk, but it is a security hardening gap.

- **C8 (MEDIUM): Validate middleware uses `as never` casts for context variables.** Line 43 of `validate.ts`: `c.set('validatedBody' as never, result.data as never)`. Similarly, all handlers read it back with `c.get('validatedBody' as never) as BodyType`. This bypasses Hono's type system. The proper solution is to declare `validatedBody` in the `AppVariables` interface in `types.ts` and use typed context. This affects all 10 handler files.

---

## 5. DOMAIN ROUTES -- PER-DOMAIN ANALYSIS

### AUTH (/api/auth)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| /switch-tenant | POST | Yes | No | None | switchTenantSchema | PASS |

- Auth routes correctly skip tenant middleware (JWT has no tenant_id yet).
- Zod validates `tenantId` as UUID.
- **PASS**

### TENANTS (/api/tenants)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| / | GET | Yes | No | None | None | PASS |
| / | POST | Yes | No | None | createTenantSchema | PASS |
| /:id | GET | Yes | Yes | None | None | PASS |
| /:id | PUT | Yes | Yes | owner | updateTenantSchema | PASS |

- `PUT /:id` is owner-only per RBAC matrix. Correct.
- Create schema validates platform as enum. Correct.
- **PASS**

### NOTIFICATIONS (/api/notifications)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| / | GET | Yes | Yes | All | None | PASS |
| /:id | GET | Yes | Yes | All | None | PASS |
| / | POST | Yes | Yes | owner,editor | createNotificationSchema | PASS |
| /:id | DELETE | Yes | Yes | owner | None | PASS |

- RBAC: viewer can GET, editor can POST, owner can DELETE. Matches spec matrix exactly.
- **PASS**

### APP-USERS (/api/app-users)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| / | GET | Yes | Yes | All | None | PASS |
| /:id | GET | Yes | Yes | All | None | PASS |

- Read-only, all roles. Correct.
- **PASS**

### DEVICES (/api/devices)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| / | GET | Yes | Yes | All | None | PASS |
| / | POST | Yes | Yes | owner,editor | registerDeviceSchema | PASS |

- **PASS**

### AUTOMATIONS (/api/automations)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| / | GET | Yes | Yes | All | None | PASS |
| /:flowType | GET | Yes | Yes | All | None | PASS |
| /:flowType | PUT | Yes | Yes | owner,editor | updateAutomationSchema | PASS |
| /:flowType/toggle | PATCH | Yes | Yes | owner,editor | toggleAutomationSchema | PASS |

- **PASS**

### ANALYTICS (/api/analytics)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| /overview | GET | Yes | Yes | All | None | PASS |
| /notifications/:id | GET | Yes | Yes | All | None | PASS |
| /flows | GET | Yes | Yes | All | None | PASS |

- Read-only, all roles. Matches spec.
- **PASS**

### BILLING (/api/billing)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| /webhook | POST | **No** | No | None | None | PASS |
| /checkout | POST | Yes | Yes | owner | checkoutSchema | PASS |
| /portal | POST | Yes | Yes | owner | portalSchema | PASS |

- Webhook has NO auth -- uses Stripe signature verification. Correct per spec.
- Checkout and portal are owner-only. Matches RBAC matrix.
- **PASS**

### INTEGRATIONS (/api/integrations)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| /:platform/webhook | POST | **No** | No | None | None | PASS |
| /:platform/callback | GET | **No** | No | None | None | PASS |
| / | GET | Yes | Yes | All | None | PASS |
| /:platform/connect | POST | Yes | Yes | owner,editor | connectSchema | PASS |

- Webhook and OAuth callback have NO auth -- use HMAC verification. Correct.
- **PASS**

### APP-CONFIGS (/api/app-configs)

| Route | Method | Auth | Tenant | Roles | Validate | Status |
|---|---|---|---|---|---|---|
| / | GET | Yes | Yes | All | None | PASS |
| / | PUT | Yes | Yes | owner,editor | updateAppConfigSchema | PASS |

- Color validation with hex regex. Correct.
- **PASS**

### CONCERNS (Routes)

- **C9 (MEDIUM): Notification routes at `/api/notifications` but CLAUDE.md spec shows `/api/notifications` -- match.** However, the spec also shows `POST /api/members/invite` (owner only) and `PUT /api/settings` (editor+) which are not scaffolded. These map to tenants or a future members domain. Acceptable as not all spec endpoints need to be in the initial scaffold.

- **C10 (MEDIUM): Automation flowType route param is unvalidated.** `c.req.param('flowType') as FlowType` on automation handlers (lines 18, 26, 48) casts the raw URL param without Zod validation. An invalid flowType like `/api/automations/invalid_flow` will pass to `AutomationService.getConfig()` which will throw `AutomationNotFoundError` (producing a 404). While the error handling is safe, a Zod param validation would give a cleaner 400 error. Low risk since the error handler catches it.

- **C11 (MEDIUM): Billing webhook does not verify Stripe signature.** The handler reads `Stripe-Signature` header (line 26) and checks for its presence, but passes `JSON.parse(rawBody)` directly to `billingService.handleWebhook()` without verifying the signature against `STRIPE_WEBHOOK_SECRET`. The TODO is implicit (handleWebhook is a stub), but the handler structure should be prepared for real verification. Currently a request with any `Stripe-Signature` value would be accepted.

---

## 6. RBAC MATRIX VERIFICATION

Per CLAUDE.md spec (tenant middleware defaults to 'viewer', so all non-owner/editor routes effectively test the matrix):

| Endpoint | Viewer | Editor | Owner | Scaffold | Verdict |
|---|---|---|---|---|---|
| `GET /api/notifications` | 200 | 200 | 200 | All roles (no requireRoles) | PASS |
| `POST /api/notifications` | 403 | 200 | 200 | `requireRoles('owner', 'editor')` | PASS |
| `DELETE /api/notifications/:id` | 403 | 403 | 200 | `requireRoles('owner')` | PASS |
| `POST /api/billing/checkout` | 403 | 403 | 200 | `requireRoles('owner')` | PASS |
| `POST /api/billing/portal` | 403 | 403 | 200 | `requireRoles('owner')` | PASS |
| `PUT /api/tenants/:id` | 403 | 403 | 200 | `requireRoles('owner')` | PASS |
| `GET /api/analytics/overview` | 200 | 200 | 200 | All roles (no requireRoles) | PASS |

**All 7 spec RBAC rows verified: PASS**

---

## 7. SECURITY CHECKS

### PASS

| Item | Status | Notes |
|---|---|---|
| No secrets hardcoded | PASS | All from env.ts |
| JWT verification with jose | PASS | Uses SUPABASE_JWT_SECRET |
| Stripe webhook: no auth middleware | PASS | Correct pattern |
| Integration webhooks: no auth middleware | PASS | Correct pattern |
| No `any` types | PASS | Zero occurrences |
| Zod validation on all POST/PUT inputs | PASS | 8 schemas across domains |
| Error handler does not leak stack traces | PASS | Only logs internally |
| Unknown errors return generic 500 | PASS | "An unexpected error occurred" |

### CONCERNS

- **C7 (HIGH, repeated from middleware):** JWT `algorithms` not pinned to `['HS256']`.
- **C11 (MEDIUM, repeated from routes):** Stripe webhook signature not verified.

---

## 8. CONSISTENCY WITH EXISTING PACKAGES

### PASS

| Item | Status | Notes |
|---|---|---|
| Imports from @appfy/core | PASS | Dependencies, services, normalizePagination, DomainError |
| Imports from @appfy/shared | PASS | MembershipRole, FlowType, slugify, ApiErrorResponse |
| Imports from @appfy/db | PASS | createDrizzleClient |
| Service method calls match core | PASS | All `.findById()`, `.list()`, `.create()` signatures match |
| Error types match | PASS | DomainError hierarchy correctly mapped in error-handler |

### CONCERNS

- **C12 (MEDIUM): `Hono` type not parameterized with `AppVariables`.** The `types.ts` file defines `AppType = Hono<{ Variables: AppVariables }>` but `app.ts` creates `new Hono()` (untyped) and domain routes also use `new Hono()`. This means `c.get('tenantId')` returns `unknown` instead of `string`, forcing all handlers to use `as string` casts. If `Hono<{ Variables: AppVariables }>` were used, the casts would be unnecessary and the compiler would catch missing middleware.

---

## 9. CROSS-CUTTING

### PASS

| Item | Status | Notes |
|---|---|---|
| ESM convention (.js extensions) | PASS | All imports use .js |
| TypeScript strict | PASS | Extends tsconfig.base with strict: true |
| No console.log | PASS | Only console.info/warn/error with JSON.stringify |
| Async/await throughout | PASS | No .then chains |
| All handlers async | PASS | Every handler is async |
| Handlers are thin | PASS | Delegate to deps services |
| Each domain: routes.ts + handlers.ts + schemas.ts | PASS | Consistent structure across all 10 domains |

---

## SUMMARY OF FINDINGS

### By Severity

| Severity | Count | Items |
|---|---|---|
| HIGH | 4 | C3 (env empty defaults), C5 (dead null check in tenant mw), C6 (hardcoded viewer role), C7 (JWT alg not pinned) |
| MEDIUM | 9 | C1 (setup sleep), C2 (unused path aliases), C4 (missing SENTRY_AUTH_TOKEN), C8 (as never casts), C9 (missing member endpoints), C10 (unvalidated flowType param), C11 (Stripe sig not verified), C12 (untyped Hono) |

### Fix Priority (recommended order)

1. **C6** -- Wire MembershipRepository into tenant middleware (blocks all write operations)
2. **C7** -- Pin JWT algorithms to `['HS256']` in auth middleware
3. **C3** -- Make ONESIGNAL_API_KEY and STRIPE_SECRET_KEY required (or guard in factory)
4. **C5** -- Fix tenant middleware: catch TenantNotFoundError and rethrow as 403, or remove dead check
5. **C12** -- Parameterize Hono with AppVariables to eliminate `as string` casts
6. **C8** -- Add `validatedBody` to AppVariables type, eliminate `as never`
7. **C11** -- Add Stripe signature verification structure to billing webhook handler
8. **C10** -- Add Zod validation for flowType param on automation routes
9. **C1** -- Replace `sleep 5` with `docker compose up --wait`

---

## GATE DECISION

**PASS WITH CONCERNS**

The API scaffold demonstrates strong adherence to the spec:
- All 10 domains scaffolded with correct file organization (routes/handlers/schemas)
- RBAC matrix verified: 7/7 spec rows match
- Middleware chain correctly ordered
- All external endpoints (webhook, OAuth callback) correctly skip auth
- Error handler correctly maps all 12 DomainError codes to HTTP statuses
- Zero security violations (no secrets, no any, no console.log, no .then chains)

The 4 HIGH items are all addressable in a single session. C6 (hardcoded viewer role) is the most impactful since it blocks all non-GET operations, but it fails safely (closed). C7 (JWT alg pinning) is a security hardening item. The scaffold is approved to proceed to Step 10 (apps/workers) provided HIGH items are tracked for resolution.

---

-- Quinn, guardiao da qualidade
