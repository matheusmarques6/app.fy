# Story 023: Request Caching com SWR

**Fase:** 5 — Qualidade & Observabilidade
**Tamanho:** M
**Agentes:** @dev
**Dependência:** Stories 009-013 (CRUD completo)
**Status:** ⬜ pending

---

## Descrição
Como usuário do console, quero que a navegação entre páginas seja instantânea quando os dados já foram carregados, para que a experiência seja fluida sem spinners constantes.

## Acceptance Criteria
- [ ] AC1: Instalar `swr` no console
- [ ] AC2: Dashboard usa SWR — navegar embora e voltar não refaz fetch se dados < 30s
- [ ] AC3: Listagem de campaigns, segments, devices usa SWR
- [ ] AC4: Mutações (create, update, delete) invalidam o cache SWR correspondente
- [ ] AC5: Revalidação automática ao focar a janela do browser

## Tasks
- [ ] Task 1: Instalar `swr` em `apps/console`
- [ ] Task 2: Criar hooks customizados: `useCampaigns()`, `useDevices()`, `useAnalytics()`
- [ ] Task 3: Migrar `useEffect + fetch` das páginas principais para hooks SWR
- [ ] Task 4: Implementar `mutate()` após operações de CRUD para invalidar cache
- [ ] Task 5: Configurar `SWRConfig` global com `revalidateOnFocus: true`

## Definição de Pronto
- [ ] Páginas principais usando SWR
- [ ] Navegação entre pages reutiliza cache
- [ ] CRUD invalida cache corretamente
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/package.json` (+ swr)
- `apps/console/src/lib/hooks/` (novos hooks SWR)
- `apps/console/src/app/(dashboard)/stores/[storeId]/**/page.tsx` (principais)
- `apps/console/src/components/providers.tsx` (SWRConfig global)
