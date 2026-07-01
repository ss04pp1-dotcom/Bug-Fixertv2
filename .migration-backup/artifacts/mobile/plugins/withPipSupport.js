/**
 * withPipSupport — Expo config plugin
 *
 * Configures AndroidManifest.xml for Picture-in-Picture support.
 *
 * NOTE — android:autoEnterPictureInPicture is intentionally NOT set here.
 * That attribute requires API 31 and causes AAPT2 to hard-fail on
 * minSdkVersion=24 builds even with compileSdk=35, because AAPT validates
 * attributes against minSdkVersion at resource-link time.
 *
 * The tools:targetApi="31" workaround relies on xml2js correctly serializing
 * prefixed attributes through expo's withAndroidManifest, which is not
 * guaranteed across EAS build environments.
 *
 * Functional equivalence is achieved via the AppState 'background' listener
 * in GlobalVideoPlayer.tsx, which calls setPip(true) programmatically when
 * the app goes to background — the same result as the OS auto-enter flag,
 * with no manifest attribute needed.
 *
 * Attributes applied:
 *   android:supportsPictureInPicture="true"   — enables PiP (API 24+)
 *   android:resizeableActivity="true"          — required pre-API 31
 *   android:configChanges (additions)          — no restart on PiP resize
 *   android:launchMode="singleTask"            — keeps activity alive
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withPipSupport(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;

    // ── Locate MainActivity ───────────────────────────────────────────────────
    const mainActivity = manifest.manifest.application[0].activity.find(
      (act) => act.$['android:name'] === '.MainActivity'
    );
    if (!mainActivity) {
      throw new Error('withPipSupport: MainActivity not found in AndroidManifest');
    }

    // ── PiP feature flags ─────────────────────────────────────────────────────
    // supportsPictureInPicture — safe on API 24+, no AAPT restriction
    mainActivity.$['android:supportsPictureInPicture'] = 'true';

    // resizeableActivity — required for split-screen / freeform windowing
    // (needed by PiP on pre-API 31 devices)
    mainActivity.$['android:resizeableActivity'] = 'true';

    // DO NOT SET android:autoEnterPictureInPicture here.
    // It requires API 31 and AAPT rejects it for minSdkVersion=24.
    // The AppState 'background' listener in GlobalVideoPlayer.tsx handles
    // this programmatically via setPip(true) on every Android version.

    // ── configChanges — prevent activity restart on PiP resize ───────────────
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

    // ── Launch mode — keep activity alive across PiP transitions ─────────────
    mainActivity.$['android:launchMode'] =
      mainActivity.$['android:launchMode'] || 'singleTask';

    return config;
  });
};
