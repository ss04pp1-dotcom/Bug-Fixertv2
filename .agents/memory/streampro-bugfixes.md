---
name: StreamPro bug reports vs production deployment
description: Key gotcha when debugging bugs reported by the StreamPro user — the mobile app and admin default to external production hosts, not this repo's local servers.
---

The mobile app (`artifacts/mobile/constants/config.ts`) defaults `EXPO_PUBLIC_API_URL` to `https://livetv-aokw.onrender.com`, and the admin the user screenshots from is `livetvv.pages.dev` (Cloudflare Pages) — neither is this repl's local `artifacts/api-server` / `StreamPro Admin` workflow.

**Why:** Bugs reported via screenshots reflect whatever is currently deployed externally, which may be behind this repo's code. Fixes made here cannot be verified by reproducing against the live report — only by code review + typecheck — until the user redeploys.

**How to apply:** When debugging user-reported runtime bugs, check `Config.API_BASE`/deployed admin URL first. Fix the root cause in source, typecheck, but tell the user they need to redeploy (Render/Cloudflare Pages) to see the fix live; don't claim it's verified in production.

Known root cause found: Google Sign-In was always failing because `verifyOAuthToken` in `auth.service.ts` only checked a `google_client_ids` setting that the admin UI never exposes/sets — the actual admin-configurable fields are `google_client_id_web/android/ios`. Fixed by accepting those as valid audiences too.
