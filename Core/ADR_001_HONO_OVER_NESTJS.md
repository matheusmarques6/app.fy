# ADR-001: Hono como Framework Backend (sobre NestJS)

**Status:** Aceito
**Data:** 2026-03-10
**Decisores:** Arquiteto, Dev, Analytics, BDM

---

## Contexto

O projeto precisa de um framework backend para:
- API REST multi-tenant com middleware chain (auth → tenant → roles)
- Workers long-running (BullMQ) para push notifications
- Integração com Supabase, Firebase, Shopify, Nuvemshop
- TDD obrigatório com alta testabilidade
- Deploy em Railway/Render (Node.js)

O projeto anterior (Convertfy) usava NestJS e teve problemas:
- `@ts-nocheck` necessários por conflitos de tipo com decorators
- Bundle pesado para workers simples
- DI container dificultava debugging

5 opções avaliadas:
- (a) NestJS
- (b) Hono
- (c) Express/Fastify raw
- (d) Next.js API Routes
- (e) Outros

---

## Decisão

**Hono** como framework backend para API e base dos workers.

---

## Avaliação por Perspectiva

### Arquiteto — Hono (confiança alta)

| Critério | NestJS | Hono | Veredito |
|---|---|---|---|
| Redundância com patterns do CLAUDE.md | Alta (modules + providers + decorators sobre Repository + Adapter + Pipeline) | Nenhuma (framework sai do caminho) | Hono |
| Type safety | Decorators são runtime, não compile-time | Tipos inferidos nativamente | Hono |
| Workers leves | ~150-200MB RAM por worker | ~50MB RAM por worker | Hono |
| Multi-runtime (Node, Bun, Edge) | Apenas Node | Node, Bun, Cloudflare Workers, Deno | Hono |
| Middleware chain explícito | Implícito via decorators/guards | Explícito e composável | Hono |
| Maturidade de ecossistema | 7+ anos, enorme | 3+ anos, crescendo rápido | NestJS |

**Argumento decisivo:** O CLAUDE.md já define toda a arquitetura via patterns (Repository, Adapter, Pipeline, Factory). NestJS adicionaria uma segunda camada organizacional (modules, providers, interceptors, pipes, guards, filters) que é redundante. Hono deixa os patterns serem a arquitetura, sem framework noise.

### Dev — NestJS preferido, Hono aceito (confiança média)

| Critério | NestJS | Hono |
|---|---|---|
| Experiência prévia | Sim, fluente | Não, mas API similar a Express |
| Curva de aprendizado | 0 | ~1 dia |
| Boilerplate para nova rota | Baixo (CLI gera) | Baixo (arquivo simples) |
| Mocking em testes | DI facilita, mas setup pesado | Factory functions, setup leve |
| Comunidade PT-BR | Grande | Pequena |
| Debug quando quebra | Difícil (decorators escondem) | Fácil (código explícito) |

**Condições para aceitar Hono:**
1. `middleware/` organizado desde o dia 1 (auth, tenant, roles, validate, logger, error)
2. Factory functions para DI manual com tipagem forte
3. Zod para toda validação de input
4. OpenTelemetry configurado no setup inicial, não "depois"

### Analytics — Neutro (sem preferência forte)

Ambos suportam o log estruturado obrigatório:
```json
{ "timestamp", "requestId", "tenantId", "userId", "method", "path", "status", "latencyMs" }
```

NestJS tem módulo OTel oficial. Hono precisa setup manual.
Diferença: ~2h de setup. Não é decisivo.

### BDM — Hono (confiança alta)

| Critério | NestJS | Hono | Impacto |
|---|---|---|---|
| RAM por worker | ~150-200MB | ~50MB | R$600-1200/ano economizados |
| Velocidade de iteração | Mais boilerplate | Menos boilerplate | Features entregues mais rápido |
| Opcionalidade Edge | Impossível | Grátis | Seguro de futuro sem custo |
| Pool de contratação | Grande | Menor (mas quem sabe Express aprende em 1 dia) | Risco baixo |

---

## Consequências

### Positivas
- Workers 3x mais leves → menor custo de infra
- TypeScript sem hacks de decorator → zero `@ts-nocheck`
- Testes mais simples → TDD mais fluido
- Opcionalidade de runtime → pode migrar para Edge/Bun sem reescrita
- Código explícito → debug direto ao ponto

### Negativas
- DI manual via factories (mais verboso que NestJS @Inject)
- Sem Swagger auto-gen (usar @hono/zod-openapi)
- Menos exemplos prontos na comunidade PT-BR
- Setup inicial de OTel manual (~2h)

### Riscos mitigados
- "E se Hono morrer?" → API é padrão Web (Request/Response). Migrar para qualquer framework é trocar imports, não reescrever lógica.
- "E se precisar de DI complexo?" → Se o projeto crescer a ponto de precisar DI container, adicionar `tsyringe` ou `awilix` depois. Custo: 1 dia de refactor.

---

## Alternativas Rejeitadas

### NestJS
Rejeitado por redundância com patterns já definidos e histórico de problemas de tipo.

### Express/Fastify raw
Rejeitado por falta de opinião estrutural. Sem framework opinion = cada dev faz diferente.
Fastify seria segunda opção após Hono (performance, schema validation nativo).

### Next.js API Routes
Eliminado. Workers long-running (BullMQ) não rodam em serverless. Teria 2 runtimes diferentes.

---

## Referências

- Hono docs: https://hono.dev
- Hono middleware: https://hono.dev/docs/guides/middleware
- @hono/zod-openapi: https://github.com/honojs/middleware/tree/main/packages/zod-openapi
- Benchmark Hono vs Express vs Fastify: https://hono.dev/docs/concepts/benchmarks
