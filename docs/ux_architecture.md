# AppFy Admin Dashboard - UX/UI Architecture

Este documento descreve a estrutura, navegação e arquitetura de componentes visuais do painel administrativo do AppFy, baseado no Next.js App Router, shadcn/ui e Tailwind CSS.

## 1. Estrutura de Layout e Navegação

O painel segue um layout clássico de Dashboard B2B SaaS, visando máxima clareza e retenção de usuários.

### 1.1 Header (Fixo)
O Header acompanha o usuário em todas as páginas para garantir acesso rápido a funções globais.

*   **Tenant Switcher:** Dropdown no canto esquerdo. Permite alternar rapidamente entre diferentes lojas/apps caso o usuário tenha acesso a múltiplos (graças à arquitetura multi-tenant).
*   **Central de Notificações:** Ícone de sino (🔔). Exibe alertas do sistema, como:
    *   Falhas de envio de push
    *   Build do app finalizado
    *   Desconexões de integrações
*   **Menu do Usuário:** Avatar e nome à direita. Dropdown contendo:
    *   Meu Perfil
    *   Configurações
    *   Sair (Logout)

### 1.2 Sidebar (Menu Principal)
Navegação lateral agrupada de forma lógica para gerenciar o "Motor de Receita".

1.  **Home (Dashboard)**
2.  **Notificações**
3.  **Automações**
4.  **Analytics**
5.  **App**
6.  **Integrações**
7.  **Usuários**
8.  **Billing**
9.  **Configurações**

---

## 2. Mapa de Telas e Componentes

Abaixo está o detalhamento de cada tela, seus cards e elementos interativos.

### 2.1 Dashboard (Home)
Foco em "Hero Metrics" — mostrar o valor financeiro do produto nos primeiros segundos.
*   **Hero Metric (Destaque Principal):** "Receita gerada por push (R$)" - Texto em fonte grande.
*   **Métricas Secundárias (Cards Menores):**
    *   Notificações enviadas (no período)
    *   Taxa de abertura (%)
    *   Taxa de clique (%)
    *   Taxa de conversão (%)
*   **Gráfico de Receita:** Gráfico de linha mostrando a evolução dos últimos 30 dias.
*   **Top 5 Notificações:** Mini-tabela listando os disparos que geraram mais conversão.
*   **Visão Geral do Sistema:**
    *   Automações Ativas (ex: "7/9")
    *   Status do App (Publicado, Pendente, etc.)

### 2.2 Notificações
Gestão do disparo manual de campanhas. Possui duas sub-abas (Tabs):
*   **Sub-abas:** "Manuais", "Histórico"

*   **Elementos Principais:**
    *   **Botão Novo Disparo:** Call-to-action (CTA) principal "Nova Notificação" (abre um formulário completo em página ou Sheet/Drawer).
    *   **Filtros de Tabela:** Status, período, tipo de flow.
    *   **Tabela de Dados:** Título, segmento alvo, data, badge de status (draft, scheduled, sending, sent, failed), mini-indicador numérico de (enviadas/abertas/clicadas).
*   **Ação (Linha da Tabela):** Clicar em uma notificação abre a **Página de Detalhe**:
    *   Preview visual do push no celular.
    *   Métricas completas do disparo (funil numérico).
    *   Comparação A/B (caso variant exista).

### 2.3 Automações
O "coração" do motor de receita. Visão em formato de grid.
*   **Cards de Fluxos (9 no total):**
    1.  Carrinho abandonado
    2.  PIX recovery
    3.  Boleto recovery
    4.  Boas-vindas
    5.  Checkout abandonado
    6.  Pedido confirmado
    7.  Rastreio criado
    8.  Browse abandoned
    9.  Upsell
*   **Estrutura de cada Card:**
    *   Título e Ícone descritivo.
    *   Toggle (Switch On/Off).
    *   Badge de Status (Ativo, Pausado, Faltando Template).
    *   Delay programado (ex: "Envia após 1h").
    *   Métricas de resumo (Enviadas, Conversões, R$).
*   **Ação (Clicar no Card):** Abre um *Sheet (Drawer Lateral)* contendo:
    *   Editor de Template (textareas para Título e Contexto + chips arrastáveis ou clicáveis para inserir variáveis dinâmicas).
    *   Seletor numérico para ajuste de delay.
    *   Preview do Push (visual).
    *   Métricas detalhadas apenas deste fluxo específico.

