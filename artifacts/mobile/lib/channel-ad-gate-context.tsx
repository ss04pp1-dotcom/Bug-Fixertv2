import React, { createContext, useContext } from 'react';
import { useChannelAdGate } from '@/hooks/useChannelAdGate';

type ChannelAdGateContextValue = ReturnType<typeof useChannelAdGate>;

const ChannelAdGateContext = createContext<ChannelAdGateContextValue | null>(null);

export function ChannelAdGateProvider({ children }: { children: React.ReactNode }) {
  const gate = useChannelAdGate();
  return (
    <ChannelAdGateContext.Provider value={gate}>
      {children}
    </ChannelAdGateContext.Provider>
  );
}

export function useChannelAdGateContext(): ChannelAdGateContextValue {
  const ctx = useContext(ChannelAdGateContext);
  if (!ctx) throw new Error('useChannelAdGateContext must be used inside ChannelAdGateProvider');
  return ctx;
}
