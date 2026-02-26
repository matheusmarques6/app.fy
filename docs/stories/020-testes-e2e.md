# Story 020: Testes E2E do Fluxo Principal

**Fase:** 5 — Qualidade & Observabilidade
**Tamanho:** G
**Agentes:** @qa → @dev
**Dependência:** Fases 1-4 completas
**Status:** ⬜ pending

---

## Descrição
Como desenvolvedor, quero testes E2E automatizados cobrindo o fluxo principal do cliente, para que regressões sejam detectadas automaticamente antes de chegar em produção.

## Acceptance Criteria
- [ ] AC1: Teste: registro → login → criar store → ver dashboard
- [ ] AC2: Teste: conectar Shopify (mock) → ver status "active"
- [ ] AC3: Teste: criar campanha → agendar → verificar status "scheduled"
- [ ] AC4: Teste: criar segmento → verificar population → criar campanha para segmento
- [ ] AC5: Teste: device se registra → recebe push → evento tracked → aparece em analytics
- [ ] AC6: Testes rodam em CI (GitHub Actions) a cada PR
- [ ] AC7: Testes usam banco de dados isolado (test schema no Supabase)

## Tasks
- [ ] Task 1: Configurar Playwright para o console (Next.js E2E)
- [ ] Task 2: Configurar Jest + Supertest para API (integration tests)
- [ ] Task 3: Criar test database isolado (Supabase branch ou schema separado)
- [ ] Task 4: Implementar 5 testes E2E listados nos ACs
- [ ] Task 5: Criar fixtures: usuário de teste, store de teste, dados mockados
- [ ] Task 6: Configurar GitHub Actions para rodar testes a cada PR
- [ ] Task 7: Configurar Shopify mock server para testes sem conta real

## Definição de Pronto
- [ ] 5 fluxos E2E passando
- [ ] Rodando no CI
- [ ] < 5 minutos de duração total
- [ ] Lint/typecheck ok

## Arquivos a Modificar/Criar
- `apps/console/e2e/` (Playwright tests)
- `apps/api/test/` (Jest integration tests)
- `.github/workflows/e2e.yml`
- `package.json` (scripts de teste)
