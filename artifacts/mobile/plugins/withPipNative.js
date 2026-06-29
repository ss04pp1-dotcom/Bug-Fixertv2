/**
 * withPipNative — Expo config plugin
 *
 * Injects Android 12+ (API 31+) seamless auto-enter PiP into MainActivity
 * using PictureInPictureParams.Builder().setAutoEnterEnabled(true).
 *
 * Why native instead of manifest attribute:
 *   android:autoEnterPictureInPicture requires API 31 and AAPT2 hard-fails
 *   when minSdkVersion < 31. The native approach calls the API at runtime
 *   with a Build.VERSION.SDK_INT >= 31 guard, so it compiles and runs safely
 *   on all API levels (24+).
 *
 * What this does:
 *   - Overrides onUserLeaveHint() in MainActivity — called when user presses
 *     Home or Recent Apps. Calls enterPictureInPictureMode() with
 *     autoEnterEnabled=true on API 31+, giving the smooth OS-level transition.
 *   - Overrides onPictureInPictureModeChanged() to let the JS layer know
 *     PiP state changed (via react-native-video's own mechanism).
 *
 * The JS-side AppState listener in PremiumVideoPlayer.tsx handles API 24-30
 * by calling setPip(true) programmatically — no change needed there.
 */
const { withMainActivity } = require('@expo/config-plugins');

const PIP_IMPORTS = [
  'import android.app.PictureInPictureParams;',
  'import android.os.Build;',
  'import android.util.Rational;',
];

const ON_USER_LEAVE_HINT = `
  @Override
  public void onUserLeaveHint() {
    super.onUserLeaveHint();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      // API 31+ — seamless auto-enter PiP (smooth swipe-to-home transition)
      PictureInPictureParams params = new PictureInPictureParams.Builder()
          .setAutoEnterEnabled(true)
          .setAspectRatio(new Rational(16, 9))
          .build();
      setPictureInPictureParams(params);
      enterPictureInPictureMode(params);
    }
  }
`;

module.exports = function withPipNative(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;

    // ── 1. Add imports (skip if already present) ──────────────────────────────
    PIP_IMPORTS.forEach((imp) => {
      if (!src.includes(imp)) {
        // Insert after the last existing import line
        src = src.replace(
          /(import\s+[\w.]+;(?:\s*\n)?)(?=\s*(?:\/\/|@|public\s+class))/,
          `$1${imp}\n`,
        );
      }
    });

    // ── 2. Inject onUserLeaveHint (skip if already injected) ─────────────────
    if (!src.includes('onUserLeaveHint')) {
      // Insert before the closing brace of MainActivity class
      const lastBrace = src.lastIndexOf('}');
      if (lastBrace !== -1) {
        src = src.slice(0, lastBrace) + ON_USER_LEAVE_HINT + '\n}';
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
