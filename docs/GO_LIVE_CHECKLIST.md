# AppFy — GO LIVE CHECKLIST (Piloto + Publicação)
Versão: v1.0
Objetivo: checklist único (Definition of Done real) para **colocar 1 lojista piloto em produção** e **publicar o primeiro app** (App Store / Play) no mesmo trilho.

> Regra de ouro: **Piloto = distribuição controlada (TestFlight / Internal Testing)**.
> **Publicação = release para loja**. O mesmo app pode passar por ambos, sem retrabalho.

---

## 0) Papéis e responsabilidades (RACI)
Legenda: **R**=Responsável (faz), **A**=Aprova (decide), **C**=Consultado, **I**=Informado

| Entrega | Dev (Backend/Mobile/Front) | DevOps | PM/Operações | Segurança/Compliance |
|---|---|---|---|---|
| E2E Shopify/Woo (runbook + execução) | R | C | A | C |
| Observabilidade (logs/métricas/alertas) | C | R | I | C |
| DLQ + Reprocessamento | R | C | A | C |
| CI/CD build/publish (Fastlane + Actions) | C | R | I | C |
| Metadados Store (screenshots, descrição, review notes) | C | I | R/A | C |
| Privacy/Data Safety (Apple/Google) | C | I | R/A | R |
| Go/No-Go Piloto | I | C | R/A | C |
| Go/No-Go Publicação | I | C | R/A | R |

---

## 1) Ambientes e domínios (pré-requisito)
### 1.1 Ambientes mínimos
- [ ] **STAGING**: API + Workers + DB + Redis + Storage
- [ ] **PROD**: API + Workers + DB + Redis + Storage
- [ ] **Console**: pode rodar no Railway (temporário) ou Vercel (final)

### 1.2 Domínios recomendados
- [ ] `api.<dominio>` — Core API
- [ ] `console.<dominio>` — Console
- [ ] (opcional) `rc.<dominio>` — Remote Config (ou path `/v1/remote-config`)
- [ ] (opcional) `webhooks.<dominio>` — Webhooks (ou path `/v1/integrations/.../webhooks/...`)

### 1.3 SSL/HTTPS
- [ ] HTTPS válido em todos os endpoints públicos (OAuth/Webhooks/RC)

---

## 2) Secrets e variáveis obrigatórias (DoD de infraestrutura)
> **Nunca** armazenar plaintext de chaves/tokens no DB. Usar `secret_ref`/KMS/Vault quando aplicável.

### 2.1 Core API + Workers (PROD)
**Banco/Redis/Filas**
- [ ] `DATABASE_URL`
- [ ] `REDIS_URL` (ou `REDIS_HOST/PORT/PASSWORD`)
- [ ] `NODE_ENV=production`

**JWT / Auth**
- [ ] `JWT_ISS`
- [ ] `JWT_AUD_HUMAN` (Console)
- [ ] `JWT_AUD_DEVICE` (Mobile)
- [ ] `JWT_SECRET` **ou** par de chaves assimétricas (preferível)
- [ ] (se houver) `REFRESH_TOKEN_SECRET` / parâmetros de rotação

**Criptografia/PII**
- [ ] `ENCRYPTION_SECRET` (32 bytes reais; ideal base64 de 32 bytes randômicos)
- [ ] `EMAIL_HASH_SALT`

**Shopify**
- [ ] `SHOPIFY_API_KEY`
- [ ] `SHOPIFY_API_SECRET`
- [ ] `SHOPIFY_REDIRECT_URI` (prod)
- [ ] `WEBHOOK_BASE_URL` (prod)

**WooCommerce**
- [ ] `WOOCOMMERCE_WEBHOOK_SECRET` (se aplicável) / validação de assinatura

**Push (OneSignal)**
- [ ] `ONESIGNAL_API_KEY` (ou por store via secret_ref)
- [ ] `ONESIGNAL_APP_ID` (ou por store via secret_ref)
- [ ] Garantia: **PII NÃO vai para OneSignal** (tags/ids técnicos apenas)

**Storage**
- [ ] `STORAGE_PROVIDER` (R2/S3/MinIO)
- [ ] `STORAGE_ACCESS_KEY`
- [ ] `STORAGE_SECRET_KEY`
- [ ] `STORAGE_BUCKET`
- [ ] `STORAGE_REGION/ENDPOINT`

**Webhooks segurança**
- [ ] rate limit/WAF no endpoint de webhooks
- [ ] verificação HMAC (Shopify/Woo) com raw body
- [ ] dedupe + lock + max attempts

