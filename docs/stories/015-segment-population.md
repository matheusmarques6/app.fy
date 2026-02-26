# Story 015: Segment Initial Population

**Fase:** 4 — Fluxo Operacional
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 010 (segments CRUD)
**Status:** ⬜ pending

---

## Descrição
Como gestor de marketing, quero que ao criar um segmento, ele seja populado imediatamente com os devices que já atendem aos critérios, para que eu possa usar o segmento em campanhas sem esperar novos eventos.

## Acceptance Criteria
- [ ] AC1: Após `POST /segments`, job de `SEGMENT_FULL_REFRESH` é enfileirado automaticamente
- [ ] AC2: Job processa todos os devices da store e avalia se atendem aos critérios do segmento
- [ ] AC3: `member_count` do segmento é atualizado após o job concluir
- [ ] AC4: Segmentos existentes (criados antes desta fix) podem ser re-populados via endpoint `POST /segments/:id/refresh`
- [ ] AC5: Segmento com 0 membros é diferente de segmento "ainda sendo calculado" na UI

## Tasks
- [ ] Task 1: Descomentar linha em `segments.service.ts:77-79` que enfileira full refresh
- [ ] Task 2: Verificar que `SegmentProcessor` implementa `handleFullRefresh()` corretamente
- [ ] Task 3: Implementar endpoint `POST /v1/segments/:id/refresh` para refresh manual
- [ ] Task 4: Adicionar campo `last_evaluated_at` ao model `Segment` para rastrear quando foi calculado
- [ ] Task 5: UI: mostrar indicador "calculando..." quando segmento foi criado há < 1min e member_count = 0

## Definição de Pronto
- [ ] Segmento criado popula membros automaticamente
- [ ] Refresh manual funcionando
- [ ] UI diferencia "vazio" de "calculando"
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/modules/segments/segments.service.ts` (descomentar queue call)
- `apps/api/src/workers/processors/segment.processor.ts`
- `apps/api/prisma/schema.prisma` (+ last_evaluated_at)
- `apps/console/src/app/(dashboard)/stores/[storeId]/segments/page.tsx`
