/**
 * withPipNative — Expo config plugin
 *
 * Registers PiP params on API 31+ so react-native-video can enter PiP
 * programmatically when the user taps the PiP button in the player.
 *
 * Auto-enter (onUserLeaveHint → enterPictureInPictureMode) is intentionally
 * DISABLED because it caused the entire app — including non-video screens like
 * Sign Up and Home — to enter PiP whenever the user pressed the Home button.
 * PiP is now controlled exclusively from JS via react-native-video's `pip` prop.
 */
const { withMainActivity } = require('expo/config-plugins');

// ── Kotlin code ───────────────────────────────────────────────────────────────
const KT_IMPORTS = [
  'import android.app.PictureInPictureParams',
  'import android.os.Build',
  'import android.util.Rational',
];

const KT_ON_USER_LEAVE_HINT = `
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    // Register PiP params so react-native-video can enter PiP from JS.
    // Do NOT call enterPictureInPictureMode() here — that caused the whole
    // app (including non-video screens) to enter PiP on every Home press.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val params = PictureInPictureParams.Builder()
        .setAutoEnterEnabled(false)
        .setAspectRatio(Rational(16, 9))
        .build()
      setPictureInPictureParams(params)
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
    // Register PiP params so react-native-video can enter PiP from JS.
    // Do NOT call enterPictureInPictureMode() here — that caused the whole
    // app (including non-video screens) to enter PiP on every Home press.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      PictureInPictureParams params = new PictureInPictureParams.Builder()
          .setAutoEnterEnabled(false)
          .setAspectRatio(new Rational(16, 9))
          .build();
      setPictureInPictureParams(params);
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
