import { useState, useEffect, useCallback, useRef } from 'react';
import { admobAvailable, AppOpenAd, AdEventType, TestIds, initAdMob } from '@/lib/admob';
import { useAdConfig, isAdMobActive } from '@/hooks/useAdConfig';
import { useAuthStore } from '@/lib/auth-store';

/**
 * useAppOpenAd — shows an ad when the app launches.
 *
 * Prefers a real Google AdMob "App Open" ad (when AdMob is the active
 * provider, an App Open ad unit ID is configured, and the native module is
 * available — i.e. not Expo Go). Falls back to a house ad shown via
 * <AdInterstitial placement="app_open" /> otherwise.
 *
 * Usage in app root (_layout.tsx or index.tsx):
 *
 *   const { visible, dismiss } = useAppOpenAd();
 *   return (
 *     <>
 *       <Slot />
 *       <AdInterstitial placement="app_open" visible={visible} onClose={dismiss} />
 *     </>
 *   );
 */
export function useAppOpenAd() {
  const [visible, setVisible] = useState(false);
  const { data: adConfig } = useAdConfig();
  const { user } = useAuthStore();
  const isPremium = !!user && user.plan?.toLowerCase() !== 'free';
  const shownRef = useRef(false);

  const admobActive = isAdMobActive(adConfig);
  const appOpenUnitId = adConfig?.activeProvider?.adUnits?.appOpen;
  const useRealAdMob = admobActive && admobAvailable && !!appOpenUnitId && !!AppOpenAd;

  useEffect(() => {
    if (adConfig === undefined) return; // still loading config
    if (isPremium) return;             // premium users never see app-open ads
    if (shownRef.current) return;      // show once per app session
    shownRef.current = true;

    if (useRealAdMob && appOpenUnitId) {
      // Cancellation flag: if the effect cleanup runs before initAdMob() resolves,
      // we must not attach any listeners (avoids orphan callbacks after unmount).
      let cancelled = false;
      let unsubs: Array<() => void> = [];

      initAdMob().then(() => {
        if (cancelled) return;
        const resolvedUnitId = adConfig?.activeProvider?.isTestMode
          ? TestIds.APP_OPEN
          : appOpenUnitId;
        const realAd = AppOpenAd.createForAdRequest(resolvedUnitId, {
          requestNonPersonalizedAdsOnly: false,
        });
        unsubs = [
          realAd.addAdEventListener(AdEventType.LOADED, () => { realAd.show(); }),
          realAd.addAdEventListener(AdEventType.ERROR, (e: unknown) => {
            console.warn('[AdMob] app open ad failed to load', e);
          }),
        ];
        realAd.load();
      });

      return () => {
        cancelled = true;
        unsubs.forEach(u => u());
      };
    }

    // Fallback: trigger the AdInterstitial modal (placement="app_open").
    // AdInterstitial handles its own fetch, display, and impression tracking —
    // we simply signal that it should open. It will auto-close if no ad is found.
    setVisible(true);
  }, [useRealAdMob, appOpenUnitId, adConfig, isPremium]);

  const dismiss = useCallback(() => setVisible(false), []);

  return { visible, dismiss };
}
