# StreamPro

Enterprise TV streaming platform — live TV, VOD movies, series, subscriptions, and ad monetization, served via a NestJS API with an Expo mobile app and Next.js admin panel.

## Run & Operate

```bash
# Start all services
pnpm --filter @workspace/api-server run dev       # API server — port 8080
pnpm --filter @workspace/admin run dev            # Admin panel — port 23744
pnpm --filter @workspace/mobile run dev           # Expo mobile app

# Database
cd artifacts/api-server && npx prisma db push --accept-data-loss   # push schema changes (dev)
cd artifacts/api-server && npx prisma generate                      # regenerate client
cd artifacts/api-server && npx ts-node prisma/seed.ts               # seed reference data

# Type-check
pnpm --filter @workspace/api-server exec tsc --noEmit
```

**Required environment variables**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase transaction pooler, port 6543) |
| `JWT_ACCESS_SECRET` | JWT access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 access key ID |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 secret key |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name |
| `CLOUDFLARE_R2_PUBLIC_URL` | Public CDN URL for R2 assets |
| `DIRECT_URL` | Direct DB connection (port 5432) for Prisma migrations |
| `REDIS_URL` | Redis URL (BullMQ job queues) |

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **API**: NestJS 10, Prisma 6 ORM, PostgreSQL, port 8080
- **Mobile**: Expo SDK 52 / React Native, Expo Router v4, Axios HTTP client
- **Admin**: Next.js 15 App Router, Tailwind CSS, shadcn/ui, port 23744
- **Auth**: JWT (access + refresh tokens), OTP email verification, Passport.js
- **Jobs**: BullMQ (Redis) — notifications, email, analytics queues
- **Storage**: Cloudflare R2 via AWS S3 SDK (`StorageModule`)
- **WebSockets**: Socket.IO gateway with JWT authentication (`WsJwtGuard`)
- **Validation**: class-validator + class-transformer; strict Prisma types (no `any`)
- **i18n**: Locale JSON files at `artifacts/mobile/i18n/{en,ar,fr,es}.json`

## Where things live

```
artifacts/
  api-server/
    src/
      auth/               JWT auth, OTP, refresh tokens
      users/              User CRUD + sanitization (no password in responses)
      channels/           Live TV channels + EPG
      movies/             VOD movies
      series/             Series + seasons + episodes
      favorites/          User favorites
      watch-history/      Continue watching
      subscriptions/      Plans, coupons, user subscriptions
      payments/           Payment gateways, transactions
      notifications/      Push + in-app notifications
      advertisements/     Ad providers, placements, events, revenue
      settings/           Key-value app settings
      parental-control/   PIN-gated content restrictions
      audit/              Admin audit log
      analytics/          Dashboard KPIs
      websocket/          Socket.IO gateway (JWT-authenticated)
      jobs/               BullMQ job consumers (notifications/email/analytics)
      storage/            Cloudflare R2 upload service
      config/             NestJS ConfigModule (configuration.ts)
      common/             Guards, interceptors, filters, decorators
    prisma/
      schema.prisma       Source of truth for DB schema
      seed.ts             Reference data seed script
    test/                 Jest unit tests (auth, users)
  mobile/
    app/                  Expo Router screens
    services/
      apiClient.ts        Central Axios client (token refresh interceptor)
      authService.ts      Auth API calls
      subscriptionService.ts
      paymentService.ts
    i18n/                 EN / AR / FR / ES locale files
    store/                Zustand state stores
  admin/
    app/admin/            Next.js App Router pages
    lib/api-config.ts     Central API client (localStorage token)
    components/           Reusable admin UI components
```

## Architecture decisions

- **Global URI versioning**: All NestJS routes use `/v1/...` via `VersioningType.URI` with `defaultVersion: '1'`. The server does NOT call `setGlobalPrefix('api')`, so actual paths are `/v1/...` not `/api/v1/...`. Endpoints that must remain unversioned (health, ad SDK) use `VERSION_NEUTRAL`. Health endpoints are at root (e.g. `/healthz`).
- **No `any` types**: All Prisma queries use typed inputs (`Prisma.XxxWhereInput`, `Prisma.XxxCreateInput`, typed enums from `@prisma/client`). `strictPropertyInitialization: false` is set only for NestJS DTOs (class-validator pattern requires uninitialized class properties).
- **OTP security**: The `forgotPassword` endpoint returns only `{ message }` — the OTP code is never included in the API response. It is sent out-of-band via email.
- **WebSocket JWT**: The Socket.IO gateway (`StreamProGateway`) verifies a JWT on every `handleConnection` via `WsJwtGuard`. Unauthenticated connections are immediately disconnected.
- **Repository layer**: Services are the repository layer — all DB access goes through the service, never directly from controllers. Controllers handle HTTP concerns only.
- **Mobile Axios client**: `services/apiClient.ts` intercepts 401 responses, attempts a token refresh, and retries the original request. Uses `expo-secure-store` for token persistence.
- **BullMQ jobs**: `JobsModule` provides three queues (`notifications`, `email`, `analytics`). Requires Redis (`REDIS_URL`). Not registered in AppModule by default (add when Redis is available in production).

## Product

- **Live TV**: Channel listing, EPG guide, geo-blocked channel support
- **VOD**: Movies and series (seasons + episodes) with watch-history and continue-watching
- **Subscriptions**: Tiered plans with duration, coupons (percentage/fixed discount), gateway-agnostic payments
- **Ads**: Provider management, placement targeting by country/device/OS, impression/click/error/revenue event tracking
- **Notifications**: In-app and push notifications with read/dismiss state
- **Parental Controls**: PIN-gated content rating restrictions per user profile
- **Admin Panel**: Full CRUD for all entities, analytics dashboard, audit log, feature flags, settings KV store
- **Mobile App**: Expo + React Native, i18n (EN/AR/FR/ES), Zustand state, Axios with auto token refresh

## User preferences

_None recorded yet._

## Gotchas

- **Prisma generate required**: Run `npx prisma generate` after any schema change or after a fresh install. The client is generated into the pnpm cache, not a local `.prisma/` folder.
- **Port collisions**: Admin Next.js runs on `localPort 23744`. If `EADDRINUSE` on restart, kill the port first: `fuser -k 23744/tcp`.
- **ThrottlerGuard**: Registered via `APP_GUARD` in `AppModule` — do NOT also add it in `main.ts` (it has a 3-argument constructor incompatible with manual instantiation).
- **JSON nullable fields**: When assigning `null` to a Prisma nullable JSON field, use `Prisma.DbNull` (not plain `null`) to satisfy the `NullableJsonNullValueInput` type.
- **Composite nullable unique keys**: Nullable string fields in a Prisma composite unique index require a `as string` cast for the where-clause lookup (Prisma 6 type-generation quirk).
- **BullMQ / Redis**: `JobsModule` consumers will crash on startup without a running Redis. Add `JobsModule` to `AppModule` only once Redis is provisioned.

## Pointers

- See the `pnpm-workspace` skill for workspace structure and TypeScript setup
- API Swagger docs available at `http://localhost:8080/api/docs` when the server is running
- Seed script populates: plans, ad providers, 25 placements, 7 payment gateways, coupons
