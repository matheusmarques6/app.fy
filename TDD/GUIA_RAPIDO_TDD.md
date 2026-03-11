# Guia Rapido — Quando Usar Cada TDD Doc

> Referencia rapida para saber qual documento consultar em cada momento do desenvolvimento.
> Cada doc tem um papel especifico no ciclo. Nao leia todos de uma vez — use sob demanda.

---

## Mapa Visual

```
  Vai comecar a codar?
        │
        ▼
  ┌─────────────────────┐
  │  TDD_ARQUITETURA.md │ ← Leia ANTES de escrever qualquer teste
  │  (Como testar)       │
  └────────┬────────────┘
           │
     ┌─────┴──────┐
     ▼             ▼
┌──────────┐  ┌──────────────┐
│ TDD_DEV  │  │ TDD_DATABASE │
│ (Modulo) │  │ (Banco)      │
└─────┬────┘  └──────┬───────┘
      │               │
      └───────┬───────┘
              ▼
      ┌──────────────┐
      │   TDD_QA.md  │ ← Antes de abrir PR / rodar CI
      │  (Validacao)  │
      └──────────────┘
```

---

## 1. TDD_ARQUITETURA.md — "Como estruturo meus testes?"

**Quando consultar:** Antes de criar qualquer teste novo. E toda vez que tiver duvida sobre onde colocar um teste ou como mockar algo.

**O que voce encontra:**

| Topico | Resumo |
|---|---|
| ADRs de testabilidade | Como Hono, Drizzle, OneSignal, BullMQ e Repository Pattern afetam os testes |
| 4 Camadas de teste | Layer 1 (Domain puro) → Layer 2 (Use Cases mockados) → Layer 3 (Infra real) → Layer 4 (HTTP Hono) |
| DI sem container | `createDependencies(overrides)` — override parcial, so mocka o que precisa |
| Mock de servicos | Tabela completa: Supabase Auth (jose), OneSignal (MSW), Shopify (MSW+HMAC), Stripe (stripe-mock), Redis/PG (testcontainers) |
| Docker Compose test | Config otimizada: PG em tmpfs, Redis sem persistencia, MinIO, stripe-mock |
| Performance tests | p95 < 200ms API, < 50ms queries, k6 semanal |
| Contract tests | Zod schemas como contrato, interface compliance para adapters |
| Piramide | 70% unit / 20% integration / 10% E2E — ~510 testes totais, CI < 7 min |

**Regras-chave para lembrar:**
- Sempre comece pelo Layer 1 (domain puro, zero deps)
- Nunca pule do Layer 1 direto pro Layer 4
- `makeSut()` + AAA (Arrange/Act/Assert) em todo teste
- Naming: `*.spec.ts` (nunca `*.test.ts`)

---

## 2. TDD_DEV.md — "O que testo neste modulo?"

**Quando consultar:** Ao iniciar a implementacao de um modulo especifico. Abra a secao do modulo que vai codar.

**O que voce encontra:**

| Secao | Conteudo |
|---|---|
| Infra de testes | Vitest config completa (unit/integration/isolation projects), aliases, setup files |
| Auth | Login, switch-tenant, JWT decode, membership check, guard chain, RBAC |
| Notifications | CRUD, template variables, status machine, frequency capping, scheduling, A/B testing |
| Push (OneSignal) | Provision app, send batch, delivery tracking, token cleanup, retry/DLQ |
| Billing (Stripe) | Checkout, webhook lifecycle, plan limits, subscription cancel/reactivate |
| Segments | Regras JSONB, refresh worker, segment membership, dynamic filters |
| Analytics | Event ingestion, dedup, metrics aggregation, conversion attribution (1h/24h) |
| Integrations | Shopify adapter, Nuvemshop adapter, webhook HMAC, contract tests |
| Automations | 9 flow types, trigger matching, delay execution, on/off toggle |
| Workers (BullMQ) | Job dispatch, retry backoff, DLQ, concurrency, `waitForJob()` helpers |

**Como usar na pratica:**
1. Vai implementar `auth`? → Abra TDD_DEV secao Auth
2. Leia os cenarios RED-GREEN-REFACTOR listados
3. Implemente na ordem: Layer 1 (validacoes puras) → Layer 2 (use cases) → Layer 3 (repos) → Layer 4 (rotas)
4. Cada cenario ja tem o teste de exemplo pronto — adapte pro seu caso

---

## 3. TDD_QA.md — "Meu codigo ta pronto pra deploy?"

