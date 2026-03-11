# Plano de Execução — Testes Críticos Pré-MVP (v3 — 12 Testes)

## Timeline Geral

```
Dia 1:   Teste 0 (Supabase RLS + ORM) + Teste 12 (Supabase Auth + MFA) — paralelo
         + Commit monorepo vazio com CI
Dia 1-2: Teste 1 (Webhook Shopify) + Teste 2 (Drizzle vs Prisma) — paralelo
Dia 3:   Teste 3 (BullMQ batching) + Teste 8 (Multi-tenant isolation) — paralelo
Dia 4-5: Teste 4 (LLM notificações) + Teste 5 (RAG) — paralelo
Dia 6:   Teste 6 (Capacitor vs PWA) + Teste 9 (OneSignal E2E push real) — paralelo
Dia 7:   Teste 7 (Horário ideal - Klaviyo) + Teste 10 (OAuth Shopify+Nuvemshop) — paralelo
Dia 8:   Teste 11 (Stripe billing) + Consolidação dos resultados
```

**Total: 8 dias de testes antes do primeiro commit funcional do MVP.**
**Monorepo vazio + CI commitado no dia 1** (algo tangível desde o início).
**5 testes novos** encaixados em paralelo com os originais (apenas +1 dia).

---

## TESTE 0 — Supabase RLS + ORM (NOVO)
**Prioridade:** #0 (bloqueia decisão do Teste 2)
**Duração:** meio dia (dia 1, manhã)
**Custo:** R$0 (Supabase free tier)

### Justificativa
Nem Drizzle nem Prisma lidam nativamente com `SET app.current_tenant` antes de cada query.
Se RLS exigir workarounds pesados em um dos ORMs, isso muda a decisão do Teste 2.

### Setup
```bash
# Usar Supabase free tier já existente
# Criar schema de teste com RLS

# SQL no Supabase:
CREATE TABLE test_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE test_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES test_tenants(id),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE test_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON test_notifications
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

### O que testar
```
1. Drizzle:
   - Executar SET app.current_tenant = 'uuid' antes de query
   - Funciona com connection pooling (Supavisor)?
   - Precisa de raw SQL ou tem API nativa?
   - Transaction: SET + SELECT dentro da mesma transação funciona?

2. Prisma:
   - Mesmo teste com $executeRaw('SET app.current_tenant = ...')
   - Funciona com connection pooling?
   - Interactive transactions mantêm o SET?
   - Prisma Client Extensions consegue injetar SET automaticamente?

3. Alternativa: RLS via auth.uid()
   - Usar Supabase Auth JWT com claim custom (tenant_id)
   - Testar se ambos ORMs conseguem passar o JWT no header da conexão
```

### Critérios de Avaliação
```
| Métrica                          | Drizzle        | Prisma         |
|----------------------------------|----------------|----------------|
| SET tenant funciona              | sim/não        | sim/não        |
| Funciona com pooling             | sim/não        | sim/não        |
| Precisa raw SQL                  | sim/não        | sim/não        |
| Transaction isolation OK         | sim/não        | sim/não        |
| Workaround necessário            | descrever      | descrever      |
| Complexidade do workaround (1-5) | avaliar        | avaliar        |
```

### Decisão Resultante
```
Se um ORM lida nativamente e o outro precisa de hack:
  → Peso forte na decisão do Teste 2 (pode ser eliminatório)

Se ambos precisam de workaround similar:
  → RLS não diferencia, Teste 2 decide por outros critérios

Se nenhum lida bem:
  → Considerar RLS via application-level (WHERE tenant_id = ?) em vez de DB-level
  → Documentar trade-off de segurança
```

---

## TESTE 1 — Webhook Reliability Shopify
**Prioridade:** #1 (bloqueia toda a arquitetura de fluxos automáticos)
**Duração:** 2 dias
**Custo:** R$0 (Shopify Partner account grátis)

### Setup
```bash
# 1. Criar loja de desenvolvimento no Shopify Partners
# https://partners.shopify.com → Development stores → Create store

# 2. Criar app de teste no Partners Dashboard
# App setup → URLs → Redirect: http://localhost:3000/auth/callback

# 3. Instalar ngrok para receber webhooks localmente
npm install -g ngrok
ngrok http 3000
```

### Script de Teste
```
Arquivo: tests/webhook-reliability/test.ts

Objetivo:
- Registrar webhooks: carts/create, carts/update, orders/create, checkouts/create
- Gerar 50 eventos de cada tipo na loja de teste
- Registrar TODOS os webhooks recebidos com timestamp
- Comparar: eventos gerados vs webhooks recebidos
- Medir latência média de cada webhook

Infraestrutura:
- Hono server rodando local com ngrok
- SQLite local para logging (não precisa de infra)
- Script de geração de eventos via Shopify Admin API

Cenários:
1. Criar 50 carrinhos com produtos → contar webhooks carts/create
2. Abandonar 50 checkouts → contar webhooks checkouts/create
3. Criar 50 pedidos (API) → contar webhooks orders/create
4. Criar 10 eventos em rajada (1 por segundo) → testar rate limiting
5. Criar 10 eventos simultâneos (Promise.all) → testar concorrência
6. (NOVO) Derrubar servidor por 60s, gerar 10 eventos, subir servidor
   → Shopify reenvia? Com que delay? Quantas tentativas?
```

### Critérios de Avaliação
```
| Métrica                        | Aceitável      | Ideal          |
|--------------------------------|----------------|----------------|
| Taxa de entrega webhooks       | > 95%          | > 99%          |
| Latência média                 | < 10s          | < 3s           |
| Latência p99                   | < 30s          | < 10s          |
| Webhooks duplicados            | < 5%           | < 1%           |
| Webhooks fora de ordem         | documentar     | documentar     |
| (NOVO) Replay após downtime    | documentar     | documentar     |
| (NOVO) Tentativas de reenvio   | documentar     | documentar     |
| (NOVO) Delay do reenvio        | documentar     | documentar     |
```

### Teste Extra: Headers de Verificação
```
Verificar se Shopify envia:
- X-Shopify-Hmac-Sha256 (assinatura para validar autenticidade)
- X-Shopify-Topic (tipo do evento)
- X-Shopify-Shop-Domain
- X-Shopify-Webhook-Id (para dedup)
- X-Shopify-Triggered-At (timestamp do evento)

Se X-Shopify-Webhook-Id existe:
  → Usar como chave de dedup no banco
  → UNIQUE constraint em webhook_events.shopify_webhook_id
```

### Decisão Resultante
```
Se taxa < 95%:
  → Implementar polling como fallback obrigatório
  → Polling a cada 5 min para eventos perdidos
  → Reconciliação: webhook + polling, dedup por event_id

Se taxa > 99%:
  → Webhook como primário, polling apenas como safety net a cada 30 min

Se replay após downtime funciona:
  → Documentar janela de retry do Shopify (geralmente 48h, 19 tentativas)
  → Dimensionar timeout de reconciliação baseado nisso

Documentar no CLAUDE.md seção Common Hurdles.
```

---

## TESTE 2 — Drizzle vs Prisma
**Prioridade:** #2 (define toda a camada de dados)
**Duração:** 2 dias (paralelo com Teste 1)
**Custo:** R$0 (Supabase free tier)
**Depende de:** Teste 0 (resultado de RLS influencia peso)

### Contexto Importante
O projeto atual já usa Prisma. A migração para Drizzle tem custo real de reescrita.
O Teste 2 precisa medir não só performance isolada, mas **delta mínimo que justifica migração**.

**Antes de começar, definir:** qual é o delta mínimo de performance para justificar a mudança?
Sugestão: Drizzle precisa ser **>30% melhor** em queries críticas para compensar o custo de migração.

### Setup
```bash
# Criar 2 projetos mínimos
mkdir test-drizzle && cd test-drizzle && npm init -y
mkdir test-prisma && cd test-prisma && npm init -y

