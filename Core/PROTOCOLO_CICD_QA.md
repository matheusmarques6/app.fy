# Protocolo CI/CD & QA — AppFy Mobile Revenue Engine

## Visão Geral

```
Todo código que entra em main é production-ready.
Nenhum atalho. Nenhuma exceção. Nenhum "conserto no próximo commit".

O CI é o bouncer — se não passa, não entra.
O QA é o detetive — encontra o que o CI não vê.
O CD é o entregador — só carrega o que foi aprovado.
```

---

## 1. Arquitetura do Pipeline

### 1.1 — Trigger Map

```
┌─────────────────────────────────────────────────────────────┐
│                      TRIGGERS                                │
├──────────────────┬──────────────────────────────────────────┤
│ push to branch   │ → CI Lint + Type + Unit                  │
│ pull request     │ → CI Full (Lint + Type + Unit + Integ    │
│                  │   + Isolation + Coverage + Audit)         │
│ merge to main    │ → CI Full + Build + Deploy Staging       │
│ tag v*           │ → CI Full + Build + Deploy Production    │
│ schedule (daily) │ → Security Scan + Dependency Audit       │
│ manual dispatch  │ → Qualquer pipeline sob demanda          │
└──────────────────┴──────────────────────────────────────────┘
```

### 1.2 — Pipeline Stages (Ordem de Execução)

```
┌──────────────────────────────────────────────────────────────────┐
│ STAGE 1: GATE — Rápido, bloqueia cedo (< 30s)                   │
│                                                                   │
│  1.1 biome check --no-errors-on-unmatched                        │
│      → Lint + format em 1 comando                                │
│      → Se falhar: dev roda `biome check --write` e recommita     │
│                                                                   │
│  1.2 tsc --noEmit                                                │
│      → Type check sem gerar output                               │
│      → Zero tolerance: 0 errors                                  │
│                                                                   │
│  1.3 Turbo cache check                                           │
│      → Se nada mudou no package, skip testes daquele package     │
├──────────────────────────────────────────────────────────────────┤
│ STAGE 2: TEST — Testes unitários + integração (< 5min)           │
│                                                                   │
│  2.1 Unit tests (Vitest)                                         │
│      → packages/api/**/*.spec.ts                                 │
│      → packages/notifications/**/*.spec.ts                       │
│      → packages/integrations/**/*.spec.ts                        │
│      → packages/db/**/*.spec.ts                                  │
│      → apps/web/**/*.spec.ts                                     │
│      → Paralelizado por package via Turborepo                    │
│                                                                   │
│  2.2 Integration tests                                           │
│      → Supabase local (via supabase start ou test project)       │
│      → Redis mock ou testcontainers                              │
│      → Testa fluxos: API route → service → repository → DB      │
│                                                                   │
│  2.3 Coverage check                                              │
│      → Baseline: nunca diminui (ratchet)                         │
│      → Mínimo: 80% em todos os packages                             │
│      → Coverage report gerado como artifact                      │
├──────────────────────────────────────────────────────────────────┤
│ STAGE 3: SECURITY — Isolamento + vulnerabilidades (< 2min)       │
│                                                                   │
│  3.1 Multi-tenant isolation tests                                │
│      → Tenant A tenta acessar dados de Tenant B                  │
│      → DEVE falhar em 100% dos cenários                          │
│      → Testa: SELECT, INSERT, UPDATE, DELETE cross-tenant        │
│      → Testa: API endpoints com tenant_id errado                 │
│      → Se QUALQUER cenário passar → pipeline FALHA               │
│                                                                   │
│  3.2 npm audit                                                   │
│      → npm audit --audit-level=high                              │
│      → Bloqueia em vulnerabilidades high/critical                │
│      → Moderate: warning, não bloqueia                           │
│                                                                   │
│  3.3 Secret scanning                                             │
│      → Verificar se .env, tokens, keys estão no commit           │
│      → Regex patterns: API_KEY, SECRET, PASSWORD, TOKEN          │
│      → Se detectar secret → pipeline FALHA + alerta              │
├──────────────────────────────────────────────────────────────────┤
│ STAGE 4: BUILD — Compilação e artifacts (< 3min)                 │
│  (Só roda em merge to main ou tag)                               │
│                                                                   │
│  4.1 Build packages (Turborepo)                                  │
│      → packages/shared → packages/db → packages/* → apps/*      │
│      → Ordem de dependência respeitada                           │
│                                                                   │
│  4.2 Build web (Next.js)                                         │
│      → next build                                                │
│      → Output: standalone mode para deploy                       │
│                                                                   │
│  4.3 Build workers                                               │
│      → Bundle cada worker separadamente                          │
│      → Output: 1 arquivo por worker                              │
│                                                                   │
│  4.4 Docker images (se aplicável)                                │
│      → Multi-stage build                                         │
│      → Tag: git SHA + latest                                     │
├──────────────────────────────────────────────────────────────────┤
│ STAGE 5: DEPLOY — Entrega (< 5min)                               │
│  (Só roda em merge to main ou tag)                               │
│                                                                   │
│  5.1 Deploy Staging (merge to main)                              │
│      → Vercel preview para web                                   │
│      → Railway/Render staging para workers                       │
│      → Migrations executadas em staging DB                       │
│                                                                   │
│  5.2 Smoke tests em staging                                      │
│      → Health check endpoints                                    │
│      → 1 push enviado para device de teste                       │
│      → 1 API call completa (auth → dados → response)             │
│                                                                   │
│  5.3 Deploy Production (tag v*)                                  │
│      → Vercel production para web                                │
│      → Railway/Render production para workers                    │
│      → Migrations executadas em production DB                    │
│      → Smoke tests em production                                 │
│      → Rollback automático se smoke falhar                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. QA Gates — Definições

### 2.1 — Gate Levels

```
┌───────────────────┬──────────────┬───────────────────────────────────────────────┐
│ Level             │ Quando       │ O que valida                                  │
├───────────────────┼──────────────┼───────────────────────────────────────────────┤
│ G0: Pre-commit    │ Pre-commit   │ Biome (lint+format) + tsc --noEmit            │
│ G1: Unit Tests    │ Todo push    │ Vitest unit tests + coverage ≥80%             │
│ G2: Integration   │ Todo push    │ Integration + Isolation + DB migrations        │
│ G3: Security      │ Todo PR      │ Dependency audit + SAST (CodeQL) + secrets    │
│ G4: Build         │ Merge main   │ API + Web + Shared compilam sem erros         │
│ G5: Deploy Staging│ Merge main   │ Deploy web + API + health check               │
│ G6: E2E + Smoke   │ Deploy       │ Smoke tests + Playwright E2E flows            │
│ G7: Prod Deploy   │ Manual       │ G0-G6 verdes + review humano + rollback plan  │
└───────────────────┴──────────────┴───────────────────────────────────────────────┘

