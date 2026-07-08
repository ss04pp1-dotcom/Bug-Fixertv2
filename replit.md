# SOL TV

A full-stack streaming/TV platform consisting of a backend API server, an admin web interface, and a mobile app.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/admin run dev` — run the admin Next.js app
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

### Required environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for session signing |

> **Note:** `node_modules` are not installed. Run `pnpm install` from the workspace root before starting any workflow.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: NestJS / Express 5
- DB: PostgreSQL + Prisma ORM
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/`)
- Admin: Next.js (App Router) + Tailwind CSS
- Mobile: Expo / React Native (Expo Router)
- Build: esbuild (CJS bundle for API), Vite (shared libs)

## Where things live

- `artifacts/api-server/` — NestJS backend; `src/main.ts` is the entry point
- `artifacts/admin/` — Next.js admin web app; `app/` uses App Router
- `artifacts/mobile/` — Expo mobile app; `app/` uses Expo Router
- `lib/api-spec/` — OpenAPI spec (source of truth for all API contracts)
- `lib/api-client-react/` — generated React hooks (do not edit manually)
- `lib/api-zod/` — generated Zod schemas (do not edit manually)
- `artifacts/api-server/prisma/schema.prisma` — database schema

## Architecture decisions

- The OpenAPI spec in `lib/api-spec/` is the single source of truth; client hooks and Zod schemas are generated from it via Orval — always run codegen after spec changes.
- Prisma is the ORM; schema changes require `pnpm --filter @workspace/db run push` (dev) or a migration (prod).
- Ad system uses WebView banners + Smartlink gate + VAST (not AdMob/AppLovin SDKs).

## User preferences

- Only make exactly the changes asked — nothing more, nothing less.

## Gotchas

- Run `pnpm install` from the workspace root before starting any workflow — `node_modules` will be missing on a fresh clone/import.
- Always run codegen (`pnpm --filter @workspace/api-spec run codegen`) after editing the OpenAPI spec in `lib/api-spec/`.
- Run Prisma commands from `artifacts/api-server/` using the local binary, not the workspace root.
- Expo Router app root is set via the `EXPO_ROUTER_APP_ROOT` env var — do not hardcode paths in `_ctx.*.js`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- `FIXES-APPLIED.md` and `BATCH2_FIXES.md` document historical bug fixes applied to this project.
