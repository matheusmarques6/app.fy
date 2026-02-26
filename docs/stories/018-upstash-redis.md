# Story 018: Migrar BullMQ para Upstash Redis

**Fase:** 4 — Fluxo Operacional
**Tamanho:** M
**Agentes:** @devops → @dev
**Dependência:** Story 004 (Vercel setup)
**Status:** ⬜ pending

---

## Descrição
Como desenvolvedor, quero migrar o Redis local (Docker) para Upstash Redis, para que BullMQ funcione corretamente no ambiente serverless do Vercel e em produção sem precisar manter um servidor Redis.

## Acceptance Criteria
- [ ] AC1: BullMQ conecta ao Upstash Redis usando `REDIS_URL` do Upstash
- [ ] AC2: Todos os 8 workers funcionam com Upstash
- [ ] AC3: Rate limiting do RedisService funciona com Upstash
- [ ] AC4: Token denylist (invalidação de JWT) funciona com Upstash
- [ ] AC5: Conexão é resiliente a reconexões (Upstash tem timeouts mais curtos)

## Tasks
- [ ] Task 1: Criar conta/projeto no Upstash e obter REDIS_URL (TLS enabled)
- [ ] Task 2: Atualizar `REDIS_URL` no `.env` local e no Vercel para apontar para Upstash
- [ ] Task 3: Verificar configuração de TLS no `app.module.ts` — BullMQ precisará de `tls: {}` para Upstash
- [ ] Task 4: Testar todos os workers com Upstash
- [ ] Task 5: Remover serviço `redis` do `docker-compose.yml` (ou manter como fallback local)
- [ ] Task 6: Atualizar `.env.example` com formato da URL Upstash

## Definição de Pronto
- [ ] Todos os workers processando jobs via Upstash
- [ ] Rate limiting funcionando
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/app.module.ts` (BullMQ TLS config)
- `apps/api/src/common/redis/redis.service.ts` (TLS config)
- `.env.example`
- `docker-compose.yml`

## Notas
- Upstash free tier: 10.000 commands/dia — suficiente para desenvolvimento e piloto pequeno
- Upstash usa TLS por padrão: URL começa com `rediss://` (duplo s)
- BullMQ com Upstash: adicionar `enableOfflineQueue: false` para evitar acúmulo de comandos
