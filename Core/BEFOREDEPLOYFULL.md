# Before Deploy — Full Configuration Guide

> What to configure and WHERE before deploying AppFy to production.

---

## 1. Supabase Project (already done)

- **Project:** App.fy (`rzirllxapfknblvfwqxq`)
- **Region:** us-west-2
- **URL:** `https://rzirllxapfknblvfwqxq.supabase.co`
- **DB:** PostgreSQL 17, 15 tables, RLS enabled on 13 tables
- **Plans seeded:** Starter (R$127), Business (R$197), Elite (R$297)

### Pending Supabase config:
- [ ] Enable Email Auth in Auth settings
- [ ] Configure Auth redirect URLs (console domain)
- [ ] Set JWT expiry to desired value (default 3600s)
- [ ] Copy `SUPABASE_SERVICE_ROLE_KEY` from Settings → API → Service Role Key

---

## 2. Environment Variables — Where Each Goes

### Railway (API + 3 Workers)

Railway hosts the backend. All 4 services (API, worker-push, worker-ingestion, worker-analytics) share these vars:

```env
# Database (from Supabase → Settings → Database → Connection string)
DATABASE_URL=postgresql://postgres.rzirllxapfknblvfwqxq:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.rzirllxapfknblvfwqxq:[PASSWORD]@db.rzirllxapfknblvfwqxq.supabase.co:5432/postgres

# Auth
SUPABASE_URL=https://rzirllxapfknblvfwqxq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<from Supabase Dashboard → Settings → API>
SUPABASE_JWT_SECRET=<from Supabase Dashboard → Settings → API → JWT Secret>
JWT_SECRET=<generate: openssl rand -base64 32>

# Encryption
ENCRYPTION_SECRET=<generate: openssl rand -base64 32 (min 32 chars)>

# Queue
REDIS_URL=<Railway Redis addon or Upstash URL>

# Push
ONESIGNAL_API_KEY=<from OneSignal Dashboard>
ONESIGNAL_USER_AUTH_KEY=<from OneSignal Dashboard → Settings → Keys>

# Billing
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Integrations
SHOPIFY_CLIENT_ID=<from Shopify Partners>
SHOPIFY_CLIENT_SECRET=<from Shopify Partners>
NUVEMSHOP_APP_ID=<from Nuvemshop Partners>
NUVEMSHOP_APP_SECRET=<from Nuvemshop Partners>
KLAVIYO_API_KEY=<from Klaviyo Settings → API Keys>

# Storage
CLOUDFLARE_R2_ACCOUNT_ID=<from Cloudflare Dashboard>
CLOUDFLARE_R2_ACCESS_KEY=<R2 API token>
CLOUDFLARE_R2_SECRET_KEY=<R2 API token>
CLOUDFLARE_R2_BUCKET=appfy-assets

# Monitoring
SENTRY_DSN=<from Sentry Project Settings>
SENTRY_AUTH_TOKEN=<from Sentry Organization Settings>
```

**API-only** (not needed in workers):
- `DIRECT_URL` (migrations only)

**Workers-only** (all 3 share the same vars):
- Each worker is a separate Railway service with its own start command
- `push`: `node dist/push/index.js`
- `ingestion`: `node dist/ingestion/index.js`
- `analytics`: `node dist/analytics/index.js`

---

### Vercel (Console)

Vercel hosts the Next.js frontend. It **never connects to the database directly**.

```env
# API connection
NEXT_PUBLIC_API_URL=https://api.appfy.com.br (or Railway public URL)

# Supabase Auth (client-side)
NEXT_PUBLIC_SUPABASE_URL=https://rzirllxapfknblvfwqxq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6aXJsbHhhcGZrbmJsdmZ3cXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDA0MTcsImV4cCI6MjA4OTE3NjQxN30.afWfegnZCVQscQc5IpnySjyCoOBjtCRpi9vxVdRlEGk

# Supabase Auth (server-side SSR middleware)
SUPABASE_URL=https://rzirllxapfknblvfwqxq.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6aXJsbHhhcGZrbmJsdmZ3cXhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDA0MTcsImV4cCI6MjA4OTE3NjQxN30.afWfegnZCVQscQc5IpnySjyCoOBjtCRpi9vxVdRlEGk
```

