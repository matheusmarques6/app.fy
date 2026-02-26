# Story 021: Toast Notifications no Console

**Fase:** 5 — Qualidade & Observabilidade
**Tamanho:** M
**Agentes:** @dev
**Dependência:** Stories 009-013
**Status:** ⬜ pending

---

## Descrição
Como usuário do console, quero ver feedback visual (toast) após cada ação, para que eu saiba se uma operação foi bem-sucedida ou falhou sem precisar olhar para cards de erro.

## Acceptance Criteria
- [ ] AC1: Toast verde de sucesso após: criar/editar/deletar qualquer recurso
- [ ] AC2: Toast vermelho de erro com mensagem específica após falhas de API
- [ ] AC3: Toast some automaticamente após 4 segundos
- [ ] AC4: Toasts empilham se múltiplas ações simultâneas
- [ ] AC5: Toast de sucesso após salvar settings
- [ ] AC6: Toast de erro para falhas de conexão

## Tasks
- [ ] Task 1: Instalar `sonner` (biblioteca de toast leve e bonita)
- [ ] Task 2: Adicionar `<Toaster />` ao layout principal do dashboard
- [ ] Task 3: Criar hook `useToast()` wrapper simples
- [ ] Task 4: Substituir todos os error cards inline por toasts nas pages
- [ ] Task 5: Adicionar toast de sucesso em todas as operações CRUD
- [ ] Task 6: Manter error cards apenas para erros de carregamento de página (não de formulário)

## Definição de Pronto
- [ ] Toasts aparecem em todas as operações CRUD
- [ ] Error cards removidos dos formulários
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/package.json` (+ sonner)
- `apps/console/src/app/(dashboard)/stores/[storeId]/layout.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/**/page.tsx` (todos)
