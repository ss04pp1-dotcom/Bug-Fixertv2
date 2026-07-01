---
name: Mobile API endpoint auth mismatches
description: Which NestJS endpoints are public vs admin-only, and the correct mobile hook paths
---

Several mobile api-hooks.ts entries were calling admin-only endpoints.
Correct public paths:

| Hook | Wrong path | Correct public path |
|---|---|---|
| useBanners | /banners | /banners/active |
| useAnnouncements | /announcements | /announcements/active |
| useSettings | /settings | /settings/public |
| useFeatureFlags | /feature-flags | /feature-flags/enabled |
| useContinueWatching | /watch-history | /watch-history/continue-watching |
| useEPG | /epg | /epg (new endpoint added — getAllByDate) |

**Why:** NestJS controllers have both @Public @Get('sub-route') and
@ApiBearerAuth @Roles('admin') @Get() at the same controller. The root
GET is always admin-only; the public endpoint is always a named sub-route.

**How to apply:** Whenever adding a new mobile hook, check the controller
for @Public decorators — never assume GET / on a controller is public.