**Vercel does NOT need:** `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `STRIPE_SECRET_KEY`, `ENCRYPTION_SECRET`, `ONESIGNAL_*`, `SHOPIFY_*`, `NUVEMSHOP_*`, `CLOUDFLARE_R2_*`

---

### GitHub Actions (CI Secrets)

These are needed for the CI/CD pipeline:

```
# Deploy
RAILWAY_TOKEN          → Railway staging deploy token
RAILWAY_TOKEN_PROD     → Railway production deploy token (separate!)
VERCEL_TOKEN           → Vercel deploy token
VERCEL_ORG_ID          → Vercel org ID
VERCEL_PROJECT_ID      → Vercel project ID

# Test secrets (optional, fallback values exist in workflow)
TEST_ENCRYPTION_SECRET
TEST_JWT_SECRET
TEST_SUPABASE_JWT_SECRET
```

**GitHub Actions Variables** (not secrets — these are public URLs):
```
STAGING_API_URL        → Railway staging URL
STAGING_CONSOLE_URL    → Vercel preview URL
PRODUCTION_API_URL     → Railway production URL
PRODUCTION_CONSOLE_URL → Vercel production URL
```

---

## 3. External Services Setup

### Stripe (P0)
1. Create 3 products in Stripe Dashboard:
   - **Starter** — R$127/mês, R$1.272/ano
   - **Business** — R$197/mês, R$1.972/ano
   - **Elite** — R$297/mês, R$2.972/ano
2. Copy each `price_id` (starts with `price_`)
3. Update `plans` table:
   ```sql
   UPDATE plans SET stripe_price_id = 'price_xxx' WHERE name = 'starter';
   UPDATE plans SET stripe_price_id = 'price_yyy' WHERE name = 'business';
   UPDATE plans SET stripe_price_id = 'price_zzz' WHERE name = 'elite';
   ```
4. Configure Stripe webhook endpoint: `https://api.appfy.com.br/api/billing/webhook`
5. Events to listen: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`

### OneSignal (P0)
1. Create at least 1 app in OneSignal for testing
2. Copy `ONESIGNAL_API_KEY` (REST API Key) and `ONESIGNAL_USER_AUTH_KEY` (User Auth Key)
3. In production, apps are provisioned per tenant via API

### Cloudflare R2 (P1)
1. Create bucket `appfy-assets` in Cloudflare Dashboard
2. Configure CORS:
   ```json
   [{"AllowedOrigins": ["https://console.appfy.com.br"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600}]
   ```
3. Create R2 API token with read/write permissions

### Sentry (P1)
1. Create project in Sentry (Node.js)
2. Copy DSN
3. Add `Sentry.init()` calls in API + Workers entry points

### Domain/DNS (P2)
- `api.appfy.com.br` → Railway public URL (CNAME)
- `console.appfy.com.br` → Vercel (CNAME)
- Configure SSL (automatic on both Railway and Vercel)

---

## 4. Deploy Order

```
1. Configure all env vars in Railway (staging)     ← do first
2. Configure all env vars in Vercel (staging)      ← do first
3. Push code to main                               ← triggers CI
4. CI passes (G1-G4)                               ← automatic
5. Deploy to staging (G5)                           ← automatic
6. Smoke tests (G6)                                ← automatic
7. Manual approval (G7)                            ← you click "approve"
8. Deploy to production                            ← automatic
9. Production health check                         ← automatic
```

---

## 5. Post-Deploy Checklist

- [ ] `/health` returns 200
- [ ] Supabase Auth login works from Console
- [ ] Switch tenant flow works (JWT with tenant_id)
- [ ] Create a test notification (manual)
- [ ] Stripe checkout creates subscription
- [ ] Stripe webhook updates tenant plan
- [ ] OneSignal push delivery works
- [ ] Shopify OAuth connect works
- [ ] Sentry captures test error
- [ ] All 3 workers are processing queues

---

## Quick Reference

| Service | Platform | URL Pattern |
|---|---|---|
| API | Railway | `https://api.appfy.com.br` or `*.up.railway.app` |
| Workers (3) | Railway | Internal (no public URL needed) |
| Console | Vercel | `https://console.appfy.com.br` or `*.vercel.app` |
| Database | Supabase | `db.rzirllxapfknblvfwqxq.supabase.co` |
| Auth | Supabase | `https://rzirllxapfknblvfwqxq.supabase.co/auth` |
| Push | OneSignal | `https://onesignal.com/api/v1` |
| Billing | Stripe | `https://api.stripe.com` |
| Storage | Cloudflare R2 | `https://<account>.r2.cloudflarestorage.com/appfy-assets` |
| Monitoring | Sentry | `https://sentry.io` |
