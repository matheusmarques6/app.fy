# Story 001: Setup Supabase

**Fase:** 1 — Foundation
**Tamanho:** M
**Agentes:** @devops → @dev
**Status:** ⬜ pending

---

## Descrição
Como desenvolvedor, quero migrar o banco de dados de PostgreSQL local (Docker) para Supabase, para que o projeto rode em infraestrutura gerenciada sem precisar manter Docker em produção.

## Acceptance Criteria
- [ ] AC1: Projeto Supabase criado e DATABASE_URL configurada no `.env`
- [ ] AC2: Schema Prisma migrado com sucesso (`prisma migrate deploy`) no Supabase
- [ ] AC3: `prisma db push` funcionando no ambiente local apontando para Supabase
- [ ] AC4: Variável `DATABASE_URL` usa a connection string com pgBouncer (Supabase pooled) para serverless
- [ ] AC5: Variável `DIRECT_URL` configurada no Prisma para migrations diretas
- [ ] AC6: Docker Compose mantém PostgreSQL local apenas para desenvolvimento offline

## Tasks
- [ ] Task 1: Criar projeto no Supabase (região `sa-east-1` — São Paulo)
- [ ] Task 2: Atualizar `prisma/schema.prisma` com `directUrl = env("DIRECT_URL")`
- [ ] Task 3: Executar `prisma migrate deploy` contra o Supabase
- [ ] Task 4: Atualizar `.env.example` com novas variáveis Supabase
- [ ] Task 5: Testar conexão local → Supabase com `prisma db studio`
- [ ] Task 6: Documentar as 2 URLs (pooled vs direct) no README

## Definição de Pronto
- [ ] Código implementado
- [ ] `npx prisma db push` executa sem erros contra Supabase
- [ ] Lint/typecheck ok
- [ ] `.env.example` atualizado

## Arquivos a Modificar
- `apps/api/prisma/schema.prisma`
- `.env.example`
- `docker-compose.yml` (comentar postgres se usar Supabase)

## Notas
- Supabase usa pgBouncer por padrão na connection string pooled — Prisma precisa de `?pgbouncer=true` no DATABASE_URL
- DIRECT_URL não usa pgBouncer — necessária para migrations
- Região recomendada: `sa-east-1` (São Paulo) para latência BR
