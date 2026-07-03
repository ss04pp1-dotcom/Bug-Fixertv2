---
name: expo-router blank "Welcome to Expo" screen under pnpm
description: Root cause and fix when expo-router shows the default placeholder screen instead of app routes in a pnpm workspace
---

## Symptom
The app always renders Expo Router's built-in "Welcome to Expo — Start by creating a file in the app directory" placeholder at every path, even though `app/` has real route files. `getRoutesCore.js`'s `contextModule.keys()` returns an empty array (0 routes found).

## Root cause
`babel-preset-expo`'s expo-router babel plugin only rewrites **literal** `process.env.EXPO_ROUTER_APP_ROOT` (and `EXPO_ROUTER_ABS_APP_ROOT`) member-expression references found in expo-router's shipped `_ctx.*.js` files. It computes the correct relative path at *transform time* using `path.relative(dirname(actualFileBeingTransformed), appRoot)` — this is specifically designed to be correct even though pnpm symlinks `node_modules/expo-router` into the `.pnpm` virtual store.

If anything (e.g. a custom postinstall "patch" script) overwrites those `_ctx.*.js` files with a **hardcoded string literal** path (relative OR absolute) instead of leaving `process.env.EXPO_ROUTER_APP_ROOT` in place, the babel transform never fires, and `require.context()` scans the wrong/nonexistent directory — silently producing zero matched routes.

**Why:** A previous patch script assumed `EXPO_ROUTER_APP_ROOT` wasn't resolved correctly under pnpm and "fixed" it by baking in a literal path. This bypassed the transform entirely and was the actual cause of the blank screen, not pnpm/symlinks themselves.

## How to apply
- Never overwrite expo-router's `_ctx.*.js` files. Leave them using `process.env.EXPO_ROUTER_APP_ROOT` / `EXPO_ROUTER_IMPORT_MODE` as shipped.
- If routes aren't found, check for stale/patched `_ctx.*.js` files in `node_modules/.pnpm/expo-router@*/node_modules/expo-router/` and remove any custom patch scripts targeting them; do a clean reinstall (`rm -rf node_modules` at both the package and pnpm-store level for expo-router, then `pnpm install`).
- The `EXPO_ROUTER_APP_ROOT` env var itself (e.g. set to `app` in the dev command) is only used as a fallback/signal — the actual path resolution happens via the babel plugin's `getExpoRouterAbsoluteAppRoot` caller + `path.relative`, not by reading the env var into `require.context()` directly.
