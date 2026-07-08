# Bug-Fixertv2 — Applied Fixes (v2 patch)

## Removed
- **Drizzle package `lib/db/`** — entire package deleted (was `export {}`, dead code).
- **`drizzle-orm` catalog entry** removed from `pnpm-workspace.yaml`.

## API Server (`artifacts/api-server`)

### CRITICAL
1. **Premium channel authorization** — `channels.service.ts::getStreamUrl()` now takes the authenticated user and throws `ForbiddenException` for anonymous or non-premium callers on `isPremium` channels. Staff roles (`super_admin`, `admin`, `editor`, `moderator`) bypass. Also honours `subscriptionEndsAt`.
2. **`GET /channels/:id/stream`** — controller now uses new `OptionalJwtAuthGuard` (`common/guards/optional-jwt-auth.guard.ts`) so it stays public for free channels but populates `req.user` when a bearer token is present.
3. **SSLCommerz IPN verification** implemented per SSLCommerz v4 verify_sign/verify_key MD5 algorithm.
4. **PayPal webhook verification** implemented via PayPal's `/v1/notifications/verify-webhook-signature` REST call (secret must be JSON `{clientId, clientSecret, webhookId, env}`). `verifyGatewaySignature` is now async.

### HIGH
5. **SSRF hardening** — new `isPrivateUrlDeep()` resolves DNS and rejects hostnames pointing at private/link-local ranges. `parsePlaylistUrl()` uses it. Also switched to `BadRequestException`.
6. **`parsePlaylistUrl` content-type detection** — now prefers `Content-Type` header, then extension, then payload sniffing.
7. **Refresh tokens no longer stored raw** — new `AuthService.hashRefreshToken()` (HMAC-SHA256 keyed with `jwtConfig.refreshSecret`). All `Session.refreshToken` writes (login, refresh, social login) store the hash; `JwtRefreshStrategy.validate()` compares by hash and also checks `expiresAt`.
8. **Inactive channels editable** — `channels.service.ts::update()` and `remove()` no longer route through `findOne()` (which filters `isActive:true`). Admins can re-activate or edit disabled channels.
9. **Google OAuth `aud` verification** — `verifyOAuthToken()` now checks `email_verified` and validates the token's `aud` against configured client IDs (settings key `google_client_ids` or env `GOOGLE_OAUTH_CLIENT_IDS`). Refuses login if not configured.
10. **Analytics events persisted** — new `AnalyticsEvent` Prisma model + `analytics_events` table; `AnalyticsQueueConsumer` writes to it via new `PrismaService` injection. `JobsModule` now imports `PrismaModule`.

### MEDIUM
11. **OTP brute-force counter fixed** — new `failedAttempts` column on `Otp`. `verifyOtp()` now reads the single active OTP, increments `failedAttempts` on wrong code, and burns the OTP at 5 attempts. Old count-of-unused heuristic was defeated by every-request invalidation.
12. **`PaginationDto.sortOrder`** — now `@IsIn(['asc','desc'])` instead of open `@IsString()`.
13. **`PaginationDto.limit` max** lowered from 500 → 100.
14. **Firebase FCM lazy retry** — module-level `fcmInitAttempted` flag replaced with a `fcmLastAttemptAt` cooldown so init can recover if config is added later.
15. **SearchHistory race condition** — `findFirst → create` replaced with a real atomic `prisma.searchHistory.upsert()` on the existing `@@unique([userId, query])`.

### LOW / Infra
16. **Channel composite indexes** added on `(isActive, deletedAt, categoryId)`, `(isFeatured, isActive, deletedAt)`, `(isTrending, isActive, deletedAt)` — matches the actual list-filter query shapes.

## Schema migration required

Two schema changes ship in this patch:

1. `Otp.failedAttempts Int @default(0)`
2. `AnalyticsEvent` model + `analytics_events` table
3. Three new composite indexes on `Channel`

Run `pnpm --filter @workspace/api-server run db:push` (dev) or generate a migration with `pnpm exec prisma migrate dev --name post-fix-patch` and deploy in production.

## Configuration checklist

- Set `google_client_ids` in Admin → Settings (or `GOOGLE_OAUTH_CLIENT_IDS` env, comma-separated) — Google login now refuses without it.
- Regenerate any PayPal `webhookSecret` values into the JSON format described in `payments.service.ts::verifyPaypalSignature`.
- If any live SSLCommerz gateway rows already exist, ensure `webhookSecret` holds the store password (used to MD5 the signature).

## Not changed (out of scope for this pass)

- `lib/api-client-react` / `lib/api-zod` (Orval-generated, mostly `/healthz` only) — kept in place. Recommend regenerating from a real OpenAPI spec (Nest Swagger export) in a separate task.
- Admin panel `sessionStorage` token — requires switching admin off `output: "export"` static export to enable httpOnly cookies. Architectural change.
- Email templates still hardcoded HTML strings.

---

## v3 patch (second-pass deep audit)

