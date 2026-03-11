# Apple App Store — Critérios de Rejeição para Apps WebView (Capacitor)

> **Contexto AppFy:** SaaS que cria apps móveis para lojas de e-commerce usando Capacitor (WebView wrapper). Cada cliente recebe um app com sua marca, publicado nas stores. Risco de rejeição é **ALTO**.

---

## 1. Motivos Conhecidos de Rejeição

### Guideline 4.2 — Minimum Functionality (MAIS COMUM)

> *"Your app should include features, content, and UI that elevate it beyond a repackaged website."*

**Por que afeta o AppFy:** Um app Capacitor que apenas carrega a loja do cliente via WebView é, na essência, um "repackaged website". A Apple rejeita sistematicamente apps que não oferecem valor além do que o Safari já faz.

**O que a Apple espera:**
- Features nativas que não existem no navegador
- Performance superior ao site mobile
- Funcionalidades offline
- Integração com o ecossistema iOS (widgets, Siri, Share Sheet, etc.)

### Guideline 4.2.6 — Template Apps / Cookie-Cutter Apps (CRÍTICO PARA APPFY)

> *"Apps created from a commercialized template or app generation service will be rejected unless they are submitted directly by the provider of the app's content."*

**Por que afeta o AppFy:** A Apple detecta padrões em submissions. Se 200+ apps com a mesma estrutura forem enviados pela mesma conta de desenvolvedor, serão rejeitados como "spam" ou "template apps".

**Regras específicas:**
- Apps devem ser enviados pela **conta do cliente** (não pela conta da AppFy)
- Cada app deve ter **conteúdo único** (não apenas logo/cor diferente)
- A Apple rastreia apps com binários similares — fingerprinting de código
- Apps template podem ser aceitos se enviados pelo **provedor de conteúdo** (o lojista)

### Guideline 2.5.6 — Apps que Usam Apenas WebView

> *"Apps that browse the web must use the appropriate WebKit framework and WebKit JavaScript."*

**Restrições:**
- Deve usar WKWebView (Capacitor já usa por padrão)
- UIWebView causa rejeição automática (deprecated desde iOS 12)
- JavaScript injection limitado — não pode modificar comportamento de sites de terceiros

### Guideline 4.7 — HTML5 Games, Bots, etc.

Menos relevante para e-commerce, mas apps que são **exclusivamente** conteúdo web sem lógica nativa podem cair nesta categoria.

### Guideline 2.1 — App Completeness

- App deve funcionar completamente no momento do review
- Links quebrados = rejeição
- Funcionalidades "coming soon" = rejeição
- Precisa de dados de teste (conta demo) para o reviewer

### Guideline 2.3 — Accurate Metadata

- Screenshots devem refletir o app real
- Descrição não pode prometer features que não existem
- Categoria correta (Shopping, não Utilities)

### Guideline 3.1.1 — In-App Purchase

- Se o app vende produtos digitais (não físicos), precisa usar IAP da Apple
- Produtos físicos de e-commerce são isentos
- **Push notifications pagas** (se cobrar do lojista) não precisam de IAP

### Guideline 5.1 — Privacy

- Privacy policy obrigatória
- Disclosure de todos os dados coletados
- App Tracking Transparency (ATT) se usar IDFA
- Push notifications requerem opt-in explícito

---

## 2. O que a Apple Especificamente Procura no Review

### Checklist do Reviewer

| Critério | O que verificam | Risco AppFy |
|---|---|---|
| **Funcionalidade nativa** | App faz algo que Safari não faz? | ALTO — sem push/offline, é idêntico ao site |
| **Performance** | Tempo de carga, transições, scrolling | MÉDIO — WebView é mais lento que nativo |
| **Conteúdo único** | Conteúdo é exclusivo ou mirror do site? | ALTO — é literalmente o site |
| **Crashes** | Crash durante review = rejeição automática | BAIXO — Capacitor é estável |
| **Funcionalidades offline** | App funciona sem internet? | ALTO — WebView sem internet = tela branca |
| **Navegação** | Usa padrões iOS (back gesture, tab bar)? | MÉDIO — WebView tem navegação web |
| **Similaridade** | Parece com outros apps já submetidos? | CRÍTICO — 200+ apps similares |
| **Dados de teste** | Reviewer consegue usar o app? | MÉDIO — precisa de loja com produtos |

