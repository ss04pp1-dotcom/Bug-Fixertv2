import React, { createContext, useContext, useState, useEffect } from 'react';
import { useChannelAdGate } from '@/hooks/useChannelAdGate';
import {
  GlobalAdConfig,
  DEFAULT_GLOBAL_AD_CONFIG,
  fetchGlobalAdConfig,
} from '@/lib/global-ad-engine';

interface ChannelAdGateContextValue {
  requestChannel: (id: string, params?: Record<string, any>) => Promise<void>;
  /** Current global ad config — screens can read banner positions etc. */
  globalConfig: GlobalAdConfig;
}

const ChannelAdGateContext = createContext<ChannelAdGateContextValue | null>(null);

export function ChannelAdGateProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<GlobalAdConfig>(DEFAULT_GLOBAL_AD_CONFIG);

  useEffect(() => {
    fetchGlobalAdConfig().then(setConfig).catch((e) => console.warn('[AdGate] config fetch failed:', e));
  }, []);

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