# Ambos apontando para o mesmo Supabase (schemas diferentes)
# Schema: tenants, notifications, notification_deliveries
```

### O que implementar em CADA ORM
```
1. Schema das 3 tabelas core:
   - tenants (com campos encrypted, jsonb)
   - notifications (com enum status, FK para tenant)
   - notification_deliveries (tabela grande, FK para notification e tenant)

2. Migrations:
   - Criar schema inicial
   - Adicionar coluna nova (ALTER TABLE)
   - Criar índice composto (tenant_id + created_at)

3. Queries:
   - INSERT: 1000 tenants, 10K notifications, 100K deliveries
   - SELECT: listar notifications por tenant com paginação
   - SELECT: métricas agregadas (COUNT status por tenant, últimos 30 dias)
   - SELECT: join notification + deliveries com filtro de tenant
   - UPDATE: atualizar status de 1000 deliveries em batch
   - SELECT com RLS: usar resultado do Teste 0

4. TypeScript DX:
   - Qual gera tipos mais úteis?
   - Autocomplete no VSCode funciona bem?
   - Erros de tipo são claros?

5. (NOVO) Custo de migração:
   - Quanto do código atual de Prisma precisaria ser reescrito?
   - Estimativa em horas/dias
   - Risco de bugs durante migração
```

### Critérios de Avaliação
```
| Métrica                        | Drizzle        | Prisma         |
|--------------------------------|----------------|----------------|
| INSERT 100K rows (ms)          | medir          | medir          |
| SELECT paginado (ms)           | medir          | medir          |
| SELECT agregado (ms)           | medir          | medir          |
| JOIN com filtro (ms)           | medir          | medir          |
| UPDATE batch (ms)              | medir          | medir          |
| Migration: criar schema (s)    | medir          | medir          |
| Migration: add column (s)      | medir          | medir          |
| Bundle size (KB)               | medir          | medir          |
| Type inference quality (1-5)   | avaliar        | avaliar        |
| Supabase integration (1-5)     | avaliar        | avaliar        |
| RLS compatibility (resultado T0)| preencher     | preencher      |
| Documentação PT-BR (1-5)       | avaliar        | avaliar        |
| (NOVO) Custo migração (dias)   | 0 (já novo)    | 0 (já existe)  |
```

### Decisão Resultante
```
Critérios de peso:
  Performance:           25%
  DX (tipos, autocomplete): 25%
  Supabase/RLS compat:  25%
  Custo de migração:     25%  ← NOVO: peso igual aos outros

Se Drizzle vencer por >30% em performance E RLS funciona:
  → Migrar para Drizzle (justifica o custo)

Se Drizzle vencer por <30%:
  → Ficar com Prisma (delta não justifica reescrita)

Se Prisma vencer em RLS (Teste 0):
  → Ficar com Prisma (eliminatório)

Se empate:
  → Ficar com Prisma (já existe, menos risco)
```

---

## TESTE 3 — BullMQ Batching Strategy
**Prioridade:** #3 (define performance do core do produto)
**Duração:** 1 dia
**Custo:** R$0 (Redis local via Docker + Upstash free tier)

### Setup
```bash
# Redis local
docker run -d --name redis-test -p 6379:6379 redis:7-alpine

# Projeto de teste
mkdir test-bullmq && cd test-bullmq && npm init -y
npm install bullmq ioredis
```

### Cenários de Teste
```
Cenário 1 — Batch Size
  Enviar 10.000 jobs simulando push
  Testar batch sizes: 50, 100, 250, 500
  Worker simula chamada OneSignal com delay de 50ms
  Medir: throughput (jobs/segundo), tempo total

Cenário 2 — Concurrency
  10.000 jobs, batch size fixo em 500
  Testar concurrency: 1, 3, 5, 10 workers
  Medir: throughput, uso de memória, CPU

Cenário 3 — Rate Limiting
  Simular limite OneSignal: 1000 msg/segundo
  BullMQ limiter: { max: 1000, duration: 1000 }
  Enviar 50.000 jobs em rajada
  Medir: respeita o limite? jobs ficam na fila sem perder?

Cenário 4 — Retry e Falha
  10.000 jobs, 10% simulam falha (throw Error)
  Backoff: exponential, base 1000ms, max 30000ms
  Medir: quantos retries até sucesso, tempo total com retries

Cenário 5 — Dead Letter Queue
  1.000 jobs, 5% falham permanentemente (max retries: 3)
  Medir: jobs vão para DLQ corretamente? nenhum job perdido?

Cenário 6 — Multi-tenant isolation
  5 tenants, 2.000 jobs cada (10.000 total)
  Cada job tem tenant_id
  Medir: jobs de um tenant atrasam os de outro?
  Testar: rate limit por tenant (max 100 jobs/min por tenant)

Cenário 7 — (NOVO) Redis Reconnect
  Rodar 5.000 jobs
  No meio (após ~2.500), derrubar Redis por 30s
  Subir Redis novamente
  Medir: BullMQ reconecta automaticamente? Jobs perdidos? Jobs duplicados?
  Testar com: maxRetriesPerRequest: null (recomendação BullMQ)

Cenário 8 — (NOVO) Upstash TLS
  Repetir Cenários 1, 2 e 3 contra Upstash (Redis over TLS)
  Usar connection string: rediss://...@...upstash.io:6379
  Medir: delta de latência vs Redis local
  Medir: throughput real com network latency
  Testar: BullMQ limiter funciona sobre TLS?
```

### Critérios de Avaliação
```
| Métrica                        | Aceitável      | Ideal          |
|--------------------------------|----------------|----------------|
| Throughput (jobs/s) local      | > 500          | > 2000         |
| Throughput (jobs/s) Upstash    | > 100          | > 500          |
| Latência por job local (ms)    | < 100          | < 20           |
| Latência por job Upstash (ms)  | < 500          | < 100          |
| Rate limit respeitado          | sim            | sim            |
| Jobs perdidos                  | 0              | 0              |
| DLQ funciona                   | sim            | sim            |
| Memória com 50K jobs na fila   | < 500MB        | < 200MB        |
| (NOVO) Reconnect sem perda     | sim            | sim            |
| (NOVO) Upstash TLS funciona    | sim            | sim            |
```

### Decisão Resultante
```
Definir config padrão para produção:
  BATCH_SIZE = [resultado do teste]
  WORKER_CONCURRENCY = [resultado do teste]
  RATE_LIMIT_MAX = [resultado do teste]
  RATE_LIMIT_DURATION = [resultado do teste]
  RETRY_ATTEMPTS = [resultado do teste]
  RETRY_BACKOFF_BASE = [resultado do teste]
  RETRY_BACKOFF_MAX = [resultado do teste]

(NOVO) Se Upstash throughput < 100 jobs/s:
  → Considerar Redis dedicado (Railway/Render) em vez de Upstash
  → Ou aceitar throughput menor e compensar com mais concurrency

(NOVO) Se reconnect perde jobs:
  → Implementar checkpointing local antes de ack
  → Ou usar persistent storage (Redis AOF) obrigatório

Documentar no CLAUDE.md seção Environment Variables.
```

---

## TESTE 4 — LLM para Geração de Notificações
**Prioridade:** #4 (define qualidade do produto principal)
**Duração:** 2 dias
**Custo:** ~$5-15 em tokens de API

### Setup
```bash
# Projeto de teste
mkdir test-llm && cd test-llm && npm init -y
npm install @anthropic-ai/sdk openai

# Criar .env com API keys
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...
```

### Perfis de Loja (5 personas)
```
Loja 1 — Moda Feminina Premium
  Nicho: vestidos, acessórios
  Ticket médio: R$280
  Tom: sofisticado, aspiracional
  Público: mulheres 25-40

