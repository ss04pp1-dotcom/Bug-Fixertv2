import { useQuery } from '@tanstack/react-query';
import { Config } from '@/constants/config';

export interface AdUnits {
  banner?: string | null;
  interstitial?: string | null;
  rewarded?: string | null;
  native?: string | null;
  appOpen?: string | null;
}

export interface AdActiveProvider {
  slug: string;
  name: string;
  appId?: string | null;
  adUnits: AdUnits;
  isTestMode: boolean;
}

export interface AdRemoteConfig {
  activeProvider: AdActiveProvider | null;
  placements: Record<string, { enabled: boolean; type: string; screen?: string }>;
  adsEnabled: boolean;
  maintenanceMode: boolean;
}

async function fetchAdConfig(): Promise<AdRemoteConfig | null> {
  try {
    const res = await fetch(`${Config.API_BASE}/ads/config`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetches the admin-configured ad settings (`/v1/ads/config`).
 * Tells the UI which network is active (e.g. 'admob'), whether it's in test
 * mode, and which ad unit IDs to use for banner/interstitial/appOpen slots.
 */
export function useAdConfig() {
  return useQuery({
    queryKey: ['ads-config'],
    queryFn: fetchAdConfig,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

/** True when AdMob is the network selected in the admin panel. */
export function isAdMobActive(config: AdRemoteConfig | null | undefined): boolean {
  return !!config?.activeProvider && config.activeProvider.slug === 'admob' && !!config.adsEnabled;
}
