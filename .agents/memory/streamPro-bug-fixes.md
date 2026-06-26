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

**Why admin dropdowns were empty:** Admin sports page calls `GET /v1/sports/teams` and `GET /v1/sports/tournaments` expecting `{ data: [...] }` (to match the `extractData` utility which reads `res.data.data`). The service returned a raw array, so `data` was `undefined` → Select options were empty.

**Why health_check_mode save failed:** The setting key may not have existed yet (first save = CREATE path). With `value` stripped by whitelist, Prisma tried to INSERT with `value = undefined` which violates the NOT NULL constraint. General settings save appeared to work only because those keys already existed (UPDATE path ignores undefined fields silently).
