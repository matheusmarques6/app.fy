# Story 016: Order Attribution

**Fase:** 4 — Fluxo Operacional
**Tamanho:** M
**Agentes:** @dev → @qa
**Dependência:** Story 007 (Shopify sync), Story 014 (campaign queue fix)
**Status:** ⬜ pending

---

## Descrição
Como gestor de marketing, quero ver quais campanhas e automações geraram vendas, para que eu possa avaliar o ROI das minhas ações de marketing.

## Acceptance Criteria
- [ ] AC1: Quando um order chega via webhook, o sistema busca deliveries recentes do device/customer (janela de 48h)
- [ ] AC2: `Attribution` record criado com modelo `last_click` por padrão
- [ ] AC3: Analytics de revenue mostra `attributed_revenue` vs `total_revenue` corretamente
- [ ] AC4: Campanha com pelo menos 1 atribuição mostra `attributed_orders` no leaderboard
- [ ] AC5: Modelo de atribuição configurável por store (last_click, view_through)

## Tasks
- [ ] Task 1: Implementar `calculateAttribution(orderId, storeId)` no events/order processor
- [ ] Task 2: Ao receber `orders/create` webhook, chamar attribution calculation
- [ ] Task 3: Buscar deliveries recentes: `WHERE device_id = :deviceId AND status IN ('delivered', 'opened', 'clicked') AND sent_at > NOW() - INTERVAL '48 hours'`
- [ ] Task 4: Criar `Attribution` record vinculando order → campaign/automation
- [ ] Task 5: Atualizar query de analytics para incluir attributed_revenue
- [ ] Task 6: Testar com sequência: enviar push → clicar → realizar pedido → ver attribution

## Definição de Pronto
- [ ] Attribution criada ao receber order de device que recebeu push recentemente
- [ ] Analytics de revenue mostra dados de attribution
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/workers/processors/integrations.processor.ts`
- `apps/api/src/modules/analytics/analytics.service.ts`
- Novo: `apps/api/src/modules/attribution/attribution.service.ts`
