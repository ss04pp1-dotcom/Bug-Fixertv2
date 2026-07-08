# HLS.js Tree-Shake Note

## Status: ⚠️ hls.js IS in package.json — action needed

## Background

`hls.js` is a web-only HLS player library (~250KB minified). React Native / Expo
apps use the native platform HLS player (AVPlayer on iOS, ExoPlayer on Android),
so `hls.js` should NEVER be bundled into a native app build.

## Check Results

hls.js in package.json: True
Found as: ^1.6.16

## Action

1. If hls.js is only used in web-specific code guarded by `Platform.OS === 'web'` or `if (Platform.OS === 'web') {{ const hls = await import('hls.js') }}`, it may be dynamically imported and tree-shaken correctly.

2. If it is a static import (import Hls from 'hls.js'), it will be bundled into ALL platforms. Fix: use dynamic import inside a Platform.OS === 'web' guard.

3. Verify with: `npx expo export --platform android 2>&1 | grep hls` — if hls.js appears in the bundle manifest, it needs to be moved to a dynamic import.

## Pattern for web-only HLS

```typescript
if (Platform.OS === 'web') {
  const { default: Hls } = await import('hls.js'); // Only loaded on web
  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(videoElement);
  }
}
```