Loja 2 — Suplementos Fitness
  Nicho: whey, creatina, vitaminas
  Ticket médio: R$120
  Tom: energético, técnico
  Público: homens e mulheres 20-35

Loja 3 — Joias Artesanais
  Nicho: anéis, colares, brincos
  Ticket médio: R$180
  Tom: delicado, emocional
  Público: mulheres 30-50

Loja 4 — Brinquedos Educativos
  Nicho: jogos, quebra-cabeças, STEM
  Ticket médio: R$95
  Tom: divertido, confiável
  Público: mães/pais 28-45

Loja 5 — Eletrônicos e Gadgets
  Nicho: fones, carregadores, acessórios
  Ticket médio: R$150
  Tom: direto, specs-oriented
  Público: homens 18-35
```

### Tipos de Notificação a Gerar (por loja) — CORRIGIDO
```
Amostra reduzida para viabilizar avaliação manual com qualidade.

Para cada loja, gerar 5 variantes de cada:
1. Carrinho abandonado (com nome do produto)
2. Boas-vindas (primeiro acesso ao app)
3. PIX pendente (pedido aguardando pagamento)
4. Upsell (pós-entrega, produto complementar)
5. Promoção (oferta genérica da loja)

Total gerado: 5 lojas × 5 tipos × 5 variantes = 125 notificações por modelo
3 modelos = 375 notificações geradas

AVALIAÇÃO: selecionar 25 amostras aleatórias por modelo (75 total)
  - 5 por tipo de notificação, lojas variadas
  - Usar random seed fixo para reprodutibilidade
  - Segundo avaliador avalia as mesmas 75 para calibração
  - Se scores divergem >1 ponto em >20% das amostras → discutir e realinhar
```

### Prompt Base (igual para todos os modelos)
```
Contexto da Loja:
- Nome: {store_name}
- Nicho: {niche}
- Tom de voz: {tone}
- Público-alvo: {audience}
- Ticket médio: R${avg_ticket}

Produto em questão: {product_name} — R${price}

Gere uma notificação push de {notification_type}.

Regras:
- Título: máximo 50 caracteres (para iOS)
- Corpo: máximo 178 caracteres (para iOS lock screen)
- Português brasileiro natural (não Portugal)
- Tom alinhado com a marca
- Incluir urgência sutil, não agressiva
- Incluir nome do produto quando relevante
- NÃO usar caixa alta inteira
- NÃO usar mais de 1 emoji

Retorne JSON:
{
  "title": "...",
  "body": "...",
  "suggested_product_id": "...",
  "reasoning": "..."
}
```

### Modelos a Testar
```
1. Claude Haiku 4.5 (claude-haiku-4-5-20251001)
   - via @anthropic-ai/sdk
   - max_tokens: 300

2. GPT-4o-mini (gpt-4o-mini)
   - via openai sdk
   - max_tokens: 300

3. Llama 3.1 8B via Groq (llama-3.1-8b-instant)
   - via openai sdk (Groq é compatível)
   - max_tokens: 300
```

### Critérios de Avaliação (por notificação)
```
Avaliar sobre as 25 amostras por modelo (não 125):

| Critério              | Peso | Descrição                                           |
|-----------------------|------|-----------------------------------------------------|
| Naturalidade PT-BR    | 25%  | Soa como brasileiro escreveu? Sem "você" formal?    |
| Adequação ao tom      | 25%  | Loja de luxo soa luxo? Fitness soa energético?      |
| Persuasão             | 20%  | Dá vontade de clicar? Tem urgência sem ser spam?    |
| Respeito aos limites  | 15%  | Título < 50 chars? Corpo < 178 chars?               |
| JSON válido           | 15%  | Retornou JSON parseable? Todos os campos presentes? |

Processo de avaliação:
1. Avaliador 1 pontua as 75 amostras
2. Avaliador 2 pontua as mesmas 75 amostras
3. Se divergência > 1 ponto em > 20% → sessão de calibração
4. Score final = média dos dois avaliadores
```

### Métricas Técnicas
```
| Métrica                | Claude Haiku   | GPT-4o-mini    | Llama 3.1 8B   |
|------------------------|----------------|----------------|-----------------|
| Latência média (ms)    | medir          | medir          | medir           |
| Latência p95 (ms)      | medir          | medir          | medir           |
| Custo por notificação  | calcular       | calcular       | calcular        |
| Custo para 50K/mês     | calcular       | calcular       | calcular        |
| JSON válido (%)        | medir          | medir          | medir           |
| Respeita limites (%)   | medir          | medir          | medir           |
| Score qualidade (1-5)  | avaliar        | avaliar        | avaliar         |
```

### Decisão Resultante
```
Se 1 modelo é claramente superior em qualidade E custo aceitável:
  → Usar como default
  → Segundo melhor como fallback

Se 2 modelos empatam:
  → Usar o mais barato como default
  → Adapter pattern permite trocar facilmente

Documentar no CLAUDE.md:
  AI_DEFAULT_PROVIDER = [vencedor]
  AI_FALLBACK_PROVIDER = [segundo]
  AI_MAX_TOKENS = [resultado]
  PUSH_TITLE_MAX_LENGTH = [resultado real do teste de devices]
  PUSH_BODY_MAX_LENGTH = [resultado real do teste de devices]
```

---

## TESTE 5 — RAG: Contexto no Prompt vs pgvector vs Cache
**Prioridade:** #5 (define complexidade da IA no MVP)
**Duração:** 2 dias (paralelo com Teste 4)
**Custo:** ~$5-10 em tokens

### Setup
```bash
# Usar o mesmo projeto do Teste 4
# Adicionar Supabase client com pgvector

npm install @supabase/supabase-js

# Habilitar pgvector no Supabase:
# SQL Editor → CREATE EXTENSION IF NOT EXISTS vector;
```

### Dados de Teste
```
Usar catálogos reais de 3 lojas AppFy (com permissão):
  Loja Pequena:  ~50 produtos
  Loja Média:    ~500 produtos
  Loja Grande:   ~5.000 produtos

Para cada produto, extrair:
  - nome
  - descrição
  - preço
  - categoria
  - tags
  - imagem_url
```

### Abordagem A — Contexto no Prompt
```
Para cada geração de notificação:
1. Buscar últimos 20 produtos mais vendidos (ORDER BY sales DESC LIMIT 20)
2. Buscar últimos 5 produtos visualizados pelo usuário
3. Injetar como contexto no prompt:

"Produtos mais vendidos da loja:
1. Vestido Floral — R$189
2. Bolsa Couro — R$320
..."

Medir: tokens de input, qualidade da sugestão, latência
```

### Abordagem B — pgvector
```
1. Gerar embeddings de todos os produtos (text-embedding-3-small)
2. Armazenar em tabela com coluna vector

Para cada geração:
1. Criar embedding da query: "produto para presente feminino até R$200"
2. Buscar top 5 produtos por similaridade de cosseno
3. Injetar resultado no prompt

Medir: tokens de input (menor), qualidade (mais relevante?), latência (+ embedding)
```

### Abordagem C — Cache de Embeddings (NOVO)
```
Terceira via entre as duas abordagens:

1. Gerar embeddings de todos os produtos (1x por dia, via cron job)
2. Cachear no Redis: key = "store:{id}:embeddings", TTL = 24h
3. Para cada geração:
   - Buscar embeddings do cache (Redis, sem hit no banco)
   - Calcular similaridade in-memory (cosine similarity em JS)
   - Injetar top 5 no prompt

Vantagem: mais inteligente que dump no prompt, mais simples que pgvector real-time
Desvantagem: usa memória do Redis, cálculo in-memory pode ser lento com 5K produtos

