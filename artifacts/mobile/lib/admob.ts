import Constants from 'expo-constants';

// ─────────────────────────────────────────────────────────────────────────────
//  Real Google AdMob SDK bridge.
//
//  `react-native-google-mobile-ads` ships a native module. It only works in a
//  custom dev client / production build (via `expo prebuild` + EAS build) —
//  it CANNOT run inside Expo Go, because Expo Go doesn't contain the native
//  AdMob code. Importing the native module there throws synchronously, which
//  would crash the whole app.
//
//  To keep the app safe to preview in Expo Go while still being fully wired
//  for a real build, we detect Expo Go and skip loading the native module in
//  that case. Everywhere else in the app, import from HERE (never import
//  'react-native-google-mobile-ads' directly) and check `admobAvailable`
//  before using any of the exports.
// ─────────────────────────────────────────────────────────────────────────────

export const isExpoGo = Constants.appOwnership === 'expo';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mobileAdsModule: any = null;
export let admobAvailable = false;

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mobileAdsModule = require('react-native-google-mobile-ads');
    admobAvailable = true;
  } catch (e) {
    console.warn(
      '[AdMob] Native module failed to load. Real AdMob ads require a custom ' +
        'dev client or production build (expo prebuild / eas build) — they will ' +
        'not appear in Expo Go.',
      e,
    );
  }
}

export const mobileAds = mobileAdsModule?.default ?? null;
export const BannerAd = mobileAdsModule?.BannerAd ?? null;
export const BannerAdSize = mobileAdsModule?.BannerAdSize ?? null;
export const InterstitialAd = mobileAdsModule?.InterstitialAd ?? null;
export const AppOpenAd = mobileAdsModule?.AppOpenAd ?? null;
export const AdEventType = mobileAdsModule?.AdEventType ?? null;
export const TestIds = mobileAdsModule?.TestIds ?? null;

let initPromise: Promise<void> | null = null;

/** Initializes the AdMob SDK once. Safe to call multiple times; no-op in Expo Go. */
export function initAdMob(): Promise<void> {
  if (!admobAvailable || !mobileAds) return Promise.resolve(undefined);
  if (!initPromise) {
    initPromise = mobileAds()
      .initialize()
      .then(() => undefined)
      .catch((e: unknown) => {
        console.warn('[AdMob] initialize() failed', e);
      });
  }
  return initPromise as Promise<void>;
}
