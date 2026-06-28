/**
 * withPipSupport — Expo config plugin
 *
 * Configures AndroidManifest.xml for Picture-in-Picture support:
 *   - android:supportsPictureInPicture="true"   (API 24+)
 *   - android:autoEnterPictureInPicture="true"  (API 31+ — Android 12 auto-PiP)
 *   - android:resizeableActivity="true"         (required pre-API 31)
 *   - android:configChanges additions           (prevent activity restart on PiP resize)
 *   - tools:targetApi="31" on MainActivity     (suppress AAPT2 error for API-31
 *                                               attributes when minSdkVersion < 31)
 *   - xmlns:tools namespace on <manifest>       (required for tools:targetApi)
 *
 * Why tools:targetApi is required:
 *   AAPT2 validates every attribute against the minSdkVersion of the build.
 *   android:autoEnterPictureInPicture did not exist before API 31, so AAPT
 *   throws "attribute not found" for minSdkVersion=24 builds unless the
 *   element is tagged with tools:targetApi="31", which tells AAPT the
 *   attribute is intentionally used on API 31+ only.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withPipSupport(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;

    // ── 1. Ensure xmlns:tools is declared on the root <manifest> element ──────
    // tools:targetApi requires this namespace; AAPT ignores it at runtime.
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    // ── 2. Locate MainActivity ────────────────────────────────────────────────
    const mainActivity = manifest.manifest.application[0].activity.find(
      (act) => act.$['android:name'] === '.MainActivity'
    );
    if (!mainActivity) {
      throw new Error('withPipSupport: MainActivity not found in AndroidManifest');
    }

    // ── 3. PiP feature flags ──────────────────────────────────────────────────
    // supportsPictureInPicture — available API 24+, safe unconditionally
    mainActivity.$['android:supportsPictureInPicture'] = 'true';

    // resizeableActivity — required for pre-API 31 PiP (split-screen / freeform)
    mainActivity.$['android:resizeableActivity'] = 'true';

    // autoEnterPictureInPicture — Android 12 (API 31) only.
    // AAPT2 would reject this attribute for minSdkVersion < 31 without
    // tools:targetApi below.  At runtime on older devices the attribute is
    // simply ignored by the OS.
    mainActivity.$['android:autoEnterPictureInPicture'] = 'true';

    // ── 4. tools:targetApi — suppress the AAPT2 "attribute not found" error ──
    // Tells AAPT this activity element intentionally uses API-31 attributes.
    // Has zero effect at runtime; stripped before the final APK/AAB is built.
    mainActivity.$['tools:targetApi'] = '31';

    // ── 5. configChanges — prevent activity restart on PiP resize ─────────────
    const required = [
      'screenSize',
      'smallestScreenSize',
      'screenLayout',
      'orientation',
      'keyboardHidden',
      'keyboard',
      'navigation',
    ];
    const existingChanges = mainActivity.$['android:configChanges'] || '';
    const current = existingChanges.split('|').filter(Boolean);
    required.forEach((c) => {
      if (!current.includes(c)) current.push(c);
    });
    mainActivity.$['android:configChanges'] = current.join('|');

    // ── 6. Launch mode — keep activity alive across PiP transitions ───────────
    mainActivity.$['android:launchMode'] =
      mainActivity.$['android:launchMode'] || 'singleTask';

    return config;
  });
};
