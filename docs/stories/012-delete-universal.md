# Story 012: Delete Universal — Confirmação e API

**Fase:** 3 — CRUD Completo
**Tamanho:** P
**Agentes:** @dev
**Dependência:** Stories 009, 010, 011
**Status:** ⬜ pending

---

## Descrição
Como usuário do console, quero poder excluir recursos (campaigns, segments, automations) com uma confirmação visual, para que eu não delete acidentalmente dados importantes.

## Acceptance Criteria
- [ ] AC1: Componente `DeleteConfirmDialog` reutilizável criado
- [ ] AC2: Dialog mostra o nome do item a ser deletado
- [ ] AC3: Botão "Cancelar" fecha dialog sem ação
- [ ] AC4: Botão "Deletar" vermelho chama API e remove o item da listagem
- [ ] AC5: Loading spinner no botão durante chamada à API
- [ ] AC6: Toast de sucesso após delete bem-sucedido
- [ ] AC7: Toast de erro se API retornar falha

## Tasks
- [ ] Task 1: Criar `apps/console/src/components/delete-confirm-dialog.tsx`
- [ ] Task 2: Integrar em campaigns, segments e automations pages
- [ ] Task 3: Garantir que item é removido do estado local após delete (sem refetch)

## Definição de Pronto
- [ ] Componente criado e integrado nas 3 entidades
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/components/delete-confirm-dialog.tsx` (novo)
- `apps/console/src/app/(dashboard)/stores/[storeId]/campaigns/page.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/segments/page.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/automations/page.tsx`
