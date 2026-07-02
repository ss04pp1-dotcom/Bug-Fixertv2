import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';

interface PendingChannel {
  id: string;
  params?: Record<string, any>;
}

/**
 * Gates channel playback behind a mandatory rewarded ad: pressing a channel
 * opens the rewarded-ad modal, and navigation to the live player only happens
 * once the reward is actually earned (i.e. the ad was watched, not skipped).
 *
 * Fail-safe: if no ad (real network or house-ad fallback) loads within 8s —
 * e.g. the ad backend is unreachable — the user is let through anyway so a
 * broken ad pipeline never permanently blocks channel access.
 */
export function useChannelAdGate() {
  const [visible, setVisible] = useState(false);
  const pendingRef = useRef<PendingChannel | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const navigateToPending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    clearTimer();
    setVisible(false);
    if (pending) {
      router.push({ pathname: `/live-player/${pending.id}` as any, params: pending.params });
    }
  }, [clearTimer]);

  const requestChannel = useCallback((id: string, params?: Record<string, any>) => {
    pendingRef.current = { id, params };
    setVisible(true);
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      navigateToPending();
    }, 8000);
  }, [clearTimer, navigateToPending]);

  const onRewardEarned = useCallback(() => {
    navigateToPending();
  }, [navigateToPending]);

  const onClose = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    setVisible(false);
  }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { visible, requestChannel, onRewardEarned, onClose };
}
