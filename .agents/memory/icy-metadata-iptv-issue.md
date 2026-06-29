---
name: Icy-MetaData IPTV playback issue
description: Why Icy-MetaData:1 header causes 20-30s delay on IPTV servers and should never be sent
---

## Rule
Never send `Icy-MetaData: 1` in ExoPlayer/react-native-video request headers for IPTV streams.

## Why
`Icy-MetaData: 1` is a Shoutcast/Icecast audio metadata header. When IPTV video streaming servers
(e.g. "Streamer 23.07" used by many IPTV panels) receive it, they spend 20-30 seconds preparing
audio metadata before sending the first byte. ExoPlayer's default connection timeout fires → the
channel never plays. Without that header the same server responds in under 1 second.

**Measured evidence** (T Sports HD channel, `http://114.130.57.233:8080/LIVE-Sports/video.m3u8?token=...`):
- With `Icy-MetaData: 1` → `X-Route-Time: 26771` (26 seconds)
- Without `Icy-MetaData: 1` → `X-Route-Time: 904` (< 1 second)

Mini Player works because it never sends `Icy-MetaData`.

## How to apply
- **Default User-Agent**: Use `Lavf/58.29.100` (FFmpeg) — universally whitelisted by Xtream/Stalker/
  Emby/Jellyfin panels. VLC and TiviMate use the same UA. The app's own UA
  `StreamPro/2.4.1 (Linux;Android...)` can be rate-limited or blocked by some panels.
- Keep `headers` non-empty (User-Agent alone) so DataSourceUtil.kt rebuilds its OkHttpDataSource
  singleton and prevents old headers leaking between streams.
- Files that implement this: `GlobalVideoPlayer.tsx`, `live-player/[id].tsx`, `player/[id].tsx`
- If a source provides its own `userAgent` in the admin panel, it overrides the default.