### 2.4 Analytics
Mergulho nos dados de performance global.
*   **Sub-abas:** "Visão Geral", "Por Notificação", "Por Flow", "Eventos"

*   **Visualizações de Dados (Gráficos/Cards):**
    *   **Funil de Perfomance:** Elemento visual que afunila Enviadas → Entregues → Abertas → Clicadas → Convertidas.
    *   **Receita por Flow:** Gráfico de Barras horizontais ou verticais para comparação rápida.
    *   **Heatmap de Engajamento:** Matriz de dia da semana x horas mostrando onde a audiência mais abre/clica (se aplicável).
    *   **Comparativo A/B:** View gráfica.
    *   **Distribuição de Plataforma:** Pie chart (Android vs iOS).
    *   **Visão de Usuários:** Gráfico em área preenchida sobre usuários ativos (7/30 dias).
    *   **Audit de Eventos:** Gráfico de barras simples para eventos técnicos (app_opened, checkout, etc).
    *   **KPIs Finais:** % de Opt-In de push e retenção (7d/30d).

### 2.5 App
Área onde o cliente personaliza a identidade visual da infraestrutura final e aciona o build.
*   **Sub-abas:** "Configuração", "Preview", "Build"

*   **1. Configuração (Form):**
    *   Campos de Texto/Upload: Nome do app, Upload via dropzone para Ícone e Splash (integração visual direta ao Cloudflare R2).
    *   Color Pickers: Primária, Secundária (com feedback visual hex/rgb).
    *   Campos Técnicos/Operacionais: URL base, Android package name, iOS bundle id.
    *   Menu Builder: Lista Drag & Drop (arrastar-e-soltar) para organizar abas da navbar inferior do app nativo.
*   **2. Preview:**
    *   Apresentação de Formato "Mockup de Celular" (ex: frame de iPhone) exibindo ao vivo as cores, logo e ícones do menu setados na aba anterior.
*   **3. Build:**
    *   Indicador de Status (stepper ou progress bar: Pending -> Building -> Ready).
    *   Botão Destruidor "Gerar Build".
    *   Tabela de Histórico (commits/gerações passadas, data, link).
    *   Links finais nativos (App Store, Google Play).

### 2.6 Integrações
Pontos de entrada de dados no sistema. Grid flexível de cards.
*   **Lista de Plataformas:**
    *   Shopify / Nuvemshop / Klaviyo / OneSignal / Stripe.
*   **Estrutura do Card de Integração:**
    *   Logotipo Oficial grande.
    *   Badge de Status atual (ex: Bolinha verde com "Conectado").
    *   Label de "Última Sincronização".
    *   Botão principal ("Conectar", "Reconfigurar", ou "Desconectar" via dropdown "mais ações").
    *   Área sanfonada (Accordion) listando Webhooks Ativos instalados por aquela integração.

### 2.7 Usuários do App
Gestão de contatos finais.
*   **Sub-abas:** "Lista", "Segmentos"

*   **1. Lista:**
    *   Tabela Paginada Alta Densidade com Filtros inline complexos.
    *   Colunas: Nome, Email, OS, Último Acesso, Compras Totais, Gasto Total (LTV), Flag de Opt-In.
    *   **Ação:** Clique na linha abre um Drawer/Page mostrando: Visão do Cliente, histórico profundo cronológico (timeline de eventos), produtos vistos etc.
*   **2. Segmentos:**
    *   View tipo Lista de cartões.
    *   Visualização clara de quais regras formam o segmento ("E.g: LTV > 1000 AND Último Acesso > 30d").

### 2.8 Billing
Transparência financeira para o Tenant.
*   **Cards Administrativos:**
    *   Badge de Plano (Starter/Business/Elite).
    *   Barra de Progresso (Notificações consumidas vs Limite de uso mensal).
    *   Painel de Ciclo (Próxima Cobrança: Data / R$).
    *   Call-to-Action "Upgrade" visível e com cor de destaque se não estiver no teto.
*   **Método e Faturas:**
    *   Card de Cartão (Visa/Master final XXXX).
    *   Tabela de Faturas anteriores com botão Download PDF.

### 2.9 Configurações
Manutenção das credenciais, time e seguranças.
*   **Sub-abas:** "Conta", "Time", "Segurança"

