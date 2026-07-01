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

module.exports = config;
