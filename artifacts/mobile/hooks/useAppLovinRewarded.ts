import { useEffect, useRef, useState } from 'react';
import { appLovinAvailable, AppLovinMAX } from '@/lib/applovin';

/**
 * Loads a real AppLovin MAX rewarded ad and exposes a `show()` function.
 * Calls `onReward` when the user earns the reward. Mirrors the interstitial
 * hook's shape so AdRewarded.tsx can consume it the same way AdInterstitial
 * consumes useAdMobInterstitial/useAppLovinInterstitial.
 */
export function useAppLovinRewarded(
  adUnitId: string | null | undefined,
  ready: boolean,
  onReward: () => void,
) {
  const [loaded, setLoaded] = useState(false);
  const listenersRef = useRef<Array<() => void>>([]);
  const onRewardRef = useRef(onReward);
  onRewardRef.current = onReward;

  useEffect(() => {
    if (!appLovinAvailable || !AppLovinMAX || !adUnitId || !ready) {
      setLoaded(false);
      return;
    }

    setLoaded(false);

    const onLoaded = AppLovinMAX.addRewardedAdLoadedEventListener(() => setLoaded(true));
    const onFailed = AppLovinMAX.addRewardedAdLoadFailedEventListener((e: unknown) => {
      console.warn('[AppLovin MAX] rewarded failed to load', e);
      setLoaded(false);
    });
    const onReceived = AppLovinMAX.addRewardedAdReceivedRewardEventListener(() => {
      onRewardRef.current();
    });
    const onHidden = AppLovinMAX.addRewardedAdHiddenEventListener(() => {
      setLoaded(false);
      AppLovinMAX.loadRewardedAd(adUnitId);
    });
    listenersRef.current = [
      () => onLoaded?.remove?.(),
      () => onFailed?.remove?.(),
      () => onReceived?.remove?.(),
      () => onHidden?.remove?.(),
    ];

    AppLovinMAX.loadRewardedAd(adUnitId);

    return () => {
      listenersRef.current.forEach(unsub => unsub());
      listenersRef.current = [];
    };
  }, [adUnitId, ready]);

  const show = () => {
    if (loaded && adUnitId && AppLovinMAX) {
      AppLovinMAX.showRewardedAd(adUnitId);
      return true;
    }
    return false;
  };

  return { loaded, show };
}
