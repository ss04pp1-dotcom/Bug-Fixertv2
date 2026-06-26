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
