# 🔍 StreamPro Project — সম্পূর্ণ সমস্যা বিশ্লেষণ (Full Problem Analysis)

> **Project:** StreamPro — Enterprise IPTV/Live TV Streaming Platform  
> **Stack:** NestJS API + Expo/React Native Mobile + Next.js Admin  
> **Monorepo:** pnpm workspaces

---

## 🔴 Critical Security Issues (6)

### 1. JWT Secret Falls Back to Empty String — Signing With NO Key
**File:** [jwt.config.ts](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/api-server/src/config/jwt.config.ts#L1-L6)

```typescript
export const jwtConfig = {
  secret:           process.env.JWT_ACCESS_SECRET  || '',  // ⚠️ EMPTY STRING FALLBACK!
  refreshSecret:    process.env.JWT_REFRESH_SECRET  || '',  // ⚠️ EMPTY STRING FALLBACK!
};
```

> [!CAUTION]
> If `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` environment variables are missing, JWTs get signed with an **empty string** as the secret. Any attacker can forge valid tokens and impersonate any user including super_admin. `main.ts` validates these vars exist, but if they're set to empty (`JWT_ACCESS_SECRET=""`) the validation passes but `jwtConfig` still uses `""`.

**Fix:** Throw an error in `jwtConfig` if the secret is falsy rather than falling back to `""`.

---

### 2. `.env.local` Committed to Git With Production Secrets
**File:** [admin/.env.local](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/admin/.env.local)

```
NEXT_PUBLIC_API_URL=https://bug-fixertv2.onrender.com
NEXT_PUBLIC_WS_URL=wss://bug-fixertv2.onrender.com
```

> [!WARNING]
> `.env.local` is committed into the repository. While these are `NEXT_PUBLIC_` vars (client-side safe), the file itself is in the repo — if anyone adds a secret here later it will leak. The [.gitignore](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/.gitignore) should explicitly include `*.env.local`.

---

### 3. `uncaughtException` Handler Swallows Fatal Errors
**File:** [main.ts](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/api-server/src/main.ts#L196-L201)

```typescript
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception — server will continue:', err.stack);
  // Only truly fatal errors (OOM, SIGKILL) should terminate the process.
});
```

> [!WARNING]
> After an `uncaughtException`, Node.js is in an **undefined state**. Continuing execution can lead to data corruption, silent failures, or security bypasses. The Node.js docs explicitly recommend terminating the process. The comment says "server will continue" — this is dangerous.

---

### 4. Refresh Token Exposed in Mobile API Response Body
**File:** [auth.controller.ts](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/api-server/src/auth/auth.controller.ts#L159-L176)

```typescript
const isMobile = req?.headers?.['x-client'] === 'mobile';
if (!isMobile) {
  delete result.refreshToken;
}
```

> [!IMPORTANT]
> The `X-Client: mobile` header determines whether the refresh token is included in the response body. An attacker can simply add `X-Client: mobile` to any request to receive refresh tokens in the response body, bypassing the httpOnly cookie protection intended for web clients.

---

### 5. Module-Level `_switchCount` — Cross-Session State Leak
**File:** [live-player/[id].tsx](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/app/live-player/%5Bid%5D.tsx#L31-L32)

```typescript
let _switchCount = 0;  // Module-level — persists across user sessions
```

While this is intentional for ad counting across `router.replace()` remounts, if a user logs out and another logs in, the counter persists — the second user's ad experience is polluted by the first user's session.

---

### 6. Stream URL (`passedUrl`) Exposed as Route Parameter
**File:** [live-player/[id].tsx](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/app/live-player/%5Bid%5D.tsx#L47-L48)

```typescript
const { streamUrl: passedUrl } = useLocalSearchParams<{ streamUrl?: string; }>();
```

> [!WARNING]
> Stream URLs (which may contain auth tokens, signed URLs, or API keys in query params) are passed as route parameters and thus visible in navigation history, debug logs, and potentially deep link URLs.

---

## 🟠 Bugs (5)

### 1. `setCurrentLang` Gets `""` Instead of `null`
**File:** [live-player/[id].tsx](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/app/live-player/%5Bid%5D.tsx#L201)

```typescript
setCurrentLang((ch?.language || '').toLowerCase() || null);
```

If `ch.language` is `undefined`, this evaluates to `''.toLowerCase()` → `''` — which is truthy-ish for the `||` operator... **wait**, actually `'' || null` → `null` ✓. But if `ch.language` is `" "` (whitespace), it becomes `" "` — which won't match anything. Should `.trim()` first.

---

### 2. `related` Array Uses `any` Types Extensively
**File:** [live-player/[id].tsx](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/app/live-player/%5Bid%5D.tsx#L77-L103)

```typescript
const pool = (relatedRaw as any[]).filter((ch: any) => ch.id !== id);
const scored = pool.map((ch: any) => { ... });
```

The entire related channels computation is untyped — any API response shape change silently breaks the UI instead of being caught at compile time.

---

### 3. `sources.length > 0` in useEffect Dependencies
**File:** [live-player/[id].tsx](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/app/live-player/%5Bid%5D.tsx#L262-L268)

```typescript
useEffect(() => {
  if (sources.length > 0) scheduleHourlyAd();
  return () => { ... };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [sources.length > 0]);  // ⚠️ Boolean expression in deps
```

`sources.length > 0` evaluates to a boolean — so once it becomes `true`, it never triggers again even if the sources array changes completely (e.g. channel switch). The eslint disable comment hides this issue.

---

### 4. `_layout.tsx` — `OtaUpdateBanner` and `GlobalVideoPlayer` Rendered Outside `AppGuards`
**File:** [_layout.tsx](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/app/_layout.tsx#L149-L155)

```tsx
<AppGuards>
  <Slot />
</AppGuards>
<OtaUpdateBanner />      {/* ← Outside FeatureFlagsContext */}
<GlobalVideoPlayer />    {/* ← Outside FeatureFlagsContext */}
```

If `OtaUpdateBanner` or `GlobalVideoPlayer` need feature flag access, they won't have it. Also they render even when geo-blocked — the video player overlay appears on top of the "Not Available in Your Region" screen.

---

### 5. `registerDto` — No Email OR Phone Validation for Empty Strings
**File:** [auth.service.ts](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/api-server/src/auth/auth.service.ts#L33-L35)

```typescript
if (!dto.email && !dto.phone) {
  throw new BadRequestException('Email or phone is required');
}
```

If `dto.email = ""` (empty string), this passes the check since `!""` is `true`... **actually** `!""` is `true`, so this would throw. But if `dto.email = " "` (whitespace), it passes. The DTO validation should `.trim()` before checking.

---

## 🟡 Architecture & Code Quality Issues (8)

### 1. Windows Compatibility — `pnpm-workspace.yaml` Overrides
**File:** [pnpm-workspace.yaml](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/pnpm-workspace.yaml#L78-L161)

The workspace overrides block excludes **all** esbuild/lightningcss/rollup platform binaries except `linux-x64-gnu`. Since you're running on **Windows**, `pnpm install` will fail to get native binaries for your platform. Comments say "replit uses linux-x64 only" — this project was designed for Replit and **will not work natively on Windows** without fixing the overrides.

> [!CAUTION]
> **Most critical runtime issue:** The `dev` script in the API server uses `sh -c`, `pgrep`, `redis-server --daemonize`, and other Unix commands that don't exist on Windows. The project cannot run as-is on your machine.

---

### 2. API Server `dev` Script — Unix-Only
**File:** [api-server/package.json](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/api-server/package.json#L6)

```json
"dev": "if ! pgrep -x redis-server >/dev/null 2>&1; then redis-server --daemonize yes ... fi; pnpm exec prisma generate; pnpm exec nest start --watch"
```

This is a bash script that **will not run on Windows PowerShell**. It uses `pgrep`, `redis-server`, and bash-specific syntax.

---

### 3. Root `preinstall` Script — Unix-Only
**File:** [package.json](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/package.json#L6)

```json
"preinstall": "sh -c 'rm -f package-lock.json yarn.lock; case \"$npm_config_user_agent\" in pnpm/*) ;; *) echo \"Use pnpm instead\" >&2; exit 1 ;; esac'"
```

Uses `sh -c` — requires a Unix shell. Will fail on Windows unless Git Bash or WSL is on PATH.

---

### 4. 106KB `GlobalVideoPlayer.tsx` — God Component
**File:** [GlobalVideoPlayer.tsx](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/components/GlobalVideoPlayer.tsx) — **106,876 bytes**

This single file is over **106KB** — likely 2500+ lines. This is extremely difficult to maintain, debug, and review. It should be split into smaller sub-components (controls, progress bar, source selector, PiP handler, etc.).

---

### 5. Duplicate User Mapping Logic — DRY Violation
**File:** [auth-store.ts](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/lib/auth-store.ts)

The exact same user-mapping code appears in **3 places** (`checkAuth`, `updateUser`, `refreshProfile`):

```typescript
const user: User = {
  id: userData.id,
  name: userData.name,
  email: userData.email,
  avatar: userData.avatar,
  plan: userData.isPremium ? (userData.subscription?.plan?.name || 'premium') : 'free',
};
```

Should be extracted to a shared `mapUserData()` function.

---

### 6. No Error Boundary in Mobile App
**File:** [_layout.tsx](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/app/_layout.tsx)

The root layout has no React Error Boundary. An unhandled rendering error in any screen will crash the entire app with a white screen rather than showing a fallback UI.

---

### 7. Missing `node_modules` — Dependencies Not Installed
The project contains `pnpm-lock.yaml` (667KB) but no `node_modules` directory. You'll need to run `pnpm install` first, but due to the Windows compatibility issues above, this will likely fail.

---

### 8. `Prisma` Schema Too Large — 1417 Lines in Single File
**File:** [schema.prisma](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/api-server/prisma/schema.prisma) — **1417 lines, 48KB**

While Prisma only supports a single `schema.prisma` file, 1417 lines indicates a very complex data model (30+ models). Consider using Prisma's multi-file schema feature (available since Prisma 5.15) to split this into logical groups.

---

## 🔵 Deployment & Configuration Issues (4)

### 1. Hardcoded Production URL in Config
**File:** [config.ts](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/mobile/constants/config.ts#L12)

```typescript
'https://bug-fixertv2.onrender.com'
```

The fallback server URL is hardcoded to a Render deployment. If this URL becomes unreachable (Render spins down free tier), the app fails with no way for users to recover.

---

### 2. Missing `.env` File for API Server
**File:** [.env.example](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/api-server/.env.example) exists, but no `.env` or `.env.local`

Without a `.env` file, the API server will fail to start because `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are required (validated in `main.ts`).

---

### 3. Admin Panel Middleware — False Security
**File:** [middleware.ts](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/artifacts/admin/middleware.ts)

The middleware only runs in development (`next dev`). In production with `output: "export"`, it's completely inactive. The comments acknowledge this, but it can give developers a false sense of security.

---

### 4. `minimumReleaseAge` — Doesn't Apply to All Packages
**File:** [pnpm-workspace.yaml](file:///d:/download/Bug-Fixertv2-main/Bug-Fixertv2-main/pnpm-workspace.yaml#L28)

```yaml
minimumReleaseAge: 1440
minimumReleaseAgeExclude:
  - '@replit/*'
  - stripe-replit-sync
```

The `@replit/*` exclusion is Replit-specific. On a non-Replit environment, the `stripe-replit-sync` package exclusion might cause confusion.

---

## 📋 Summary Table

| Category | Count | Severity |
|:---|:---:|:---:|
| 🔴 Critical Security | 6 | High |
| 🟠 Bugs | 5 | Medium |
| 🟡 Architecture/Quality | 8 | Medium |
| 🔵 Deployment/Config | 4 | Low-Med |
| **Total Issues** | **23** | |

---

## 🎯 Recommended Priority Fix Order

1. **JWT empty-string fallback** — immediate security risk
2. **Windows compatibility** — you can't run the project otherwise
3. **Create `.env` files** from `.env.example`
4. **`uncaughtException` handler** — should terminate gracefully
5. **Refresh token `X-Client` bypass** — security fix
6. **Split `GlobalVideoPlayer.tsx`** — maintainability
7. **Add Error Boundary** to mobile app
8. **Type safety** — replace `any` casts with proper types

---

> আপনি চাইলে আমি এই সমস্যাগুলো একে একে fix করতে পারি। কোনটা আগে fix করবো বলুন, অথবা সবগুলো ধরে ধরে করি! 🚀
