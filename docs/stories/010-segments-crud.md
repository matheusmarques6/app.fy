# Story 010: Segments CRUD Completo no Console

**Fase:** 3 — CRUD Completo
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 003 (auth)
**Status:** ⬜ pending

---

## Descrição
Como gestor de marketing, quero criar e gerenciar segmentos de audiência, para que eu possa enviar campanhas para grupos específicos de clientes.

## Acceptance Criteria
- [ ] AC1: Botão "New Segment" abre formulário com campos: nome, descrição, regras DSL
- [ ] AC2: Builder de regras visual com pelo menos: plataforma (ios/android), has_purchased (sim/não), última visita (< N dias), valor gasto (> R$ X)
- [ ] AC3: Preview de contagem de membros estimada ao montar as regras
- [ ] AC4: Segmento criado aparece na listagem com contagem de membros
- [ ] AC5: Edição de segmento existente funciona
- [ ] AC6: Delete com confirmação funciona
- [ ] AC7: Toast de sucesso/erro após operações

## Tasks
- [ ] Task 1: Criar componente `SegmentRuleBuilder` — interface visual para DSL JSON
- [ ] Task 2: Implementar formulário de criação/edição de segmento
- [ ] Task 3: Integrar `segmentsApi.preview()` para estimar membros em tempo real
- [ ] Task 4: Integrar `segmentsApi.create()`, `update()`, `delete()`
- [ ] Task 5: Mostrar contagem de membros atualizada na listagem
- [ ] Task 6: Testar com regras combinadas (AND/OR)

## Definição de Pronto
- [ ] Builder de regras funcionando com pelo menos 4 tipos de regra
- [ ] Preview de membros funcional
- [ ] CRUD completo testado
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/app/(dashboard)/stores/[storeId]/segments/page.tsx`
- `apps/console/src/components/` (novo: SegmentRuleBuilder)
- `apps/console/src/lib/api-client.ts`
