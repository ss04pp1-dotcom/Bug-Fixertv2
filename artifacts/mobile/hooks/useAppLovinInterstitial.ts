import { useEffect, useRef, useState } from 'react';
import { appLovinAvailable, AppLovinMAX } from '@/lib/applovin';

/**
 * Loads a real AppLovin MAX interstitial ad and exposes a `show()` function.
 * No-op (loaded stays false) when the native module isn't available (Expo Go)
 * or no ad unit ID is configured. Mirrors useAdMobInterstitial.ts.
 */
export function useAppLovinInterstitial(adUnitId: string | null | undefined, ready: boolean) {
  const [loaded, setLoaded] = useState(false);
  const listenersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!appLovinAvailable || !AppLovinMAX || !adUnitId || !ready) {
      setLoaded(false);
      return;
    }

    setLoaded(false);

    const onLoaded = AppLovinMAX.addInterstitialLoadedEventListener(() => setLoaded(true));
    const onFailed = AppLovinMAX.addInterstitialLoadFailedEventListener((e: unknown) => {
      console.warn('[AppLovin MAX] interstitial failed to load', e);
      setLoaded(false);
    });
    const onHidden = AppLovinMAX.addInterstitialHiddenEventListener(() => {
      setLoaded(false);
      AppLovinMAX.loadInterstitial(adUnitId);
    });
    listenersRef.current = [
      () => onLoaded?.remove?.(),
      () => onFailed?.remove?.(),
      () => onHidden?.remove?.(),
    ];

    AppLovinMAX.loadInterstitial(adUnitId);

    return () => {
      listenersRef.current.forEach(unsub => unsub());
      listenersRef.current = [];
    };
  }, [adUnitId, ready]);

  const show = () => {
    if (loaded && adUnitId && AppLovinMAX) {
      AppLovinMAX.showInterstitial(adUnitId);
      return true;
    }
    return false;
  };

  return { loaded, show };
}
