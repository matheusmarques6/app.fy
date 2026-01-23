# Runbook E2E Shopify

## 0) Pré-flight (Railway + Shopify Partners)

### Railway (env vars)

Confere que estão setadas no API e (quando necessário) nos Workers:

- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_REDIRECT_URI=https://<SUA_API>/v1/integrations/shopify/callback`
- `WEBHOOK_BASE_URL=https://<SUA_API>` (pra formar URLs públicas)
- DB/Redis/Encryption vars já ok

> **Dica prática:** o `SHOPIFY_REDIRECT_URI` tem que bater **exatamente** com o cadastrado no app da Shopify.

### Shopify Partners (app + dev store)

Você precisa de **1 dev store** e **1 app** no Partners (com o mesmo API_KEY/SECRET que está no Railway).

Configure no app:
- **App URL:** `https://<SUA_API>` (ou landing do seu sistema)
- **Allowed redirection URL(s):** exatamente `.../v1/integrations/shopify/callback`
- **Scopes mínimos para MVP:** `read_products`, `read_orders`, `read_customers` (e `write_*` só se realmente precisar)

---

## 1) Iniciar OAuth (Install)

Defina o base da API:

```bash
export API_BASE="https://<SUA_API_RAILWAY>"
export SHOP_DOMAIN="mystore.myshopify.com"
export HUMAN_TOKEN="eyJ..."   # se o endpoint exigir auth humano
```

Chame o install:

```bash
curl -i -X POST "$API_BASE/v1/integrations/shopify/install" \
  -H "Authorization: Bearer $HUMAN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"shop\":\"$SHOP_DOMAIN\"}"
```

**O esperado:**
- ou `302 Location: https://{shop}/admin/oauth/authorize?...`
- ou JSON com `redirectUrl`

Abra a URL no browser e finalize a instalação.

---

## 2) Confirmar status + pegar integrationId

```bash
curl -s "$API_BASE/v1/integrations/shopify/status" \
  -H "Authorization: Bearer $HUMAN_TOKEN" | jq .
```

Pegue o `integrationId` e exporte:

```bash
export INTEGRATION_ID="<uuid>"
```

✅ **Critério A:** `integration.status=connected` e logs indicando webhooks registrados (ou endpoint/flag equivalente).

---

## 3) Happy path — gerar webhooks reais

Na dev store (admin Shopify):
1. Criar produto
2. Atualizar produto
3. Criar pedido teste (qualquer checkout dev/test)

✅ **Critérios B/C:**
- no DB `webhook_events`: `received → processing → processed`
- produto e pedido aparecem com `external_id`

**SQL rápido:**

```sql
SELECT topic, status, count(*)
FROM webhook_events
WHERE integration_id = '<INTEGRATION_ID>'
GROUP BY 1, 2
ORDER BY 1, 2;
```

---

## 4) Dedupe (replay)

O jeito mais "realista" é reenviar o mesmo webhook com o mesmo `X-Shopify-Event-Id`.

Pra isso, pegue no log do seu servidor:
- `X-Shopify-Event-Id`
- `X-Shopify-Topic`
- body bruto (ou salve o payload que seu controller registrou)

Se você tiver o payload salvo em `payload.json`, você pode reenviar assim:

```bash
export EVENT_ID="<o mesmo do log>"
export TOPIC="products/update"

# Reenvio (usa o mesmo body e o mesmo Event-Id)
curl -i -X POST "$API_BASE/v1/integrations/shopify/webhooks/$INTEGRATION_ID" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: $TOPIC" \
  -H "X-Shopify-Shop-Domain: $SHOP_DOMAIN" \
  -H "X-Shopify-Event-Id: $EVENT_ID" \
  -H "X-Shopify-Triggered-At: 2024-01-15T10:30:00Z" \
  -H "X-Shopify-Hmac-Sha256: <HMAC_REAL_DO_PAYLOAD>" \
  --data-binary @payload.json
```

✅ **Critério D:**
- log `"ignoring/deduped"`
- não duplica WebhookEvent (UNIQUE segura)

### Gerar HMAC localmente (se não capturou o original)

```bash
export SHOPIFY_API_SECRET="xxx"  # só local
export HMAC=$(node -e "
  const fs=require('fs'); const crypto=require('crypto');
  const body=fs.readFileSync('payload.json');
  process.stdout.write(crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(body).digest('base64'));
")
echo "$HMAC"
```

---

## 5) Stale webhook (triggeredAt antigo)

Reenvie com `Triggered-At` antigo (HMAC é do body, então continua válido):

```bash
curl -i -X POST "$API_BASE/v1/integrations/shopify/webhooks/$INTEGRATION_ID" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: $TOPIC" \
  -H "X-Shopify-Shop-Domain: $SHOP_DOMAIN" \
  -H "X-Shopify-Event-Id: $(uuidgen)" \
  -H "X-Shopify-Triggered-At: 2020-01-01T00:00:00Z" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  --data-binary @payload.json
```

✅ **Critério E:**
- log warning `"stale webhook…"`
- processa normal (idempotência segura)

---

## 6) Uninstall

Na dev store: desinstale o app.

✅ **Critério F:**
- `integration.status=disconnected`
- automations paused
- campaigns canceladas

---

## Checklist de Aceite

| # | Teste | Critério | Pass |
|---|-------|----------|------|
| A | OAuth Install | `status=connected`, webhooks registrados | ☐ |
| B | Produto create/update | `received→processing→processed`, `external_id` no DB | ☐ |
| C | Pedido create | order no DB com `external_id` | ☐ |
| D | Dedupe replay | log "deduped", sem duplicata | ☐ |
| E | Stale webhook | log warning, processa normal | ☐ |
| F | Uninstall | `status=disconnected`, automations/campaigns paradas | ☐ |
