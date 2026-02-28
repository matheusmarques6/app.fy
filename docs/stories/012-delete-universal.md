# Story 012: Delete Universal — Confirmação e API

**Fase:** 3 — CRUD Completo
**Tamanho:** P
**Agentes:** @dev
**Dependência:** Stories 009, 010, 011
**Status:** ✅ passed

---

## Descrição
Como usuário do console, quero poder excluir recursos (campaigns, segments, automations) com uma confirmação visual, para que eu não delete acidentalmente dados importantes.

## Acceptance Criteria
- [x] AC1: Componente `DeleteConfirmDialog` reutilizável criado
- [x] AC2: Dialog mostra o nome do item a ser deletado
- [x] AC3: Botão "Cancelar" fecha dialog sem ação
- [x] AC4: Botão "Deletar" vermelho chama API e remove o item da listagem
- [x] AC5: Loading spinner no botão durante chamada à API
- [x] AC6: Toast de sucesso após delete bem-sucedido
- [x] AC7: Toast de erro se API retornar falha

## Tasks
- [x] Task 1: Criar `apps/console/src/components/delete-confirm-dialog.tsx`
- [x] Task 2: Integrar em campaigns, segments e automations pages
- [x] Task 3: Garantir que item é removido do estado local após delete (sem refetch)

## Definição de Pronto
- [x] Componente criado e integrado nas 3 entidades
- [x] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/components/delete-confirm-dialog.tsx` (novo)
- `apps/console/src/app/(dashboard)/stores/[storeId]/campaigns/page.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/segments/page.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/automations/page.tsx`