Medir: latência total, uso de memória Redis, qualidade vs pgvector
```

### Cenários
```
1. Carrinho abandonado — produto específico
   Query: "cliente abandonou Vestido Floral R$189"
   Esperado: sugerir produto similar ou complementar

2. Upsell pós-compra
   Query: "cliente comprou Whey 900g, sugerir complemento"
   Esperado: creatina, shaker, glutamina

3. Browse abandonment — categoria
   Query: "cliente navegou em colares por 5 minutos"
   Esperado: colar popular ou em promoção

4. Promoção genérica
   Query: "gerar push promocional para Dia das Mães"
   Esperado: produto relevante para a data
```

### Critérios de Avaliação
```
| Métrica                        | Contexto Prompt | pgvector       | Cache Redis    |
|--------------------------------|-----------------|----------------|----------------|
| Relevância produto sugerido    | avaliar (1-5)   | avaliar (1-5)  | avaliar (1-5)  |
| Tokens de input (média)        | medir           | medir          | medir          |
| Custo por geração              | calcular        | calcular       | calcular       |
| Latência total (ms)            | medir           | medir          | medir          |
| Funciona com 50 produtos?      | sim/não         | sim/não        | sim/não        |
| Funciona com 500 produtos?     | sim/não         | sim/não        | sim/não        |
| Funciona com 5000 produtos?    | sim/não         | sim/não        | sim/não        |
| Complexidade de implementação  | avaliar (1-5)   | avaliar (1-5)  | avaliar (1-5)  |
| Uso de memória Redis           | N/A             | N/A            | medir          |
```

### Decisão Resultante
```
Se contexto no prompt funciona bem até 500 produtos:
  → MVP usa contexto no prompt (mais simples)
  → Cache Redis entra como upgrade natural quando necessário
  → pgvector para Fase 2 (lojas com >1000 produtos)

Se cache Redis é significativamente melhor que contexto e quase igual a pgvector:
  → MVP usa cache Redis (melhor custo-benefício)
  → pgvector só para buscas semânticas avançadas (Fase 3)

Se pgvector é claramente superior mesmo com lojas pequenas:
  → MVP já usa pgvector
  → Aceitar complexidade adicional

Se empate geral:
  → Contexto no prompt para MVP (simplicidade vence)
  → Documentar threshold de produtos para cada upgrade
```

---

## TESTE 6 — Capacitor vs PWA (TWA removido)
**Prioridade:** #6 (define pipeline de build)
**Duração:** 1 dia
**Custo:** R$0

### Justificativa da remoção de TWA
TWA não existe no iOS. Como iOS é requisito, TWA já está eliminado.
Testar apenas Capacitor (nativo) vs PWA (web).

### Setup
```bash
# Criar 2 projetos mínimos com a mesma loja Shopify de teste

# PWA
npx create-next-app@latest test-pwa
# Adicionar manifest.json, service worker, meta tags

# Capacitor
npx create-next-app@latest test-capacitor
npm install @capacitor/core @capacitor/cli @capacitor/push-notifications
npx cap init
npx cap add android
npx cap add ios
```

### Critérios de Avaliação
```
| Métrica                    | PWA        | Capacitor  |
|----------------------------|------------|------------|
| Push no Android            | testar     | testar     |
| Push no iOS                | testar     | testar     |
| Splash screen custom       | limitado   | testar     |
| Ícone custom na store      | N/A        | sim        |
| Tamanho do APK (MB)        | N/A        | medir      |
| Tempo de build (s)         | N/A        | medir      |
| Performance scroll (FPS)   | medir      | medir      |
| Precisa de conta developer | não        | sim        |
| Publicável na App Store    | não        | sim        |
| Publicável na Play Store   | não        | sim        |
| Complexidade do build      | baixa      | avaliar    |
```

### Teste Crítico: Push no iOS
```
PWA no iOS:
  - Safari suporta push desde iOS 16.4 (2023)
  - MAS: requer que o usuário adicione à Home Screen
  - MAS: prompt de permissão diferente do nativo
  - Testar: fluxo completo funciona? UX é aceitável?
  - Documentar: % estimado de usuários que adicionam à Home Screen

Capacitor no iOS:
  - Push nativo via APNs
  - Funciona como qualquer app
  - Testar: fluxo completo de push funciona?
  - Testar: signing e provisioning profile funcionam?
```

### Decisão Resultante
```
Se Capacitor funciona bem e build é automatizável:
  → Confirma Capacitor (esperado)

Se PWA push no iOS é surpreendentemente bom:
  → PWA como opção "lite" para lojas que não querem app na store
  → Capacitor continua como produto principal

Provavelmente Capacitor vence — é a única opção
que cobre Android + iOS + store + push nativo.
O teste serve para confirmar, não para decidir.
```

---

## TESTE 7 — Horário Ideal de Envio (Dados Klaviyo)
**Prioridade:** #7 (alimenta o cérebro central antes do MVP)
**Duração:** 1 dia
**Custo:** R$0 (API Klaviyo já disponível)

### Setup
```bash
# Usar Klaviyo API já existente
# Endpoint: GET /api/campaigns
# Endpoint: GET /api/metrics/aggregate

mkdir test-klaviyo-analysis && cd test-klaviyo-analysis
npm install axios
```

### Dados a Extrair
```
Para cada cliente AppFy (ou amostra de 50):
  1. Últimas 50 campanhas enviadas
  2. Para cada campanha:
     - data/hora de envio
     - tipo (promocional, transacional, automação)
     - subject line
     - taxa de abertura
     - taxa de clique
     - receita gerada (se disponível)
     - nicho da loja
     - número de destinatários

  3. Métricas de fluxos automáticos:
     - Carrinho abandonado: hora do abandono, hora da abertura do email
     - Welcome: hora do cadastro, hora da abertura
```

### Análise a Gerar
```
1. Heatmap: taxa de abertura por hora do dia (0-23) × dia da semana (seg-dom)
   - Geral (todas as lojas)
   - Por nicho (moda, suplementos, joias, etc.)
   - (NOVO) Incluir intervalo de confiança para cada célula

2. Melhor horário por nicho:
   - Top 3 horários com maior abertura
   - Top 3 horários com maior conversão (se disponível)
   - (NOVO) Apenas reportar se N > 30 amostras por célula

3. Sazonalidade:
   - Meses com maior engajamento por nicho
   - Datas comemorativas com picos

4. Benchmark:
   - Taxa média de abertura por nicho
   - Taxa média de clique por nicho
   - Comparar com benchmarks públicos de push notification
   - (NOVO) Documentar que email ≠ push (proxy temporal, não benchmark direto)

5. Correlação:
   - Tamanho do subject line vs abertura
   - Horário vs abertura por nicho
   - Dia da semana vs conversão
   - (NOVO) Reportar R² e p-value, não apenas correlação
```

### Output Esperado
```
Arquivo: brain_seed_data.json

