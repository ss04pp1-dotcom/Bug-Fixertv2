/**
 * withGMSResolution — Expo config plugin
 *
 * Pins Google Mobile Services dependencies to versions compatible with
 * the project's Kotlin version (2.1.21).
 *
 * WHY this is needed:
 *   react-native-google-mobile-ads@16.x depended on play-services-ads@25.4.0
 *   which was compiled with Kotlin 2.3.0 metadata. Kotlin 2.1.21 cannot read
 *   2.3.0 metadata → build failed at :react-native-google-mobile-ads:compileReleaseKotlin.
 *   FIX: downgraded to react-native-google-mobile-ads@15.x which targets
 *   play-services-ads@24.x (Kotlin 2.1-compatible).
 *
 *   Additionally, google-mobile-ads historically declares transitive deps on
 *   play-services-ads-identifier versions that do not exist in Google Maven
 *   (e.g. 23.6.0). This plugin forces the highest actually-published version
 *   so Gradle never attempts to fetch a non-existent artifact.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const GMS_ADS_ID_VERSION = '18.1.0';

module.exports = function withGMSResolution(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (contents.includes('play-services-ads-identifier-force')) return cfg;

    const forceBlock = `
    // ── GMS ads-identifier version pin — react-native-google-mobile-ads
    // requests a version that does not exist in Maven; force a real release.
    // play-services-ads-identifier-force (idempotency marker)
    configurations.all {
        resolutionStrategy {
            force "com.google.android.gms:play-services-ads-identifier:${GMS_ADS_ID_VERSION}"
        }
    }
`;

    const patched = contents.replace(
      /^(dependencies\s*\{)/m,
      `$1${forceBlock}`,
    );

    if (!patched.includes('play-services-ads-identifier-force')) {
      throw new Error(
        '[withGMSResolution] Could not find "dependencies {" block in ' +
          'app/build.gradle. GMS resolution config was NOT injected.',
      );
    }

    cfg.modResults.contents = patched;
    return cfg;
  });
};
