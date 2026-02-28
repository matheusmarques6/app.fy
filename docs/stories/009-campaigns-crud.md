# Story 009: Campaigns CRUD Completo no Console

**Fase:** 3 — CRUD Completo
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 003 (auth) + Story 001 (DB)
**Status:** ✅ passed

---

## Descrição
Como gestor de marketing, quero criar, editar e excluir campanhas de push notification pelo console, para que eu possa gerenciar comunicações com meus clientes.

## Acceptance Criteria
- [x] AC1: Botão "New Campaign" abre modal/página com formulário de criação
- [x] AC2: Formulário: nome, descrição, template de push (título + corpo), segmento alvo (opcional), data de agendamento
- [x] AC3: Campanha criada aparece na listagem imediatamente
- [x] AC4: Clicar em campanha existente abre modo de edição
- [x] AC5: Botão de delete com confirmação ("Tem certeza?") funciona
- [x] AC6: Campanha no status `draft` pode ser editada; `sent` é somente leitura
- [x] AC7: Validação: título obrigatório, corpo obrigatório
- [x] AC8: Toast de sucesso/erro após cada operação (criar, editar, deletar)

## Tasks
- [x] Task 1: Criar componente `CampaignForm` reutilizável (criar e editar)
- [x] Task 2: Implementar modal de criação em `campaigns/page.tsx`
- [x] Task 3: Implementar edição inline/modal ao clicar na campanha
- [x] Task 4: Implementar botão de delete com dialog de confirmação
- [x] Task 5: Integrar `campaignsApi.create()`, `campaignsApi.update()`, `campaignsApi.delete()` do api-client
- [x] Task 6: Adicionar Toast component (criar utilitário simples ou instalar `sonner`)
- [x] Task 7: Testar fluxo completo: criar → editar → enviar → deletar

## Definição de Pronto
- [x] Código implementado
- [x] CRUD completo funcionando end-to-end
- [x] Validações funcionando
- [x] Toast notifications exibidos
- [x] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/app/(dashboard)/stores/[storeId]/campaigns/page.tsx`
- `apps/console/src/components/` (novos: CampaignForm, DeleteConfirm, Toast)
- `apps/console/src/lib/api-client.ts` (verificar métodos de campaigns)
- `apps/console/package.json` (adicionar `sonner` se usar)