{
  "metadata": {
    "source": "klaviyo_email_campaigns",
    "data_type": "proxy_temporal",
    "confidence": "low",
    "note": "Dados de email usados como proxy de comportamento temporal. NÃO são benchmarks diretos de push notification. Confiança será atualizada para 'medium' com dados reais de push.",
    "stores_analyzed": 50,
    "campaigns_analyzed": 2500,
    "date_range": "2025-01-01 a 2026-03-01",
    "generated_at": "2026-03-XX"
  },
  "general": {
    "best_hours": [19, 20, 10],
    "best_hours_ci_95": [[18,20], [19,21], [9,11]],
    "best_days": ["terça", "quinta", "segunda"],
    "avg_open_rate": 0.18,
    "avg_click_rate": 0.04,
    "sample_size": 2500
  },
  "by_niche": {
    "moda_feminina": {
      "best_hours": [20, 21, 12],
      "best_hours_ci_95": [[19,21], [20,22], [11,13]],
      "best_days": ["quarta", "quinta"],
      "avg_open_rate": 0.22,
      "avg_ticket": 280,
      "top_subjects_patterns": ["novidades", "últimas peças", "desconto exclusivo"],
      "sample_size": 450,
      "confidence": "low"
    },
    "suplementos": {
      "best_hours": [7, 18, 20],
      "best_hours_ci_95": [[6,8], [17,19], [19,21]],
      "best_days": ["segunda", "terça"],
      "avg_open_rate": 0.15,
      "avg_ticket": 120,
      "top_subjects_patterns": ["reposição", "combo", "frete grátis"],
      "sample_size": 380,
      "confidence": "low"
    }
  },
  "seasonal": {
    "dia_das_maes": { "start_ramp": "2 semanas antes", "peak_niches": ["joias", "moda"] },
    "black_friday": { "start_ramp": "1 semana antes", "peak_niches": ["todos"] }
  }
}
```

### Decisão Resultante
```
Este teste NÃO gera decisão técnica.
Gera DADOS que alimentam o cérebro central desde o dia 1.

O brain_seed_data.json se torna:
  - Seed data para sugestão de horário no MVP (confiança baixa, melhor que nada)
  - Baseline para comparar push vs email (quando tiver dados reais de push)
  - Benchmark interno por nicho
  - Input para prompts da IA ("lojas de moda têm melhor abertura às 20h")

(NOVO) Plano de atualização de confiança:
  - "low": seed data de email (dia 7)
  - "medium": primeiros 1000 push enviados (semana 2-3 do MVP)
  - "high": 10.000+ push com A/B test de horário (mês 2)

Documentar no CLAUDE.md seção Cérebro de IA:
  "Seed data gerado a partir de análise de [X] campanhas de [Y] lojas AppFy"
  "Confiança: baixa (proxy de email). Atualizar com dados reais de push."
```

---

## TESTE 8 — Multi-tenant RLS Isolation (Segurança)
**Prioridade:** #8 (risco #1 do produto — vazamento de dados)
**Duração:** meio dia (dia 3, paralelo com Teste 3)
**Custo:** R$0 (Supabase free tier)

### Justificativa
O CLAUDE.md define isolamento multi-tenant como princípio #1 e exige testes no CI.
Antes de escrever qualquer feature, precisamos garantir que RLS funciona em todos os cenários.
Vazamento de dados entre lojas = morte do produto.

### Setup
```bash
# Usar Supabase do Teste 0 (já com RLS configurado)
# Criar 3 tenants de teste: tenant_a, tenant_b, tenant_c
# Popular cada um com dados diferentes

# Criar 2 usuários de teste:
#   user_a: membro de tenant_a
#   user_b: membro de tenant_b
```

### Cenários de Teste
```
Cenário 1 — Isolamento básico
  Autenticado como user_a (tenant_a):
  - SELECT * FROM notifications → deve retornar APENAS de tenant_a
  - SELECT * FROM app_users → deve retornar APENAS de tenant_a
  - SELECT * FROM notification_deliveries → deve retornar APENAS de tenant_a
  ✅ PASS se 0 registros de tenant_b/c aparecem

Cenário 2 — Tentativa de acesso cruzado via API
  Autenticado como user_a:
  - GET /api/notifications?tenant_id=tenant_b → deve retornar 403 ou vazio
  - GET /api/app-users/{id_de_tenant_b} → deve retornar 404 ou 403
  - PATCH /api/notifications/{id_de_tenant_b} → deve retornar 403
  ✅ PASS se nenhuma operação cross-tenant funciona

Cenário 3 — JWT manipulation
  Pegar JWT de user_a
  Modificar claim tenant_id para tenant_b (sem re-assinar)
  - Toda request deve falhar (JWT inválido)
  ✅ PASS se Supabase rejeita JWT adulterado

Cenário 4 — Inserção cross-tenant
  Autenticado como user_a:
  - INSERT notification com tenant_id = tenant_b → deve falhar
  - INSERT app_user com tenant_id = tenant_b → deve falhar
  ✅ PASS se RLS bloqueia INSERT cross-tenant

Cenário 5 — Service role bypass (backend)
  Usando SUPABASE_SERVICE_ROLE_KEY:
  - SELECT sem filtro → deve retornar TODOS os tenants
  - Verificar: o backend SEMPRE adiciona WHERE tenant_id = ?
  - Verificar: repository pattern impede bypass
  ✅ PASS se service role funciona mas repository protege

Cenário 6 — Membership check
  user_c sem membership em nenhum tenant:
  - Qualquer request → deve retornar 403
  user_a com role "viewer" em tenant_a:
  - GET → deve funcionar
  - POST/PATCH/DELETE → deve retornar 403 (read-only)
  ✅ PASS se roles são respeitadas

Cenário 7 — Multi-membership
  user_d membro de tenant_a E tenant_b:
  - Com header X-Tenant-Id: tenant_a → vê dados de tenant_a
  - Com header X-Tenant-Id: tenant_b → vê dados de tenant_b
  - Sem header → deve retornar 400 (tenant obrigatório)
  - Nunca vê dados de tenant_c
  ✅ PASS se troca de tenant funciona sem vazamento
```

### Critérios de Avaliação
```
| Cenário                      | Resultado      |
|------------------------------|----------------|
| Isolamento SELECT            | PASS/FAIL      |
| Acesso cruzado API           | PASS/FAIL      |
| JWT manipulation             | PASS/FAIL      |
| INSERT cross-tenant          | PASS/FAIL      |
| Service role + repository    | PASS/FAIL      |
| Membership roles             | PASS/FAIL      |
| Multi-membership             | PASS/FAIL      |

CRITÉRIO: 7/7 PASS para seguir em frente.
Qualquer FAIL = bloqueia MVP até resolver.
```

### Decisão Resultante
```
Se 7/7 PASS:
  → Copiar cenários como testes automatizados no CI
  → Rodar em CADA commit (conforme CLAUDE.md define)

Se algum FAIL:
  → Corrigir ANTES de qualquer outro desenvolvimento
  → Re-testar até 7/7 PASS

Output: script de testes de isolamento reutilizável no CI.
```

---

## TESTE 9 — OneSignal E2E End-to-End (Push Real)
**Prioridade:** #9 (validar que push funciona de verdade)
**Duração:** meio dia (dia 6, paralelo com Teste 6)
**Custo:** R$0 (OneSignal free tier)

### Justificativa
O Teste 6 valida Capacitor vs PWA como framework. Este teste valida o **fluxo completo de push**
desde o backend até o device real. Inclui provisionamento de apps via API, credenciais dinâmicas por tenant, batching, e limites reais de caracteres.

### Setup
```bash
# 1. Criar conta OneSignal (free tier)
# https://onesignal.com → Sign Up

# 2. Criar app de teste via OneSignal REST API (provisionamento programático)
curl -X POST https://api.onesignal.com/apps \
  -H "Authorization: Basic {USER_AUTH_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name": "test-tenant-a"}'

# 3. Obter App ID e API Key da resposta
# Salvar: ONESIGNAL_APP_ID e ONESIGNAL_API_KEY

# 4. Ter 2 devices reais (ou emuladores):
#    - Android (físico ou emulador)
#    - iOS (físico — push não funciona em simulador iOS)

# 5. App Capacitor do Teste 6 com onesignal-cordova-plugin ou @onesignal/cordova-plugin
```

### Cenários de Teste
```
Cenário 1 — Push básico (texto)
  Enviar push com título + corpo para 1 device Android via OneSignal REST API
  Enviar push com título + corpo para 1 device iOS via OneSignal REST API
  Medir: chegou? Latência? Exibição correta?
  ✅ PASS se push aparece em ambos OS

