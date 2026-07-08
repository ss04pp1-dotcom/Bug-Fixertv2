# New Architecture (newArchEnabled: true) Compatibility Notes

## Current Status
- React Native version: 0.81.5
- newArchEnabled: true (set in app.config.js)
- kotlinVersion: 2.1.21

## Third-party library compatibility (tested with RN 0.81.x new arch)

| Library | Status | Notes |
|---------|--------|-------|
| react-native-video | ✅ Compatible | v6+ has new arch support |
| react-native-webview | ⚠️ Check version | Needs v13.6.0+ for full new-arch support |
| react-native-youtube-iframe | ⚠️ Verify | May have new-arch issues; test on real device |
| expo-secure-store | ✅ Compatible | Expo SDK packages are new-arch ready |
| react-native-gesture-handler | ✅ Compatible | v2.14.0+ |
| react-native-reanimated | ✅ Compatible | v3.0.0+ |

## Testing Protocol Before Release

1. Build a **development APK** (not Expo Go) with new arch:
   ```bash
   eas build --profile development --platform android
   ```

2. Specifically test these features known to be new-arch sensitive:
   - [ ] Video playback (react-native-video)
   - [ ] YouTube player (react-native-youtube-iframe)
   - [ ] WebView ads (react-native-webview)
   - [ ] PiP mode (withPipSupport plugin)
   - [ ] Gesture-based player controls
   - [ ] Deep linking (URL scheme)

3. If you encounter bridge errors with a specific library:
   ```bash
   # Disable new arch temporarily to isolate the issue
   # In app.config.js: newArchEnabled: false
   ```

## Known Issue: Bridge + New Arch Mixed Mode

If a third-party library crashes with new arch, the quickest fix is:
```javascript
// app.config.js
expo: {
  newArchEnabled: false, // Revert until library is fixed
  ...
}
```

Then file an issue on the library repo and track their new-arch migration.

## References
- https://reactnative.dev/docs/new-architecture-intro
- https://github.com/reactwg/react-native-new-architecture/discussions