**Quando consultar:** Antes de abrir PR, ao rodar CI, ao validar seguranca, ou ao investigar falha de quality gate.

**O que voce encontra:**

| Secao | Conteudo |
|---|---|
| Quality Gates G0-G7 | Pipeline completo: pre-commit → unit → integration → security → build → staging → E2E → production |
| Coverage | 80% minimo global, coverage delta nao pode diminuir |
| Isolation multi-tenant | Testes IDOR: tenant A nunca ve dados de tenant B (bloqueador absoluto) |
| Security tests | OWASP Top 10: injection, XSS, IDOR, auth bypass, credential exposure |
| Stripe webhooks | Signature verification, lifecycle completo, idempotency |
| Frequency capping | Limites por plano, janela diaria, override de urgencia |
| LGPD | Anonimizacao, export de dados, consent tracking, retention |
| Rate limiting | 3 tiers (1s/10s/60s), sliding window Redis, bypass para health checks |

**Gates resumidos:**

| Gate | Onde roda | O que valida | Se falhar |
|---|---|---|---|
| G0 | Pre-commit (local) | Biome format + lint + tsc | Commit bloqueado |
| G1 | CI (push) | Unit tests + coverage >= 80% | PR bloqueado |
| G2 | CI (push) | Integration + isolation + migrations | PR bloqueado |
| G3 | CI (push) | Audit deps + CodeQL + secrets scan | PR bloqueado |
| G4 | CI (push) | Build API + Web + Shared | PR bloqueado |
| G5 | CI (merge) | Deploy staging + health check | Deploy bloqueado |
| G6 | CI (post-deploy) | Smoke tests + Playwright E2E | Rollback automatico |
| G7 | Manual | Review humano + rollback plan + Sentry | Deploy cancelado |

---

## 4. TDD_DATABASE.md — "Como testo banco de dados?"

**Quando consultar:** Ao criar/alterar tabelas, escrever queries, configurar RLS, ou trabalhar com migrations.

**O que voce encontra:**

| Secao | Conteudo |
|---|---|
| Schema tests | Verificar colunas, constraints, FKs, defaults, unique — para cada tabela |
| RLS policies | `SET LOCAL jwt.claims` → query → assert isolamento. 5 cenarios obrigatorios por policy |
| Repository tests | CRUD completo, filtros, paginacao, queries complexas — sempre com `tenantId` obrigatorio |
| Migration tests | `drizzle-kit push --dry-run` em banco fresh, idempotencia, rollback |
| Concorrencia | `SELECT ... FOR UPDATE`, optimistic locking com `version`, deadlock detection |
| RBAC matrix | owner/admin/member — permissoes por tabela e operacao |
| Retention | Job de limpeza (notification_deliveries > 90 dias), vacuum, monitoring |
| Audit log | Trigger de audit para operacoes sensibles, imutabilidade |

**5 cenarios RLS obrigatorios por tabela:**
1. Tenant A le so dados de A
2. Tenant B le so dados de B
3. Tenant A NAO consegue ler dados de B
4. Sem JWT → acesso negado
5. JWT com tenant_id invalido → zero resultados

**Padrao de teste de repository:**
```
beforeEach → truncateAllTables(db)
seed dados para tenant-a e tenant-b
query como tenant-a → so ve dados de tenant-a
```

---

## Fluxo Completo na Pratica

```
1. Recebeu uma task/story
   │
2. Consulte TDD_ARQUITETURA → entenda em qual layer comecar
   │
3. Consulte TDD_DEV → encontre os cenarios do modulo
   │
4. Se envolver banco → consulte TDD_DATABASE
   │
5. Implemente RED-GREEN-REFACTOR (Layer 1 → 2 → 3 → 4)
   │
6. Antes do PR → consulte TDD_QA → garanta que passa G0-G4
   │
7. CI roda G0-G6 automaticamente
   │
8. G7 = review humano → deploy
```

---

## Checklist Rapido Pre-PR

- [ ] Testes comecam no Layer 1 (domain puro)?
- [ ] `makeSut()` + AAA em todos os testes?
- [ ] Arquivos nomeados `*.spec.ts`?
- [ ] Coverage >= 80%?
- [ ] Isolamento multi-tenant testado (se envolveu dados)?
- [ ] RLS policy testada (se criou/alterou tabela)?
- [ ] Mock strategy correta (spy → MSW → real)?
- [ ] Nenhum `.only` ou `.skip` esquecido?
- [ ] `biome check` + `tsc --noEmit` passando?