Cenário 2 — Push com imagem
  Enviar push com big_picture (Android) / ios_attachments (iOS) via OneSignal API
  Android: imagem aparece expandida?
  iOS: imagem aparece no lock screen?
  ✅ PASS se imagem renderiza em ambos

Cenário 3 — Limites reais de caracteres
  Enviar pushes com títulos de: 30, 50, 65, 80, 100 caracteres
  Enviar pushes com corpos de: 100, 150, 178, 200, 250, 300 caracteres
  Documentar em CADA device + OS:
    - Onde trunca no lock screen?
    - Onde trunca na notification shade?
    - Onde trunca expandido?
  ✅ Output: limites reais documentados (não os teóricos)

Cenário 4 — Credenciais dinâmicas por tenant
  Criar 2 OneSignal apps via API (simulando 2 tenants)
  Worker carrega credencial (app_id + api_key) do tenant_a → envia push → funciona
  Worker carrega credencial (app_id + api_key) do tenant_b → envia push → funciona
  Verificar: credenciais não ficam em memória cruzada
  ✅ PASS se isolamento de credenciais funciona

Cenário 5 — Batching (segmentos)
  Registrar 10 devices no mesmo OneSignal app
  Enviar 1 notificação para todos via OneSignal segments ou include_player_ids
  Verificar: OneSignal entrega para todos os devices
  Medir: latência do batch vs individual
  ✅ PASS se batching funciona sem erro

Cenário 6 — Player ID inválido / expirado
  Enviar push para player_id inválido (string aleatória)
  Enviar push para player_id de device que desinstalou app
  Verificar: OneSignal retorna erro específico por player
  Verificar: sistema marca device como inativo (is_active = false)
  ✅ PASS se tokens ruins são detectados e marcados

Cenário 7 — Deep link
  Push com data payload: { "url": "/produto/123" }
  Ao clicar no push, app abre na URL correta?
  Android: funciona com app em background? Com app fechado?
  iOS: funciona com app em background? Com app fechado?
  ✅ PASS se deep link funciona nos 4 cenários (2 OS × 2 estados)

Cenário 8 — Push silencioso (data-only)
  Enviar push data-only via OneSignal (content_available: true, sem headings/contents)
  Verificar: app recebe dados em background
  Usar para: atualizar badge count, sync silencioso
  ✅ PASS se data-only funciona em ambos OS
```

### Critérios de Avaliação
```
| Cenário                      | Android        | iOS            |
|------------------------------|----------------|----------------|
| Push básico                  | PASS/FAIL      | PASS/FAIL      |
| Push com imagem              | PASS/FAIL      | PASS/FAIL      |
| Limites de caracteres        | documentar     | documentar     |
| Credenciais dinâmicas        | PASS/FAIL      | PASS/FAIL      |
| Batching                     | PASS/FAIL      | PASS/FAIL      |
| Token inválido               | PASS/FAIL      | PASS/FAIL      |
| Deep link (background)       | PASS/FAIL      | PASS/FAIL      |
| Deep link (killed)           | PASS/FAIL      | PASS/FAIL      |
| Push silencioso              | PASS/FAIL      | PASS/FAIL      |

CRITÉRIO: todos PASS em Android. iOS pode ter limitações documentadas.
```

### Output Principal
```
Arquivo: push_limits.json

{
  "android": {
    "title_max_lockscreen": [X],
    "title_max_shade": [X],
    "body_max_lockscreen": [X],
    "body_max_shade": [X],
    "body_max_expanded": [X],
    "image_supported": true,
    "deep_link_background": true,
    "deep_link_killed": true,
    "silent_push": true
  },
  "ios": {
    "title_max_lockscreen": [X],
    "title_max_shade": [X],
    "body_max_lockscreen": [X],
    "body_max_shade": [X],
    "body_max_expanded": [X],
    "image_supported": true,
    "deep_link_background": true,
    "deep_link_killed": [true/false],
    "silent_push": [true/false]
  }
}
```

### Decisão Resultante
```
Atualizar CLAUDE.md com limites reais:
  PUSH_TITLE_MAX_LENGTH = min(android, ios)
  PUSH_BODY_MAX_LENGTH = min(android, ios)

Atualizar prompt da IA (Teste 4) com limites reais se diferentes dos 50/178 teóricos.

Se deep link não funciona com app killed:
  → Implementar cold start handler no Capacitor
  → Ou aceitar limitação e documentar

Se push silencioso não funciona no iOS:
  → Não depender dele para badge count no iOS
  → Usar notification service extension como alternativa
```

---

## TESTE 10 — OAuth Flow Completo (Shopify + Nuvemshop)
**Prioridade:** #10 (bloqueia todas as integrações)
**Duração:** meio dia (dia 7, paralelo com Teste 7)
**Custo:** R$0 (Partner accounts grátis)

### Justificativa
O CLAUDE.md define "zero acesso sem OAuth" (princípio #2). Se OAuth não funciona,
nenhuma integração funciona. Token storage com AES-256-GCM precisa ser validado.

### Setup
```bash
# Shopify: usar app do Teste 1 (já criado)
# Nuvemshop: criar app em https://partners.nuvemshop.com.br

mkdir test-oauth && cd test-oauth && npm init -y
npm install hono @hono/node-server @shopify/shopify-api axios crypto
```

### Cenários Shopify
```
Cenário 1 — Install flow completo
  1. Lojista clica "Install" no Shopify → redirect para nosso /auth
  2. Nosso server gera nonce, redirect para Shopify /oauth/authorize
  3. Lojista aprova → Shopify redirect para /auth/callback com code
  4. Server troca code por access_token
  5. Server encripta token (AES-256-GCM) e salva no banco
  ✅ PASS se token encriptado está no banco e funciona para API calls

Cenário 2 — Token encryption/decryption
  1. Encriptar token com AES-256-GCM
  2. Salvar encrypted_token + iv + auth_tag no banco
  3. Ler do banco e decriptar
  4. Usar token decriptado para GET /admin/api/products.json
  ✅ PASS se encrypt → save → load → decrypt → use funciona

Cenário 3 — Webhook HMAC validation
  1. Receber webhook do Shopify
  2. Calcular HMAC-SHA256 com client_secret
  3. Comparar com X-Shopify-Hmac-Sha256
  ✅ PASS se webhooks legítimos passam E webhooks forjados falham

Cenário 4 — Token revocation (uninstall)
  1. Lojista desinstala app no Shopify
  2. Shopify envia webhook app/uninstalled
  3. Sistema deleta token encriptado do banco
  4. Sistema marca tenant como inativo
  ✅ PASS se cleanup completo após uninstall

Cenário 5 — Scope validation
  1. Solicitar apenas scopes mínimos: read_products, read_orders, read_customers
  2. Tentar write_products com o token → deve falhar
  ✅ PASS se escopo mínimo é respeitado

Cenário 6 — Token com loja offline
  1. Usar token para API call quando loja está em manutenção
  2. Verificar: erro tratado corretamente? Retry? Graceful degradation?
  ✅ PASS se sistema não quebra com loja offline
```

### Cenários Nuvemshop
```
Cenário 7 — Install flow Nuvemshop
  1. Mesmo fluxo OAuth mas com endpoints Nuvemshop
  2. Diferenças: base URL, formato do token, scopes disponíveis
  ✅ PASS se fluxo funciona igual ao Shopify via adapter

Cenário 8 — Diferenças Nuvemshop
  Documentar:
  - Token expira? (Shopify não expira, Nuvemshop sim?)
  - Refresh token disponível?
  - Rate limits diferentes?
  - Webhooks disponíveis são os mesmos?
  - Formato de dados de produto/pedido difere?
