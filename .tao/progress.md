# AppFy v2 — Progress Tracker

## Status Geral
- **PRD:** appfy-v2-migration
- **Total Stories:** 23
- **Concluídas:** 8/23
- **Em Progresso:** 0
- **Bloqueadas:** 0
- **Iteração Atual:** 1

## Fases
- [x] Phase 1: Foundation — Migração Vercel + Supabase (4/4 stories)
- [x] Phase 2: Onboarding Funcional (4/4 stories)
- [ ] Phase 3: CRUD Completo no Console (5 stories)
- [ ] Phase 4: Fluxo Operacional (5 stories)
- [ ] Phase 5: Qualidade & Observabilidade (5 stories)

## Codebase Patterns
<!-- Padrões descobertos durante a execução. ADD ONLY. -->
- Supabase Auth usa @supabase/ssr para Next.js App Router (não auth-helpers-nextjs que é legacy)
- JwtAuthGuard tenta: humanToken → supabaseToken → deviceToken (chain de 3 strategies)
- JwtAuthGuard normaliza request.user para { userId, email, accountId, role, type } — compatível com todos os controllers
- StorageService usa createClient() do @supabase/supabase-js com service_role_key
- useAuth() hook em apps/console/src/lib/supabase/hooks.ts retorna { user, accessToken, loading, signOut }
- API usa NestJS com Prisma ORM. Módulos em apps/api/src/modules/
- Console usa Next.js 14 App Router. Páginas em apps/console/src/app/
- State management: Zustand (console), Riverpod (mobile)
- API client centralizado em apps/console/src/lib/api-client.ts
- Workers BullMQ em apps/api/src/workers/processors/
- Schema Prisma em apps/api/prisma/schema.prisma
- Variáveis de ambiente em .env.example (raiz)
- Controllers usam JwtAuthGuard (não AuthGuard('jwt') do Passport) — suporta Supabase JWT
- Sync de produtos: Shopify REST + cursor via header Link; WooCommerce paginação page/per_page
- ProductsService centralizado em apps/api/src/modules/products/ — usado por Shopify e WooCommerce
- Integration status lifecycle: pending → syncing → active (ou error)

## Quality Gates
- [ ] Lint passing
- [ ] Typecheck passing
- [ ] Tests passing
- [ ] No console.log in production code

## Session Log
<!-- APPEND ONLY — nunca apagar entradas. -->
[2026-02-25] PRD criado com 23 stories em 5 fases
[2026-02-25] Stories files criados em docs/stories/ (001-023)
[2026-02-25] Loop inicializado — pronto para execução
[2026-02-25] [Iteração 1] S-001: Setup Supabase — passed (@dev) [QA: 0]
[2026-02-25] [Iteração 1] S-002: Migrar Storage → Supabase Storage — passed (@dev) [QA: 0]
[2026-02-25] [Iteração 1] S-003: Migrar Auth Console → Supabase Auth — passed (@dev) [QA: 0]
[2026-02-25] [Iteração 1] S-004: Setup Vercel Pipeline — passed (@devops) [QA: 0]
[2026-02-25] FASE 1 COMPLETA — Foundation: Migração Vercel + Supabase
[2026-02-25] [Iteração 1] S-005: Página /stores/new Funcional — passed (@dev) [QA: 0]
[2026-02-25] [Iteração 1] S-006: Email Service — passed (@dev) [QA: 0] [fechada: Supabase Auth nativo]
[2026-02-25] [Iteração 1] S-007: Shopify Sync Real — passed (@dev) [QA: 0]
[2026-02-25] [Iteração 1] S-008: WooCommerce Sync Real — passed (@dev) [QA: 0]
[2026-02-25] FASE 2 COMPLETA — Onboarding Funcional
[2026-02-25] QA Fases 1+2: 3 BLOCKs corrigidos, 5 WARNs resolvidos — APROVADO

