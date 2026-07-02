/**
 * withGMSResolution — Expo config plugin
 *
 * Pins Google Mobile Services dependencies to versions that exist in Maven.
 *
 * WHY this is needed:
 *   react-native-google-mobile-ads@16.x declares a transitive dependency on
 *   com.google.android.gms:play-services-ads-identifier:23.6.0, which does
 *   not yet exist in Google's Maven repository (highest published version is
 *   18.x.x). This causes EAS/Gradle builds to fail at dependency resolution
 *   with "Could not find play-services-ads-identifier:23.6.0".
 *
 *   The fix: force the dependency to the highest actually-published version
 *   via resolutionStrategy.force so Gradle never attempts to fetch the
 *   non-existent 23.6.0 artifact.
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