### CRITICAL
- **Bcrypt DoS guard** — `RegisterDto.password` and `ResetPasswordDto.newPassword` now `@MaxLength(128)`.
- **Storage MIME magic-byte check** — `storage.controller.ts::validateFile()` now sniffs file leading bytes (JPEG/PNG/GIF/WEBP/MP4/WEBM/MOV) instead of trusting the client-supplied `Content-Type`. Blocks polyglot uploads.
- **FCM dead-token reaper** — `notifications.service.ts::send()` parses `sendEachForMulticast` per-token responses, and NULLs `User.fcmToken` for `UNREGISTERED` / `INVALID_ARGUMENT` errors. Fixes silent decay of push delivery over time.
- **Notifications `test-push` DTO** — new `TestPushDto` (`@IsString @IsNotEmpty @MaxLength(4096)`) replaces the untyped `{ token: string }` body that bypassed the global `ValidationPipe`.
- **Mobile URL scheme validation** — new `lib/safeLink.ts::openExternalUrl()` only permits `http(s)://`. Wired into `app/(main)/index.tsx` (2 sites) and `AdBanner`/`AdInterstitial`/`AdNative`/`AdRewarded`. Blocks server-injected `javascript:`, `tel:`, custom-scheme deep links.

### HIGH
- **JSON body-parser size cap** — `main.ts` calls `app.useBodyParser('json'/'urlencoded', { limit: '1mb' })`. Multipart uploads unaffected (still enforced by Multer per-endpoint limits).
- **JWT secret placeholder guard** — `validateEnvironment()` now hard-refuses to boot if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` starts with `CHANGE_THIS` or is shorter than 32 chars.
- **`X-Request-ID` correlation ID** — `main.ts` middleware generates a UUID per request (honouring an inbound header if present), sets it on `req.headers` and `res.setHeader('X-Request-ID', ...)`.
- **BullMQ retry semantics** — `jobs.module.ts` registers `defaultJobOptions: { attempts: 3, backoff: exponential/5s, removeOnComplete/Fail retention }`. Previously failed jobs went straight to the dead queue.
- **Daily subscription-expiry cron** — new `SubscriptionsService::expireStaleSubscriptions()` (`@Cron(EVERY_DAY_AT_3AM)`) bulk-flips expired active/trial subscriptions to `expired` and clears `user.isPremium`. Fixes ghost-premium for users who never make requests after their plan lapses.
- **Payments webhook throttle** — `POST /payments/webhook` now uses `@Throttle({ limit: 300, ttl: 60000 })` instead of open `@SkipThrottle()`. Blocks flood-DoS while keeping the per-user global limit skipped.

### MEDIUM
- **Storage folder path hardening** — `StorageService::generateKey()` runs `path.basename()` + strict allow-list regex on the folder name so a traversal payload can't escape the intended prefix even if the controller allow-list ever regresses.
- **Session index** — added `@@index([userId, isActive, expiresAt])` on the `sessions` table (covers refresh-token lookup path).
- **OTP index** — added `@@index([identifier, type, usedAt, expiresAt])` on the `otps` table (covers verifier + brute-force counter query shape).

### Schema migration required
Two new indexes ship in this patch (Session composite, Otp composite). Generate with:

```
pnpm exec prisma migrate dev --name v3-second-pass
```

### Deferred (require product decisions)
- **CSP always-on** — currently disabled outside production for Swagger convenience. Enable in staging by setting `NODE_ENV=production` on the staging environment.
- **Email verification enforcement at login** — code path exists (`user.emailVerified`) but is not gated. Enable when the product decides free accounts must confirm before login.
- **PayPal webhook event-ID dedupe table** — status-based idempotency covers the common case; a per-event dedupe table is only needed if you observe duplicate captures.
- **Admin panel CSP + move off `sessionStorage`** — architectural; requires disabling Next.js `output: "export"`.
- **Test coverage for PaymentsService / StorageService / NotificationsService** — recommended but out of scope for a fix pass.

---

## v4 — Batch 1: API safe/mechanical fixes

- **#1 Multi-tier throttling** — `ThrottlerModule` now runs three windows: short (10/sec), medium (100/min), long (1000/hr). Named tiers so per-route `@Throttle({ short: {...} })` overrides work.
- **#3 Helmet CSP always-on** — CSP now runs in every environment (including staging). Opt-out escape hatch: `CSP_DISABLED=true`.
- **#5 Graceful shutdown** — `SIGTERM`/`SIGINT` and `uncaughtException` now call `app.close()` (10s force-exit timer) so in-flight requests, Prisma pool, and BullMQ workers drain instead of being killed mid-write.
- **#6 Swagger basic auth in production** — when `SWAGGER_ENABLED=true` in prod, `/docs` requires HTTP Basic (`SWAGGER_USER` / `SWAGGER_PASS`). Missing creds → refuse to expose.
- **#10 Root route hardened** — `GET /` no longer leaks service name/version (`{ status: 'ok' }` only).
- **#11 X-Request-ID validation** — only accept a well-formed UUID from clients; otherwise mint a fresh one to prevent header injection / log-forging.
- **#14 tsconfig** — `__mocks__/**` now excluded from prod build (was leaking test doubles into `dist/`).
- **#4 Sentry hook** — `src/common/observability/sentry.ts` DSN-driven wrapper (no hard dep). Wired into `unhandledRejection` + `uncaughtException`. Install `@sentry/node` and set `SENTRY_DSN` to activate.
- **#8 Retention crons** — new `AnalyticsRetentionService` (daily 03:15 UTC) purges `analyticsEvent`, `playbackEvent`, `auditLog`; hourly cleanup for expired `session` (#17) and `otp` (#18) rows. Env: `ANALYTICS_EVENT_RETENTION_DAYS`, `PLAYBACK_EVENT_RETENTION_DAYS`, `AUDIT_LOG_RETENTION_DAYS`.

