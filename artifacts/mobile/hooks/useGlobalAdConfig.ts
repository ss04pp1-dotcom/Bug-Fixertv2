/**
 * Standalone hook for screens that live OUTSIDE the (main) route group
 * (e.g. channel/[id].tsx, live-player/[id].tsx) and therefore don't have
 * access to ChannelAdGateProvider's context.
 *
 * Reads from global-ad-engine's in-memory + AsyncStorage cache so repeated
 * mounts don't cause redundant API calls. If the first fetch fails (e.g.
 * Render.com cold-start timeout), retries every RETRY_INTERVAL_MS until it
 * succeeds, so ads appear as soon as the server wakes up.
 */
import { useState, useEffect, useRef } from 'react';
import {
  GlobalAdConfig,
  DEFAULT_GLOBAL_AD_CONFIG,
  fetchGlobalAdConfig,
  isConfigLoaded,
} from '@/lib/global-ad-engine';

const RETRY_INTERVAL_MS = 10_000; // retry every 10s until server responds

export function useGlobalAdConfig(): GlobalAdConfig {
  const [config, setConfig] = useState<GlobalAdConfig>(DEFAULT_GLOBAL_AD_CONFIG);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;

    async function load() {
      try {
        const cfg = await fetchGlobalAdConfig();
        if (!cancelled.current) {
          setConfig(cfg);
          // If the engine returned a live config (not stale default), stop retrying.
          if (isConfigLoaded()) {
            if (retryTimer.current) clearTimeout(retryTimer.current);
            return;
          }
        }
      } catch (e: unknown) {
        console.warn('[AdConfig] fetchGlobalAdConfig rejected unexpectedly:', e);
      }

      // Config not yet loaded from server — schedule a retry.
      if (!cancelled.current && !isConfigLoaded()) {
        retryTimer.current = setTimeout(load, RETRY_INTERVAL_MS);
      }
    }

    load();

    return () => {
      cancelled.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  return config;
}
