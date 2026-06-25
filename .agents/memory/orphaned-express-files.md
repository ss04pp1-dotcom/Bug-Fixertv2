---
name: Orphaned Express files in NestJS api-server
description: Express template files that got mixed into the NestJS project
---

The following Express template files were found inside the NestJS api-server artifact and caused `tsc --noEmit` failures:
- `src/app.ts` (Express + pino-http)
- `src/index.ts` (Express entry point)
- `src/lib/logger.ts` (pino logger)
- `src/routes/health.ts` (Express router + @workspace/api-zod)
- `src/routes/index.ts`

These were deleted. NestJS entry point is `src/main.ts`; app module is `src/app.module.ts`.

**Why:** They were residual files from the pnpm workspace API template that got copied when setting up the project.
**How to apply:** If tsc shows pino/pino-http/api-zod errors in the NestJS api-server, check for stray Express files.