## File List
<!-- Arquivos modificados/criados durante execução -->
- prd.json (criado)
- .tao/progress.md (criado)
- .tao/loop-state.json (criado)
- docs/stories/001-setup-supabase.md (criado)
- docs/stories/002-migrar-storage-supabase.md (criado)
- docs/stories/003-migrar-auth-console-supabase.md (criado)
- docs/stories/004-setup-vercel-pipeline.md (criado)
- docs/stories/005-stores-new-page.md (criado)
- docs/stories/006-email-service.md (criado)
- docs/stories/007-shopify-sync-real.md (criado)
- docs/stories/008-woocommerce-sync.md (criado)
- docs/stories/009-campaigns-crud.md (criado)
- docs/stories/010-segments-crud.md (criado)
- docs/stories/011-automations-crud.md (criado)
- docs/stories/012-delete-universal.md (criado)
- docs/stories/013-settings-salvam.md (criado)
- docs/stories/014-fix-campaign-queue.md (criado)
- docs/stories/015-segment-population.md (criado)
- docs/stories/016-order-attribution.md (criado)
- docs/stories/017-build-cancel-externo.md (criado)
- docs/stories/018-upstash-redis.md (criado)
- docs/stories/019-structured-logging.md (criado)
- docs/stories/020-testes-e2e.md (criado)
- docs/stories/021-toast-notifications.md (criado)
- docs/stories/022-search-debounce.md (criado)
- docs/stories/023-request-caching.md (criado)
- docs/stories/PLANO_EXECUCAO.md (criado)
- apps/api/prisma/schema.prisma (editado — directUrl)
- .env.example (reescrito — variáveis Supabase)
- apps/api/src/common/storage/storage.service.ts (reescrito — Supabase Storage)
- apps/api/package.json (editado — +@supabase/supabase-js, -@aws-sdk)
- apps/console/package.json (editado — +@supabase/ssr, +@supabase/supabase-js, +sonner, -next-auth)
- apps/console/src/lib/supabase/client.ts (criado)
- apps/console/src/lib/supabase/server.ts (criado)
- apps/console/src/lib/supabase/middleware.ts (criado)
- apps/console/src/lib/supabase/hooks.ts (criado)
- apps/console/src/app/auth/callback/route.ts (criado)
- apps/console/src/middleware.ts (reescrito — Supabase session)
- apps/console/src/components/providers.tsx (reescrito — Toaster, sem SessionProvider)
- apps/console/src/components/header.tsx (reescrito — useAuth)
- apps/console/src/app/(auth)/login/page.tsx (reescrito — Supabase Auth)
- apps/console/src/app/(auth)/register/page.tsx (reescrito — Supabase Auth)
- apps/console/src/app/(auth)/forgot-password/page.tsx (reescrito — Supabase Auth)
- apps/console/src/app/(auth)/reset-password/page.tsx (reescrito — Supabase Auth)
- apps/api/src/modules/auth/guards/jwt-auth.guard.ts (reescrito — +Supabase JWT validation)
- apps/api/src/modules/auth/strategies/supabase-jwt.strategy.ts (criado)
- 14 páginas do dashboard migradas de useSession para useAuth
- apps/console/src/lib/auth.ts (deletado)
- apps/console/src/types/next-auth.d.ts (deletado)
- vercel.json (editado — turbo-ignore)
- apps/console/src/app/(auth)/stores/new/page.tsx (editado — 409 error handler)
- apps/api/src/modules/auth/guards/jwt-auth.guard.ts (editado — normalização request.user)
- apps/api/src/modules/stores/stores.controller.ts (editado — JwtAuthGuard)
- apps/api/src/modules/apps/apps.controller.ts (editado — JwtAuthGuard)
- apps/api/src/modules/assets/assets.controller.ts (editado — JwtAuthGuard)
- apps/api/src/modules/builds/builds.controller.ts (editado — JwtAuthGuard)
- apps/api/src/modules/credentials/credentials.controller.ts (editado — JwtAuthGuard)
- apps/api/prisma/schema.prisma (editado — model Product)
- apps/api/src/modules/products/products.service.ts (criado)
- apps/api/src/modules/products/products.module.ts (criado)
- apps/api/src/modules/integrations/services/shopify.service.ts (editado — initialSync, webhooks)
- apps/api/src/modules/integrations/services/woocommerce.service.ts (editado — initialSync, handleProductWebhook)
- apps/api/src/modules/integrations/integrations.module.ts (editado — ProductsModule importado)
- apps/api/src/workers/processors/integrations.processor.ts (editado — syncWooCommerceCatalog implementado)
- .env.example (editado — ENCRYPTION_SECRET, ENCRYPTION_SALT, EMAIL_HASH_SALT, WEBHOOK_BASE_URL adicionados)
- apps/console/src/app/(auth)/stores/new/page.tsx (editado — opção "other" removida do platform)
- apps/api/src/modules/integrations/services/shopify.service.ts (editado — ENCRYPTION_SALT via env var)
- apps/api/src/modules/integrations/services/woocommerce.service.ts (editado — ENCRYPTION_SALT via env var, null-check, NaN fix)
- apps/api/src/modules/auth/guards/jwt-auth.guard.ts (editado — upsert em vez de create anti-race-condition)
- apps/console/src/app/(auth)/stores/page.tsx (editado — removido console.error)
- apps/api/src/modules/auth/strategies/supabase-jwt.strategy.ts (deletado — código morto)
