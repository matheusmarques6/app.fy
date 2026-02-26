# Story 022: Search Debounce em Todas as Buscas

**Fase:** 5 — Qualidade & Observabilidade
**Tamanho:** P
**Agentes:** @dev
**Dependência:** Nenhuma
**Status:** ⬜ pending

---

## Descrição
Como usuário do console, quero que as buscas tenham debounce, para que a UI não faça uma chamada à API a cada tecla digitada.

## Acceptance Criteria
- [ ] AC1: Todas as buscas têm debounce de 300ms
- [ ] AC2: Busca em devices, campaigns, automations, segments, webhooks com debounce
- [ ] AC3: Indicador de loading durante debounce (opcional, mas nice-to-have)

## Tasks
- [ ] Task 1: Criar hook `useDebounce(value, delay)` em `apps/console/src/lib/hooks.ts`
- [ ] Task 2: Substituir `search` direto por `useDebounce(search, 300)` em todas as pages com busca
- [ ] Task 3: Garantir que useEffect depende do valor com debounce, não do valor raw

## Definição de Pronto
- [ ] Hook criado e integrado
- [ ] Buscas fazem API call apenas 300ms após parar de digitar
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/lib/hooks.ts` (novo arquivo)
- `apps/console/src/app/(dashboard)/stores/[storeId]/devices/page.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/campaigns/page.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/segments/page.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/automations/page.tsx`
- `apps/console/src/app/(dashboard)/stores/[storeId]/webhooks/page.tsx`
