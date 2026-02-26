# Story 004: Setup Vercel — Pipeline CI/CD Console + API

**Fase:** 1 — Foundation
**Tamanho:** P
**Agentes:** @devops
**Dependência:** Stories 001, 002, 003
**Status:** ⬜ pending

---

## Descrição
Como desenvolvedor, quero configurar o deploy automático do console e da API no Vercel, para que cada push na branch `main` publique automaticamente em produção.

## Acceptance Criteria
- [ ] AC1: Console (Next.js) faz deploy automático no Vercel a partir da branch `main`
- [ ] AC2: API (NestJS) faz deploy automático no Vercel a partir da branch `main`
- [ ] AC3: Variáveis de ambiente do Supabase configuradas nos projetos Vercel
- [ ] AC4: Preview deployments funcionando para PRs
- [ ] AC5: `vercel.json` do console correto e funcional
- [ ] AC6: API NestJS adaptada para Vercel serverless (se necessário)

## Tasks
- [ ] Task 1: Criar projeto Vercel para `apps/console` (conectar ao repo GitHub)
- [ ] Task 2: Criar projeto Vercel para `apps/api` (ou verificar se nixpacks é melhor)
- [ ] Task 3: Configurar todas as env vars no Vercel Dashboard (Supabase URL, keys, etc.)
- [ ] Task 4: Verificar `vercel.json` raiz e `apps/console/vercel.json`
- [ ] Task 5: Testar deploy manual com `vercel --prod`
- [ ] Task 6: Configurar domínio customizado se disponível

## Definição de Pronto
- [ ] Console acessível via URL do Vercel
- [ ] API acessível via URL do Vercel
- [ ] Deploy automático funcionando ao push na `main`
- [ ] Variáveis de ambiente não expostas no código

## Arquivos a Modificar
- `vercel.json` (raiz)
- `apps/console/vercel.json`
- `.github/workflows/` (ajustar se necessário)

## Notas
- NestJS em Vercel serverless pode ter problemas com BullMQ (workers precisam de processo long-running)
- Considerar separar: console no Vercel, API no Railway/Render (suporta long-running processes)
- Upstash Redis (Story 018) é necessário antes de subir workers para Vercel
