# Story 011: Automations CRUD Completo no Console

**Fase:** 3 — CRUD Completo
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 003 (auth)
**Status:** ✅ passed

---

## Descrição
Como gestor de marketing, quero criar automações de push notification baseadas em eventos, para que clientes recebam mensagens relevantes automaticamente (ex: abandono de carrinho, primeira compra).

## Acceptance Criteria
- [x] AC1: Botão "New Automation" abre formulário com: nome, evento gatilho, ação de push
- [x] AC2: Formulário MVP (simplificado): trigger (evento) + delay (opcional) + push template
- [x] AC3: Automation criada aparece na listagem com status "draft"
- [x] AC4: Toggle ativo/pausado funciona
- [x] AC5: Edição de automation existente funciona
- [x] AC6: Delete com confirmação funciona
- [x] AC7: Listagem mostra stats básicas: runs totais, pushes enviados

## Tasks
- [x] Task 1: Criar formulário simplificado de automation (trigger + delay + push)
- [x] Task 2: Integrar `automationsApi.create()`, `update()`, `delete()`, `toggle()`
- [x] Task 3: Exibir stats de runs na listagem
- [x] Task 4: Garantir que toggle ativo/pausado atualiza status imediatamente na UI
- [x] Task 5: Testar criação → ativar → verificar runs

## Definição de Pronto
- [x] CRUD completo funcionando
- [x] Toggle ativo/pausado funcional
- [x] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/app/(dashboard)/stores/[storeId]/automations/page.tsx`
- `apps/console/src/components/` (novo: AutomationForm)
- `apps/console/src/lib/api-client.ts`
