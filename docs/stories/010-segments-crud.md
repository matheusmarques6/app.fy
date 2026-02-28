# Story 010: Segments CRUD Completo no Console

**Fase:** 3 — CRUD Completo
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 003 (auth)
**Status:** ✅ passed

---

## Descrição
Como gestor de marketing, quero criar e gerenciar segmentos de audiência, para que eu possa enviar campanhas para grupos específicos de clientes.

## Acceptance Criteria
- [x] AC1: Botão "New Segment" abre formulário com campos: nome, descrição, regras DSL
- [x] AC2: Builder de regras visual com pelo menos: plataforma (ios/android), has_purchased (sim/não), última visita (< N dias), valor gasto (> R$ X)
- [x] AC3: Preview de contagem de membros estimada ao montar as regras
- [x] AC4: Segmento criado aparece na listagem com contagem de membros
- [x] AC5: Edição de segmento existente funciona
- [x] AC6: Delete com confirmação funciona
- [x] AC7: Toast de sucesso/erro após operações

## Tasks
- [x] Task 1: Criar componente `SegmentRuleBuilder` — interface visual para DSL JSON
- [x] Task 2: Implementar formulário de criação/edição de segmento
- [x] Task 3: Integrar `segmentsApi.preview()` para estimar membros em tempo real
- [x] Task 4: Integrar `segmentsApi.create()`, `update()`, `delete()`
- [x] Task 5: Mostrar contagem de membros atualizada na listagem
- [x] Task 6: Testar com regras combinadas (AND/OR)

## Definição de Pronto
- [x] Builder de regras funcionando com pelo menos 4 tipos de regra
- [x] Preview de membros funcional
- [x] CRUD completo testado
- [x] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/app/(dashboard)/stores/[storeId]/segments/page.tsx`
- `apps/console/src/components/` (novo: SegmentRuleBuilder)
- `apps/console/src/lib/api-client.ts`
