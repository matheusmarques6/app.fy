# Story 014: Fix Campaign Queue Mismatch (Bug Crítico)

**Fase:** 4 — Fluxo Operacional
**Tamanho:** P
**Agentes:** @dev → @qa
**Dependência:** Nenhuma (pode ser feita a qualquer momento)
**Status:** ⬜ pending

---

## Descrição
Como plataforma, preciso que campanhas agendadas sejam processadas corretamente, para que push notifications cheguem nos devices quando o usuário agenda uma campanha.

## Acceptance Criteria
- [ ] AC1: `campaigns.service.ts` e `campaign.processor.ts` usam o mesmo `QUEUE_NAMES` constant
- [ ] AC2: Ao chamar `POST /campaigns/:id/send`, job é adicionado na fila correta
- [ ] AC3: `campaign.processor.ts` processa o job e envia push para todos os devices do segmento
- [ ] AC4: Status da campanha muda para `sending` → `sent` após processamento
- [ ] AC5: Stats da campanha (`sent_count`, `failed_count`) atualizadas após envio

## Tasks
- [ ] Task 1: Identificar a discrepância entre `campaigns.service.ts` e `campaign.processor.ts`
- [ ] Task 2: Corrigir para usar `QUEUE_NAMES.CAMPAIGN_SEND` consistentemente
- [ ] Task 3: Garantir que `WorkersModule` registra a fila com o nome correto
- [ ] Task 4: Testar envio de campanha end-to-end: criar → agendar → enviar → verificar delivery

## Definição de Pronto
- [ ] Queue name consistente em todo o código
- [ ] Campanha enviada chega como push no device de teste
- [ ] Status atualizado corretamente
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/modules/campaigns/campaigns.service.ts`
- `apps/api/src/workers/processors/campaign.processor.ts`
- `apps/api/src/workers/workers.module.ts` (verificar registro da fila)
- `apps/api/src/common/constants/queue-names.ts` (verificar constantes)