### 2.2 Console (PROD)
- [ ] `NEXTAUTH_SECRET`
- [ ] `NEXTAUTH_URL`
- [ ] `NEXT_PUBLIC_API_URL` (ou `CORE_API_URL`)
- [ ] (OAuth social no console, se existir) `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`

### 2.3 GitHub Actions (Build/Publish)
- [ ] Secrets para Fastlane (ver seção 6)
- [ ] Permissões mínimas (OIDC quando possível)
- [ ] Logs de build enviados ao Storage (restrito)

---

## 3) Telas mínimas do Console (MVP operacional)
> O Console precisa ser "funcional" para configurar e operar o piloto, não precisa estar bonito.

### 3.1 Onboarding da Store (P0)
- [ ] Criar Store
- [ ] Definir **timezone/locale**
- [ ] Configurar **allowlist**: `primary_domains`, `payment_domains`, `asset_domains`
- [ ] Configurar Push (OneSignal): `app_id` + `api_key` via secret_ref (ou input seguro)
- [ ] Conectar Shopify (OAuth) / Conectar Woo (keys) + exibir status "connected/disconnected"
- [ ] Botão "Sync Now" (Shopify/Woo) + status de último sync

### 3.2 Campanhas (P0)
- [ ] Criar campanha "Send now"
- [ ] Criar campanha "Schedule" (calendário simples)
- [ ] Template editor com variáveis (mínimo)
- [ ] Respeitar quiet hours + rate limits
- [ ] Stats mínimos: sent/delivered/open/click

### 3.3 Automações (P0)
- [ ] Editor visual (React Flow) para montar fluxo simples:
  - trigger → condition → delay → push action
- [ ] Ativar/pausar automação
- [ ] Visualizar runs recentes (últimas 50) com status

### 3.4 Segmentos (P0)
- [ ] Builder visual (mesmo simples) → gera DSL
- [ ] Preview count (estimativa)
- [ ] Lista de segmentos + status "materializado ok / erro"

### 3.5 DLQ / Reprocess (P0 operacional)
- [ ] Tela "Webhooks Falhados"
  - filtros: store/topic/status
  - ver `last_error`, `attempts`, `webhook_event_id`
  - botão "Reprocessar" (respeita max attempts ou reseta com permissão owner)
- [ ] Tela "Jobs Falhados" (BullMQ) (opcional, mas recomendado)

### 3.6 RBAC (P0)
- [ ] Papéis: owner/admin/editor/viewer
- [ ] Audit log: criação/edição de campanhas, automações, integrações

---

## 4) Gate 1 — E2E real (DoD técnico antes do piloto)
### 4.1 Runbook Shopify (dev store) — critérios de aceite
- [ ] OAuth install: `integration.status=connected`, webhooks registrados
- [ ] Produto create/update: webhook → `received→processing→processed`, produto no DB (external_id)
- [ ] Pedido create: order no DB (external_id)
- [ ] Dedupe: reenviar mesmo `X-Shopify-Event-Id` → log "ignoring", sem duplicata
- [ ] Stale: triggeredAt antigo → log warning, processa normal
- [ ] Uninstall: `integration.status=disconnected`, automations paused, campaigns canceladas

### 4.2 Runbook Woo (staging) — critérios de aceite
- [ ] Conexão via keys ok
- [ ] Webhook assinatura válida: processa async
- [ ] Dedupe por delivery id (ou fallback hash) sem duplicar

### 4.3 Mobile E2E — critérios de aceite
- [ ] App abre e carrega WebView (primary domain)
- [ ] Allowlist funciona: destinos fora → abre externo (SFSafari/CustomTabs)
- [ ] Bridge: `trackEvent` chega no backend e entra na fila offline quando sem rede
- [ ] `/devices/register` retorna tokens e app salva com secure storage
- [ ] OneSignal SDK registra push subscription e backend recebe `provider_sub_id`
- [ ] Push: enviar → receber no device → open/click tracka
- [ ] Deep link abre rota interna no app
- [ ] Remote Config: valida assinatura Ed25519 + JCS + LKG + ETag

---

## 5) Gate 2 — Observabilidade mínima (DoD antes do piloto)
### 5.1 Logs estruturados (mínimo)
- [ ] `request_id`, `store_id`, `integration_id`, `device_id`, `webhook_event_id`, `delivery_id`
- [ ] Erros com `reason_code` (ex.: `REFRESH_REUSE`, `HMAC_INVALID`, `WEBHOOK_DEDUPED`)

