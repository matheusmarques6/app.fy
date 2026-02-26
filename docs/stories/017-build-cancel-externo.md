# Story 017: Build Cancel Externo (Codemagic)

**Fase:** 4 — Fluxo Operacional
**Tamanho:** P
**Agentes:** @dev
**Dependência:** Nenhuma
**Status:** ⬜ pending

---

## Descrição
Como desenvolvedor, quero que ao cancelar um build no console, o Codemagic seja notificado para parar o build em andamento, para que não sejam consumidos créditos desnecessariamente.

## Acceptance Criteria
- [ ] AC1: `DELETE /v1/builds/:id` cancela o job local E chama API do Codemagic para cancelar
- [ ] AC2: Se build já completou no Codemagic, cancela apenas localmente sem erro
- [ ] AC3: Status do build atualiza para `cancelled`
- [ ] AC4: Erro na API do Codemagic é logado mas não impede o cancelamento local

## Tasks
- [ ] Task 1: Implementar `codemagic.service.ts` método `cancelBuild(externalBuildId)`
- [ ] Task 2: Remover TODO em `builds.service.ts:294` e implementar chamada ao Codemagic
- [ ] Task 3: Tratar caso onde `external_build_id` é null (build ainda não iniciou no Codemagic)
- [ ] Task 4: Adicionar `CODEMAGIC_API_TOKEN` ao `.env.example`

## Definição de Pronto
- [ ] Cancel notifica Codemagic
- [ ] Falha no Codemagic não quebra o cancel local
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/modules/builds/builds.service.ts`
- `apps/api/src/modules/builds/codemagic.service.ts` (novo ou existente)
- `.env.example`
