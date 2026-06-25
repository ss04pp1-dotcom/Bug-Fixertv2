# StreamPro — Deployment Guide

**Stack:** Supabase (PostgreSQL) + Render (API Server) + Cloudflare Pages (Admin Panel)

---

## Architecture Overview

```
Mobile App (Expo)
       │
       ▼
Render (NestJS API)  ←──── Supabase (PostgreSQL)
       ▲
       │
Cloudflare Pages (Next.js Admin)
```

---

## Step 1 — Supabase (Database)

### 1.1 Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to your Render region (e.g. `us-east-1`)
3. Set a strong database password — **save it**, you'll need it

### 1.2 Get your connection strings
In Supabase: **Project → Settings → Database → Connection string**

You need **two** URLs:

| Variable | Mode | Port | Use |
|---|---|---|---|
| `DATABASE_URL` | Transaction (pooler) | **6543** | Runtime queries on Render |
| `DIRECT_URL` | Direct connection | **5432** | Prisma migrations |

**Transaction pooler URL** (DATABASE_URL):
```
postgresql://postgres.YOURPROJECTID:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Direct URL** (DIRECT_URL):
```
postgresql://postgres.YOURPROJECTID:PASSWORD@db.YOURPROJECTID.supabase.co:5432/postgres
```

### 1.3 Run the database migration
In your local machine (or Replit shell):
```bash
cd artifacts/api-server
DIRECT_URL="your_direct_url" DATABASE_URL="your_direct_url" npx prisma db push
```

### 1.4 Seed the database
```bash
cd artifacts/api-server
DIRECT_URL="your_direct_url" DATABASE_URL="your_direct_url" npx ts-node --transpile-only prisma/seed.ts
```
**Admin login after seeding:** `admin@streampro.com` / `Admin@123456`

---

## Step 2 — Render (API Server)

### 2.1 Create a Render account
Go to [render.com](https://render.com) → sign up (free tier available)

### 2.2 Create a new Web Service
1. Render Dashboard → **New → Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Name:** `streampro-api`
   - **Region:** Same region as Supabase (e.g. Oregon = us-west-2)
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:**
     ```
     npm install -g pnpm@10 && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build
     ```
   - **Start Command:**
     ```
     node artifacts/api-server/dist/main.js
     ```
   - **Plan:** Free (or Starter for production)

### 2.3 Set Environment Variables in Render Dashboard

Go to your service → **Environment** → add these variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres.ID:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.ID:PASS@db.ID.supabase.co:5432/postgres
JWT_ACCESS_SECRET=<run: openssl rand -hex 32>
JWT_REFRESH_SECRET=<run: openssl rand -hex 32>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
CORS_ORIGIN=https://your-admin.pages.dev
APP_URL=https://streampro-api.onrender.com
SWAGGER_ENABLED=false
```

Optional (add later as needed):
```
REDIS_URL=redis://...
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASSWORD=...
STRIPE_SECRET_KEY=sk_live_...
```

### 2.4 Deploy
Click **Create Web Service** — Render will build and deploy automatically.

Your API will be live at: `https://streampro-api.onrender.com`

**Verify:** `https://streampro-api.onrender.com/api/healthz` → should return `{"status":"ok"}`

> ⚠️ **Free tier note:** Render free services spin down after 15 minutes of inactivity. Upgrade to Starter ($7/month) to keep it always-on.

---

## Step 3 — Cloudflare Pages (Admin Panel)

### 3.1 Build the admin panel
The admin panel exports to a static site. Make sure it's configured with your Render URL.

### 3.2 Create a Cloudflare Pages project
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create**
2. Choose **Pages → Connect to Git**
3. Select your repository

### 3.3 Configure the build
| Setting | Value |
|---|---|
| Framework preset | `Next.js (Static HTML Export)` |
| Build command | `npm install -g pnpm@10 && pnpm install && pnpm --filter @workspace/admin run build` |
| Build output directory | `artifacts/admin/out` |
| Root directory | `/` |

