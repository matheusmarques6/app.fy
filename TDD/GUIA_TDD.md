# GUIA COMPLETO — TDD NA PRÁTICA

> Do Zero ao Deploy com Confiança
> Baseado na live coding de Diego Fernandes & Rodrigo Manguinho (Rocketseat)
> Complementado com pesquisa aprofundada sobre TDD, CI/CD, GitHub Actions & Vercel
> AppFy - Documentação Técnica Interna | 2025

---

## PARTE 1: FUNDAMENTOS DO TDD

Test-Driven Development (TDD) é uma metodologia onde **você escreve o teste ANTES do código de produção**. Kent Beck formalizou a prática no livro *Test-Driven Development: By Example* (2003). O ciclo central é repetido dezenas de vezes por hora e se chama **Red-Green-Refactor**.

### 1.1 O Ciclo Red-Green-Refactor

**RED** — Escreva um teste pequeno (geralmente 3-5 linhas) que define um comportamento que ainda não existe. Rode. Confirme que falhou. Isso leva cerca de 30 segundos.

**GREEN** — Escreva o MÍNIMO de código de produção para fazer o teste passar. Hardcode e código feio são aceitáveis aqui. Não se preocupe com design. Só faça o teste ficar verde o mais rápido possível.

**REFACTOR** — Com os testes passando, melhore a estrutura do código sem mudar o comportamento. Remova duplicação, extraia abstrações, limpe code smells. Rode os testes após cada mudança.

> **ALERTA DO MANGUINHO (Live Coding)**
> "Muita gente tenta aplicar TDD sem estudar antes. Se você não domina a metodologia, você vai atrasar o projeto, seu chefe vai ficar irritado, e você vai passar a imagem de que teste atrasa. Estude primeiro. Não queime cartucho."

> **MENTALIDADE CENTRAL**
> Se o código "não tá com cara de certo", é porque falta teste. Quando você sente que algo está incompleto, esse sentimento é o sinal de que você precisa escrever mais testes. O código cresce organicamente, sempre coberto.

### 1.2 Desmistificando o TDD: O Que NÃO É

| Mito | Realidade |
|---|---|
| "TDD atrasa o projeto" | Estudos mostram 40-90% menos bugs e 32% mais releases. O investimento inicial de 15-35% se paga exponencialmente em manutenção. |
| "É só para projetos novos" | TDD funciona inclusive (e especialmente) para bug fixes: escreva um teste que reproduz o bug, depois corrija. |
| "100% de cobertura = qualidade" | Cobertura mede se o código rodou, não se está correto. Você pode ter 100% com zero assertions úteis. O sweet spot é 75-85%. |
| "Senior sabe tudo" | Dan Abramov (criador do Redux) levou 20 min para centralizar um texto em CSS ao vivo. Ninguém é senior em tudo. |
| "Preciso de banco e Express para testar" | Com TDD, você testa a regra de negócio SEM banco, SEM framework. Depois plugar infra é detalhe. |

### 1.3 Quando TDD Faz Sentido (e Quando Não)

**Ideal para:**
- **Lógica de negócio complexa** — cálculos, regras condicionais, máquinas de estado
- **APIs e endpoints** — contratos de request/response
- **Bug fixes** — escreva o teste que reproduz o bug PRIMEIRO
- **Bibliotecas e utils** — funções puras com input/output claro

**Menos efetivo para:**
- Prototipação rápida e MVPs descartáveis
- UI/design visual puro (use testes visuais/snapshot)
- Scripts one-off que não vão para produção

> **CONSELHO PRÁTICO**
> Olhe para o seu momento e o contexto do time. Se o time não está apto e não tem vontade de aplicar, será uma força vindo de um lado só. Comece estudando, pratique em projetos pessoais, e quando se sentir seguro, proponha ao time.

---

## PARTE 2: TDD PASSO A PASSO (Live Coding)

Cada etapa exata demonstrada ao vivo, com os princípios e patterns aplicados em cada momento. O exemplo é um caso de uso real: **verificar o status do último evento de um grupo** (ativo, em revisão, ou finalizado).