*   **1. Conta:** Forms tradicionais (Avatar upload, nome, email base, URL do tenant).
*   **2. Time:**
    *   Tabela de Gestão de Acessos com Badges coloridos por nível (Owner = vermelho/amarelo; Editor = azul; Viewer = cinza).
    *   Ações (Dropdown Menu na linha): "Mudar Nível" / "Remover Acesso".
    *   Botão no Header "Convidar Membro" abrindo modal.
*   **3. Segurança (Crucial devido ao contexto de Renda/Tenant):**
    *   Painel de MFA (TOTP QR Code).
    *   Lista de Sessões ativas (IP / Navegador / Revogar botão).
    *   Mini Audit-Log de ações críticas recentes.

---

## 3. Padrões de Componentes UI (Design System Guideline)

Para suportar o workflow e garantir consistência (alinhado ao `shadcn/ui` já estipulado no CLAUDE.md), a aplicação adotará os seguintes padrões inspirados na referência visual **Rentier SaaS**:

### 3.1 Estética Visual (Dark Premium Theme)
*   **Paleta de Cores Base:** Interface 100% Dark Mode. Fundo principal preto quase puro (`#050505` a `#0A0A0A`). Fundos de cards em cinza muito escuro (`#121214`) para mínima elevação.
*   **Cores de Aquece (Accent):** Roxo Neon/Vibrante (`#A855F7` ou variantes como Violet/Fuchsia) principal para botões, toggles on/off e badges de status ativos.
*   **Efeitos de Profundidade (Glow ao invés de Shadow):** Uso de "Neon Glows" sutis (sombras coloridas difusas) atrás de elementos de extrema importância (como a Hero Metric de Receita Gerada) ou ao redor de cards ativos selecionados. Sombras pesadas tradicionais dão lugar a bordas muito finas (`border-white/5` ou `border-white/10`).
*   **Tipografia e Contraste:** Fontes sem serifa modernas (Inter, Geist, ou SF Pro). Branco puro (`#FFFFFF`) para dados/valores finais e cinza médio (`#A1A1AA` ou text-muted) para descrições. Altíssimo contraste e clareza.
*   **Bordas (Border-Radius):** Arredondamento alto (Radius `lg`, `xl` ou `2xl` do Tailwind) em todos os cards, botoes e modais, trazendo um visual ultra-moderno e clean.
*   **Componentes Flutuantes (Glassmorphism):** Uso de fundos translúcidos com `backdrop-blur` elevado em barras superiores, modais, dropdowns e select menus, mantendo o contexto sempre visível no fundo.

### 3.2 Navegação e Layout
*   **Sidebar Minimalista:** Barra lateral retrátil ou focada apenas em ícones à esquerda (Ultra-Slim) para dar 90% do foco da tela à visualização e operação contínua do motor de receita.
*   **Top-based Workflow (Paralelismo):** Onde editores complexos de automação tomam foco, uso de modais que se comportam quase como abas interativas superiores, não tirando o usuário do painel primário do dashboard.

### 3.3 UX/Comportamental Base
*   **UX Funcional Financeira:** Para painéis financeiros e funis, valores vitais (R$) usarão a variação de fonte `tabular-nums` para evitar o 'salto' ("jittering") quando o número se atualiza em tempo real.
*   **Inputs de Estado:**
    *   Usar React Hook Form + Zod.
    *   Validações inline "As You Type".
*   **Drawers vs Modals:**
    *   Fluxos de "Leitura Detalhada" + "Edição contextual" (ex: Configuração de delay de automação ou Visualização longa de Usuários) usarão *Drawers Laterais (Right-Side Sheets)* com o plano de fundo escurecido/borrado.
    *   Ações fatais ou pequenos avisos usarão os `Alert Dialogs` centralizados do shadcn.
*   **Tabelas Paginadas de Alta Densidade:**
    *   Paginadas via Server-Side (com Skeletons dinâmicos exibindo leves pulsos de glow simulando carregamento).
    *   Colunas fixas para não quebrar horizontalmente e ordenação livre (Sortable Headers).

### 4. Estrutura de Rotas Prevista (Next.js App Router)

```text
/
├── /dashboard              -> Home (Hero Metrics)
├── /notifications          -> Histórico e Listagem
│   └── /[id]               -> Detalhe Notificação
├── /automations            -> Grid de Auto-Flows
├── /analytics              -> Dashboards e Funis
├── /app                    -> Ajuste Visual do App Mobile
├── /integrations           -> Conexões 3rd-Party
├── /customers              -> Base "App Users"
├── /billing                -> Portal Stripe
└── /settings               -> Equipe & Infra
```
