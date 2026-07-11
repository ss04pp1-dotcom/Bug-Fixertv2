/**
 * withExpoModulesProGuard — Expo config plugin
 *
 * Appends expo-modules-core ProGuard / R8 keep-rules so R8 does not strip
 * classes that are loaded at runtime via reflection (e.g. AnyTypeCache).
 *
 * Why this is necessary:
 *   expo-modules-core uses Class.forName() internally to load type-cache and
 *   other classes at runtime.  R8 sees them as "unused" during static analysis
 *   and strips them from the release APK, causing:
 *     java.lang.ClassNotFoundException: expo.modules.kotlin.types.AnyTypeCache
 *   Keep-rules tell R8 to preserve the full expo.modules package hierarchy.
 */
const { withDangerousMod } = require('expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const GUARD_COMMENT = '# [withExpoModulesProGuard] expo-modules keep-rules — DO NOT REMOVE';

const EXPO_MODULES_RULES = `
${GUARD_COMMENT}
# ─────────────────────────────────────────────────────────────────────────────
# expo-modules-core — type cache and reflection helpers loaded at runtime.
# ClassNotFoundException: expo.modules.kotlin.types.AnyTypeCache without these.
-keep class expo.modules.** { *; }
-keepclassmembers class expo.modules.** { *; }
-keep interface expo.modules.** { *; }

# Kotlin metadata — needed for expo-modules Kotlin reflection
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes RuntimeVisibleAnnotations
-keepattributes EnclosingMethod
-keepattributes InnerClasses
# ─────────────────────────────────────────────────────────────────────────────
# [end withExpoModulesProGuard]
`;

module.exports = function withExpoModulesProGuard(config) {
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

      fs.writeFileSync(proguardPath, existing + EXPO_MODULES_RULES, 'utf8');

      return cfg;
    },
  ]);
};
