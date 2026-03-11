# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Package manager: pnpm 9 (monorepo with turbo)
pnpm install
pnpm dev                              # All dev servers via turbo
pnpm build                            # Builds shared → Prisma generate → API

# Per-workspace
pnpm --filter @appfy/shared build     # Must build first (dependency of API + console)
pnpm --filter @appfy/api dev          # NestJS on :3000
pnpm --filter @appfy/console dev      # Next.js on :3100

# Database (Prisma + Supabase PostgreSQL)
pnpm db:generate                      # Generate Prisma client
pnpm db:push                          # Push schema to DB
pnpm db:migrate                       # Create migration
pnpm db:studio                        # Open Prisma Studio

# Testing
pnpm test                             # All unit tests via turbo
pnpm --filter @appfy/api test         # API unit tests only
pnpm --filter @appfy/api test -- --testPathPattern=events  # Single test file
pnpm --filter @appfy/api test:cov     # Coverage report
pnpm --filter @appfy/api test:e2e     # E2E (requires docker-compose.test.yml up)

# Linting
pnpm lint                             # All workspaces
pnpm --filter @appfy/api lint         # API only (ESLint --fix)

# Local services
docker-compose up                     # PostgreSQL 16, Redis 7, MinIO
docker-compose -f docker-compose.test.yml up  # Isolated test DB (:5433) + Redis (:6380)
```

## Architecture

**Monorepo layout:** `apps/api` (NestJS), `apps/console` (Next.js 14 App Router), `packages/shared` (types/constants).

### API (`apps/api`)

- **Entry:** `src/main.ts` (HTTP on :3000, prefix `/v1`), `src/workers.ts` (BullMQ processors on :3001)
- **Root module:** `src/app.module.ts` — imports all feature modules
- **Prisma schema:** `prisma/schema.prisma` (Supabase PostgreSQL, pooled + direct URLs)

**Guard chain (applied in order):**
1. `JwtAuthGuard` — decodes JWT `aud` claim to route to correct validator (device / console / Supabase)
2. `StoreAccessGuard` — validates `X-Store-Id` header against `StoreMembership`
3. `RolesGuard` — checks `@Roles('owner', 'admin')` decorator

**Key conventions:**
- `@CurrentUser()` decorator injects authenticated user from request
- `@Roles(...roles)` on controllers for destructive operations
- Redis connections: always use `createRedisConnectionOptions()` from `src/common/config/redis.factory.ts` (handles Upstash TLS `rediss://`)
- Encryption: AES-256-GCM via `EncryptionModule` for stored credentials
- Rate limiting: ThrottlerGuard with 3 tiers (1s/10s/60s) applied globally

**Module areas:** auth, stores (multi-tenant), devices, events, segments, automations, campaigns, push (OneSignal), integrations (Shopify/WooCommerce), apps (builder), builds (Codemagic), remote-config, webhooks, analytics, credentials (encrypted storage).

**Workers (BullMQ queues):** `events-ingest`, `metrics-update`, `segment-refresh`, `campaign-send`, `push-send`, `build`, `publish`. Configured with exponential backoff (3 attempts).

### Console (`apps/console`)

- Next.js 14 App Router with Supabase Auth (SSR middleware in `src/middleware.ts`)
- API client: `src/lib/api-client.ts` with `setAuthTokenProvider()` for auto-injecting Supabase session tokens
- State: Zustand + SWR
- UI: Tailwind CSS + lucide-react icons + sonner toasts

### Shared (`packages/shared`)

- Exports types, constants (JWT config, rate limits, queue names, allowed events), and utilities
- Must be built before API or console (`pnpm --filter @appfy/shared build`)

## TypeScript Path Aliases

- **API:** `@/*` → `src/*`, `@modules/*` → `src/modules/*`, `@common/*` → `src/common/*`, `@workers/*` → `src/workers/*`
- **Console:** `@/*` → `./src/*`

## Environment

Key env vars (see `.env.example`): `DATABASE_URL`, `DIRECT_URL` (migrations), `REDIS_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `ENCRYPTION_SECRET` (≥32 chars), `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`.

## Known Issues

- 6 pre-existing TS errors in API (`auth.service.ts`, `woocommerce.service.ts`, `stores.service.ts`)
- Console ESLint not fully configured (`next lint` may prompt interactive setup)
