import { useEffect, useRef, useState } from 'react';
import { admobAvailable, AdEventType, RewardedAd, RewardedAdEventType, TestIds } from '@/lib/admob';

/**
 * Loads a real Google AdMob rewarded ad and exposes a `show()` function.
 * Calls `onReward` only when the user actually earns the reward (watches to
 * completion) — mirrors useAdMobInterstitial's shape so AdRewarded.tsx can
 * consume it the same way AdInterstitial consumes useAdMobInterstitial.
 * No-op (loaded stays false) when the native module isn't available (Expo Go)
 * or no unit ID is configured.
 */
export function useAdMobRewarded(
  unitId: string | null | undefined,
  testMode: boolean,
  onReward: () => void,
) {
  const [loaded, setLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adRef = useRef<any>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);
  const onRewardRef = useRef(onReward);
  onRewardRef.current = onReward;

  useEffect(() => {
    if (!admobAvailable || !RewardedAd || !AdEventType || !RewardedAdEventType || !unitId) {
      setLoaded(false);
      return;
    }

    const resolvedUnitId = testMode ? TestIds.REWARDED : unitId;
    const ad = RewardedAd.createForAdRequest(resolvedUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    adRef.current = ad;
    setLoaded(false);

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => setLoaded(true));
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      onRewardRef.current();
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      // Preload the next one immediately.
      ad.load();
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (e: unknown) => {
      console.warn('[AdMob] rewarded failed to load', e);
      setLoaded(false);
    });
    unsubscribersRef.current = [unsubLoaded, unsubEarned, unsubClosed, unsubError];

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
