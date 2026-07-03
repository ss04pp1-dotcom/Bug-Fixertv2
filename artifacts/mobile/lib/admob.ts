/**
 * AdMob stub — the actual react-native-google-mobile-ads SDK is only
 * available in EAS native builds.  In Expo Go (development) these exports
 * are all null/false so callers can gracefully fall back.
 *
 * The ad system has been replaced with the Global Ad Engine
 * (lib/global-ad-engine.ts) which uses Smartlink + VAST + WebView banners.
 * This file is kept only so legacy import sites in settings.tsx compile.
 */

export const admobAvailable = false;

/** Returns null in Expo Go — real SDK not loaded */
export const mobileAds: (() => { openAdInspector: () => Promise<void> }) | null = null;

/** No-op in Expo Go */
export async function initAdMob(): Promise<void> {
  // Native SDK not available
}

/** Stub — not functional in Expo Go */
export const InterstitialAd: {
  createForAdRequest: (adUnitId: string, options?: object) => {
    addAdEventListener: (event: string, cb: () => void) => () => void;
    load: () => void;
    show: () => Promise<void>;
  };
} | null = null;

/** Stub event type enum */
export const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  CLOSED: 'closed',
} as const;

/** Stub test IDs */
export const TestIds = {
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  BANNER:       'ca-app-pub-3940256099942544/6300978111',
  REWARDED:     'ca-app-pub-3940256099942544/5224354917',
} as const;