### 3.4 Set Environment Variables in Cloudflare Pages
Go to **Settings → Environment Variables** → add for **Production**:

```
NEXT_PUBLIC_API_URL=https://streampro-api.onrender.com/api
```

### 3.5 Deploy
Click **Save and Deploy**.

Your admin panel will be live at: `https://your-project.pages.dev/admin/`

**Login:** `admin@streampro.com` / `Admin@123456`

### 3.6 Update CORS on Render
Go back to Render → your service → Environment → update:
```
CORS_ORIGIN=https://your-project.pages.dev
```

---

## Step 4 — Mobile App (Expo / EAS Build)

### 4.1 Update API URL
Create `artifacts/mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://streampro-api.onrender.com/api/v1
```

### 4.2 Build with EAS
```bash
cd artifacts/mobile
npx eas build --platform android --profile production
npx eas build --platform ios --profile production
```

---

## Environment Variables — Full Reference

### API Server (Render)
| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase Transaction Pooler URL (port 6543) |
| `DIRECT_URL` | ✅ | Supabase Direct Connection URL (port 5432) |
| `JWT_ACCESS_SECRET` | ✅ | 64-char random hex string |
| `JWT_REFRESH_SECRET` | ✅ | 64-char random hex string |
| `CORS_ORIGIN` | ✅ | Cloudflare Pages domain |
| `NODE_ENV` | ✅ | `production` |
| `REDIS_URL` | ❌ | Upstash or Render Redis |
| `SMTP_HOST` | ❌ | SendGrid, Resend, etc. |
| `STRIPE_SECRET_KEY` | ❌ | Stripe payments |
| `FIREBASE_PROJECT_ID` | ❌ | Push notifications |
| `CLOUDFLARE_R2_ACCOUNT_ID` | ❌ | Media file uploads |

### Admin Panel (Cloudflare Pages)
| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Full Render API URL e.g. `https://streampro-api.onrender.com/api` |

### Mobile App (EAS Build)
| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | ✅ | Full Render API URL e.g. `https://streampro-api.onrender.com/api/v1` |

---

## Quick Commands

```bash
# Run database migrations (use DIRECT_URL, not pooled URL)
cd artifacts/api-server
DIRECT_URL="postgres://..." DATABASE_URL="postgres://..." npx prisma db push

# Re-seed the database
cd artifacts/api-server
DIRECT_URL="..." DATABASE_URL="..." npx ts-node --transpile-only prisma/seed.ts

# Build admin panel locally
pnpm --filter @workspace/admin run build
# Output: artifacts/admin/out/

# Run API tests
pnpm --filter @workspace/api-server run test

# Check for TypeScript errors
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/admin run typecheck
pnpm --filter @workspace/mobile run typecheck
```

---

## Troubleshooting

### API returns 502 in admin panel
- Check `NEXT_PUBLIC_API_URL` is set correctly in Cloudflare Pages environment variables
- Verify CORS: `CORS_ORIGIN` in Render must match your Cloudflare Pages domain exactly

### Prisma migration errors on Render
- Make sure you're using `DIRECT_URL` (port 5432) not the pooler URL for migrations
- Render doesn't run migrations automatically — run them manually or add a pre-deploy hook

### Render service sleeps (free tier)
- Free tier sleeps after 15 min inactivity. Upgrade to Starter or use a cron service to ping `/api/healthz` every 10 minutes

### Admin login fails after deployment
- Verify `NEXT_PUBLIC_API_URL` points to your Render URL (not localhost)
- Check Render logs for startup errors: missing `DATABASE_URL` will prevent startup
- Confirm the database is seeded: `admin@streampro.com` / `Admin@123456`

### Supabase connection refused
- Ensure you're using the Transaction Pooler URL for `DATABASE_URL` (port **6543**)
- Ensure you're using the Direct URL for `DIRECT_URL` (port **5432**)
- Check your Supabase project is not paused (free tier pauses after 1 week of inactivity)
