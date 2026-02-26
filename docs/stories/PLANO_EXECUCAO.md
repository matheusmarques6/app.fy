# Plano de Execução: AppFy — Jornada Completa do Cliente + Migração Vercel/Supabase

**Data:** 2026-02-25
**Objetivo:** Tornar o AppFy funcional de ponta a ponta (registro → app publicado → push funcionando) com infraestrutura Vercel + Supabase.

---

## Visão Geral

O AppFy tem uma arquitetura sólida mas com fluxos quebrados. A jornada do cliente (onboarding → configuração → operação) não funciona de ponta a ponta. Paralelamente, a infraestrutura será migrada para Vercel + Supabase para simplificar operação e reduzir custos.

## Tamanhos

- **P** = 1 sessão (< 2h de dev)
- **M** = 2 sessões (2–4h de dev)
- **G** = 3+ sessões (> 4h de dev, considerar quebrar)

---

## FASE 1 — Foundation: Migração Vercel + Supabase

> **Objetivo:** Substituir PostgreSQL local + MinIO + custom auth por Supabase. Console continua no Vercel.
> **Agentes:** @architect → @devops → @dev
> **Duração estimada:** 3-4 stories

### Stories da Fase 1

- **Story 001** (M): Setup Supabase — criar projeto, migrar schema Prisma, configurar DATABASE_URL
- **Story 002** (M): Migrar Storage — substituir MinIO/S3 por Supabase Storage (ícones, splash, build artifacts)
- **Story 003** (G): Migrar Auth Console — substituir NextAuth + JWT custom por Supabase Auth (console users apenas)
- **Story 004** (P): Setup Vercel — configurar variáveis de ambiente, domínios, pipeline CI/CD console + API

---

## FASE 2 — Onboarding Funcional

> **Objetivo:** Usuário consegue se registrar, criar uma store e conectar Shopify/WooCommerce com sync real de dados.
> **Agentes:** @dev → @qa
> **Dependência:** Fase 1

### Stories da Fase 2

- **Story 005** (M): Página `/stores/new` funcional — formulário de criação de store com validação e redirect pós-criação
- **Story 006** (P): Email service — integrar Resend para verificação de conta e reset de senha
- **Story 007** (G): Shopify sync real — implementar sync de produtos e orders após OAuth (product table + workers)
- **Story 008** (M): WooCommerce sync real — implementar sync de produtos e orders via API keys

---

## FASE 3 — CRUD Completo no Console

> **Objetivo:** Todos os botões "New" funcionam. Usuário consegue criar, editar e deletar campanhas, segmentos e automações.
> **Agentes:** @dev → @qa
> **Dependência:** Fase 1 (auth e API)

### Stories da Fase 3

- **Story 009** (M): Campaigns CRUD — modal/página de criação, edição inline, delete com confirmação
- **Story 010** (M): Segments CRUD — DSL builder visual, preview de membros, create/edit/delete
- **Story 011** (M): Automations CRUD — criar automation com trigger + action, toggle ativo/pausado
- **Story 012** (P): Delete universal — implementar delete em campaigns, segments, automations, templates
- **Story 013** (P): Settings salvam — OneSignal config e webhook secret realmente persistem na API

---

## FASE 4 — Fluxo Operacional Funcionando

> **Objetivo:** Push notifications chegam nos devices. Analytics mostram dados reais. Filas funcionam.
> **Agentes:** @dev → @qa
> **Dependência:** Fase 2 + Fase 3

### Stories da Fase 4

- **Story 014** (P): Fix campaign queue mismatch — corrigir CAMPAIGN_SCHEDULER vs CAMPAIGN_SEND (bug crítico)
- **Story 015** (M): Segment initial population — ao criar segmento, popular membros imediatamente (código comentado)
- **Story 016** (M): Order attribution — implementar cálculo de attribution quando order chega via webhook
- **Story 017** (P): Build cancel externo — notificar Codemagic ao cancelar build no console
- **Story 018** (M): Upstash Redis — migrar BullMQ de Redis local para Upstash (compatível com Vercel serverless)

---

## FASE 5 — Qualidade & Observabilidade

> **Objetivo:** Logs estruturados, testes E2E do fluxo principal, dashboard de saúde.
> **Agentes:** @qa → @dev
> **Dependência:** Fases 1-4

### Stories da Fase 5

- **Story 019** (M): Structured logging — request_id, store_id, device_id em todos os logs (Winston/Pino)
- **Story 020** (G): Testes E2E fluxo principal — registro → criar store → conectar Shopify → criar campanha → enviar push
- **Story 021** (M): Toast notifications no console — substituir error cards por toasts (sucesso + erro)
- **Story 022** (P): Search debounce — debounce 300ms em todas as buscas do console
- **Story 023** (M): Request caching — SWR ou React Query no console para evitar refetch desnecessário

---

## Ordem de Execução Recomendada

```
Fase 1 (001→002→003→004)
    ↓
Fase 2 (005→006→007→008)     +     Fase 3 (009→010→011→012→013)  [paralelo]
    ↓                                        ↓
Fase 4 (014→015→016→017→018)
    ↓
Fase 5 (019→020→021→022→023)
```

> Fase 2 e Fase 3 podem rodar em paralelo após Fase 1 estar concluída.

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Supabase Auth incompatível com device JWT | Alta | Alto | Manter JWT custom para devices, Supabase Auth apenas para console |
| BullMQ não funciona em Vercel serverless | Alta | Alto | Migrar para Upstash + QStash (Story 018) antes de subir workers |
| Shopify sync demora (rate limits) | Média | Médio | Implementar com paginação + backoff, Story 007 |
| Prisma + Supabase pooling | Média | Médio | Usar pgBouncer URL do Supabase para conexões serverless |
| Schema migration com dados existentes | Baixa | Alto | Sempre testar migrations em branch separado antes de produção |

---

## Tracking de Progresso

| Story | Título | Fase | Tamanho | Status |
|-------|--------|------|---------|--------|
| 001 | Setup Supabase | 1 | M | ⬜ pending |
| 002 | Migrar Storage | 1 | M | ⬜ pending |
| 003 | Migrar Auth Console | 1 | G | ⬜ pending |
| 004 | Setup Vercel | 1 | P | ⬜ pending |
| 005 | Página stores/new | 2 | M | ⬜ pending |
| 006 | Email service | 2 | P | ⬜ pending |
| 007 | Shopify sync real | 2 | G | ⬜ pending |
| 008 | WooCommerce sync | 2 | M | ⬜ pending |
| 009 | Campaigns CRUD | 3 | M | ⬜ pending |
| 010 | Segments CRUD | 3 | M | ⬜ pending |
| 011 | Automations CRUD | 3 | M | ⬜ pending |
| 012 | Delete universal | 3 | P | ⬜ pending |
| 013 | Settings salvam | 3 | P | ⬜ pending |
| 014 | Fix campaign queue | 4 | P | ⬜ pending |
| 015 | Segment population | 4 | M | ⬜ pending |
| 016 | Order attribution | 4 | M | ⬜ pending |
| 017 | Build cancel externo | 4 | P | ⬜ pending |
| 018 | Upstash Redis | 4 | M | ⬜ pending |
| 019 | Structured logging | 5 | M | ⬜ pending |
| 020 | Testes E2E | 5 | G | ⬜ pending |
| 021 | Toast notifications | 5 | M | ⬜ pending |
| 022 | Search debounce | 5 | P | ⬜ pending |
| 023 | Request caching | 5 | M | ⬜ pending |
