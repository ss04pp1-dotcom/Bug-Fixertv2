---
name: Monetization route scope
description: ChannelAdGateProvider lives inside (main) route group; screens outside must use the hook directly
---

# Monetization Route Scope

## Rule
`ChannelAdGateProvider` is mounted only in `artifacts/mobile/app/(main)/_layout.tsx`.
Screens outside the `(main)` route group (e.g. `app/channel/[id].tsx`) must import
`useChannelAdGate` directly from `@/hooks/useChannelAdGate` — never `useChannelAdGateContext`.

**Why:** Calling `useChannelAdGateContext()` outside its provider throws a runtime error
(`must be used inside ChannelAdGateProvider`) and crashes the screen.

**How to apply:** Any new screen added outside `app/(main)/` that needs the smartlink gate
should import the hook directly, not the context.
