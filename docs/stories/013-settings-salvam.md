# Story 013: Settings que Realmente Salvam

**Fase:** 3 — CRUD Completo
**Tamanho:** P
**Agentes:** @dev → @qa
**Dependência:** Story 001 (DB), Story 003 (auth)
**Status:** ⬜ pending

---

## Descrição
Como administrador da store, quero que as configurações (OneSignal, webhook secret, informações gerais) sejam salvas quando clicar em "Salvar", para que as integrações funcionem corretamente.

## Acceptance Criteria
- [ ] AC1: Aba "General" — salva nome e domínio da store via `PUT /v1/stores/:id`
- [ ] AC2: Aba "Push" — salva OneSignal App ID e API Key via `PUT /v1/apps/:id/onesignal`
- [ ] AC3: Aba "Security" — salva webhook signing secret via `PUT /v1/stores/:id/settings`
- [ ] AC4: Toast de sucesso após salvar
- [ ] AC5: Campos preenchidos com valores atuais ao abrir a página (não em branco)
- [ ] AC6: Loader no botão "Save" durante chamada à API

## Tasks
- [ ] Task 1: Refatorar `settings/page.tsx` — conectar forms às APIs corretas
- [ ] Task 2: Popular campos com dados existentes via GET na montagem da página
- [ ] Task 3: Implementar `handleSaveGeneral()`, `handleSavePush()`, `handleSaveSecurity()`
- [ ] Task 4: Testar save de cada aba individualmente

## Definição de Pronto
- [ ] Todas as abas salvando via API
- [ ] Dados persistidos visíveis após reload da página
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/console/src/app/(dashboard)/stores/[storeId]/settings/page.tsx`
- `apps/console/src/lib/api-client.ts` (verificar endpoints de update)
