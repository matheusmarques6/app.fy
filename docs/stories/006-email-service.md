# Story 006: Email Service para Reset de Senha

**Fase:** 2 — Onboarding Funcional
**Tamanho:** P
**Agentes:** @dev
**Dependência:** Story 003 (se usar Supabase Auth, esta story pode ser desnecessária — Supabase envia emails automaticamente)
**Status:** ⬜ pending

---

## Descrição
Como usuário, quero receber email de reset de senha quando solicitar, para que eu consiga recuperar acesso à minha conta sem depender de suporte manual.

## Acceptance Criteria
- [ ] AC1: Fluxo "Esqueci minha senha" envia email real (não apenas loga no console)
- [ ] AC2: Link de reset no email leva para `/reset-password?token=xxx`
- [ ] AC3: Token expira em 1 hora
- [ ] AC4: Após reset, usuário é redirecionado para login com mensagem de sucesso
- [ ] AC5: Token usado não pode ser reutilizado

## Tasks
- [ ] Task 1: **Se Supabase Auth (Story 003 concluída):** configurar email template no Supabase Dashboard — esta story pode ser fechada
- [ ] Task 2: **Se mantiver auth própria:** integrar Resend SDK (`resend` npm package)
- [ ] Task 3: Criar `apps/api/src/common/email/email.service.ts` com método `sendPasswordReset(email, token, resetUrl)`
- [ ] Task 4: Remover `console.log` de reset token em `auth.service.ts:543`
- [ ] Task 5: Testar envio real de email em ambiente de dev

## Definição de Pronto
- [ ] Email chega na caixa de entrada ao solicitar reset
- [ ] Link de reset funciona
- [ ] Lint/typecheck ok

## Arquivos a Modificar
- `apps/api/src/modules/auth/auth.service.ts` (remover TODO/console.log)
- `apps/api/src/common/email/email.service.ts` (novo arquivo)
- `.env.example` (RESEND_API_KEY ou SUPABASE_SMTP_*)

## Notas
- Se Story 003 (Supabase Auth) for concluída, esta story é praticamente automática — Supabase gerencia emails de auth nativamente
- Resend é o provider mais simples se manter auth própria (resend.com)
