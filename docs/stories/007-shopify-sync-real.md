# Story 007: Shopify Sync Real (Produtos + Orders)

**Fase:** 2 — Onboarding Funcional
**Tamanho:** G
**Agentes:** @architect → @dev → @qa
**Dependência:** Story 001 (DB)
**Status:** ⬜ pending

---

## Descrição
Como lojista, quero que meus produtos e pedidos do Shopify sejam sincronizados automaticamente com o AppFy após conectar a integração, para que eu possa segmentar clientes e criar campanhas baseadas em comportamento real de compra.

## Acceptance Criteria
- [ ] AC1: Após OAuth do Shopify concluído, produtos são sincronizados automaticamente (job em background)
- [ ] AC2: Tabela `products` criada no schema Prisma com campos: id, store_id, external_product_id, title, handle, status, price, image_url, tags, created_at
- [ ] AC3: Webhook `products/create` e `products/update` atualiza produto na tabela local
- [ ] AC4: Webhook `orders/create` cria Order na tabela local com customer linking
- [ ] AC5: Sync inicial respeita rate limit do Shopify (2 req/s)
- [ ] AC6: Progresso do sync inicial visível na UI (status da integração: syncing → active)
- [ ] AC7: Re-sync manual disponível via endpoint da API

## Tasks
- [ ] Task 1: Adicionar model `Product` no `schema.prisma`
- [ ] Task 2: Criar `ProductsModule` no NestJS com service de CRUD básico
- [ ] Task 3: Implementar `shopify.service.ts` método `initialSync(storeId)` com paginação GraphQL Admin API
- [ ] Task 4: Desfazer comentário e implementar `// TODO: Queue initial catalog sync job` (linha 187)
- [ ] Task 5: Implementar `// TODO: Implement product sync` (linha 648) no webhook handler
- [ ] Task 6: Implementar `// TODO: Implement product table and soft delete` (linha 644)
- [ ] Task 7: Implementar criação de Order + Customer linking no webhook `orders/create`
- [ ] Task 8: Atualizar status da Integration: `pending → syncing → active`
- [ ] Task 9: Expor status de sync na API para o console mostrar

## Definição de Pronto
- [ ] Código implementado
- [ ] `prisma migrate` com nova tabela Products aplicado
- [ ] Sync de produtos funciona em ambiente de dev (testado com loja Shopify de teste)
- [ ] Webhooks de orders e products processados corretamente
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/prisma/schema.prisma` (+ model Product)
- `apps/api/src/modules/integrations/services/shopify.service.ts`
- `apps/api/src/modules/integrations/integrations.module.ts`
- `apps/api/src/workers/processors/integrations.processor.ts`
- Novos arquivos: `modules/products/`

## Notas
- Shopify GraphQL Admin API tem rate limit de 2 req/s (REST) ou baseado em "cost" (GraphQL)
- Usar cursor-based pagination para sync inicial
- Soft delete: ao receber `products/delete` webhook, marcar status como `deleted` (não remover do DB)
- Considerar index em `products.external_product_id` para lookups rápidos via webhook
