/**
 * withMedia3Gradle — Expo config plugin
 *
 * Pins Media3 (androidx.media3) to a stable release via resolutionStrategy.force
 * and adds ONLY the Media3 libraries that react-native-video does NOT bundle.
 *
 * WHY this approach:
 *   react-native-video ships a pre-built AAR that already includes:
 *     media3-exoplayer, media3-exoplayer-hls, media3-exoplayer-dash,
 *     media3-exoplayer-smoothstreaming, media3-exoplayer-rtsp, etc.
 *   Adding those same artifacts as `implementation` in app/build.gradle
 *   causes "Type X is defined multiple times" (duplicate DEX class) at
 *   :app:mergeDexRelease. The solution is:
 *     1. Use resolutionStrategy.force to pin the version — Gradle picks one
 *        copy and everything compiles against the same API surface.
 *     2. Only add `implementation` for extras react-native-video does NOT ship:
 *        media3-session (notification/background controls)
 *        media3-datasource-okhttp (Cookie/User-Agent/Referer header support)
 *
 * Fix history:
 *  - Removed rootProject.ext approach (invisible to :app dependencies scope).
 *  - Removed broken regex (non-multiline [^}]* matched wrong brace).
 *  - Switched from broad implementation block to targeted
 *    resolutionStrategy.force to avoid duplicate DEX conflict with
 *    react-native-video's bundled Media3 AAR.
 */
const {
  withAppBuildGradle,
  withGradleProperties,
} = require('@expo/config-plugins');

const MEDIA3_VERSION = '1.8.1';

// All media3 artifacts that need version-pinning (superset of what RN Video bundles)
const MEDIA3_FORCE_VERSIONS = [
  'media3-common',
  'media3-exoplayer',
  'media3-exoplayer-hls',
  'media3-exoplayer-dash',
  'media3-exoplayer-smoothstreaming',
  'media3-exoplayer-rtsp',
  'media3-session',
  'media3-datasource',
  'media3-datasource-okhttp',
  'media3-ui',
  'media3-decoder',
  'media3-container',
  'media3-extractor',
  'media3-database',
].map((a) => `"androidx.media3:${a}:${MEDIA3_VERSION}"`);

// ── 1. Patch app/build.gradle ────────────────────────────────────────────────
function withMedia3AppGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // Idempotency guard
    if (contents.includes('media3-datasource-okhttp')) return cfg;

    const forceBlock = `
    // ── Media3 version pinning — prevents duplicate-DEX conflict with
    // react-native-video's bundled AAR (do NOT add media3 via implementation
    // here — RN Video already ships those classes).
    configurations.all {
        resolutionStrategy {
            force ${MEDIA3_FORCE_VERSIONS.join(',\n                    ')}
        }
    }

    // Extras NOT bundled by react-native-video:
    implementation "androidx.media3:media3-session:${MEDIA3_VERSION}"
    implementation "androidx.media3:media3-datasource-okhttp:${MEDIA3_VERSION}"
`;

    // Inject after the first "dependencies {" line
    const patched = contents.replace(
      /^(dependencies\s*\{)/m,
      `$1${forceBlock}`,
    );

    if (!patched.includes('media3-datasource-okhttp')) {
      throw new Error(
        '[withMedia3Gradle] Could not find "dependencies {" block in ' +
        'app/build.gradle. Media3 config was NOT injected.',
      );
    }

    cfg.modResults.contents = patched;
    return cfg;
  });
}

// ── 2. Gradle properties ─────────────────────────────────────────────────────
function withMedia3GradleProperties(config) {
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults;

    const ensureProp = (key, value) => {
      const existing = props.find((p) => p.type === 'property' && p.key === key);
      if (!existing) {
        props.push({ type: 'property', key, value: String(value) });
      } else {
        existing.value = String(value);
      }
    };

    ensureProp('org.gradle.jvmargs', '-Xmx4096m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8');
    ensureProp('org.gradle.daemon', 'true');
    ensureProp('org.gradle.parallel', 'true');
    ensureProp('org.gradle.caching', 'true');
    ensureProp('android.useAndroidX', 'true');
    ensureProp('android.enableJetifier', 'true');

    return cfg;
  });
}

// ── Compose ───────────────────────────────────────────────────────────────────
module.exports = function withMedia3Gradle(config) {
  config = withMedia3AppGradle(config);
  config = withMedia3GradleProperties(config);
  return config;
};
