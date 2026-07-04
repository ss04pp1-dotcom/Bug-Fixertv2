import React, { createContext, useContext } from 'react';
import { useChannelAdGate } from '@/hooks/useChannelAdGate';
import { GlobalAdConfig } from '@/lib/global-ad-engine';
import { useGlobalAdConfig } from '@/hooks/useGlobalAdConfig';

interface ChannelAdGateContextValue {
  requestChannel: (id: string, params?: Record<string, any>) => Promise<void>;
  /** Current global ad config — screens can read banner positions etc. */
  globalConfig: GlobalAdConfig;
}

const ChannelAdGateContext = createContext<ChannelAdGateContextValue | null>(null);

export function ChannelAdGateProvider({ children }: { children: React.ReactNode }) {
  // FIX: previously fetched config once via a one-shot fetchGlobalAdConfig()
  // call with no retry — a single slow/failed network request left the whole
  // app's ad gate stuck on DEFAULT_GLOBAL_AD_CONFIG (all ads off) for the rest
  // of the session. useGlobalAdConfig() retries every 10s until the server
  // responds, matching the behavior other screens already rely on.
  const config = useGlobalAdConfig();

  const gate = useChannelAdGate(config);

  const value: ChannelAdGateContextValue = {
    requestChannel: gate.requestChannel,
    globalConfig:   config,
  };

  return (
    <ChannelAdGateContext.Provider value={value}>
      {children}
    </ChannelAdGateContext.Provider>
  );
}

export function useChannelAdGateContext(): ChannelAdGateContextValue {
  const ctx = useContext(ChannelAdGateContext);
  if (!ctx) throw new Error('useChannelAdGateContext must be used inside ChannelAdGateProvider');
  return ctx;
}
