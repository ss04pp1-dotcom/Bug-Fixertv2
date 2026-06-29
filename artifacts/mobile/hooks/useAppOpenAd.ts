import { useState, useEffect, useCallback } from 'react';
import { Config } from '@/constants/config';

interface AppOpenAd {
  id: string;
  name: string;
  imageUrl?: string;
  clickUrl?: string;
}

async function fetchAppOpenAd(): Promise<AppOpenAd | null> {
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
      name: pick.name || '',
      imageUrl: pick.imageUrl || pick.bannerUrl || '',
      clickUrl: pick.clickUrl || pick.destinationUrl || '',
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
      body: JSON.stringify({ advertisementId: adId, event: 'impression', placement: 'app_open' }),
    });
  } catch {}
}

/**
 * useAppOpenAd — shows a full-screen interstitial ad when the app launches.
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
  const [ad, setAd] = useState<AppOpenAd | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetchAppOpenAd().then(fetched => {
      if (fetched) {
        setAd(fetched);
        setVisible(true);
        trackImpression(fetched.id);
      }
    });
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  return { ad, visible, dismiss };
}
