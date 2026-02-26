# Story 005: Página /stores/new Funcional

**Fase:** 2 — Onboarding Funcional
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 003 (auth)
**Status:** ⬜ pending

---

## Descrição
Como novo usuário, quero criar minha primeira store pelo console, para que eu possa começar a configurar meu app mobile.

## Acceptance Criteria
- [ ] AC1: Formulário em `/stores/new` com campos: nome, slug (auto-gerado do nome), plataforma (shopify/woocommerce), domínio principal
- [ ] AC2: Validação client-side: nome obrigatório, slug único, domínio válido
- [ ] AC3: POST para API `POST /v1/stores` funciona e cria a store
- [ ] AC4: Após criar, redireciona para `/stores/[storeId]/dashboard`
- [ ] AC5: Erro de slug duplicado exibe mensagem clara para o usuário
- [ ] AC6: Botão "Criar Store" na listagem de stores (`/stores`) navega para `/stores/new`
- [ ] AC7: Store recém-criada aparece imediatamente na lista de stores

## Tasks
- [ ] Task 1: Implementar `apps/console/src/app/(auth)/stores/new/page.tsx` com formulário completo
- [ ] Task 2: Auto-gerar slug a partir do nome (lowercase, hifens, sem acentos)
- [ ] Task 3: Chamar `storesApi.create()` do `api-client.ts` no submit
- [ ] Task 4: Tratar erro 409 (slug duplicado) com mensagem específica
- [ ] Task 5: Adicionar loading state durante criação
- [ ] Task 6: Verificar e corrigir botão "New Store" em `/stores/page.tsx`

## Definição de Pronto
- [ ] Código implementado
- [ ] Fluxo completo testado: preencher form → criar → ver no dashboard
- [ ] Erro de slug duplicado tratado
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/app/(auth)/stores/new/page.tsx`
- `apps/console/src/app/(auth)/stores/page.tsx` (botão new)
- `apps/console/src/lib/api-client.ts` (verificar método create de stores)
