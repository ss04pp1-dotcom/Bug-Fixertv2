---
name: Triple Combo Ad System
description: Architecture for the WebView banner + Smartlink gate + VAST ad monetization system that replaced AdMob/AppLovin
---

# Triple Combo Ad System

## Rule
All ad monetization on the mobile app uses three complementary mechanisms — no native SDK is used.

## Components
1. **WebView Banner** (`AdBanner.tsx`) — renders `bannerHtmlCode` from the channel in a WebView; falls back to an image placeholder when no HTML is set.
2. **Smartlink Gate** (`useChannelAdGate.ts`) — when `isSmartlinkEnabled=true` on the channel, opens `smartlinkUrl` via `expo-web-browser` before navigating to the player. Returns only `{ requestChannel }`.
3. **VAST Video Ads** — `vastUrl` is stored on each channel, ready to be consumed by the player component.

## Data model
Four new fields on the `Channel` Prisma model (and `CreateChannelDto`):
- `isSmartlinkEnabled` (Boolean, default false)
- `smartlinkUrl` (String?)
- `vastUrl` (String?)
- `bannerHtmlCode` (String?)

## Admin UI
Fields are exposed in `artifacts/admin/components/channels/channel-detail-modal.tsx` under the "Ad Monetization" section of the Info tab. Toggle + three text inputs. Saved via `PUT /v1/channels/:id`.

## Mobile data flow
`mapChannel()` in `live-tv.tsx` picks up `isSmartlinkEnabled` and `smartlinkUrl` from the API response and passes them through `handleSelectChannel` → `useChannelAdGate.requestChannel()`.

**Why:** Native SDKs (AdMob, AppLovin) required Google Play policies compliance and SKAdNetwork config. WebView-based ads have no SDK footprint and work on both iOS and Android with zero native setup.

**How to apply:** Any new screen that shows a channel tap should call `channelGate.requestChannel(id, { ..., isSmartlinkEnabled, smartlinkUrl })` from `useChannelAdGateContext()`.
