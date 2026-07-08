# Batch 2 — Security & Quality Fixes

**Applied:** 2026-07-07  
**Fixes in this batch:** 25 changes across API, Admin, Mobile, DB

---

## 🔴 API Server

### Fix 1 — `main.ts`: DIRECT_URL boot diagnostic
**Issue #23:** `diagnoseBoot()` only checked `DATABASE_URL`. Prisma migrations use `DIRECT_URL` (non-pooled direct connection), so a misconfigured `DIRECT_URL` would fail silently at deploy time while the app still booted.  
**Fix:** Added DIRECT_URL connectivity check in `diagnoseBoot()`. Missing/failing DIRECT_URL now logs a clear warning at startup.

### Fix — `app.module.ts`: LocaleMiddleware registered globally
**Issue #46 (i18n):** API had no locale extraction — error messages were always English.  
**Fix:** `LocaleMiddleware` (new) reads `Accept-Language` header and attaches `req.locale` to every request. Services can call `t('auth.invalid_credentials', req.locale)` for localised messages.

---

## 🟠 Database / Prisma

### Fix 6 — `schema.prisma`: Missing composite indexes added
**Issue #21:** Movie/Series list queries filtered on `(isActive, deletedAt, categoryId)` with only single-column indexes → full table scans at scale.  
**Added composite indexes for:**
- `Movie`: `(isActive, deletedAt, categoryId)`, `(isFeatured, isActive, deletedAt)`, `(isTrending, isActive, deletedAt)`, `(isPremium, isActive, deletedAt)`
- `Series`: same pattern
- `Match`: `(status, scheduledAt, isActive)` for upcoming-schedule queries
- `Notification`: `(isActive, scheduledAt)`, `(targetAll, isActive)` for fan-out jobs
- `NotificationRead`: `(userId, readAt)` for unread-count queries
- `AuditLog`: `(resource, createdAt)`, `(level, createdAt)`, `(userId, createdAt)`

### Fix 7 — `fix-missing-columns.sql`: Archived with warning
**Issue #19:** Ad-hoc emergency SQL script left in `prisma/` folder risked being accidentally re-run in production.  
**Fix:** Big WARNING header added. File is kept for historical reference only — use `prisma migrate deploy` instead.

### Fix 8 — New migration: `20260707000001_add_pgcrypto_composite_indexes`
**Issue #20:** No pgcrypto/uuid-ossp extension in migrations → reproducible fresh-DB provisioning could fail.  
**Fix:** New migration creates both extensions (idempotent `CREATE EXTENSION IF NOT EXISTS`) and materialises all composite indexes as SQL `CREATE INDEX IF NOT EXISTS` statements.

### Fix 5 — `analytics-retention.service.ts`: AdEvent + WatchHistory + SearchHistory retention
**Issue #16:** Only `AnalyticsEvent`, `PlaybackEvent`, `AuditLog` had retention. `AdEvent` (high-write: one row per impression) and `WatchHistory`/`SearchHistory` accumulated forever.  
**Fix:** Added three new daily cron jobs:
- `purgeAdEvents()` — default 90 days (`AD_EVENT_RETENTION_DAYS`)
- `purgeStaleWatchHistory()` — default 180 days (`WATCH_HISTORY_RETENTION_DAYS`)
- `purgeSearchHistory()` — default 30 days (`SEARCH_HISTORY_RETENTION_DAYS`)

### Fix 14 — `soft-delete.policy.ts`: Unified soft-delete constants
**Issue #15:** Schema has three soft-delete patterns (`deletedAt`, `isActive`, or both) → inconsistent service queries.  
**Fix:** New `soft-delete.policy.ts` documents the canonical rule per model type and exports `ACTIVE_FILTER`, `NOT_DELETED_FILTER`, `IS_ACTIVE_FILTER`, `softDeletePayload()`, `restorePayload()` helpers.

---

## 🟠 Admin (Next.js)

### Fix 2 — `next.config.ts`: allowedDevOrigins dev-only
**Issue #26:** `allowedDevOrigins` (Replit preview URLs) shipped in production build where they served no purpose.  
**Fix:** Wrapped in `!isProduction && { ... }` — only present in dev server builds.

### Fix 10 — `axios-client.ts`: extractData shape validation
**Issue #27:** `extractData()` guessed the response shape, causing silent bugs when API contract drifted.  
**Fix:** Now validates for both `success` and `message` fields before unwrapping envelope. Dev-mode logs `success=false` responses loudly.

### Fix 11 — `Sidebar.tsx`: Role-based navigation visibility
**Issue #28:** All nav items shown to all admin roles regardless of permissions.  
**Fix:** `getAdminRole()` decodes JWT role claim client-side. `isNavItemVisible()` hides system-config items (`/roles`, `/permissions`, `/audit-logs`, etc.) from non-super-admin users. UX only — enforcement is API-side.

