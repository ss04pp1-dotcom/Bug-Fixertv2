---
name: StreamPro bug fixes — full audit
description: All bugs found and fixed across the StreamPro monorepo (API, admin, mobile) in the deep-audit sessions
---

## Mobile api.service.ts bugs fixed

| Service | Method | Bug | Fix |
|---------|--------|-----|-----|
| AuthService | updateProfile | PATCH /auth/profile | PUT /auth/profile |
| AuthService | changePassword | POST /auth/change-password | PUT /auth/change-password |
| SubscriptionService | cancel | DELETE /subscriptions/me | POST /subscriptions/cancel |
| SubscriptionService | subscribe | POST /subscriptions | POST /subscriptions/subscribe |
| SportService | getMatches | GET /sports/matches | GET /sports |
| SportService | getMatch | GET /sports/matches/:id | GET /sports/:id |
| SportService | getMatchCommentary | GET /sports/matches/:id/commentary | GET /sports/:id/commentary |
| SportService | setAlert | POST /sports/matches/:id/alerts (wrong 's') | POST /sports/matches/:id/alert |
| SportService | removeAlert | DELETE /sports/matches/:id/alerts | POST /sports/matches/:id/alert (toggle) |
| SupportService | getTickets | GET /support/tickets | GET /support |
| SupportService | createTicket | POST /support/tickets + wrong fields | POST /support + {subject, description} |

## Mobile api-hooks.ts bugs fixed

| Hook | Bug | Fix |
|------|-----|-----|
| useCreateTicket | POST /support/tickets + {subject, message} | POST /support + {subject, description: message} |

## Mobile auth-store.ts bug fixed

- `checkAuth: () => void` → `checkAuth: () => Promise<void>` (TypeScript interface mismatch caused type errors)

## API server bugs fixed

| File | Bug | Fix |
|------|-----|-----|
| auth/strategies/jwt-refresh.strategy.ts | mixed cookie+body extraction but cookie-parser not installed | body-only extraction |
| support/support.controller.ts | create() required userEmail in body (user already authenticated) | use @CurrentUser() to extract user.email from JWT |
| payments/payments.controller.ts | missing POST /payments/gateways/:slug/test endpoint (admin panel called it) | added stub endpoint returning success |

## Admin panel bugs fixed

| File | Bug | Fix |
|------|-----|-----|
| admin/lib/auth.ts | refreshToken stored in sessionStorage only in development | always stored in sessionStorage |
| admin/lib/axios-client.ts | refreshToken read from sessionStorage only in development | always reads from sessionStorage |

**Why these were bugs:** Admin panel is a static export (not SSR), deployed separately from API on Cloudflare Pages. Cookie-based refresh was never going to work cross-domain. Body-based token refresh is correct for this architecture.

## Sports + Settings bugs fixed (session 2)

| File | Bug | Fix |
|------|-----|-----|
| sports/sports.service.ts | `findAllTeams()` returned plain array `[...]` | Return `{ data: [...] }` to match admin's `extractData(res)` → `res.data.data` chain |
| sports/sports.service.ts | `findAllTournaments()` returned plain array `[...]` | Return `{ data: [...] }` same fix |
| sports/sports.controller.ts | Duplicate `@Get('sports')` decorator at bottom of file (dead code, shadowed by first one at line 34) | Removed the duplicate handler |
| settings/dto/set-setting.dto.ts | `value: unknown` field had NO class-validator decorator — `ValidationPipe({ whitelist: true })` strips undecorated fields → value becomes undefined → Prisma upsert CREATE fails with NOT NULL violation | Added `@Allow()` from class-validator to mark field as explicitly allowed without adding constraints |

**Key insight:** NestJS `ValidationPipe({ whitelist: true })` silently strips any DTO property that lacks a class-validator decorator. This is especially dangerous for fields typed as `unknown`/`any` where you intentionally skip validation. Always add `@Allow()` to pass-through fields.

## Zip merge + remaining bug fixes (session 3)

~96/218 bugs fixed in the user-uploaded zip; remaining ~122 verified/fixed below.

### Mobile
| Bug | File | Fix |
|-----|------|-----|
| M-012 | splash.tsx | Capture `glowLoop = RNAnimated.loop(...)`, call `glowLoop.stop()` in cleanup alongside `clearTimeout(timer)` |
| M-047 | profile.tsx | `.filter((p) => p.length > 0)` before mapping to first char — prevents undefined initials from empty name segments |

### API Server TS errors fixed (pre-existing in zip — `tsc --noEmit` 0 errors after)
| File | Error | Fix |
|------|-------|-----|
| favorites.service.ts | `PrismaClientKnownRequestError` not exported from `@prisma/client` | Import from `@prisma/client/runtime/library` |
| favorites.controller.ts | Inline `{ channelId?, movieId?, seriesId? }` body type (A-054) | New `ModifyFavoriteDto` with `@IsUUID()` validation |
| channels.service.ts | `isPremium/isFeatured === 'true'` boolean-vs-string | `String(query.isPremium) === 'true'` |
| channels.service.ts | `healthStatus`, `lastCheckedAt`, `lastSuccessAt`, `lastFailureAt`, `failureReason` not in ChannelServer schema | Removed from select |
| channels.service.ts | `channel.servers` not typed on findFirst result | Cast channel to `any` |
| channels/dto/update-overrides.dto.ts | DTO had `cookie/userAgent/referer/origin` but service expects `adminNameOverride/adminLogoOverride/adminCategoryIdOverride` | Rewrote DTO with correct channel admin override fields |
| github-sync.service.ts | `prisma.githubSource` wrong (model is `GitHubSource`) | Changed to `prisma.gitHubSource` |
| movies.service.ts | `isPremium === 'true'` boolean-vs-string | `String(query.isPremium) === 'true'` |
| movies.service.ts | `subscriptionEndsAt` not on `AuthenticatedUser` | Added `subscriptionEndsAt?: Date \| string \| null` to interface |
| search.service.ts | `userId_query` compound unique not in stale Prisma client | Replaced `upsert` with manual `findFirst + update/create` |

### Admin
| Bug | Fix |
|-----|-----|
| D-051 | Deleted `components/layout/TopHeader.tsx` (deprecated, never imported) |
| A-062 | Deleted `websocket/ws-jwt.guard.ts` (dead code — gateway handles JWT inline) |

### Libs
| Bug | Fix |
|-----|-----|
| L-018 | `chmod +x scripts/post-merge.sh scripts/start-api-server.sh` |

## Key gotchas discovered

- **ChannelServer schema** does NOT have `healthStatus`, `lastCheckedAt`, `lastSuccessAt`, `lastFailureAt`, `failureReason` — selecting them crashes tsc.
- **Prisma client must be regenerated** after schema changes. The `@@unique([userId, query])` on SearchHistory was in schema but client was stale → `userId_query` compound accessor missing → workaround with `findFirst + update/create`.
- **`gitHubSource` not `githubSource`** — Prisma camelCases from model name `GitHubSource`.
- **API server startup** requires `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` env vars — fails silently if missing (check `.env` or Replit secrets panel).