### Red Flags que Causam Review Manual Mais Rigoroso

1. **Nova conta de desenvolvedor** enviando muitos apps
2. **Binários com hash similar** a outros apps já rejeitados
3. **Screenshots genéricas** ou muito parecidas entre apps
4. **Descrições template** com apenas nome da loja trocado
5. **Frameworks conhecidos de app builder** (Capacitor é detectável)
6. **Poucos downloads** + **muitas submissions** = padrão de spam

---

## 3. Estratégias para Maximizar Taxa de Aceitação

### 3.1 Features Nativas Obrigatórias (DEVE TER)

| Feature | Plugin Capacitor | Justificativa |
|---|---|---|
| **Push Notifications** | `@capacitor/push-notifications` | Diferencial #1 vs. Safari. OneSignal SDK nativo. |
| **Biometrics** | `@capacitor-community/biometric-auth` | Face ID/Touch ID para login rápido. Apple ama isso. |
| **Deep Links** | `@capacitor/app` (handleOpenUrl) | Abre produto específico de uma notificação |
| **Offline Mode** | Service Worker + `@capacitor/network` | Tela offline customizada (últimos produtos vistos, carrinho salvo) |
| **Haptic Feedback** | `@capacitor/haptics` | Feedback tátil em ações (add to cart, purchase). Sinal de "app nativo". |
| **Share Sheet** | `@capacitor/share` | Compartilhar produto via WhatsApp/Instagram. Nativo iOS. |
| **Badge Count** | `@capacitor/badge` | Número de notificações não lidas no ícone do app |
| **Splash Screen** | `@capacitor/splash-screen` | Tela de loading nativa (não tela branca do WebView) |
| **Status Bar** | `@capacitor/status-bar` | Controle da status bar (cor, estilo) para parecer nativo |

### 3.2 Features Nativas Recomendadas (DEVERIA TER)

| Feature | Plugin Capacitor | Justificativa |
|---|---|---|
| **Camera** | `@capacitor/camera` | Upload de foto de perfil, busca visual de produto |
| **Local Notifications** | `@capacitor/local-notifications` | Lembrete de carrinho sem precisar de servidor |
| **Keyboard** | `@capacitor/keyboard` | Controle do teclado (push content up, dismiss on scroll) |
| **App Icon Badge** | `@capawesome/capacitor-badge` | Dynamic badges para itens no carrinho |
| **In-App Browser** | `@capacitor/browser` | Links externos abrem in-app (não saem do app) |
| **Clipboard** | `@capacitor/clipboard` | Copiar código de cupom, código PIX |
| **Pull-to-Refresh** | CSS/JS nativo | Padrão iOS que usuários esperam |

### 3.3 UI Patterns que "Parecem Nativos"

**CRÍTICO:** A Apple rejeita apps que "parecem um site". O app deve ter visual nativo.

1. **Tab bar nativa** — barra inferior com ícones (Home, Busca, Carrinho, Perfil). Nunca navegação tipo hamburger menu web.
2. **Navigation bar** — título + botão voltar no topo, estilo iOS. Não header de site.
3. **Pull-to-refresh** — gesto nativo para recarregar. Implementar com `overscroll-behavior`.
4. **Transições de página** — slide horizontal (push/pop), não fade ou corte. CSS transitions que imitam UINavigationController.
5. **Bottom sheet** — modais que sobem de baixo (seleção de tamanho, filtros). Não popups web.
6. **Loading skeletons** — shimmer effect em vez de spinner. Padrão do App Store.
7. **Sem barra de URL** — nunca mostrar URL. Sem botões de navegação web.
8. **Gestos iOS** — swipe back (edge gesture), long press para preview.
9. **Safe area** — respeitar notch, Dynamic Island, home indicator.
10. **Dark mode** — suportar automaticamente via `prefers-color-scheme`.

### 3.4 App Review Information — O que Escrever

Campo "Notes" no App Store Connect. O reviewer lê isso ANTES de testar o app.

**Template recomendado:**

