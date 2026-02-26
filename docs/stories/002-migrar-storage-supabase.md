# Story 002: Migrar Storage para Supabase Storage

**Fase:** 1 — Foundation
**Tamanho:** M
**Agentes:** @dev
**Dependência:** Story 001
**Status:** ⬜ pending

---

## Descrição
Como desenvolvedor, quero substituir o MinIO/S3 local pelo Supabase Storage, para que uploads de ícones, splash screens e artifacts de build funcionem sem precisar manter MinIO em Docker.

## Acceptance Criteria
- [ ] AC1: Buckets criados no Supabase: `appfy-assets` (público) e `appfy-logs` (privado)
- [ ] AC2: `StorageService` adaptado para usar Supabase Storage SDK
- [ ] AC3: Upload de ícone do app funciona (endpoint `/assets/icon`)
- [ ] AC4: Upload de splash screen funciona (endpoint `/assets/splash`)
- [ ] AC5: URLs públicas de assets são válidas e acessíveis
- [ ] AC6: Signed URLs para assets privados funcionam com expiração

## Tasks
- [ ] Task 1: Criar buckets `appfy-assets` (public) e `appfy-logs` (private) no Supabase
- [ ] Task 2: Instalar `@supabase/storage-js` no pacote da API
- [ ] Task 3: Refatorar `apps/api/src/common/storage/storage.service.ts` para Supabase Storage
- [ ] Task 4: Manter interface pública do `StorageService` idêntica (upload, getUrl, getSignedUrl, delete)
- [ ] Task 5: Atualizar variáveis de env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Task 6: Remover dependência `@aws-sdk/client-s3` se não usada em outro lugar
- [ ] Task 7: Testar upload e acesso público no ambiente de dev

## Definição de Pronto
- [ ] Código implementado
- [ ] Upload de ícone e splash funcionando end-to-end
- [ ] Sem referências a S3_ENDPOINT/S3_BUCKET em código (apenas em .env.example como legado)
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/common/storage/storage.service.ts`
- `apps/api/src/common/storage/storage.module.ts`
- `.env.example`
- `apps/api/package.json`

## Notas
- Supabase Storage é S3-compatible — pode usar AWS SDK v3 com endpoint customizado como alternativa
- Buckets públicos no Supabase não precisam de signed URLs
- Limite de tamanho: 50MB por arquivo no plano free do Supabase
