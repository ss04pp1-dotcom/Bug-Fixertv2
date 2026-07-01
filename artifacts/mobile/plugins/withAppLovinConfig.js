/**
 * withAppLovinConfig — Expo config plugin
 *
 * `react-native-applovin-max` does not ship its own Expo config plugin (unlike
 * react-native-google-mobile-ads), so the SDK key has to be injected into the
 * native manifests by hand:
 *   - Android: <meta-data android:name="applovin.sdk.key" android:value="..."/>
 *     inside <application> in AndroidManifest.xml
 *   - iOS: <key>AppLovinSdkKey</key><string>...</string> in Info.plist
 *
 * The SDK key is passed in from app.json (sourced from an env var) rather
 * than hardcoded, so switching networks/keys never requires touching native
 * code.
 */

const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');

function withAppLovinAndroidManifest(config, sdkKey) {
  return withAndroidManifest(config, cfg => {
    const app = cfg.modResults.manifest.application[0];
    if (!Array.isArray(app['meta-data'])) app['meta-data'] = [];

    const existing = app['meta-data'].find(
      (m) => m.$ && m.$['android:name'] === 'applovin.sdk.key',
    );
    if (existing) {
      existing.$['android:value'] = sdkKey;
    } else {
      app['meta-data'].push({
        $: { 'android:name': 'applovin.sdk.key', 'android:value': sdkKey },
      });
    }

    return cfg;
  });
}

function withAppLovinInfoPlist(config, sdkKey) {
  return withInfoPlist(config, cfg => {
    cfg.modResults.AppLovinSdkKey = sdkKey;
    return cfg;
  });
}

module.exports = function withAppLovinConfig(config, { sdkKey } = {}) {
  if (!sdkKey) return config;
  config = withAppLovinAndroidManifest(config, sdkKey);
  config = withAppLovinInfoPlist(config, sdkKey);
  return config;
};
