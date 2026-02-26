# Story 009: Campaigns CRUD Completo no Console

**Fase:** 3 — CRUD Completo
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 003 (auth) + Story 001 (DB)
**Status:** ⬜ pending

---

## Descrição
Como gestor de marketing, quero criar, editar e excluir campanhas de push notification pelo console, para que eu possa gerenciar comunicações com meus clientes.

## Acceptance Criteria
- [ ] AC1: Botão "New Campaign" abre modal/página com formulário de criação
- [ ] AC2: Formulário: nome, descrição, template de push (título + corpo), segmento alvo (opcional), data de agendamento
- [ ] AC3: Campanha criada aparece na listagem imediatamente
- [ ] AC4: Clicar em campanha existente abre modo de edição
- [ ] AC5: Botão de delete com confirmação ("Tem certeza?") funciona
- [ ] AC6: Campanha no status `draft` pode ser editada; `sent` é somente leitura
- [ ] AC7: Validação: título obrigatório, corpo obrigatório
- [ ] AC8: Toast de sucesso/erro após cada operação (criar, editar, deletar)

## Tasks
- [ ] Task 1: Criar componente `CampaignForm` reutilizável (criar e editar)
- [ ] Task 2: Implementar modal de criação em `campaigns/page.tsx`
- [ ] Task 3: Implementar edição inline/modal ao clicar na campanha
- [ ] Task 4: Implementar botão de delete com dialog de confirmação
- [ ] Task 5: Integrar `campaignsApi.create()`, `campaignsApi.update()`, `campaignsApi.delete()` do api-client
- [ ] Task 6: Adicionar Toast component (criar utilitário simples ou instalar `sonner`)
- [ ] Task 7: Testar fluxo completo: criar → editar → enviar → deletar

## Definição de Pronto
- [ ] Código implementado
- [ ] CRUD completo funcionando end-to-end
- [ ] Validações funcionando
- [ ] Toast notifications exibidos
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/app/(dashboard)/stores/[storeId]/campaigns/page.tsx`
- `apps/console/src/components/` (novos: CampaignForm, DeleteConfirm, Toast)
- `apps/console/src/lib/api-client.ts` (verificar métodos de campaigns)
- `apps/console/package.json` (adicionar `sonner` se usar)