Regra: G0-G3 bloqueiam merge. G4-G6 bloqueiam deploy. G7 é manual gate.
```

### 2.2 — Coverage Policy (Ratchet)

```
Princípio: coverage nunca diminui. Só sobe ou mantém.

Como funciona:
1. CI lê coverage atual de main (baseline)
2. CI mede coverage do PR
3. Se coverage do PR < baseline → FAIL
4. Se coverage do PR >= baseline → PASS
5. Ao mergear, novo baseline = coverage do PR

Por package:
  packages/api:            80% mínimo
  packages/notifications:  80% mínimo
  packages/integrations:   80% mínimo
  packages/db:             80% mínimo
  packages/shared:         80% mínimo
  apps/web:                80% mínimo

Exceções: arquivos de config, tipos puros, migrations → excluídos do coverage.
```

### 2.3 — Isolation Test Matrix

```
Estes testes rodam em CADA PR. São o coração da segurança multi-tenant.

┌─────────────────────────────────┬──────────┬──────────────────┐
│ Operação                        │ Esperado │ Se falhar         │
├─────────────────────────────────┼──────────┼──────────────────┤
│ SELECT notifications (tenant B) │ 0 rows   │ BLOCK + P0 alert │
│ SELECT deliveries (tenant B)    │ 0 rows   │ BLOCK + P0 alert │
│ SELECT app_users (tenant B)     │ 0 rows   │ BLOCK + P0 alert │
│ INSERT notification (tenant B)  │ ERROR    │ BLOCK + P0 alert │
│ UPDATE notification (tenant B)  │ ERROR    │ BLOCK + P0 alert │
│ DELETE notification (tenant B)  │ ERROR    │ BLOCK + P0 alert │
│ API GET /notif?tenant=B         │ 403/404  │ BLOCK + P0 alert │
│ API PATCH /notif/{id_B}         │ 403/404  │ BLOCK + P0 alert │
│ JWT com tenant_id manipulado    │ 401      │ BLOCK + P0 alert │
│ Service role sem WHERE tenant   │ BLOCKED  │ BLOCK + P0 alert │
└─────────────────────────────────┴──────────┴──────────────────┘

