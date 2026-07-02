/**
 * withAdMobManifest — Expo config plugin
 *
 * Directly injects the AdMob APPLICATION_ID meta-data into AndroidManifest.xml.
 *
 * WHY this is needed:
 *   react-native-google-mobile-ads ships a ContentProvider (MobileAdsInitProvider)
 *   that runs BEFORE any app code on every startup. It reads
 *   com.google.android.gms.ads.APPLICATION_ID from AndroidManifest.xml.
 *   If that meta-data is missing or invalid, the app crashes immediately:
 *     "FATAL EXCEPTION: Unable to get provider MobileAdsInitProvider:
 *      java.lang.IllegalStateException: Invalid application ID"
 *
 *   The react-native-google-mobile-ads Expo config plugin SHOULD inject this
 *   automatically, but it can fail silently when:
 *     - app.config.js is used (no static app.json) and the plugin can't find the ID
 *     - The env var is missing and the fallback isn't evaluated at prebuild time
 *     - Version mismatch between the plugin and the native SDK
 *
 *   This plugin runs AFTER react-native-google-mobile-ads and guarantees the
 *   meta-data is correctly set, overwriting any incorrect value.
 *
 * Safe test App IDs (from Google): used as fallback when env vars are not set.
 *   Android: ca-app-pub-3940256099942544~3347511713
 *   iOS:     ca-app-pub-3940256099942544~1458002511
 */
const { withAndroidManifest } = require('expo/config-plugins');

const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

module.exports = function withAdMobManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const androidAppId =
      process.env.ADMOB_ANDROID_APP_ID || TEST_ANDROID_APP_ID;

    const manifest = cfg.modResults.manifest;
    const application = manifest.application[0];

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Remove any existing APPLICATION_ID entry (could be wrong/empty)
    application['meta-data'] = application['meta-data'].filter(
      (m) =>
        m.$ &&
        m.$['android:name'] !== 'com.google.android.gms.ads.APPLICATION_ID',
    );

    // Inject the correct APPLICATION_ID
    application['meta-data'].push({
      $: {
        'android:name': 'com.google.android.gms.ads.APPLICATION_ID',
        'android:value': androidAppId,
      },
    });

    console.log(
      `[withAdMobManifest] Injected APPLICATION_ID: ${androidAppId}`,
    );

    return cfg;
  });
};
