# Story 008: WooCommerce Sync Real (Produtos + Orders)

**Fase:** 2 — Onboarding Funcional
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 007 (reutiliza model Product e padrão de sync)
**Status:** ⬜ pending

---

## Descrição
Como lojista com loja WooCommerce, quero que meus produtos e pedidos sejam sincronizados com o AppFy, para que eu tenha as mesmas funcionalidades disponíveis para usuários Shopify.

## Acceptance Criteria
- [ ] AC1: Após configuração de API keys do WooCommerce, sync inicial de produtos executado em background
- [ ] AC2: Webhook `woocommerce_order_created` processa novo pedido
- [ ] AC3: Webhook `woocommerce_product_updated` atualiza produto local
- [ ] AC4: Reutiliza model `Product` criado na Story 007
- [ ] AC5: Sync respeita limitações da API WooCommerce REST
- [ ] AC6: Status da integração atualizado: `pending → syncing → active`

## Tasks
- [ ] Task 1: Implementar `woocommerce.service.ts` método `initialSync(storeId)`
- [ ] Task 2: Desfazer comentário e implementar `// TODO: Implement product sync` (woocommerce.service.ts)
- [ ] Task 3: Implementar webhook handler para `order.created` e `product.updated`
- [ ] Task 4: Adaptar customer linking para IDs do WooCommerce
- [ ] Task 5: Testar com ambiente WooCommerce local (ou mock)

## Definição de Pronto
- [ ] Código implementado
- [ ] Sync de produtos WooCommerce funcionando
- [ ] Webhooks processados
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/modules/integrations/services/woocommerce.service.ts`
- `apps/api/src/workers/processors/integrations.processor.ts`