P0 = bloqueia pipeline, notifica time imediatamente.
Nenhum cenário de isolamento é "warning". É sempre BLOCK.
```

---

## 3. Estratégia de Testes por Camada

### 3.1 — Pirâmide de Testes

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E╲          5% — Smoke tests (deploy)
                 ╱______╲
                ╱        ╲
               ╱Integration╲     25% — Fluxos completos
              ╱____________╲
             ╱              ╲
            ╱   Unit Tests   ╲   70% — Lógica isolada
           ╱__________________╲

Nunca inverter a pirâmide. Nunca ter mais E2E que unit.
```

### 3.2 — O que testar por package

```
packages/api
├── Unit:
│   ├── Middleware: auth valida JWT, tenant extrai header, rate limit conta
│   ├── Services: lógica de negócio pura (sem DB)
│   └── Validators: input validation com zod
├── Integration:
│   ├── Route → Service → Repository → DB (fluxo completo)
│   ├── Auth flow: login → JWT → request autenticada
│   └── Error handling: 400, 401, 403, 404, 500
└── Isolation:
    └── Toda operação cross-tenant falha

packages/notifications
├── Unit:
│   ├── Pipeline: cada etapa isolada (validação, sanitização, limites)
│   ├── Flows: trigger → delay → envio (mock de OneSignal)
│   └── Batching: agrupa tokens corretamente
├── Integration:
│   ├── Pipeline completo: geração → validação → agendamento → envio
│   ├── BullMQ: job entra na fila, worker processa
│   └── Retry: falha → retry → sucesso ou DLQ
└── Isolation:
    └── Push de tenant A nunca usa credencial de tenant B

packages/integrations
├── Unit:
│   ├── Adapter: cada método retorna formato correto
│   ├── Webhook parser: payload → evento tipado
│   └── HMAC validation: legítimo aceita, forjado rejeita
├── Integration:
│   ├── OAuth flow completo (mock de Shopify/Nuvemshop)
│   ├── Webhook → event → processamento
│   └── Token encrypt → save → load → decrypt → use
└── Isolation:
    └── Token de tenant A nunca é usado para API call de tenant B

packages/db
├── Unit:
│   ├── Schema: tipos gerados corretamente
│   └── Validators: constraints funcionam
├── Integration:
│   ├── Migrations: rodam em banco fresh + existente
│   ├── Seed: dados de teste carregam corretamente
│   └── Repository: CRUD com tenant_id obrigatório
└── Isolation:
    └── RLS policies bloqueiam acesso cross-tenant

apps/web
├── Unit:
│   ├── Components: renderizam com props corretas
│   ├── Hooks: state management funciona
│   └── Utils: formatadores, parsers
├── Integration:
│   ├── Pages: carregam com dados mockados
│   ├── Forms: validação + submit + feedback
│   └── Auth: login → redirect → dashboard
└── E2E (Playwright — Fase 2):
    └── Fluxos críticos: login, enviar push, ver métricas
```

### 3.3 — Test Fixtures & Factories

```typescript
// packages/db/test/factories.ts

// Factory pattern para gerar dados de teste consistentes
// Toda factory exige tenant_id — impossível criar dados sem tenant

interface TestTenant {
  id: string
  name: string
  platform: 'shopify' | 'nuvemshop'
}

function createTestTenant(overrides?: Partial<TestTenant>): TestTenant
function createTestNotification(tenantId: string, overrides?: Partial<Notification>): Notification
function createTestAppUser(tenantId: string, overrides?: Partial<AppUser>): AppUser
function createTestDelivery(tenantId: string, notificationId: string): NotificationDelivery

// Helpers de isolamento
function createIsolationPair(): { tenantA: TestTenant, tenantB: TestTenant }
// Cria 2 tenants com dados, para testar que A não vê B

// Cleanup
function cleanupTestData(tenantId: string): Promise<void>
// Limpa tudo de um tenant de teste (rodar no afterEach)
```

