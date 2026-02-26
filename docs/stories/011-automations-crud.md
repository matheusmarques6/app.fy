# Story 011: Automations CRUD Completo no Console

**Fase:** 3 — CRUD Completo
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 003 (auth)
**Status:** ⬜ pending

---

## Descrição
Como gestor de marketing, quero criar automações de push notification baseadas em eventos, para que clientes recebam mensagens relevantes automaticamente (ex: abandono de carrinho, primeira compra).

## Acceptance Criteria
- [ ] AC1: Botão "New Automation" abre formulário com: nome, evento gatilho, ação de push
- [ ] AC2: Formulário MVP (simplificado): trigger (evento) + delay (opcional) + push template
- [ ] AC3: Automation criada aparece na listagem com status "draft"
- [ ] AC4: Toggle ativo/pausado funciona
- [ ] AC5: Edição de automation existente funciona
- [ ] AC6: Delete com confirmação funciona
- [ ] AC7: Listagem mostra stats básicas: runs totais, pushes enviados

## Tasks
- [ ] Task 1: Criar formulário simplificado de automation (trigger + delay + push)
- [ ] Task 2: Integrar `automationsApi.create()`, `update()`, `delete()`, `toggle()`
- [ ] Task 3: Exibir stats de runs na listagem
- [ ] Task 4: Garantir que toggle ativo/pausado atualiza status imediatamente na UI
- [ ] Task 5: Testar criação → ativar → verificar runs

## Definição de Pronto
- [ ] CRUD completo funcionando
- [ ] Toggle ativo/pausado funcional
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/app/(dashboard)/stores/[storeId]/automations/page.tsx`
- `apps/console/src/components/` (novo: AutomationForm)
- `apps/console/src/lib/api-client.ts`
