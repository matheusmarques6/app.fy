# AppFy MVP — Gap Analysis & Remaining Work

> Generated: 2026-03-15 | Source: Full codebase audit + Sprint 1 completion

---

## What's DONE (no work needed)

| Area | Status |
|---|---|
| Database schema (16 tables, enums, indexes) | Done |
| RLS policies (all tables) | Done |
| Core services (16+ services, 11.6K LOC) | Done |
| Integrations adapters (Shopify, Nuvemshop, Klaviyo) | Done |
| Auth flow (JWT, switch-tenant, RBAC middleware) | Done |
| Billing (Stripe webhooks, plan limits, frequency capping) | Done |
| Encryption (AES-256-GCM) | Done |
| Console UI (13 pages, 39 components) | Done |
| Tests infrastructure (85 spec files, builders, spies) | Done |
| CI/CD pipeline (8 gates, pre-commit hooks) | Done |
| Docker Compose (dev + test) | Done |

---

## What's LEFT — by category

### Code (API + Workers) — 18 remaining findings

| Sprint | Story | What | Size | Priority |
|---|---|---|---|---|
| **1** | ~~F2~~ | ~~Push dispatch delivery tracking~~ | ~~S~~ | ~~Done~~ |
| **1** | ~~F3~~ | ~~Tenant list handler~~ | ~~S~~ | ~~Done~~ |
| **1** | ~~F5~~ | ~~Webhook BullMQ enqueue~~ | ~~S~~ | ~~Done~~ |
| **2** | F1 | Data ingestion worker (dedup, persist, route 9 flows) | L | P0 |
| **2** | F4 | Shopify/Nuvemshop OAuth connect + callback | L | P0 |
| **3** | F7 | OneSignal webhook endpoint (delivery status callbacks) | M | P1 |
| **3** | F8 | Segment refresh worker (BullMQ processor) | M | P1 |
| **3** | F9 | Membership management (invite, role change, remove) | L | P1 |
| **3** | F10 | Rate limit Retry-After header | XS | P1 |
| **4** | F6 | RLS/isolation tests (48 to 60 scenarios) | L | P1 |
| **4** | F11 | Repository integration tests (55 methods) | XL | P1 |
| **4** | F12 | Seed helpers directory | M | P1 |
| **4** | F13 | Console to real API integration (remove mock-data.ts) | XL | P1 |
| **5** | F14 | Move OneSignal provider to integrations package | S | P2 |
| **5** | F15 | OneSignal contract test | S | P2 |
| **5** | F16 | R2 presigned URL for app icons/splash | M | P2 |
| **5** | F17 | Playwright E2E in CI | L | P2 |
| **5** | F18 | Structured logger (replace console.error) | S | P2 |
| **5** | F19 | X-Request-Id header | S | P2 |
| **5** | F20 | Pending plan change for downgrades | M | P2 |
| **5** | F21 | Build worker for Capacitor | L | P2 |

### Configuration / Infrastructure

| Item | What's missing | Priority |
|---|---|---|
| **Supabase project** | No project created/linked — need to provision DB, configure Auth, apply migrations + RLS | P0 |
| **Supabase Vault** | Encryption secret stored in env var, not Vault | P2 |
| **Stripe products/prices** | Need to create Starter/Business/Elite plans in Stripe Dashboard, map `stripe_price_id` | P0 |
| **OneSignal apps** | Need at least 1 OneSignal app for testing; production provisioned per tenant | P0 |
| **Cloudflare R2** | Bucket creation + CORS config for presigned uploads | P1 |
| **Sentry** | DSN configured in env but no `Sentry.init()` calls visible in API/workers | P1 |
| **Deploy (Railway)** | API + 3 workers need Railway services configured | P1 |
| **Deploy (Vercel)** | Console needs Vercel project linked | P1 |
| **Domain/DNS** | Custom domain for API + console | P2 |
| **CI secrets** | GitHub Actions secrets for all env vars | P1 |

### Database (data seeding)

| Item | What's missing | Priority |
|---|---|---|
| **Plans table** | Need to INSERT the 3 plans (Starter R$127, Business R$197, Elite R$297) with limits | P0 |
| **Seed script** | No `db:seed` command for development/staging data | P1 |
| **Initial migration run** | Migrations exist but need to be applied to Supabase | P0 |

### Mobile

| Item | What's missing | Priority |
|---|---|---|
| Android/iOS shell | No native project generated yet | P2 (Phase 2) |
| Build automation | No Fastlane / GitHub Actions for builds | P2 (Phase 2) |

---

## Critical Path to Launch

```
1. Supabase project + apply migrations + RLS     <- config
2. Stripe plans + products in dashboard           <- config
3. F1 (data ingestion worker)                     <- code, Sprint 2
4. F4 (OAuth handlers)                            <- code, Sprint 2
5. F13 (console real API integration)             <- code, Sprint 4
6. Railway + Vercel deploy                        <- config
7. OneSignal test app                             <- config
```

Steps 1-2 are pure configuration (no code). Steps 3-5 are the code critical path. Steps 6-7 are deploy config.

**Estimated remaining effort:** ~30-40 dev-days across 4 remaining sprints, plus ~2-3 days of infrastructure/config setup.

---

## Sprint Plan Reference

See `stories/Fend-sprint-plan.md` for detailed sprint breakdown with dependency graph, parallelism notes, and Gantt timeline.

See `stories/Fend-backlog.md` for detailed acceptance criteria per finding.