---

## 4. GitHub Actions — Workflows

### 4.1 — ci.yml (Todo PR)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  # ── Stage 1: Gate ──────────────────────────────
  gate:
    name: Lint + Type Check
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome check --no-errors-on-unmatched
      - run: pnpm turbo run typecheck

  # ── Stage 2: Test ──────────────────────────────
  test:
    name: Unit + Integration Tests
    needs: gate
    runs-on: ubuntu-latest
    timeout-minutes: 10
    services:
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run test -- --coverage
      - name: Coverage check (ratchet)
        run: |
          # Compara coverage atual com baseline de main
          pnpm turbo run coverage:check
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  # ── Stage 3: Security ─────────────────────────
  security:
    name: Isolation + Audit
    needs: gate
    runs-on: ubuntu-latest
    timeout-minutes: 5
    env:
      DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      - name: Multi-tenant isolation tests
        run: pnpm turbo run test:isolation

      - name: npm audit
        run: pnpm audit --audit-level=high

      - name: Secret scanning
        run: |
          # Scan para secrets no código commitado
          if grep -rE '(SUPABASE_SERVICE_ROLE|sk-[a-zA-Z0-9]{20,}|password\s*=\s*["\x27][^"\x27]+)' \
            --include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' \
            --exclude-dir=node_modules --exclude-dir=.git .; then
            echo "::error::Possible secrets detected in source code!"
            exit 1
          fi
```

### 4.2 — deploy-staging.yml (Merge to main)

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy Staging

on:
  push:
    branches: [main]

jobs:
  ci:
    uses: ./.github/workflows/ci.yml
    secrets: inherit

  deploy:
    name: Deploy to Staging
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      # Migrations
      - name: Run migrations (staging)
        run: pnpm --filter @appfy/db run migrate
        env:
          DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}

      # Deploy web (Vercel)
      - name: Deploy web to Vercel (staging)
        run: pnpm vercel deploy --token=${{ secrets.VERCEL_TOKEN }}

      # Deploy workers (Railway/Render)
      - name: Deploy workers to staging
        run: |
          # Push to staging branch triggers auto-deploy on Railway/Render
          # Ou usar CLI específico do provider
          echo "Workers deployed to staging"

      # Smoke tests
      - name: Smoke tests (staging)
        run: |
          pnpm turbo run test:smoke -- --env=staging
        env:
          STAGING_URL: ${{ secrets.STAGING_URL }}
          STAGING_API_URL: ${{ secrets.STAGING_API_URL }}
```

### 4.3 — deploy-production.yml (Tag release)

```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production

on:
  push:
    tags: ['v*']

jobs:
  ci:
    uses: ./.github/workflows/ci.yml
    secrets: inherit

  deploy:
    name: Deploy to Production
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 15
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      # Snapshot antes da migration (rollback safety)
      - name: Database snapshot
        run: |
          echo "Creating database snapshot before migration..."
          # Supabase: usar branching ou pg_dump
          # Railway: snapshot automático

      # Migrations
      - name: Run migrations (production)
        run: pnpm --filter @appfy/db run migrate
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      # Deploy web
      - name: Deploy web to Vercel (production)
        run: pnpm vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}

      # Deploy workers
      - name: Deploy workers to production
        run: |
          echo "Workers deployed to production"

      # Smoke tests
      - name: Smoke tests (production)
        run: pnpm turbo run test:smoke -- --env=production
        env:
          PRODUCTION_URL: ${{ secrets.PRODUCTION_URL }}
          PRODUCTION_API_URL: ${{ secrets.PRODUCTION_API_URL }}

      # Rollback automático se smoke falhar
      - name: Rollback on failure
        if: failure()
        run: |
          echo "::error::Smoke tests failed! Rolling back..."
          # Reverter deploy do Vercel
          # Reverter migration (se possível)
          # Alertar time
```

### 4.4 — security-scan.yml (Daily)