```
This app is the official mobile application for [STORE_NAME],
a [NICHE] e-commerce store.

KEY NATIVE FEATURES:
- Push notifications for order updates, cart recovery, and promotions
- Biometric authentication (Face ID / Touch ID)
- Offline mode with cached products and saved cart
- Native sharing via iOS Share Sheet
- Haptic feedback on key actions
- Badge count for unread notifications

The app provides a superior shopping experience compared to the
mobile website, including:
- 40% faster page loads via native caching
- Personalized push notifications based on browsing history
- One-tap reorder from order history
- Native checkout optimized for iOS

DEMO CREDENTIALS:
Email: reviewer@[store].com
Password: [password]

The store has sample products loaded for testing purposes.
```

---

## 4. Riscos Específicos do Modelo AppFy

### 4.1 Risco: 200+ Apps Similares (Guideline 4.2.6)

**Nível de risco: CRÍTICO**

A Apple tem sistemas automatizados que detectam:
- Binários com código/estrutura similar
- Submissions de contas vinculadas ao mesmo endereço/cartão
- Padrões de metadata (descrições, screenshots, keywords)

**Estratégias de mitigação:**

#### Opção A: Cada cliente tem SUA conta Apple Developer (RECOMENDADO)

- Lojista cria sua própria conta ($99/ano)
- AppFy publica via ASC API (App Store Connect API) com acesso delegado
- Cada app é "independente" aos olhos da Apple
- **Vantagem:** Zero risco de 4.2.6 — cada app vem de publisher diferente
- **Desvantagem:** Lojista precisa ter conta Apple Developer
- **Custo:** $99/ano por cliente (pode incluir no plano)

#### Opção B: AppFy como Publisher Organizacional

- Uma conta Apple Developer da AppFy
- Todos os apps publicados sob "AppFy Inc."
- **Risco:** Apple pode bloquear a conta inteira se detectar padrão de template
- **Mitigação:** Diferenciação forte de cada app (ver seção 4.2)

#### Opção C: Híbrido (PRAGMÁTICO)

- Clientes enterprise: conta própria
- Clientes starter: conta AppFy (com diferenciação forte)
- Migrar para conta própria quando cliente escalar

**Recomendação:** Opção A para todos os clientes. Incluir o custo de $99/ano no onboarding. É a única forma segura de escalar para 200+ apps.

### 4.2 Diferenciação Obrigatória por App

Mesmo com conta própria, cada app deve ter elementos únicos:

| Elemento | O que mudar |
|---|---|
| **Bundle ID** | `com.[store-slug].app` (único por definição) |
| **App Name** | Nome da loja (único) |
| **App Icon** | Logo da loja (upload do cliente) |
| **Splash Screen** | Branding da loja |
| **Color scheme** | primary/secondary color da loja |
| **Screenshots** | Geradas com produtos REAIS da loja |
| **Description** | Texto único mencionando a loja, nicho, produtos |
| **Keywords** | Específicos do nicho da loja |
| **Privacy Policy** | URL única da loja |
| **Content** | Produtos reais (não lorem ipsum) |
| **Categories** | Variam por nicho (Fashion, Food, etc.) |

### 4.3 Geração Automática de Screenshots

**CRÍTICO:** Screenshots idênticas entre apps = rejeição.

