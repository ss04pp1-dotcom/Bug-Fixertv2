/**
 * withMedia3ProGuard — Expo config plugin
 *
 * Appends Media3 / ExoPlayer ProGuard / R8 keep-rules to the Android project's
 * existing proguard-rules.pro file so R8 does not strip renderer, extractor,
 * or data-source classes that ExoPlayer discovers at runtime via reflection.
 *
 * Why this is necessary:
 *   ExoPlayer's renderer pipeline (video, audio, text, metadata) is assembled
 *   at runtime using Class.forName() and ServiceLoader.  R8 sees these classes
 *   as "unused" during static analysis and strips them, producing release APKs
 *   that open but play nothing — no crash, no error, just silence / black screen.
 *   Keep-rules tell R8 to preserve the full class hierarchy.
 *
 * Strategy:
 *   - Use withDangerousMod to write to android/app/proguard-rules.pro directly.
 *   - The file is already referenced by app/build.gradle via
 *     proguardFiles getDefaultProguardFile(...), 'proguard-rules.pro'
 *     so no build.gradle patching is needed.
 *   - Idempotency guard prevents duplicate rules on repeated prebuild runs.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const GUARD_COMMENT = '# [withMedia3ProGuard] Media3/ExoPlayer keep-rules — DO NOT REMOVE';

const MEDIA3_RULES = `
${GUARD_COMMENT}
# ─────────────────────────────────────────────────────────────────────────────
# Core ExoPlayer renderers (video, audio, text, metadata, camera-motion).
# Discovered at runtime via ServiceLoader / Class.forName — must not be stripped.
-keep class androidx.media3.exoplayer.** { *; }
-keepclassmembers class androidx.media3.exoplayer.** { *; }
-keep interface androidx.media3.exoplayer.** { *; }

# HLS, DASH, SmoothStreaming, RTSP — container/codec extractors
-keep class androidx.media3.extractor.** { *; }
-keepclassmembers class androidx.media3.extractor.** { *; }
-keep interface androidx.media3.extractor.** { *; }

# MediaItem, Format, Timeline, TrackGroup and all common data classes
-keep class androidx.media3.common.** { *; }
-keepclassmembers class androidx.media3.common.** { *; }
-keep interface androidx.media3.common.** { *; }

# DataSource implementations — DefaultDataSource, OkHttpDataSource, etc.
# Header injection (User-Agent, Cookie, Referer) lives here.
-keep class androidx.media3.datasource.** { *; }
-keepclassmembers class androidx.media3.datasource.** { *; }
-keep interface androidx.media3.datasource.** { *; }

# MediaSession — background playback notification controls
-keep class androidx.media3.session.** { *; }
-keepclassmembers class androidx.media3.session.** { *; }
-keep interface androidx.media3.session.** { *; }

# Decoder / codec extensions
-keep class androidx.media3.decoder.** { *; }
-keepclassmembers class androidx.media3.decoder.** { *; }
-keep interface androidx.media3.decoder.** { *; }

# Database / cache support
-keep class androidx.media3.database.** { *; }
-keep class androidx.media3.datasource.cache.** { *; }

# UI components (PlayerView, SubtitleView, etc.)
-keep class androidx.media3.ui.** { *; }

# ── OkHttp (used by media3-datasource-okhttp for header injection) ────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keep class okio.** { *; }
-keep interface okio.** { *; }

# ── react-native-video bridge classes ────────────────────────────────────────
-keep class com.brentvatne.** { *; }
-keepclassmembers class com.brentvatne.** { *; }
-keep interface com.brentvatne.** { *; }

# ── Suppress known-harmless R8 warnings from Media3 internals ────────────────
-dontwarn androidx.media3.**
# ─────────────────────────────────────────────────────────────────────────────
# [end withMedia3ProGuard]
`;

module.exports = function withMedia3ProGuard(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const proguardPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );

      let existing = '';
      try {
        existing = fs.readFileSync(proguardPath, 'utf8');
      } catch (_) {
        // File will be created fresh — that is fine.
      }

      // Idempotency: skip if rules are already present
      if (existing.includes(GUARD_COMMENT)) return cfg;

      fs.writeFileSync(proguardPath, existing + MEDIA3_RULES, 'utf8');

      return cfg;
    },
  ]);
};
