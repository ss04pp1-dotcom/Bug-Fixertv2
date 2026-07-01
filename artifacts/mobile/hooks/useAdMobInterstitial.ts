import { useEffect, useRef, useState } from 'react';
import { admobAvailable, AdEventType, InterstitialAd, TestIds } from '@/lib/admob';

/**
 * Loads a real Google AdMob interstitial ad and exposes a `show()` function.
 * No-op (loaded stays false) when the native module isn't available (Expo Go)
 * or no unit ID is configured.
 */
export function useAdMobInterstitial(unitId: string | null | undefined, testMode: boolean) {
  const [loaded, setLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adRef = useRef<any>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!admobAvailable || !InterstitialAd || !AdEventType || !unitId) {
      setLoaded(false);
      return;
    }

    const resolvedUnitId = testMode ? TestIds.INTERSTITIAL : unitId;
    const ad = InterstitialAd.createForAdRequest(resolvedUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    adRef.current = ad;
    setLoaded(false);

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => setLoaded(true));
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      // Preload the next one immediately.
      ad.load();
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (e: unknown) => {
      console.warn('[AdMob] interstitial failed to load', e);
      setLoaded(false);
    });
    unsubscribersRef.current = [unsubLoaded, unsubClosed, unsubError];

    ad.load();

    return () => {
      unsubscribersRef.current.forEach(unsub => unsub());
      unsubscribersRef.current = [];
      adRef.current = null;
    };
  }, [unitId, testMode]);

  const show = () => {
    if (loaded && adRef.current) {
      adRef.current.show();
      return true;
    }
    return false;
  };

  return { loaded, show };
}
