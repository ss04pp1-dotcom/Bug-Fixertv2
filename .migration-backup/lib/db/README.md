# lib/db (Drizzle)

> **Note:** This package defines a [Drizzle ORM](https://orm.drizzle.team/)
> schema (`src/schema/index.ts`, `drizzle/`), but the API server
> (`artifacts/api-server`) currently uses **Prisma** instead. The Drizzle
> schema here is kept for reference / future migration but is **not imported
> by any consumer at runtime**.

## Current state

- `src/schema/index.ts` — full Drizzle schema for the entire data model.
- `drizzle.config.ts` — Drizzle-Kit configuration (migrations would be
  generated here).
- `drizzle/` — Drizzle-Kit migration artifacts.

The API server uses:

- `artifacts/api-server/prisma/schema.prisma` — Prisma schema.
- `artifacts/api-server/src/prisma/prisma.service.ts` — Prisma client wrapper.

## Migrating to Drizzle (if desired)

1. Replace `artifacts/api-server/src/prisma/prisma.service.ts` with a
   Drizzle-based equivalent (e.g. a `DbService` exposing a `db: DrizzleDB`).
2. Update every service file under `artifacts/api-server/src/**` to use
   Drizzle queries instead of `this.prisma.xxx(...)`.
3. Update `artifacts/api-server/package.json` deps:
   - Remove `@prisma/client`, `prisma`.
   - Add `drizzle-orm`, `drizzle-kit`, and a PG driver
     (`postgres`, `pg`, etc.).
4. Delete `artifacts/api-server/prisma/`.
5. Add `lib/db` as a workspace dependency of `@workspace/api-server`.

## Or: delete this package

If Prisma is the final choice, this package can be removed entirely:

```bash
pnpm --filter @workspace/db remove drizzle-orm drizzle-kit
rm -rf lib/db
# also drop the matching entry from pnpm-workspace.yaml if present
```
