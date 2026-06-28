/**
 * withMedia3Gradle — Expo config plugin
 *
 * Pins Media3 (androidx.media3) to a stable release and enables the HLS,
 * DASH, SmoothStreaming, RTSP and OkHttp-datasource extensions that IPTV
 * streams need.  Also configures Gradle properties for performance.
 *
 * Fix history:
 *  - Removed rootProject.ext approach: ext{} inside buildscript{} is
 *    invisible to :app's dependencies block (different scope).
 *  - Removed broken regex that used [^}]* (non-multiline) and the
 *    fallback /^(dependencies\s*\{)([\s\S]*?)(\})\s*$/m whose lazy .*?
 *    + multiline $ matched the first } inside the block, landing deps
 *    outside the dependencies{} closure entirely.
 *  - Now injects immediately AFTER "dependencies {" — the one anchor
 *    guaranteed to exist and be unambiguous.
 */
const {
  withAppBuildGradle,
  withGradleProperties,
} = require('@expo/config-plugins');

const MEDIA3_VERSION = '1.5.1';

// ── 1. Add Media3 dependencies in app/build.gradle ──────────────────────────
function withMedia3AppGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;

    // Idempotency guard — already patched in a previous prebuild
    if (contents.includes('media3-exoplayer-hls')) return cfg;

    // Inject immediately after the opening "dependencies {" line.
    // This is the only unambiguous anchor in app/build.gradle.
    // We do NOT try to find the closing brace — multi-line regex on
    // Groovy gradle files is too fragile (nested closures, comments, etc.)
    const media3Deps = [
      '',
      `    // ── Google Media3 (ExoPlayer) pinned to ${MEDIA3_VERSION} ──`,
      `    // HLS (M3U8) — most IPTV / live streams`,
      `    implementation "androidx.media3:media3-exoplayer-hls:${MEDIA3_VERSION}"`,
      `    // DASH (MPD) — VOD providers`,
      `    implementation "androidx.media3:media3-exoplayer-dash:${MEDIA3_VERSION}"`,
      `    // SmoothStreaming — legacy MS/Azure streams`,
      `    implementation "androidx.media3:media3-exoplayer-smoothstreaming:${MEDIA3_VERSION}"`,
      `    // RTSP — some IPTV servers`,
      `    implementation "androidx.media3:media3-exoplayer-rtsp:${MEDIA3_VERSION}"`,
      `    // MediaSession — background playback & notification controls`,
      `    implementation "androidx.media3:media3-session:${MEDIA3_VERSION}"`,
      `    // OkHttp data source — respects Cookie / User-Agent / Referer headers`,
      `    implementation "androidx.media3:media3-datasource-okhttp:${MEDIA3_VERSION}"`,
      '',
    ].join('\n');

    // Replace the first occurrence of "dependencies {" with
    // "dependencies {\n<deps>".  The \n at end of media3Deps means the
    // original content that followed the "{" stays on its own line.
    const patched = contents.replace(
      /^(dependencies\s*\{)/m,
      `$1${media3Deps}`
    );

    if (!patched.includes('media3-exoplayer-hls')) {
      // Should never happen, but surface it clearly instead of silently
      // producing a broken build.gradle.
      throw new Error(
        '[withMedia3Gradle] Could not find "dependencies {" block in ' +
        'app/build.gradle. Media3 dependencies were NOT injected.'
      );
    }

    cfg.modResults.contents = patched;
    return cfg;
  });
}

// ── 2. Gradle properties for Media3 performance ─────────────────────────────
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

    // Increase JVM heap for Media3 codec operations during build
    ensureProp('org.gradle.jvmargs', '-Xmx4096m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8');
    // Gradle daemon — faster incremental builds
    ensureProp('org.gradle.daemon', 'true');
    // Parallel module resolution — important for multi-module Media3
    ensureProp('org.gradle.parallel', 'true');
    // Build cache
    ensureProp('org.gradle.caching', 'true');
    // AndroidX — required for Media3
    ensureProp('android.useAndroidX', 'true');
    ensureProp('android.enableJetifier', 'true');

    return cfg;
  });
}

// ── Compose patches ──────────────────────────────────────────────────────────
module.exports = function withMedia3Gradle(config) {
  config = withMedia3AppGradle(config);
  config = withMedia3GradleProperties(config);
  return config;
};
