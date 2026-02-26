# Story 019: Structured Logging

**Fase:** 5 — Qualidade & Observabilidade
**Tamanho:** M
**Agentes:** @dev
**Dependência:** Fases 1-4
**Status:** ⬜ pending

---

## Descrição
Como engenheiro de operações, quero logs estruturados com contexto de request_id, store_id e device_id, para que eu possa rastrear problemas em produção rapidamente.

## Acceptance Criteria
- [ ] AC1: Todo log de requisição inclui: `request_id`, `store_id`, `method`, `path`, `status_code`, `duration_ms`
- [ ] AC2: Logs de workers incluem: `job_id`, `queue`, `store_id`, `attempt`
- [ ] AC3: Logs em formato JSON no ambiente de produção
- [ ] AC4: Logs legíveis (pretty) no ambiente de desenvolvimento
- [ ] AC5: Erros incluem stack trace em dev, apenas mensagem em prod
- [ ] AC6: `console.log` substituídos por logger estruturado em todo o código da API

## Tasks
- [ ] Task 1: Instalar `winston` ou `pino` na API
- [ ] Task 2: Criar `LoggerModule` global com configuração por ambiente
- [ ] Task 3: Criar `LoggingInterceptor` que adiciona request_id e mede duração
- [ ] Task 4: Injetar logger nos services principais (auth, campaigns, push, webhooks)
- [ ] Task 5: Remover todos os `console.log` e substituir por `logger.log/warn/error`
- [ ] Task 6: Configurar log level via env var `LOG_LEVEL`

## Definição de Pronto
- [ ] Zero `console.log` em produção
- [ ] Todos os requests logados com contexto
- [ ] Logs de workers com contexto de job
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/common/logger/` (novo módulo)
- `apps/api/src/main.ts` (integrar logger)
- `apps/api/src/modules/**/*.service.ts` (substituir console.log)
- `.env.example` (LOG_LEVEL)
