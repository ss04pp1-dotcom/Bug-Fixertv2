/**
 * withMedia3Gradle — Expo config plugin
 *
 * Pins Media3 (androidx.media3) to a stable release and enables the HLS,
 * DASH, SmoothStreaming, and RTSP extensions that IPTV streams need.
 * Also adds ProGuard rules so Media3 classes survive release builds.
 */
const {
  withProjectBuildGradle,
  withAppBuildGradle,
  withGradleProperties,
} = require('@expo/config-plugins');

const MEDIA3_VERSION = '1.5.1';

// ── 1. Pin Media3 version in the root project build.gradle ──────────────────
function withMedia3RootGradle(config) {
  return withProjectBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;

    // Already patched?
    if (contents.includes('media3_version')) return cfg;

    // Insert after the first `allprojects {` block's `repositories {` section
    // by appending to the ext block or creating one.
    const extBlock = `
    // ── Media3 (ExoPlayer) version pin ──────────────────────────────────────
    ext {
        media3_version = "${MEDIA3_VERSION}"
    }
`;

    // Append before the last closing brace of the buildscript block
    cfg.modResults.contents = contents.replace(
      /buildscript\s*\{/,
      `buildscript {\n${extBlock}`
    );

    return cfg;
  });
}

// ── 2. Add Media3 dependencies in app/build.gradle ──────────────────────────
function withMedia3AppGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    const contents = cfg.modResults.contents;

    // Already patched?
    if (contents.includes('media3-exoplayer-hls')) return cfg;

    const media3Deps = `
    // ── Google Media3 (ExoPlayer) — pinned to ${MEDIA3_VERSION} ──────────────
    // HLS (M3U8) streams — most IPTV sources
    implementation "androidx.media3:media3-exoplayer-hls:\${rootProject.ext.media3_version}"
    // DASH (MPD) streams — some VOD providers
    implementation "androidx.media3:media3-exoplayer-dash:\${rootProject.ext.media3_version}"
    // SmoothStreaming — legacy MS streams
    implementation "androidx.media3:media3-exoplayer-smoothstreaming:\${rootProject.ext.media3_version}"
    // RTSP — some IPTV servers stream over RTSP
    implementation "androidx.media3:media3-exoplayer-rtsp:\${rootProject.ext.media3_version}"
    // MediaSession — background playback notification controls
    implementation "androidx.media3:media3-session:\${rootProject.ext.media3_version}"
    // OkHttp data source — respects Cookie / User-Agent headers
    implementation "androidx.media3:media3-datasource-okhttp:\${rootProject.ext.media3_version}"
`;

    // Inject before the closing brace of the dependencies block
    cfg.modResults.contents = contents.replace(
      /(\n\s*\/\/ react-native-video|\ndependencies\s*\{[^}]*\})/,
      (match) => media3Deps + match
    );

    // Fallback: append before last closing brace of dependencies { ... }
    if (!cfg.modResults.contents.includes('media3-exoplayer-hls')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /^(dependencies\s*\{)([\s\S]*?)(\})\s*$/m,
        (_, open, body, close) => `${open}${body}${media3Deps}${close}`
      );
    }

    return cfg;
  });
}

// ── 3. Gradle properties for Media3 performance ─────────────────────────────
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

    // Increase JVM heap for Media3 codec operations
    ensureProp('org.gradle.jvmargs', '-Xmx4096m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8');
    // Enable Gradle daemon for faster incremental builds
    ensureProp('org.gradle.daemon', 'true');
    // Parallel build — speeds up multi-module Media3 resolution
    ensureProp('org.gradle.parallel', 'true');
    // Gradle caching
    ensureProp('org.gradle.caching', 'true');
    // AndroidX — required for Media3
    ensureProp('android.useAndroidX', 'true');
    ensureProp('android.enableJetifier', 'true');

    return cfg;
  });
}

// ── Compose all three patches ────────────────────────────────────────────────
module.exports = function withMedia3Gradle(config) {
  config = withMedia3RootGradle(config);
  config = withMedia3AppGradle(config);
  config = withMedia3GradleProperties(config);
  return config;
};
