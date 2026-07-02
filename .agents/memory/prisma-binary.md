---
name: Prisma binary location
description: Where to run prisma CLI commands in this monorepo
---

# Prisma Binary Location

## Rule
Always run `prisma` commands from `artifacts/api-server/` using its local binary:

```
cd artifacts/api-server && npx prisma db push
# or
artifacts/api-server/node_modules/.bin/prisma db push
```

Running `prisma` from the workspace root fails because Prisma is not installed there.

**Why:** pnpm workspace installs each package's deps in its own `node_modules`. The `schema.prisma` and `.env` (DATABASE_URL) are both scoped to `artifacts/api-server/`.
