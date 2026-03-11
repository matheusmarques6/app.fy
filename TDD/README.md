# TDD — Documentacao AppFy

## Ordem de Leitura Recomendada

| # | Documento | Escopo | Quando Consultar |
|---|---|---|---|
| 1 | `GUIA_TDD.md` | Fundamentos RED-GREEN-REFACTOR, mentalidade, ciclo completo | Primeiro contato com TDD no projeto |
| 2 | `TDD_ARQUITETURA.md` | Piramide de testes (4 layers), DI sem container, mocking strategy, contract tests | Antes de criar qualquer teste |
| 3 | `TDD_DEV.md` | Specs por modulo (auth, notifications, push, billing, segments, analytics, A/B testing) | Ao implementar um modulo especifico |
| 4 | `TDD_QA.md` | Quality gates G0-G7, isolation suites, security tests, Stripe webhooks, frequency capping, LGPD | Ao validar qualidade ou seguranca |
| 5 | `TDD_DATABASE.md` | Schema, RLS policies, repositories, migrations, concurrency, RBAC matrix | Ao trabalhar com banco de dados |

## Documentos Relacionados (Core/)

| Documento | Relacao |
|---|---|
| `Core/CLAUDE.md` | Spec completa do projeto (fonte de verdade para arquitetura e regras de negocio) |
| `Core/PROTOCOLO_TDD.md` | Workflow diario do dev (ciclos, etapas, pipeline) |
| `Core/PROTOCOLO_CICD_QA.md` | Implementacao CI/CD dos quality gates (GitHub Actions) |
| `Core/PLANO_TESTES_PRE_MVP.md` | Cenarios de teste pre-lancamento |

## Convencoes

- **Naming:** `*.spec.ts` (nunca `*.test.ts`)
- **Pattern:** `makeSut()` + AAA (Arrange/Act/Assert)
- **DI:** `createDependencies(overrides)` — sem container, override parcial
- **Mocking:** Spies (unit) → MSW (integration) → Real services (E2E)
- **Cleanup:** TRUNCATE CASCADE no `beforeEach` para integration tests
- **Coverage minimo:** 80% global
- **Piramide:** 70% unit / 25% integration / 5% E2E

## Stack de Testes

- **Runner:** Vitest (projects: unit/integration/isolation)
- **HTTP:** `app.request()` (Hono test client)
- **Mocks HTTP:** MSW v2
- **DB:** testcontainers (CI) / docker-compose.test.yml (local)
- **Push:** OneSignal (MSW mock)
- **Billing:** stripe-mock (Docker)
- **Linter:** Biome (pre-commit G0)
