/**
 * withPipNative — Expo config plugin
 *
 * Injects Android 12+ (API 31+) seamless auto-enter PiP into MainActivity.
 * Detects whether MainActivity is Java or Kotlin and injects the correct syntax.
 *
 * Why native instead of manifest attribute:
 *   android:autoEnterPictureInPicture requires API 31 and AAPT2 hard-fails
 *   when minSdkVersion < 31. The native approach calls the API at runtime
 *   with a Build.VERSION.SDK_INT >= 31 guard, so it compiles and runs safely
 *   on all API levels (24+).
 */
const { withMainActivity } = require('@expo/config-plugins');

// ── Kotlin code ───────────────────────────────────────────────────────────────
const KT_IMPORTS = [
  'import android.app.PictureInPictureParams',
  'import android.os.Build',
  'import android.util.Rational',
];

const KT_ON_USER_LEAVE_HINT = `
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val params = PictureInPictureParams.Builder()
        .setAutoEnterEnabled(true)
        .setAspectRatio(Rational(16, 9))
        .build()
      setPictureInPictureParams(params)
      enterPictureInPictureMode(params)
    }
  }
`;

// ── Java code ─────────────────────────────────────────────────────────────────
const JAVA_IMPORTS = [
  'import android.app.PictureInPictureParams;',
  'import android.os.Build;',
  'import android.util.Rational;',
];

const JAVA_ON_USER_LEAVE_HINT = `
  @Override
  public void onUserLeaveHint() {
    super.onUserLeaveHint();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
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
    const isKotlin = cfg.modResults.language === 'kt';

    const imports = isKotlin ? KT_IMPORTS : JAVA_IMPORTS;
    const methodBody = isKotlin ? KT_ON_USER_LEAVE_HINT : JAVA_ON_USER_LEAVE_HINT;
    const guardStr = 'onUserLeaveHint';

    // ── 1. Add imports (idempotent) ───────────────────────────────────────────
    imports.forEach((imp) => {
      if (!src.includes(imp.replace(';', ''))) {
        if (isKotlin) {
          // Insert after last "import ..." line in Kotlin
          src = src.replace(
            /(import\s+[\w.]+(?:\s*\n)?)(?=\s*(?:\/\/|@|class\s))/,
            `$1${imp}\n`,
          );
        } else {
          // Insert after last "import ...;" line in Java
          src = src.replace(
            /(import\s+[\w.]+;(?:\s*\n)?)(?=\s*(?:\/\/|@|public\s+class))/,
            `$1${imp}\n`,
          );
        }
      }
    });

    // ── 2. Inject onUserLeaveHint (idempotent) ────────────────────────────────
    if (!src.includes(guardStr)) {
      const lastBrace = src.lastIndexOf('}');
      if (lastBrace !== -1) {
        src = src.slice(0, lastBrace) + methodBody + '\n}';
      }
    }

    cfg.modResults.contents = src;
    return cfg;
  });
};
