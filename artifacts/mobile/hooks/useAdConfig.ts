import { useQuery } from '@tanstack/react-query';
import { Config } from '@/constants/config';

export interface AdPlacement {
  enabled: boolean;
  type: string;
  screen?: string;
}

export interface AdRemoteConfig {
  adsEnabled: boolean;
  maintenanceMode: boolean;
  placements: Record<string, AdPlacement>;
  bannerHtmlCode?: string;
}

async function fetchAdConfig(): Promise<AdRemoteConfig | null> {
  try {
    const res = await fetch(`${Config.API_BASE}/ads/config`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json?.data ?? json) as AdRemoteConfig;
  } catch {
    return null;
  }
}

export function useAdConfig() {
  return useQuery({
    queryKey: ['ads-config'],
    queryFn: fetchAdConfig,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}
