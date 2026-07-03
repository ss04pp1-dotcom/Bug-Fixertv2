#!/usr/bin/env node
/**
 * NOTE: This script previously also hardcoded a literal path into expo-router's
 * _ctx.*.js context files, on the theory that EXPO_ROUTER_APP_ROOT wasn't
 * resolved correctly under pnpm. That was wrong and actively broke routing:
 * babel-preset-expo's expo-router plugin only rewrites literal
 * `process.env.EXPO_ROUTER_APP_ROOT` references at transform time (computing a
 * relative path from the *actual transformed file* to the app folder, which
 * correctly handles pnpm's symlinked node_modules). Overwriting _ctx.*.js with
 * a hardcoded string bypasses that transform entirely, so require.context()
 * always scanned the wrong (or a nonexistent) directory and matched zero
 * routes — causing the "Welcome to Expo" placeholder screen to show up.
 * The fix is to leave expo-router's shipped _ctx.*.js files untouched and let
 * the normal EXPO_ROUTER_APP_ROOT env var + babel transform do their job.
 *
 * This script now only creates a stub for
 * react-native/Libraries/Core/InitializeCore, which was removed in React
 * Native 0.77+ but is still referenced by @expo/metro-config.
 */
const fs   = require('fs');
const path = require('path');

// --- Patch 1: Create InitializeCore stub for RN 0.77+ compatibility ---
const initCorePath = path.join(__dirname, '..', 'node_modules', 'react-native', 'Libraries', 'Core');
const initCoreFile = path.join(initCorePath, 'InitializeCore.js');
if (!fs.existsSync(initCoreFile)) {
  fs.mkdirSync(initCorePath, { recursive: true });
  // Stub for React Native 0.77+ compatibility — InitializeCore was removed
  // but some libraries still import it. Export an empty function so
  // `require('react-native/Libraries/Core/InitializeCore')()` doesn't throw.
  fs.writeFileSync(initCoreFile, 'module.exports = function() {};\n');
  console.log('[patch-rn] created InitializeCore stub');
} else {
  console.log('[patch-rn] InitializeCore stub already exists');
}

console.log('[patch-expo-router] expo-router _ctx.*.js files are left untouched (using default EXPO_ROUTER_APP_ROOT resolution)');
