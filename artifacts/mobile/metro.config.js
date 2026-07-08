const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude pnpm temp directories from Metro file watching.
// During `pnpm install`, pnpm creates temp dirs like `pkg_tmp_1234` and
// `@scope/pkg_tmp_1234` in node_modules, then renames them atomically.
// Metro's FallbackWatcher picks these up and crashes with ENOENT.
config.resolver = {
  ...config.resolver,
  blockList: [
    ...(config.resolver?.blockList ? [config.resolver.blockList].flat() : []),
    // Match pnpm temp dirs: _tmp_DIGITS anywhere in path (handles scoped pkgs too)
    /_tmp_\d+/,
    // Ignore backup node_modules created during reinstall
    /node_modules_bak\b/,
  ],
};

// ── Platform-specific module exclusions ──────────────────────────────────────
// hls.js is a web-only HLS player library. It must not be bundled into the
// native (iOS/Android) build because:
//   1. It's 250KB of browser-specific code that does nothing on native.
//   2. It references browser globals (document, window.performance) that
//      cause runtime errors in the native JS engine (JSI/Hermes).
// On native, HLS is handled natively by AVPlayer (iOS) / ExoPlayer (Android)
// via react-native-video — hls.js is completely unnecessary.
//
// Metro's `resolveRequest` hook intercepts the import and returns an empty
// stub on non-web platforms, effectively tree-shaking the entire library.
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Redirect hls.js to an empty stub on native platforms.
    if (moduleName === 'hls.js' && platform !== 'web') {
      return {
        filePath: require.resolve('./stubs/hls-stub.js'),
        type: 'sourceFile',
      };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
