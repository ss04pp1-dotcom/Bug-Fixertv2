/**
 * Standalone hook for screens that live OUTSIDE the (main) route group
 * (e.g. channel/[id].tsx, live-player/[id].tsx) and therefore don't have
 * access to ChannelAdGateProvider's context.
 *
 * Reads from global-ad-engine's in-memory + AsyncStorage cache so repeated
 * mounts don't cause redundant API calls.
 */
import { useState, useEffect } from 'react';
import {
  GlobalAdConfig,
  DEFAULT_GLOBAL_AD_CONFIG,
  fetchGlobalAdConfig,
} from '@/lib/global-ad-engine';

export function useGlobalAdConfig(): GlobalAdConfig {
  const [config, setConfig] = useState<GlobalAdConfig>(DEFAULT_GLOBAL_AD_CONFIG);

  useEffect(() => {
    let cancelled = false;
    fetchGlobalAdConfig().then(cfg => {
      if (!cancelled) setConfig(cfg);
    });
    return () => { cancelled = true; };
  }, []);

  return config;
}