```yaml
# .github/workflows/security-scan.yml
name: Security Scan (Daily)

on:
  schedule:
    - cron: '0 6 * * *'   # 6am UTC = 3am BRT
  workflow_dispatch:

jobs:
  audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      - name: npm audit (full)
        run: pnpm audit --audit-level=moderate

      - name: Check for outdated dependencies
        run: pnpm outdated || true

      - name: License check
        run: |
          # Verificar que nenhuma dependência tem licença problemática
          # (GPL, AGPL em projeto comercial)
          npx license-checker --failOn 'GPL-2.0;GPL-3.0;AGPL-3.0'

      # Notificar se encontrar problemas
      - name: Notify on issues
        if: failure()
        run: |
          echo "::warning::Security scan found issues. Review required."
          # Integrar com Slack/Discord/Email
```

---

## 5. QA Manual — Checklists por Feature

### 5.1 — Checklist: Nova Rota de API

```
Antes de abrir PR:
- [ ] Route segue convenção RESTful
- [ ] Auth middleware aplicado (JwtAuthGuard ou equivalente)
- [ ] Tenant isolation: toda query filtra por tenant_id
- [ ] Input validation com zod schema
- [ ] Error responses padronizadas (400, 401, 403, 404, 500)
- [ ] Rate limiting aplicado
- [ ] Audit log para operações de escrita
- [ ] Testes unitários para service
- [ ] Testes de integração para rota completa
- [ ] Teste de isolamento (tenant B não acessa)
- [ ] OpenAPI/Swagger atualizado (se aplicável)
```

### 5.2 — Checklist: Novo Fluxo de Notificação

```
Antes de abrir PR:
- [ ] Fluxo passa por TODAS as etapas do pipeline (nunca pula)
- [ ] Trigger configurado (webhook ou evento)
- [ ] Delay correto (conforme tabela de flows)
- [ ] Template de prompt testado com 3+ lojas diferentes
- [ ] Título e corpo dentro dos limites reais (push_limits.json)
- [ ] Sanitização de input (DOMPurify)
- [ ] Tenant isolation verificada
- [ ] Retry configurado com backoff exponencial
- [ ] Dead letter queue para falhas permanentes
- [ ] Audit trail registrando todas as etapas
- [ ] Testes unitários para cada etapa do pipeline
- [ ] Teste de integração para fluxo completo
- [ ] Teste com device real (pelo menos 1 push recebido)
```

### 5.3 — Checklist: Nova Integração (Adapter)

```
Antes de abrir PR:
- [ ] Implementa PlatformAdapter interface completa
- [ ] OAuth flow testado end-to-end
- [ ] Token encryption/decryption validado
- [ ] HMAC webhook validation implementada
- [ ] Rate limiting da API respeitado (429 → backoff)
- [ ] Graceful degradation (API fora → sistema continua)
- [ ] Uninstall handler (cleanup de tokens)
- [ ] Scope mínimo verificado
- [ ] Testes unitários com mocks da API
- [ ] Testes de integração com sandbox da plataforma
- [ ] Documentação de diferenças vs outras plataformas
```

### 5.4 — Checklist: Nova Migration

```
Antes de abrir PR:
- [ ] Migration é nova (nunca editar existente)
- [ ] Testada em banco fresh (do zero)
- [ ] Testada em banco existente (com dados)
- [ ] Colunas novas têm DEFAULT (não quebra inserções existentes)
- [ ] Índices criados para queries frequentes
- [ ] RLS policy criada para nova tabela (se aplicável)
- [ ] Rollback possível (ou documentar que não é)
- [ ] Não dropa coluna sem migration de fallback
- [ ] Performance testada com volume realista de dados
```

### 5.5 — Checklist: Deploy para Produção

```
Antes de criar tag:
- [ ] Todas as features do release testadas em staging
- [ ] Smoke tests passando em staging
- [ ] Migration testada em staging DB
- [ ] Snapshot do banco de produção criado (rollback safety)
- [ ] Changelog atualizado
- [ ] Zero erros no CI pipeline completo
- [ ] Performance não degradou (comparar com métricas anteriores)
- [ ] Nenhum secret exposto no diff

Após deploy:
- [ ] Smoke tests passando em produção
- [ ] Health check endpoints respondendo
- [ ] Push de teste enviado e recebido
- [ ] Métricas de erro estáveis (não subiram)
- [ ] Workers processando fila normalmente
- [ ] Verificar logs por 15 minutos (nada anômalo)
```

