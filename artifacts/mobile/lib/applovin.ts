import Constants from 'expo-constants';

// ─────────────────────────────────────────────────────────────────────────────
//  Real AppLovin MAX SDK bridge.
//
//  `react-native-applovin-max` ships a native module — same constraint as
//  AdMob (see lib/admob.ts): it only works in a custom dev client / production
//  build (expo prebuild + EAS build), NOT inside Expo Go. We detect Expo Go
//  and skip loading the native module there so the app never crashes in
//  preview. Everywhere else in the app, import from HERE (never import
//  'react-native-applovin-max' directly) and check `appLovinAvailable` first.
// ─────────────────────────────────────────────────────────────────────────────

export const isExpoGo = Constants.appOwnership === 'expo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let maxModule: any = null;
export let appLovinAvailable = false;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    maxModule = require('react-native-applovin-max');
    appLovinAvailable = true;
  } catch (e) {
    console.warn(
      '[AppLovin MAX] Native module failed to load. Real AppLovin ads require ' +
        'a custom dev client or production build (expo prebuild / eas build) — ' +
        'they will not appear in Expo Go.',
      e,
    );
  }
}

export const AppLovinMAX = maxModule?.AppLovinMAX ?? null;
export const MaxAdView = maxModule?.MaxAdView ?? null;
export const AdViewPosition = maxModule?.AdViewPosition ?? null;
export const AdFormat = maxModule?.AdFormat ?? null;

let initPromise: Promise<void> | null = null;

/**
 * Initializes the AppLovin MAX SDK once with the given SDK key.
 * Safe to call multiple times; no-op in Expo Go or when no key is provided.
 */
export function initAppLovin(sdkKey: string | null | undefined): Promise<void> {
  if (!appLovinAvailable || !AppLovinMAX || !sdkKey) return Promise.resolve(undefined);
  if (!initPromise) {
    initPromise = new Promise<void>(resolve => {
      try {
        AppLovinMAX.initialize(sdkKey, () => resolve(undefined));
      } catch (e) {
        console.warn('[AppLovin MAX] initialize() failed', e);
        resolve(undefined);
      }
    });
  }
  return initPromise;
}
