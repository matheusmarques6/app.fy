# Story 003: Migrar Auth do Console para Supabase Auth

**Fase:** 1 — Foundation
**Tamanho:** G
**Agentes:** @architect → @dev → @qa
**Dependência:** Story 001
**Status:** ⬜ pending

---

## Descrição
Como desenvolvedor, quero substituir NextAuth + bcrypt customizado pela autenticação do Supabase, para que o gerenciamento de usuários do console (registro, login, reset de senha, verificação de email) seja gerenciado pelo Supabase sem precisar implementar email service separado.

## Acceptance Criteria
- [ ] AC1: Login no console usa Supabase Auth (email + password)
- [ ] AC2: Registro de usuário cria conta no Supabase Auth E na tabela `users` do Prisma
- [ ] AC3: Reset de senha funciona via email (Supabase envia o email automaticamente)
- [ ] AC4: Verificação de email no registro funciona
- [ ] AC5: Sessão no Next.js usa token do Supabase (não NextAuth)
- [ ] AC6: JWT de devices (mobile) continua funcionando separado — não afetado por esta story
- [ ] AC7: Middleware do Next.js protege rotas usando sessão Supabase
- [ ] AC8: Usuários existentes na tabela `users` não são perdidos (migration de dados)

## Tasks
- [ ] Task 1: Instalar `@supabase/supabase-js` e `@supabase/ssr` no console
- [ ] Task 2: Remover `next-auth` e dependências de bcrypt do console
- [ ] Task 3: Criar `apps/console/src/lib/supabase/client.ts` (browser client)
- [ ] Task 4: Criar `apps/console/src/lib/supabase/server.ts` (server client para RSC)
- [ ] Task 5: Criar `apps/console/src/lib/supabase/middleware.ts` (substituir NextAuth middleware)
- [ ] Task 6: Refatorar `apps/console/src/app/(auth)/login/page.tsx` para `supabase.auth.signInWithPassword()`
- [ ] Task 7: Refatorar `apps/console/src/app/(auth)/register/page.tsx` para `supabase.auth.signUp()`
- [ ] Task 8: Implementar `apps/console/src/app/(auth)/forgot-password/page.tsx` com `supabase.auth.resetPasswordForEmail()`
- [ ] Task 9: Implementar `apps/console/src/app/(auth)/reset-password/page.tsx` com `supabase.auth.updateUser()`
- [ ] Task 10: Atualizar `apps/console/src/middleware.ts` para usar Supabase session
- [ ] Task 11: Remover `apps/console/src/app/api/auth/[...nextauth]/` route
- [ ] Task 12: Atualizar API backend — validar Supabase JWT nos endpoints do console (ou manter JWT próprio via Supabase service role)
- [ ] Task 13: Atualizar `.env.example` com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY

## Definição de Pronto
- [ ] Código implementado
- [ ] Login, registro, forgot-password e reset-password funcionando
- [ ] Emails de verificação e reset chegando (Supabase email provider)
- [ ] Rotas protegidas redirecionando para /login sem sessão
- [ ] Lint/typecheck ok
- [ ] `next-auth` removido do package.json

## Arquivos a Modificar
- `apps/console/package.json`
- `apps/console/src/middleware.ts`
- `apps/console/src/app/(auth)/**/page.tsx` (todos)
- `apps/console/src/app/api/auth/[...nextauth]/route.ts` → deletar
- `apps/console/src/lib/` (novos arquivos Supabase)
- `.env.example`

## Notas
- **CRÍTICO:** JWT de devices (mobile → API) NÃO muda. Supabase Auth é só para usuários do console.
- Supabase inclui email provider SMTP configurável no projeto (evita precisar do Resend/SendGrid separado)
- O `@supabase/ssr` é a forma recomendada para Next.js App Router (não `@supabase/auth-helpers-nextjs` que é legacy)
- A API NestJS pode validar o Supabase JWT usando SUPABASE_JWT_SECRET ou via service role key