---

## 6. Monitoring & Alertas

### 6.1 — Health Checks

```
Endpoints obrigatórios:

GET /health
  → 200 se API está respondendo
  → Verifica: DB connection, Redis connection
  → Latência < 500ms

GET /health/deep
  → 200 se tudo funciona
  → Verifica: DB query funciona, Redis read/write, OneSignal credentials válidas
  → Latência < 2s
  → NÃO expor publicamente (requer auth)

Workers:
  → Cada worker reporta heartbeat a cada 60s
  → Se heartbeat parar por 5 min → alerta
```

### 6.2 — Alertas (por severidade)

```
┌────────┬────────────────────────────────────────┬──────────────┐
│ Sev    │ Condição                               │ Ação         │
├────────┼────────────────────────────────────────┼──────────────┤
│ P0     │ RLS bypass detectado                   │ Bloquear NOW │
│ P0     │ Secret exposto em commit               │ Rotate NOW   │
│ P0     │ Push delivery rate < 80%               │ Investigar   │
│ P0     │ API down (health check failing)        │ Pager        │
├────────┼────────────────────────────────────────┼──────────────┤
│ P1     │ Push delivery rate < 95%               │ Investigar   │
│ P1     │ Worker queue > 10K jobs pendentes      │ Scale up     │
│ P1     │ API p95 latency > 500ms                │ Investigar   │
│ P1     │ Error rate > 5% por tenant             │ Notificar    │
├────────┼────────────────────────────────────────┼──────────────┤
│ P2     │ Coverage diminuiu                      │ Bloquear PR  │
│ P2     │ npm audit found moderate               │ Planejar fix │
│ P2     │ Worker queue > 5K jobs pendentes       │ Monitorar    │
│ P2     │ API p95 latency > 200ms                │ Monitorar    │
├────────┼────────────────────────────────────────┼──────────────┤
│ P3     │ Dependência outdated > 3 meses         │ Atualizar    │
│ P3     │ Test flaky detectado                   │ Corrigir     │
│ P3     │ Build time > 10 min                    │ Otimizar     │
└────────┴────────────────────────────────────────┴──────────────┘
```

### 6.3 — Dashboards

```
Dashboard 1: Operacional
  - API uptime (99.9% target)
  - API latency p50, p95, p99
  - Error rate por endpoint
  - Worker queue depth
  - Worker processing rate
  - Redis memory usage

Dashboard 2: Push Performance
  - Delivery rate (por tenant, geral)
  - Push latency (agendamento → entrega)
  - Open rate (por tipo de notificação)
  - Click rate
  - Conversion rate
  - Failed pushes (por motivo)

Dashboard 3: Business
  - MRR (monthly recurring revenue)
  - Tenants ativos
  - Notificações enviadas (período)
  - Receita gerada por push (por tenant)
  - Churn rate
  - Upgrade/downgrade rate

Dashboard 4: CI/CD
  - Build success rate
  - Average build time
  - Test pass rate
  - Coverage trend
  - Deploy frequency
  - Mean time to recovery (MTTR)
```

---

## 7. Incident Response

### 7.1 — Runbook: Data Leak Detectado

```
1. CONFIRMAR: verificar se dados realmente vazaram cross-tenant
2. ISOLAR: desabilitar tenant afetado (is_active = false)
3. INVESTIGAR: audit_log para identificar scope do vazamento
4. CORRIGIR: fix na RLS policy ou código
5. VALIDAR: rodar isolation tests completos
6. RESTAURAR: reabilitar tenant
7. NOTIFICAR: informar clientes afetados (LGPD obriga)
8. POSTMORTEM: documentar causa raiz e prevenção
```

### 7.2 — Runbook: Push Falhando em Massa

```
1. VERIFICAR: OneSignal status page (pode ser outage deles)
2. VERIFICAR: credenciais do tenant ainda válidas?
3. VERIFICAR: rate limit do OneSignal atingido?
4. SE OneSignal down: ativar circuit breaker, jobs voltam para fila
5. SE credencial expirou: re-provisionar app via OneSignal API
6. SE rate limit: reduzir concurrency, aumentar delay entre batches
7. MONITORAR: DLQ para jobs que falharam permanentemente
8. REPROCESSAR: replay DLQ após resolução
```

