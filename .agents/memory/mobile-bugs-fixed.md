---
name: Mobile bug audit findings
description: Deep audit of artifacts/mobile — all confirmed bugs and their fixes
---

## Confirmed & Fixed (July 2026)

### EAS Build (Critical — blank screen)
- `scripts/patch-expo-router.js`: now skips expo-router patching when `EAS_BUILD` is truthy (EAS sets it to `"true"`, not `"1"`). Old patch broke pnpm virtual-store paths → `No routes found`.
- `eas.json`: added `EXPO_ROUTER_APP_ROOT=app` to all three build profiles.

### Auth Store
- `lib/auth-store.ts` `checkAuth()`: added in-flight guard (`if (get().isLoading) return`) to prevent concurrent calls (e.g. multiple mounting components).
- `lib/auth-store.ts` `checkAuth()`: now rethrows errors. Distinguishes 401/403 (clears tokens) from network errors (leaves tokens intact). Callers can branch on offline vs invalid-token.
- `lib/auth-store.ts` `logout()`: now also resets `isLoading: false` so a stuck concurrent checkAuth can't leave the store frozen.

### Splash Screen
- `app/(auth)/splash.tsx`: added `isMounted` guard — all `router.replace()` calls are now wrapped in `navigate()` which checks mount state before navigating. Prevents post-unmount navigation errors.

### OTP Verification
- `app/(auth)/otp-verification.tsx`: `handleResend` setInterval now stored in `resendIntervalRef`. Cleanup effect clears it on unmount. Previous version leaked intervals on every resend.

### Player Store
- `lib/player-store.ts` `hide()`: now resets `contentType`, `isLive`, and `playerRoute` back to defaults. Previously left ghost metadata from previous session.

### Components
- `components/AdInterstitial.tsx`: added `onClose` to dependency arrays of the AdMob and AppLovin show effects (lines were missing it).
- `components/AdRewarded.tsx`: `onRequestClose` now calls `onClose` when `rewardEarned` is true, allowing hardware back after reward. Previously always blocked.

### Home Screen
- `app/(main)/index.tsx` FlatList: added `onScrollToIndexFailed` with 250ms retry (`scrollToIndex` fallback) instead of silent no-op. Auto-rotation carousel now recovers from layout-not-ready.

### Subscription Screen
- `app/subscription.tsx`: replaced `plans.length` dep with `firstPlanId` stable primitive. Prevents infinite effect triggers since `plans` array is recreated every render.

### UI Bug
- `app/movie/[id].tsx`: `isBookmarked ? 'My List' : 'My List'` → `'Added' : 'My List'` — label was identical in both states.

## Known Non-Critical / Low-Priority Remaining
- `api.ts`: POST requests skip 401 auto-retry (intentional, documented — avoids duplicate resource creation).
- `api-hooks.ts`: heavy use of `any` in unwrap helpers — no TypeScript safety on API responses.
- `admob.ts` / `applovin.ts`: SDK init failures are console.warn only, no UI state update.
- `withGMSResolution.js`: idempotency relies on a comment string — if comment removed manually, could double-inject.
- `withMedia3Gradle.js`: idempotency check weak — if only part of the block was manually added, rest is skipped.
- `iptv-report.tsx`: no per-fetch retry; single network failure on flaky connection aborts entire test.
- `AdBanner.tsx`: `Linking.openURL` errors silently swallowed — user gets no feedback on bad click URLs.