### Fix 18 — `lib/lazy-page.tsx`: Route-level dynamic import utility
**Issue #31:** 40+ admin pages statically bundled → large initial JS.  
**Fix:** New `lazyPage()` HOC wraps pages in `dynamic()` with a skeleton loading state. Pages can opt in with `export default lazyPage(() => import("./_content/..."))`.

### Fix — `no-ssr.tsx`: Improved with CLS prevention docs
**Issue #29:** Hydration flash — no guidance on providing stable fallback skeleton.  
**Fix:** Added JSDoc explaining how to pass `fallback={<Skeleton />}` for zero-CLS hydration.

---

## 🟠 Mobile (Expo/RN)

### Fix 3 — `app.config.js`: iOS ATS hardened, Android cleartext via plugin only
**Issue #33:** `NSAllowsArbitraryLoads: true` allows HTTP for ALL app networking (not just media) → App Store review flag.  
**Fix:**
- `NSAllowsArbitraryLoads: false` (removed)
- `NSAllowsArbitraryLoadsForMedia: true` (kept — needed for IPTV streams via AVPlayer)
- `NSExceptionDomains` added for the API server
- `usesCleartextTraffic` removed from manifest (the `withNetworkSecurityConfig` plugin handles Android via authoritative XML config)

### Fix 4 — `lib/api.ts`: Retry/backoff + web storage fix + POST 401 error
**Issue #32, #36, #38:**
- **Retry/backoff:** Idempotent requests (GET/PUT/PATCH/DELETE) now retry up to 2× on 5xx/network errors with exponential backoff (500ms → 1s → 2s, capped at 4s)
- **Web storage:** Refresh token no longer stored in `localStorage` on web. Access token moved to `sessionStorage`. Prevents XSS → persistent token escalation.
- **POST 401 error:** POST requests that get 401 now reject with a named `AUTH_EXPIRED` error instead of silent rejection, so UI can surface a "Session expired" message.

### Fix 17/Metro — `metro.config.js` + `stubs/hls-stub.js`
**Issue #40:** `hls.js` (250KB browser-only library) in `package.json` could be bundled into native builds.  
**Fix:** Metro `resolveRequest` hook intercepts `hls.js` imports on non-web platforms and returns an empty stub. Native HLS is handled by AVPlayer/ExoPlayer via `react-native-video`.

### Fix 9 — `AdBanner.tsx`: WebView originWhitelist restricted
**Issue #39:** `originWhitelist={['*']}` allowed any URL scheme (including `javascript:`, `file://`, `data:`) in ad WebViews.  
**Fix:** Changed to `['https://*', 'http://*']` — allows all HTTP/HTTPS ad network origins but blocks dangerous non-HTTP schemes.

---

## 🔵 Cross-cutting

### Fix 13 — Public routes E2E test
**Issue #44 (test coverage):** No test verifying `@Public()` routes are accessible and protected routes reject correctly.  
**Fix:** `src/auth/tests/public-routes.e2e-spec.ts` tests all public routes return non-401, and all protected routes return 401 without a token.

### Fix 15 — Secret rotation policy doc
**Issue #45:** No rotation runbook — rotating `JWT_ACCESS_SECRET` instantly invalidates all sessions with no grace period.  
**Fix:** `docs/secret-rotation-policy.md` documents dual-secret window strategy and migration path to `kid`-tagged key rotation.

### Fix 16 — `locale.middleware.ts` + i18n `t()` helper
**Issue #46:** API error messages were always English regardless of client locale.  
**Fix:** New `LocaleMiddleware` extracts `Accept-Language`, attaches `req.locale`. New `t(key, locale)` function provides bn/ar/en/hi/fr/es/pt/ur/tr translations for common error keys.

### Fix 19 — New-arch compatibility docs
**Issue #41:** No tracking of which third-party libraries are tested with `newArchEnabled: true`.  
**Fix:** `mobile/docs/new-arch-compatibility.md` documents per-library status and testing protocol.

### Fix 12 — `replit.md`: Drizzle → Prisma
**Issue #43:** Stack section incorrectly listed "Drizzle" as the ORM.  
**Fix:** Corrected to "Prisma".

---

## What was already fixed in v2/v3 + Batch 1

✅ Premium stream authz | ✅ SSLCommerz/PayPal signature | ✅ SSRF hardening  
✅ Refresh-token hash | ✅ Google OAuth aud check | ✅ MIME magic-byte  
✅ FCM dead-token reap | ✅ Mobile URL scheme guard | ✅ Body-size cap  
✅ JWT placeholder guard | ✅ X-Request-ID (UUID validation) | ✅ BullMQ retry  
✅ Subscription-expire cron | ✅ Session/OTP index | ✅ Multi-tier throttle  
✅ CSP always-on | ✅ Graceful shutdown | ✅ Swagger basic-auth  
✅ Root route sanitize | ✅ __mocks__ exclude | ✅ Sentry hook  
✅ Retention/cleanup crons | ✅ CORS exact origins | ✅ AnalyticsEvent indexes  
✅ PrismaService pool config | ✅ Webhook size cap | ✅ JWT auth guard test