### 7.3 — Runbook: Deploy Quebrou Produção

```
1. DETECTAR: smoke tests falharam OU métricas anômalas em 15 min
2. ROLLBACK WEB: reverter deploy no Vercel (1 click)
3. ROLLBACK WORKERS: reverter para versão anterior
4. ROLLBACK DB: se migration causou o problema:
   a. Se migration é reversível → rodar rollback
   b. Se não é reversível → restaurar snapshot
5. VALIDAR: smoke tests passando com versão anterior
6. INVESTIGAR: o que quebrou e por quê
7. FIX: corrigir, testar em staging, re-deploy
```

---

## 8. Ferramentas

### 8.1 — Stack de Ferramentas

```
| Função             | Ferramenta                           |
|--------------------|--------------------------------------|
| Test runner        | Vitest                               |
| Coverage           | v8 (via Vitest)                      |
| Lint + Format      | Biome                                |
| CI/CD              | GitHub Actions                       |
| E2E (Fase 2)      | Playwright                           |
| Monitoring         | Sentry + Railway logs                |
| Error tracking     | Sentry                               |
| Uptime monitoring  | BetterUptime / UptimeRobot (grátis)  |
| Security scan      | npm audit + license-checker          |
| Secret detection   | gitleaks (ou regex custom)           |
| DB snapshots       | Supabase branching / pg_dump         |
| Artifact storage   | GitHub Actions artifacts             |
| Package manager    | pnpm                                 |
| Monorepo           | Turborepo                            |
```

### 8.2 — Configuração Vitest

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/*.spec.ts', 'apps/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', '.turbo'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        '**/*.d.ts',
        '**/*.config.*',
        '**/migrations/**',
        '**/types/**',
        '**/test/**',
      ],
    },
    // Isolation tests rodam separado
    // pnpm turbo run test:isolation
  },
})
```

### 8.3 — Configuração Biome

```json
// biome.json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "error"
      },
      "complexity": {
        "noForEach": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "all"
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      ".turbo",
      "coverage",
      "*.gen.ts"
    ]
  }
}
```

---

## 9. Turbo Pipeline Config

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "env": ["DATABASE_URL", "REDIS_URL"]
    },
    "test:isolation": {
      "dependsOn": ["^build"],
      "env": ["DATABASE_URL"]
    },
    "test:smoke": {
      "dependsOn": ["build"],
      "env": ["STAGING_URL", "PRODUCTION_URL"]
    },
    "coverage:check": {
      "dependsOn": ["test"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 10. Definition of Done (DoD)

### Para uma Feature estar DONE:

```
Code:
  ✅ Implementação completa (todos os acceptance criteria)
  ✅ TypeScript strict sem errors
  ✅ Biome sem errors
  ✅ Sem console.log (structured logging apenas)
  ✅ Sem TODO/FIXME/HACK no código novo

Tests:
  ✅ Testes unitários escritos e passando
  ✅ Testes de integração escritos e passando
  ✅ Testes de isolamento multi-tenant passando
  ✅ Coverage não diminuiu (ratchet)

Security:
  ✅ Input validado com zod
  ✅ Output sanitizado (DOMPurify para texto de push)
  ✅ tenant_id filtrado em toda query
  ✅ Auth required em todo endpoint
  ✅ Audit log para operações de escrita
  ✅ Sem secrets no código

CI:
  ✅ Pipeline completo verde
  ✅ npm audit limpo (high/critical)

Review:
  ✅ Code review aprovado
  ✅ Checklist da feature completado

Deploy:
  ✅ Testado em staging
  ✅ Smoke test passando em staging
```

### Para um Release estar DONE:

```
  ✅ Todas as features do release estão DONE
  ✅ Smoke tests passando em staging
  ✅ Snapshot do banco de produção criado
  ✅ Migration testada em staging
  ✅ Changelog atualizado
  ✅ Tag criada (semver)
  ✅ Deploy em produção executado
  ✅ Smoke tests passando em produção
  ✅ Monitoramento por 15 min sem anomalias
  ✅ Rollback plan documentado e testado
```
