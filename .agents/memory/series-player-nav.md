---
name: Series player navigation
description: How to navigate to the VOD player for series content in the mobile app
---

When navigating to the player for series content, always pass the SERIES id
(not episode id) as the path segment, with params: { type: 'series', season: '<1-based episode number>' }.

Example:
  router.push({ pathname: `/player/${seriesId}`, params: { type: 'series', season: '1' } })

The player screen (app/player/[id].tsx) calls GET /series/${id} and then
flattens all seasons' episodes. The `season` param is parsed as parseInt(season) - 1
for the episode index.

**Why:** Using firstEp.id or episode id as the path causes the player to call
GET /series/<episodeId> which returns 404.

**How to apply:** Any screen that navigates to series playback (series detail,
season screen, my-list, trending, browse).