### 5.2 Métricas mínimas
- [ ] `webhooks_received_total{provider,topic,store}`
- [ ] `webhooks_deduped_total{provider,store}`
- [ ] `webhooks_failed_total{provider,topic,store}`
- [ ] `queue_depth{queue}` e `queue_lag_ms{queue}`
- [ ] `jobs_failed_total{queue}`
- [ ] `events_ingested_total{store}`
- [ ] `push_sent/delivered/open/click_total{store}`
- [ ] `auth_refresh_reuse_detected_total{store}`

### 5.3 Alertas mínimos
- [ ] Falhas webhooks > X/min (por store)
- [ ] Queue lag > Y minutos
- [ ] Push failure rate acima de Z%
- [ ] Spike de refresh reuse

---

## 6) Gate 4 — Build/Publish (DoD para "publicar")
> Dá para iniciar o piloto **antes** da aprovação final usando TestFlight/Internal Testing.

### 6.1 Pipeline (Fastlane + GitHub Actions)
- [ ] Android: build AAB + signing + upload (Internal testing)
- [ ] iOS: build IPA + signing + upload (TestFlight)
- [ ] Status do build: `BuildJob` no DB (queued/running/success/failed)
- [ ] Logs do build armazenados no Storage (link no Console)

### 6.2 Secrets (por lojista) — armazenamento seguro
- [ ] Apple:
  - [ ] App Store Connect API Key (`key_id`, `issuer_id`, `p8`)
  - [ ] Certificados/perfis (ou match)
- [ ] Google:
  - [ ] Service account JSON (Play Developer API)
  - [ ] Keystore + passwords
- [ ] Tudo em Vault/KMS/secret_ref (nunca plaintext/log)

### 6.3 Compliance checklist (anti-rejeição)
- [ ] Shell nativo real (tabs, prefs, notification center)
- [ ] Diferenciação por loja (módulos/abas/conteúdo, não só tema)
- [ ] Review Notes geradas (template)
- [ ] Política de privacidade + link de suporte
- [ ] Consentimento de push (opt-in) seguindo guidelines
- [ ] Data Safety (Play) e Privacy labels (Apple) preenchidos

---

## 7) Critérios GO/NO-GO
### 7.1 "Pode ir para PILOTO" (TestFlight / Internal Testing)
**Obrigatório**
- [ ] Gate 1 (E2E) **passou**
- [ ] Gate 2 (Observabilidade mínima) **passou**
- [ ] DLQ/reprocess (mínimo) disponível (UI ou endpoint admin)
- [ ] Kill switch de push por store + caps por device/dia funcionando
- [ ] Backup/restore do DB testado (ao menos um restore em staging)

**Não bloqueia o piloto**
- [ ] Publicação na loja (review) finalizada
- [ ] UI perfeita do Console (desde que configure e opere)

### 7.2 "Pode PUBLICAR" (Release App Store / Play)
**Obrigatório**
- [ ] Gate 4 (Pipeline) **passou**
- [ ] Checklist compliance **passou**
- [ ] Metadados completos (screenshots, descrição, categorias)
- [ ] Política de privacidade e Data Safety/Privacy labels concluídas
- [ ] Runbook de suporte (incidente) + contatos do lojista

---

## 8) Plano de execução sugerido (2 trilhos)
### Trilho A — Piloto (rápido)
1. [ ] E2E Shopify/Woo
2. [ ] Observabilidade mínima + alertas
3. [ ] DLQ/reprocess mínimo
4. [ ] Build/TestFlight + Internal testing
5. [ ] Piloto rodando 7–14 dias com feedback

### Trilho B — Publicação (paralelo)
1. [ ] Compliance + assets + formulários
2. [ ] Submissão App Store/Play
3. [ ] Correções de review
4. [ ] Release público

---

## 9) Anexos (templates úteis)
### 9.1 Review Notes (Apple) — modelo
- O app é da loja: **{store_name}**
- Funcionalidades nativas: tabs, notificações, central de notificações, preferências
- Login: **{instruções de credencial de review}**
- Fluxo de compra: WebView do domínio **{primary_domain}**
- Push: exemplo de campanha e onde ver resultados no app/console
- Contato suporte: **{email/telefone}**
- Política de privacidade: **{url}**

### 9.2 Go-live brief interno (PM)
- Data/hora de início do piloto
- Store piloto + domínio
- Métricas que vamos acompanhar
- Plano de rollback (pausar push, desconectar integração, desativar app)

---

**Fim.**