```

### Critérios de Avaliação
```
| Cenário                      | Shopify        | Nuvemshop      |
|------------------------------|----------------|----------------|
| Install flow                 | PASS/FAIL      | PASS/FAIL      |
| Token encrypt/decrypt        | PASS/FAIL      | PASS/FAIL      |
| HMAC validation              | PASS/FAIL      | N/A ou testar  |
| Uninstall cleanup            | PASS/FAIL      | PASS/FAIL      |
| Scope mínimo                 | PASS/FAIL      | PASS/FAIL      |
| Graceful degradation         | PASS/FAIL      | PASS/FAIL      |

CRITÉRIO: Shopify 6/6 PASS obrigatório. Nuvemshop: documentar diferenças.
```

### Decisão Resultante
```
Se OAuth funciona bem em ambas:
  → Adapter pattern confirmado, interface comum funciona

Se Nuvemshop tem diferenças significativas:
  → Documentar em CLAUDE.md seção "Diferenças por Plataforma"
  → Adapter absorve diferenças, interface pública não muda

Se token encryption tem edge cases:
  → Documentar e tratar no código (ex: IV collision, auth_tag mismatch)

Output: módulo de OAuth reutilizável com testes automatizados.
```

---

## TESTE 11 — Stripe Billing + Limites de Plano
**Prioridade:** #11 (bloqueia monetização)
**Duração:** 1 dia (dia 8)
**Custo:** R$0 (Stripe test mode)

### Justificativa
Sem billing testado, não há monetização. O CLAUDE.md define regras complexas:
"notificações automáticas nunca param, manuais bloqueiam com soft limit".
Isso precisa ser validado antes de ir para produção.

### Setup
```bash
# Stripe test mode (não precisa de conta verificada)
# https://dashboard.stripe.com/test/

# Criar produtos e preços no Stripe:
#   Starter: R$127/mês, 15 notificações manuais
#   Business: R$197/mês, ilimitado
#   Elite: R$297/mês, ilimitado

mkdir test-stripe && cd test-stripe && npm init -y
npm install stripe hono @hono/node-server
```

### Cenários de Teste
```
Cenário 1 — Checkout flow
  1. Cliente seleciona plano Starter
  2. Redirect para Stripe Checkout
  3. Pagamento com cartão de teste (4242...)
  4. Webhook checkout.session.completed recebido
  5. Sistema cria subscription no banco
  6. Tenant marcado como ativo com plan_id correto
  ✅ PASS se fluxo completo funciona

Cenário 2 — Enforcement de limites (Starter)
  1. Tenant no plano Starter (15 notificações manuais/mês)
  2. Enviar 14 notificações manuais → funciona
  3. Enviar 15ª notificação manual → funciona (atingiu limite)
  4. Tentar 16ª notificação manual → soft block + upsell
  5. Notificação AUTOMÁTICA (carrinho abandonado) → DEVE funcionar
  ✅ PASS se manuais bloqueiam E automáticas continuam

Cenário 3 — Upgrade mid-cycle
  1. Tenant no Starter, já usou 10 notificações
  2. Upgrade para Business
  3. Stripe proration funciona?
  4. Limite resetado imediatamente?
  5. Tenant pode enviar notificações ilimitadas
  ✅ PASS se upgrade é instantâneo

Cenário 4 — Downgrade
  1. Tenant no Business (ilimitado)
  2. Downgrade para Starter
  3. Quando entra em vigor? (fim do billing cycle)
  4. Se já usou > 15 neste ciclo, o que acontece?
  ✅ PASS se downgrade é tratado corretamente

Cenário 5 — Falha no pagamento
  1. Simular cartão que falha (4000000000000341)
  2. Webhook invoice.payment_failed recebido
  3. Grace period: quantos dias antes de suspender?
  4. Durante grace period: tenant continua operando?
  5. Após grace period: tenant suspenso (push para, painel read-only)
  ✅ PASS se grace period funciona corretamente

Cenário 6 — Cancelamento
  1. Cliente cancela subscription
  2. Webhook customer.subscription.deleted recebido
  3. Acesso continua até fim do período pago
  4. Após período: tenant desativado
  5. Dados preservados por 90 dias (LGPD)
  ✅ PASS se cancelamento é gracioso

Cenário 7 — Webhook reliability
  1. Simular Stripe webhook com assinatura válida → aceito
  2. Simular webhook com assinatura inválida → rejeitado
  3. Simular webhook duplicado (mesmo event_id) → idempotente
  4. Simular webhook fora de ordem → tratado corretamente
  ✅ PASS se webhooks são seguros e idempotentes

Cenário 8 — Trial period (se aplicável)
  1. Criar subscription com trial de 14 dias
  2. Durante trial: funcionalidades completas
  3. Trial expira sem pagamento → suspensão
  4. Trial converte para pago → transição suave
  ✅ PASS se trial funciona end-to-end
```

### Critérios de Avaliação
```
| Cenário                      | Resultado      |
|------------------------------|----------------|
| Checkout flow                | PASS/FAIL      |
| Enforcement limites          | PASS/FAIL      |
| Upgrade mid-cycle            | PASS/FAIL      |
| Downgrade                    | PASS/FAIL      |
| Falha no pagamento           | PASS/FAIL      |
| Cancelamento                 | PASS/FAIL      |
| Webhook security             | PASS/FAIL      |
| Trial period                 | PASS/FAIL      |

CRITÉRIO: 7/8 PASS mínimo (trial pode ser Fase 2).
```

### Decisão Resultante
```
Se tudo funciona:
  → Copiar cenários como testes de integração no CI
  → Documentar grace period e edge cases no CLAUDE.md

Se enforcement de limites é complexo:
  → Simplificar para MVP: apenas contar e bloquear
  → Upsell UI pode vir na Fase 2

Se Stripe proration é confuso:
  → MVP: upgrade imediato, downgrade no próximo ciclo
  → Documentar regra simplificada

Output: módulo de billing com testes e regras de enforcement claras.
```

---

## TESTE 12 — Supabase Auth + MFA + Memberships
**Prioridade:** #12 (bloqueia acesso ao painel)
**Duração:** meio dia (dia 1, paralelo com Teste 0)
**Custo:** R$0 (Supabase free tier)

### Justificativa
Sem auth funcionando, ninguém acessa o painel. O CLAUDE.md define MFA via TOTP e
memberships multi-tenant. O JWT precisa conter claims customizados para RLS funcionar.

### Setup
```bash
# Usar Supabase do Teste 0
# Configurar Supabase Auth:
#   - Email/password habilitado
#   - MFA (TOTP) habilitado
#   - Custom JWT claims via database function

# SQL para claims customizados no JWT:
CREATE OR REPLACE FUNCTION auth.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  tenant_id uuid;
BEGIN
  claims := event->'claims';
  -- buscar tenant_id do membership
  SELECT m.tenant_id INTO tenant_id
  FROM memberships m
  WHERE m.user_id = (event->>'user_id')::uuid
  LIMIT 1;

  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(tenant_id));
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$ LANGUAGE plpgsql;
```

### Cenários de Teste
```
Cenário 1 — Signup + Login básico
  1. Criar conta com email + senha
  2. Verificar email (ou desabilitar verificação para teste)
  3. Login → receber JWT
  4. JWT contém: user_id, email, tenant_id (custom claim)
  ✅ PASS se login funciona e JWT tem claims corretos

Cenário 2 — MFA Setup
  1. User logado → habilitar MFA
  2. Supabase retorna QR code (TOTP URI)
  3. Escanear com app authenticator (Google Authenticator / Authy)
  4. Verificar código TOTP → MFA habilitado
  ✅ PASS se setup completo funciona

Cenário 3 — Login com MFA
  1. User com MFA habilitado tenta login
  2. Email + senha → retorna challenge (não JWT ainda)
  3. User envia código TOTP
  4. Código correto → recebe JWT
  5. Código errado → rejeição
  ✅ PASS se MFA é obrigatório após habilitado