Implementar gerador de screenshots que:
1. Captura telas reais do app com produtos da loja
2. Aplica frames de device (iPhone 15, etc.)
3. Adiciona texto marketing customizado
4. Gera para todos os tamanhos obrigatórios (6.7", 6.5", 5.5")

Ferramentas: Fastlane Snapshot + Frameit

---

## 5. Checklist Antes da Submissão

### 5.1 Técnico

- [ ] WKWebView (não UIWebView) — verificar com `grep -r "UIWebView"`
- [ ] Minimum deployment target iOS 16+
- [ ] Suporte a todos os tamanhos de tela (iPhone SE → iPhone 15 Pro Max)
- [ ] Suporte a iPad (mesmo que básico — Universal app)
- [ ] Dark mode funcional
- [ ] Safe area respeitada (notch, Dynamic Island, home indicator)
- [ ] Push notifications configuradas e funcionais
- [ ] Biometrics implementado e funcional
- [ ] Offline mode: tela customizada sem internet (não tela branca)
- [ ] Deep links funcionando (test via `xcrun simctl openurl`)
- [ ] Splash screen customizada (não default Capacitor)
- [ ] Performance: First Contentful Paint < 2s
- [ ] Sem crashes durante uso normal (teste com Xcode Instruments)
- [ ] Sem memory leaks (teste com Xcode Leaks instrument)
- [ ] App Transport Security: HTTPS only (ATS enabled)
- [ ] Sem APIs privadas (scan com `otool -L`)
- [ ] Binário < 200MB (ideal < 50MB)
- [ ] Suporte a orientação portrait (landscape opcional)

### 5.2 Conteúdo

- [ ] App tem produtos reais carregados (não placeholder)
- [ ] Todas as páginas funcionam (sem links quebrados)
- [ ] Checkout funcional (ou claramente simulado para review)
- [ ] Conta demo criada para o reviewer
- [ ] Categoria correta no App Store Connect
- [ ] Age rating correto (provavelmente 4+)
- [ ] Copyright text correto

### 5.3 Screenshots

- [ ] Screenshots de **telas reais** com produtos da loja
- [ ] Tamanhos obrigatórios:
  - iPhone 6.7" (iPhone 15 Pro Max) — 1290 x 2796
  - iPhone 6.5" (iPhone 14 Plus) — 1284 x 2778
  - iPhone 5.5" (iPhone 8 Plus) — 1242 x 2208
  - iPad Pro 12.9" (3rd gen+) — 2048 x 2732
- [ ] Mínimo 3 screenshots, máximo 10
- [ ] Screenshots mostram funcionalidades nativas (push, biometrics)
- [ ] Texto em screenshots no idioma do app
- [ ] Sem mockups genéricos — telas reais

### 5.4 Privacidade e LGPD

- [ ] Privacy Policy URL válida e acessível
- [ ] App Privacy labels preenchidos no App Store Connect:
  - Data Used to Track You: Device ID (OneSignal)
  - Data Linked to You: Purchases, Browsing History
  - Data Not Linked to You: Crash Data, Performance Data
- [ ] App Tracking Transparency (ATT) prompt se usar IDFA
- [ ] Consent para push notifications (nativo iOS, automático)
- [ ] Opção de deletar conta (obrigatório desde 2022)
- [ ] LGPD: opt-out de coleta de dados
- [ ] Localização: NÃO coletar (não precisamos, evita scrutiny extra)

### 5.5 App Store Connect

- [ ] App Review Information preenchido (ver template seção 3.4)
- [ ] Demo account credentials fornecidos
- [ ] Contact information do publisher válido
- [ ] App description única (não template)
- [ ] Keywords relevantes ao nicho
- [ ] What's New text (se update)
- [ ] Support URL válida
- [ ] Marketing URL (opcional mas recomendado)

---

## 6. O que Fazer se Rejeitado

### 6.1 Processo de Resposta

1. **Ler a rejeição com atenção** — Apple cita a guideline específica
2. **NÃO resubmeter imediatamente** sem mudanças — conta fica flagged
3. **Responder via Resolution Center** com explicação detalhada
4. **Fazer as mudanças solicitadas** antes de resubmeter
5. **Se discordar:** usar "Appeal" (App Review Board) — leva 1-2 semanas

### 6.2 Respostas para Rejeições Comuns

#### Rejeição por Guideline 4.2 (Minimum Functionality)

```
Dear App Review Team,

Thank you for your feedback. We understand the concern about
minimum functionality. Our app provides significant value beyond
the mobile website:

1. PUSH NOTIFICATIONS: Real-time order updates, cart recovery
   notifications, and personalized product recommendations —
   features unavailable via mobile Safari.

2. BIOMETRIC AUTH: Face ID / Touch ID for one-tap secure login,
   eliminating the need to type credentials.

3. OFFLINE MODE: Users can browse recently viewed products,
   access their saved cart, and view order history without an
   internet connection.

4. NATIVE PERFORMANCE: Product pages load 40% faster through
   native caching and preloading.

5. HAPTIC FEEDBACK: Tactile responses on key actions (add to cart,
   purchase confirmation) that create a premium shopping experience.

We've updated the app to better highlight these native features
during the first launch experience. Please see the attached
screenshots showing the native functionality.

Best regards,
[Name]
```

#### Rejeição por Guideline 4.2.6 (Template/Spam)

```
Dear App Review Team,

This app is the official mobile application for [STORE_NAME],
submitted by the store owner through their own Apple Developer
account. It is NOT a template app.

[STORE_NAME] is a legitimate [NICHE] e-commerce business
operating at [WEBSITE_URL] since [YEAR]. The app contains:

- The store's own product catalog ([N] unique products)
- Custom branding, colors, and visual identity
- Store-specific push notification flows
- Unique content and promotions

The app was built using Capacitor (a standard cross-platform
framework, similar to React Native), which may have triggered
a similarity detection. However, the content, branding, and
user experience are entirely unique to this business.

We're happy to provide additional documentation of the business
relationship if needed.

Best regards,
[Name]
```

#### Rejeição por Guideline 2.1 (Incomplete)

```
Dear App Review Team,

Thank you for the feedback. We've resolved the issues noted:

1. [SPECIFIC ISSUE]: [How you fixed it]
2. Demo credentials have been updated:
   Email: reviewer@[store].com / Password: [new_password]
3. The store now has [N] products loaded for testing

We've verified all functionality works correctly in the review
environment. Please try again with the updated demo credentials.

Best regards,
[Name]
```

### 6.3 Timeline de Review

| Situação | Tempo médio |
|---|---|
| Primeira submissão | 24-48h |
| Resubmissão após rejeição | 24-48h |
| Appeal (App Review Board) | 7-14 dias |
| Expedited review (urgência) | 24h (raro, precisa justificar) |

---

## 7. Padrões de Sucesso — Concorrentes

### Tapcart (referência direta)

- **Modelo:** WebView wrapper para Shopify stores (exatamente como AppFy)
- **Como passam no review:**
  - Cada app é publicado na conta do lojista
  - Push notifications como diferencial principal
  - UI nativa na tab bar e navegação
  - Offline product browsing
  - Deep links de push → produto específico
  - Screenshots geradas automaticamente com produtos reais

### Shopify Shop App

- **Modelo:** App único para todas as lojas (diferente do AppFy)
- **Por que funciona:** É 1 app com conteúdo dinâmico, não 200+ apps
- **Lição:** Se AppFy tivesse 1 app multi-tenant (como Shop), zero risco de 4.2.6. Mas perde a proposta de "app com a marca do cliente".

### Plobal Apps

- **Modelo:** Similar ao Tapcart — app por lojista
- **Como passam:**
  - Conta Apple do lojista (obrigatório)
  - Integração nativa com Apple Pay
  - Wishlist offline
  - AR (Augmented Reality) para produtos 3D

### MobiLoud

- **Modelo:** Converte site em app nativo
- **Como passam:**
  - Usam uma combinação de WebView + componentes nativos
  - Garantem push notifications nativos
  - Navegação nativa (não web)
  - Oferecem "native wrapper" que injeta componentes iOS

### Lições Consolidadas

1. **Push é o ticket de entrada** — sem push, nenhum desses apps sobreviveria ao review
2. **Conta do lojista** é padrão da indústria — todos fazem assim
3. **Tab bar nativa** é universal — nunca hamburger menu
4. **Offline mode** diferencia de "website in a frame"
5. **Screenshots reais** são obrigatórias — ninguém usa mockups

---

## 8. Plano de Ação Priorizado para AppFy

### P0 — Bloqueadores (sem isso, NÃO submete)

- [ ] Push notifications nativo (OneSignal SDK)
- [ ] Offline mode (tela customizada + cache de produtos)
- [ ] Tab bar nativa (Home, Busca, Carrinho, Perfil)
- [ ] Splash screen customizada por loja
- [ ] Safe area + Dark mode
- [ ] Privacy Policy URL por loja
- [ ] Conta Apple Developer do lojista (não da AppFy)
- [ ] Demo account para reviewer
- [ ] Screenshots reais com produtos da loja

### P1 — Fortalecem aprovação

- [ ] Biometric auth (Face ID / Touch ID)
- [ ] Haptic feedback
- [ ] Deep links (push → produto)
- [ ] Share Sheet nativo
- [ ] Badge count
- [ ] Pull-to-refresh

### P2 — Diferenciais

- [ ] Apple Pay integration
- [ ] Clipboard (copiar código PIX/cupom)
- [ ] Local notifications (lembretes)
- [ ] Gerador automático de screenshots (Fastlane)

### P3 — Fase 2+

- [ ] Widgets (iOS 16+ WidgetKit)
- [ ] Siri Shortcuts
- [ ] App Clips
- [ ] AR product preview

---

## Referências

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Guideline 4.2 - Design: Minimum Functionality](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)
- [Guideline 4.2.6 - Template Apps](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)
- [App Privacy Details](https://developer.apple.com/app-privacy/)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