### ETAPA 0: Setup e Mentalidade

**Princípio: YAGNI (You Ain't Gonna Need It)**

Antes de escrever qualquer código, resista à tentação de instalar Express, MongoDB, Prisma. **Não faça coisas enquanto não precisa.** O caso de uso precisa de uma data de término e uma duração. De onde vem esses dados (Mongo, Postgres, API) é irrelevante para a regra de negócio.

> **SPECULATIVE GENERALITY (Code Smell a evitar)**
> Começar supondo coisas que você vai precisar antes de realmente precisar. Exemplo: instalar 10 dependências no início do projeto "porque talvez eu precise".

**Documentação mínima antes de codar:**
1. **Caso de uso:** Descrição textual da feature (input, output, regras)
2. **Timeline visual:** Diagrama de linha do tempo para cálculos com data
3. **Anotações:** Lista de anti-patterns e boas práticas encontrados durante o desenvolvimento

### ETAPA 1: Primeiro Teste — Verificar Chamada ao Repositório

**O que testar:** "Preciso garantir que meu caso de uso busca os dados do último evento com o group ID correto."

```typescript
// check-last-event-status.spec.ts

describe('CheckLastEventStatus', () => {
  it('should get last event data', async () => {
    // Arrange
    const loadLastEventRepository = new LoadLastEventRepositorySpy()
    const sut = new CheckLastEventStatus(loadLastEventRepository)

    // Act
    await sut.perform({ groupId: 'any_group_id' })

    // Assert
    expect(loadLastEventRepository.groupId).toBe('any_group_id')
    expect(loadLastEventRepository.callsCount).toBe(1)
  })
})
```

> **PADRÃO AAA (Arrange, Act, Assert)**
> Todo teste segue três blocos separados por linha em branco: (1) Arrange — prepara dependências e dados, (2) Act — executa a ação, (3) Assert — verifica o resultado. No código de produção, nunca pula linha. No teste, pula para marcar os blocos.

**Código FALHA (RED):** A classe CheckLastEventStatus não existe. O TypeScript não compila. Isso já é RED no TDD. Erro de compilação = RED.

**Criar o mínimo para compilar:**

```typescript
interface LoadLastEventRepository {
  loadLastEvent(input: { groupId: string }): Promise<void>
}

class LoadLastEventRepositorySpy implements LoadLastEventRepository {
  groupId?: string
  callsCount = 0

  async loadLastEvent({ groupId }: { groupId: string }): Promise<void> {
    this.groupId = groupId
    this.callsCount++
  }
}

class CheckLastEventStatus {
  constructor(
    private readonly loadLastEventRepository: LoadLastEventRepository
  ) {}

  async perform({ groupId }: { groupId: string }): Promise<void> {
    await this.loadLastEventRepository.loadLastEvent({ groupId })
  }
}
```

**Teste PASSA (GREEN).** COMMIT.

**Princípios aplicados:**

| Princípio/Pattern | O Que Foi Feito | Por Quê |
|---|---|---|
| Single Responsibility (SRP) | Caso de uso NÃO cria sua própria dependência | Cada classe tem UMA responsabilidade |
| Dependency Injection (DI) | Repositório é injetado via construtor | Evita Improper Instantiation e permite troca |
| Dependency Inversion (DIP) | Caso de uso depende de INTERFACE, não de classe concreta | Domínio não conhece infraestrutura |
| Liskov Substitution (LSP) | Posso trocar implementação sem quebrar o caso de uso | Mock, Postgres, Mongo — tanto faz |
| Repository Pattern | Classe dedicada a obter dados de fonte externa | Separação domínio vs infra |
| Strategy Pattern | Interface permite múltiplas estratégias de busca | Composição flexível |
| Test Double (Mock) | Spy captura input para verificação | Testa sem banco de dados real |
| SUT Convention | Variável principal do teste se chama 'sut' | Clareza: quem estou testando? |

### ETAPA 2: Testar Retorno Quando Não Há Evento

**O que testar:** "Se o grupo não tem nenhum evento marcado, retorne status 'done'."

```typescript
it('should return status done when group has no event', async () => {
  const { sut, loadLastEventRepository } = makeSut()
  loadLastEventRepository.output = undefined

  const eventStatus = await sut.perform({ groupId })

  expect(eventStatus.status).toBe('done')
})
```

**Implementação GREEN (marretada):**

```typescript
async perform({ groupId }: { groupId: string }): Promise<EventStatus> {
  await this.loadLastEventRepository.loadLastEvent({ groupId })
  return { status: 'done' }  // <-- MARRETADO! E isso mesmo.
}
```

> **"MAS ISSO NÃO TÁ CERTO!"**
> Se você sentiu que retornar 'done' direto não está certo, é porque FALTA TESTE. Quando criarmos o próximo teste com status diferente, seremos obrigados a colocar lógica. Enquanto só existe um status possível, marretar é a resposta CORRETA no TDD.

**Evolução: Mock vira Spy**

| Tipo | Se Preocupa Com | Exemplo |
|---|---|---|
| Mock | Input (entrada) | Verifica se o método foi chamado com parâmetros corretos |
| Stub | Output (saída) | Retorna valor pré-definido sem verificar chamada |
| Spy | Input E Output | Verifica chamada E controla retorno |
| Fake | Implementação simplificada | Banco em memória ao invés de Postgres real |

**Factory Method para evitar duplicação:**

```typescript
const makeSut = () => {
  const loadLastEventRepository = new LoadLastEventRepositorySpy()
  const sut = new CheckLastEventStatus(loadLastEventRepository)
  return { sut, loadLastEventRepository }
}
```

> **FACTORY PATTERN**
> Quando a criação de uma instância se repete em múltiplos testes, centralize num factory. Se a assinatura do construtor mudar, você altera UM lugar, não todos os testes.

### ETAPA 3: Status Active — O Agora Está Antes do Fim

**O problema das datas:** Quando você cria um `new Date()` no teste e outro `new Date()` no código de produção, já passou 1ms. O teste pode falhar por timing. Solução: **congelar a data** com MockDate:

```typescript
import { set, reset } from 'mockdate'

beforeAll(() => { set(new Date()) })  // Congela o tempo
afterAll(() => { reset() })           // Descongela
```

```typescript
it('should return status active when now is before event end time', async () => {
  const { sut, loadLastEventRepository } = makeSut()
  loadLastEventRepository.output = {
    endDate: new Date(new Date().getTime() + 1), // 1ms no futuro
    reviewDurationInHours: 1,
  }

  const eventStatus = await sut.perform({ groupId })

  expect(eventStatus.status).toBe('active')
})
```

### ETAPA 4: Status In Review — Forçando a Lógica

```typescript
it('should return status inReview when now is after event end time', async () => {
  const { sut, loadLastEventRepository } = makeSut()
  loadLastEventRepository.output = {
    endDate: new Date(new Date().getTime() - 1), // 1ms no passado!
    reviewDurationInHours: 1,
  }

  const eventStatus = await sut.perform({ groupId })

  expect(eventStatus.status).toBe('inReview')
})
```

### ETAPA 5: Testando nos Limites (Boundary Testing)

| Teste | Condição | Status Esperado |
|---|---|---|
| now < endDate | Agora antes do fim | active |
| now = endDate | Exatamente no limite | active |
| now > endDate (por 1ms) | Logo após o fim | inReview |
| now < reviewTime | Antes do fim da revisão | inReview |
| now = reviewTime | Exatamente no limite da revisão | inReview |
| now > reviewTime (por 1ms) | Logo após o fim da revisão | done |

> **SEMPRE TESTE NOS LIMITES**
> Esqueceu um `>=` e botou só `>`? Esse bug aparece a cada X mil requests quando o timing bate exatamente no limite. Com teste de boundary, você pega isso ANTES de ir pra produção.

### ETAPA 6: Implementação Final

```typescript
async perform({ groupId }: Input): Promise<EventStatus> {
  const event = await this.loadLastEventRepository.loadLastEvent({ groupId })
  if (event === undefined) return { status: 'done' }

  const now = new Date()
  if (event.endDate >= now) return { status: 'active' }

  const reviewDurationInMs = event.reviewDurationInHours * 60 * 60 * 1000
  const reviewDate = new Date(event.endDate.getTime() + reviewDurationInMs)
  if (reviewDate >= now) return { status: 'inReview' }

  return { status: 'done' }
}
```

### ETAPA 7: Refactor — Extrair para Entidade

```typescript
type Status = 'active' | 'inReview' | 'done'

class EventStatus {
  status: Status

  constructor(event?: { endDate: Date; reviewDurationInHours: number }) {
    if (event === undefined) {
      this.status = 'done'
      return
    }
    const now = new Date()
    if (event.endDate >= now) {
      this.status = 'active'
      return
    }
    const reviewDurationInMs = event.reviewDurationInHours * 60 * 60 * 1000
    const reviewDate = new Date(event.endDate.getTime() + reviewDurationInMs)
    this.status = reviewDate >= now ? 'inReview' : 'done'
  }
}
```

O caso de uso agora só faz: `return new EventStatus(event)`. Toda a lógica vive na entidade. **Todos os testes continuam passando** — esse é o poder do refactor com cobertura.

---

## PARTE 3: ANTI-PATTERNS E BOAS PRÁTICAS

### 3.1 Code Smells e Anti-Patterns a Evitar

1. **Speculative Generality** — Instalar dependências ou criar abstrações "porque talvez precise"
2. **Improper Instantiation** — Classe cria suas próprias dependências internamente (impossível testar)
3. **High Coupling** — Depender de classe concreta ao invés de interface
4. **Test Code in Production** — Propriedades que só existem para o teste poder ler
5. **God Class** — Classe que faz muita coisa (busca dados + calcula + formata + salva)
6. **Divergent Change** — Mexer num componente por mais de um motivo
7. **Duplicate Code** — Criar SUT manualmente em cada teste ao invés de usar factory
8. **Shotgun Surgery** — Mexer num lugar e acender vermelho em vários outros
9. **Long Parameter List** — Método com muitos parâmetros soltos ao invés de objeto nomeado
10. **Primitive Obsession** — Retornar string pura ao invés de tipo estruturado (EventStatus)
11. **Bad Names** — reviewDuration ao invés de reviewDurationInHours — unidade faz diferença
12. **Blank Lines no código** — Evitar pular linha em produção; no teste usar para marcar AAA

### 3.2 Boas Práticas e Design Patterns Aplicados

1. **YAGNI** — Não instale/crie até precisar
2. **SRP (Single Responsibility)** — Cada classe, uma responsabilidade
3. **DIP (Dependency Inversion)** — Dependa de abstrações, não de concretos
4. **LSP (Liskov Substitution)** — Troque implementação sem quebrar nada
5. **Dependency Injection** — Receba dependências pelo construtor
6. **Repository Pattern** — Abstrai acesso a dados
7. **Strategy Pattern** — Interface permite múltiplas implementações
8. **Factory Pattern** — Centraliza criação de objetos complexos
9. **Test Doubles (Mock/Spy/Stub)** — Isola componente sem dependências reais
10. **SUT Convention** — Variável principal se chama 'sut' em todo teste
11. **AAA Pattern** — Arrange, Act, Assert em blocos separados
12. **Small Commits** — TDD facilita: completou etapa? Commit.
13. **Clean Code naming** — Nomes explicativos com unidades (InHours, InMs)
14. **Boundary Testing** — Teste nos limites exatos (igual, +1ms, -1ms)
15. **If-Return > If-Else** — Evita identação hadouken

---

## PARTE 4: CI/CD — INTEGRANDO TDD AO DEPLOY

### 4.1 O Pipeline Completo

| Etapa | O Que Faz | Ferramenta |
|---|---|---|
| 1. Lint | Verifica estilo e erros estáticos | Biome + TypeScript (tsc --noEmit) |
| 2. Unit Tests | Roda testes unitários com cobertura | Vitest |
| 3. Integration Tests | Testa com banco de dados real | Testcontainers / Service Containers |
| 4. Security Scan | SAST + dependency audit | CodeQL + pnpm audit |
| 5. Deploy | Build e deploy SOMENTE se tudo passou | Vercel CLI via GitHub Actions |
| 6. E2E + Smoke | Testa o app deployado | Playwright + curl health check |

### 4.2 GitHub Actions + Vercel: Configuração

**Passo 1: Desabilitar deploy automático do Vercel**

```json
// vercel.json
{
  "git": { "deploymentEnabled": false }
}
```

**Passo 2: Configurar secrets no GitHub**
- `VERCEL_TOKEN` — Token da sua conta Vercel
- `VERCEL_ORG_ID` — ID da organização
- `VERCEL_PROJECT_ID` — ID do projeto

**Passo 3: Workflow YAML completo**

```yaml
name: CI/CD Pipeline

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome check
      - run: pnpm tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm vitest run --coverage

  deploy:
    runs-on: ubuntu-latest
    needs: [quality, test]  # SÓ DEPLOYA SE AMBOS PASSAREM
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: npm i -g vercel@latest
      - run: |
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

> **POR QUE --prebuilt?**
> O flag `--prebuilt` diz ao Vercel para pular o build e usar os artefatos já construídos. Build errors são pegos no GitHub Actions, não no Vercel.

---

## PARTE 5: FERRAMENTAS RECOMENDADAS (2025)

| Categoria | Ferramenta | Por Quê |
|---|---|---|
| Unit/Integration | **Vitest** | 3-4x mais rápido que Jest, ESM nativo, API 95% compatível |
| E2E | **Playwright** | Cross-browser (Chrome, Firefox, Safari), paralelismo nativo |
| API Testing | **Hono `app.request()`** | Testa endpoints sem subir servidor (test client nativo) |
| Mock de data | **MockDate** | Congela `new Date()` para testes determinísticos |
| Mock de API | **MSW** | Mock Service Worker — intercepta fetch realisticamente |
| Cobertura | **v8 (via Vitest)** | Coverage nativo sem overhead de Istanbul |
| Mutation Testing | **Stryker** | Revela se seus asserts realmente detectam bugs |
| CI/CD | **GitHub Actions** | Nativo no GitHub, YAML, matrix builds, caching |
| Deploy | **Vercel** | Preview deploys por PR, rollback instantâneo, Edge |
| SAST | **CodeQL** | Análise estática de segurança nativa do GitHub |
| Deps | **Dependabot** | Atualiza dependências automaticamente com PRs |

---

## PARTE 6: CHECKLIST DO TDD

Use este checklist para cada feature que você desenvolver com TDD:

| # | Etapa | Feito? |
|---|---|---|
| 1 | Descrevi o caso de uso em texto (input, output, regras) | [ ] |
| 2 | Criei timeline/diagrama para lógica complexa (datas, estados) | [ ] |
| 3 | Criei arquivo `.spec.ts` com `describe` e primeiro `it` | [ ] |
| 4 | Escrevi teste RED que falha (compilação ou assertion) | [ ] |
| 5 | Escrevi MÍNIMO de código para ficar GREEN | [ ] |
| 6 | COMMIT com mensagem descritiva | [ ] |
| 7 | Refatorei (extrair factory, renomear, limpar) | [ ] |
| 8 | Testei nos LIMITES (igual, +1, -1) | [ ] |
| 9 | Verifiquei: nenhum code smell novo (God Class, High Coupling...) | [ ] |
| 10 | Extraí regra de negócio para entidade/value object | [ ] |
| 11 | Todos os testes passando após refactor | [ ] |
| 12 | Push → CI roda lint + testes automaticamente | [ ] |
| 13 | Deploy só acontece se CI passou | [ ] |

> *"O TDD não é um bicho de sete cabeças. Ele não é essa coisa que muita gente acha. Se você sente que o código não tá com cara de certo, é porque falta teste." — Rodrigo Manguinho*