Cenário 4 — Session refresh
  1. Login → JWT com expiry curto (1h)
  2. Após 50 min → refresh token
  3. Receber novo JWT sem re-login
  4. Refresh token expirado → forçar re-login
  ✅ PASS se refresh funciona sem perder sessão

Cenário 5 — Membership: usuário com 1 tenant
  1. User com membership em tenant_a
  2. Login → JWT tem tenant_id = tenant_a
  3. Todas as queries RLS filtram por tenant_a
  ✅ PASS se single-tenant funciona

Cenário 6 — Membership: usuário com múltiplos tenants
  1. User com membership em tenant_a E tenant_b
  2. Login → qual tenant_id vai no JWT?

  Opção A: JWT default = primeiro tenant, troca via API
    - POST /api/switch-tenant { tenant_id: "tenant_b" }
    - Novo JWT emitido com tenant_id = tenant_b

  Opção B: JWT sem tenant, header X-Tenant-Id por request
    - Cada request inclui header
    - Middleware valida membership antes de prosseguir

  Testar ambas opções e escolher a mais segura
  ✅ PASS se troca de tenant funciona sem vazamento

Cenário 7 — Roles dentro do tenant
  1. User com role "owner" em tenant_a → pode tudo
  2. User com role "editor" → pode criar/editar notificações
  3. User com role "viewer" → só leitura
  4. Tentar ação além do role → 403
  ✅ PASS se roles são enforced corretamente

Cenário 8 — Invite flow
  1. Owner de tenant_a convida user@email.com como "editor"
  2. Se user já tem conta → adiciona membership
  3. Se user não tem conta → envia invite email
  4. User aceita → cria conta + membership
  ✅ PASS se invite funciona end-to-end

Cenário 9 — Logout + revocation
  1. User faz logout → token invalidado
  2. Usar token antigo → rejeitado
  3. User logado em 2 dispositivos → logout de 1 não afeta outro
     (ou logout global revoga todos — decidir)
  ✅ PASS se logout funciona corretamente

Cenário 10 — Password reset
  1. User esqueceu senha → request reset
  2. Email com link de reset recebido
  3. Clicar link → definir nova senha
  4. Login com nova senha funciona
  5. Tokens antigos invalidados
  ✅ PASS se reset funciona end-to-end
```

### Critérios de Avaliação
```
| Cenário                      | Resultado      |
|------------------------------|----------------|
| Signup + Login               | PASS/FAIL      |
| MFA Setup                    | PASS/FAIL      |
| Login com MFA                | PASS/FAIL      |
| Session refresh              | PASS/FAIL      |
| Single tenant                | PASS/FAIL      |
| Multi-tenant switch          | PASS/FAIL      |
| Roles enforcement            | PASS/FAIL      |
| Invite flow                  | PASS/FAIL      |
| Logout + revocation          | PASS/FAIL      |
| Password reset               | PASS/FAIL      |

CRITÉRIO: 8/10 PASS mínimo (invite + MFA podem ser Fase 2 se necessário).
```

### Decisão Resultante
```
Multi-tenant auth strategy:
  → Opção escolhida: [A: JWT switch / B: Header por request]
  → Justificativa: [segurança vs UX]

Se custom JWT claims funcionam:
  → RLS usa auth.jwt() ->> 'tenant_id' (conforme CLAUDE.md)

Se custom JWT claims NÃO funcionam:
  → Alternativa: middleware que seta role via SET LOCAL
  → Impacto no Teste 0 (RLS + ORM)

Se MFA é muito complexo para MVP:
  → MVP sem MFA, habilitar na Fase 2
  → Documentar no CLAUDE.md

Output: módulo de auth com strategy definida e testes automatizados.
```

---

## Consolidação dos Resultados

### Ao final dos 8 dias, atualizar o CLAUDE.md com:

```
Seção: Research Results

### Supabase RLS + ORM (Teste 0)
- Drizzle: [funciona / workaround / não funciona]
- Prisma: [funciona / workaround / não funciona]
- Impacto na decisão de ORM: [nenhum / favorece X / eliminatório]

### Webhook Shopify (Teste 1)
- Taxa de entrega real: [X%]
- Latência média: [X]ms
- Replay após downtime: [sim/não, delay Xs, Y tentativas]
- Decisão: [webhook only / webhook + polling fallback]

### ORM (Teste 2)
- Vencedor: [Drizzle / Prisma]
- Motivo: [resumo]
- Performance delta: [X% mais rápido em Y]
- Custo de migração considerado: [sim]

### BullMQ Config (Teste 3)
- Batch size: [X]
- Concurrency: [X]
- Rate limit: [X/s]
- Retry: [X attempts, backoff X-Xms]
- Upstash delta: [X% mais lento que local]
- Reconnect: [funciona / precisa de workaround]

### LLM Provider (Teste 4)
- Default: [Claude Haiku / GPT-4o-mini / Llama]
- Fallback: [segundo lugar]
- Custo estimado: $[X]/mês para 50K notificações
- Score qualidade: [X/5]
- Método de avaliação: [25 amostras/modelo, 2 avaliadores]

### RAG Strategy (Teste 5)
- MVP: [contexto no prompt / cache Redis / pgvector]
- Threshold para upgrade: [X produtos]

### App Framework (Teste 6)
- Escolha: [Capacitor] (confirmado)
- Push iOS: [funciona / limitações]

### Horários Ideais — Seed Data (Teste 7)
- Arquivo: brain_seed_data.json
- Lojas analisadas: [X]
- Campanhas analisadas: [X]
- Confiança: baixa (proxy de email)
- Plano de atualização: [low → medium → high]

### Multi-tenant Isolation (Teste 8)
- Cenários passando: [X/7]
- Vulnerabilidades encontradas: [listar ou "nenhuma"]
- Testes automatizados: [criados para CI]

### OneSignal Push Real (Teste 9)
- Push Android: [funciona / limitações]
- Push iOS: [funciona / limitações]
- Título max real: [X chars]
- Corpo max real: [X chars]
- Deep link: [funciona / limitações por OS]
- Arquivo: push_limits.json

### OAuth (Teste 10)
- Shopify: [X/6 cenários PASS]
- Nuvemshop: [diferenças documentadas]
- Token encryption: [funciona / edge cases]

### Stripe Billing (Teste 11)
- Checkout flow: [funciona]
- Enforcement limites: [funciona / simplificado]
- Grace period: [X dias]
- Cenários passando: [X/8]

### Supabase Auth (Teste 12)
- Auth strategy: [JWT switch / Header por request]
- MFA: [MVP / Fase 2]
- Cenários passando: [X/10]
- Custom JWT claims: [funciona / alternativa]
```

---

## Checklist Final Pré-MVP

Depois dos 8 dias de testes, antes de iniciar o MVP:

- [ ] Monorepo commitado com CI desde o dia 1
- [ ] Todos os 12 testes (0-12) executados e documentados
- [ ] CLAUDE.md atualizado com todos os resultados
- [ ] Decisões de stack confirmadas (sem "vamos ver depois")
- [ ] brain_seed_data.json gerado com metadata de confiança
- [ ] push_limits.json gerado com limites reais de caracteres
- [ ] Config de BullMQ definida (local + Upstash)
- [ ] Webhook reliability documentada com estratégia de fallback e replay
- [ ] Multi-tenant isolation 7/7 PASS (obrigatório)
- [ ] OAuth encrypt/decrypt validado
- [ ] Auth strategy definida (JWT switch vs header)
- [ ] Billing enforcement rules definidas
- [ ] Scripts de benchmark salvos para re-execução futura
- [ ] Testes de isolamento copiados para CI pipeline
- [ ] Supabase project criado com schema inicial
- [ ] OneSignal app de teste criado via API
- [ ] Primeiro push enviado e recebido em device real
- [ ] Stripe test mode configurado com produtos e preços
