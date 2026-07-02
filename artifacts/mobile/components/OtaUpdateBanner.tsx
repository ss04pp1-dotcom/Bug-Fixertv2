import React, { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// ── Expo Go detection ──────────────────────────────────────────────────────
const IS_EXPO_GO: boolean = (() => {
  try {
    const env = (Constants as any).executionEnvironment;
    if (env === 'storeClient') return true;
    if (env === 'standalone' || env === 'bare') return false;
    return Constants.appOwnership === 'expo';
  } catch { return false; }
})();

/**
 * Silent OTA updater — no UI shown.
 * On every app launch it checks for an update, downloads it, and reloads
 * the JS bundle automatically. User sees the new code on next open.
 */
export default function OtaUpdateBanner() {
  const didCheck = useRef(false);

  const silentUpdate = useCallback(async () => {
    if (didCheck.current) return;
    if (Platform.OS === 'web') return;
    if (IS_EXPO_GO) return;

    didCheck.current = true;

    try {
      const Updates = await import('expo-updates');
      if (!Updates.isEnabled) {
        console.log('[OTA] expo-updates disabled (runtimeVersion / projectId missing in this build)');
        return;
      }

      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        console.log('[OTA] No update available');
        return;
      }

      console.log('[OTA] Update found — downloading…');
      await Updates.fetchUpdateAsync();
      console.log('[OTA] Download complete — reloading app');
      await Updates.reloadAsync();
    } catch (e: any) {
      console.warn('[OTA] silent update failed:', e?.message ?? e);
    }
  }, []);

  useEffect(() => { silentUpdate(); }, [silentUpdate]);

  return null;
}
