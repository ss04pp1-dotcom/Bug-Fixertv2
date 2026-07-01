import { useState, useEffect, useCallback, useRef } from 'react';
import { Config } from '@/constants/config';
import { admobAvailable, AppOpenAd, AdEventType, TestIds, initAdMob } from '@/lib/admob';
import { useAdConfig, isAdMobActive } from '@/hooks/useAdConfig';

interface HouseAppOpenAd {
  id: string;
  name: string;
  imageUrl?: string;
  clickUrl?: string;
}

async function fetchAppOpenAd(): Promise<HouseAppOpenAd | null> {
  try {
    const res = await fetch(
      `${Config.API_BASE}/advertisements/placements/public?slug=app_open`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : data?.data ?? [];
    const pl = items.find((p: any) => p.slug === 'app_open' || p.slug === 'app-open');
    if (!pl) return null;
    const ads: any[] = (pl.advertisements ?? []).filter(
      (a: any) => a.isActive !== false && ['app_open', 'splash', 'interstitial'].includes(a.type),
    );
    if (ads.length === 0) return null;
    const pick = ads[Math.floor(Math.random() * ads.length)];
    return {
      id: pick.id,
      name: pick.title || pick.name || '',
      imageUrl: pick.imageUrl || pick.bannerUrl || '',
      clickUrl: pick.targetUrl || pick.clickUrl || pick.destinationUrl || '',
    };
  } catch {
    return null;
  }
}

async function trackImpression(adId: string) {
  try {
    await fetch(`${Config.API_BASE}/advertisements/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId, eventType: 'impression', placement: 'app_open' }),
    });
  } catch {}
}

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
 *   const { ad, visible, dismiss } = useAppOpenAd();
 *   return (
 *     <>
 *       <Slot />
 *       <AdInterstitial placement="app_open" visible={visible} onClose={dismiss} />
 *     </>
 *   );
 */
export function useAppOpenAd() {
  const [ad, setAd] = useState<HouseAppOpenAd | null>(null);
  const [visible, setVisible] = useState(false);
  const { data: adConfig } = useAdConfig();
  const shownRealAd = useRef(false);

  const admobActive = isAdMobActive(adConfig);
  const appOpenUnitId = adConfig?.activeProvider?.adUnits?.appOpen;
  const useRealAdMob = admobActive && admobAvailable && !!appOpenUnitId && !!AppOpenAd;

  useEffect(() => {
    if (adConfig === undefined) return; // still loading config

    if (useRealAdMob && appOpenUnitId) {
      if (shownRealAd.current) return;
      shownRealAd.current = true;

      initAdMob().then(() => {
        const resolvedUnitId = adConfig?.activeProvider?.isTestMode
          ? TestIds.APP_OPEN
          : appOpenUnitId;
        const realAd = AppOpenAd.createForAdRequest(resolvedUnitId, {
          requestNonPersonalizedAdsOnly: false,
        });
        const unsubLoaded = realAd.addAdEventListener(AdEventType.LOADED, () => {
          realAd.show();
        });
        const unsubError = realAd.addAdEventListener(AdEventType.ERROR, (e: unknown) => {
          console.warn('[AdMob] app open ad failed to load', e);
        });
        realAd.load();
        return () => {
          unsubLoaded();
          unsubError();
        };
      });
      return;
    }

    // Fallback: house ad shown through the shared AdInterstitial modal.
    fetchAppOpenAd().then(fetched => {
      if (fetched) {
        setAd(fetched);
        setVisible(true);
        trackImpression(fetched.id);
      }
    });
  }, [useRealAdMob, appOpenUnitId, adConfig]);

  const dismiss = useCallback(() => setVisible(false), []);

  return { ad, visible, dismiss };
}
