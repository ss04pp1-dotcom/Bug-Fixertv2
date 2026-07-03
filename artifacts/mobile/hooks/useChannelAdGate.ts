/**
 * Global-engine-backed channel gate.
 *
 * On each channel switch the persistent counter is incremented and the
 * engine decides which ad to show based on the cycle:
 *
 *   pos 1..slFreq-1  → nothing
 *   pos slFreq       → Smartlink  (opens global URL in browser)
 *   pos slFreq+1..N-1→ nothing
 *   pos 0 (cycle end)→ VAST pre-roll (passed to live-player via route param)
 *
 * Per-channel isSmartlinkEnabled / smartlinkUrl / vastUrl fields are ignored —
 * all ad config comes from GlobalAdConfig.
 */
import { useCallback } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  GlobalAdConfig,
  AdAction,
  recordChannelSwitch,
  trackAdEvent,
} from '@/lib/global-ad-engine';

export function useChannelAdGate(config: GlobalAdConfig) {
  const requestChannel = useCallback(
    async (id: string, params?: Record<string, any>, opts?: { replace?: boolean }) => {
      // Strip out legacy per-channel ad fields so they don't pollute route params
      const {
        isSmartlinkEnabled: _sl,
        smartlinkUrl: _slUrl,
        vastUrl: _va,
        bannerHtmlCode: _ba,
        ...playerParams
      } = params ?? {};

      let action: AdAction = null;
      try {
        action = await recordChannelSwitch(config);
      } catch {}

      // ── Smartlink ──────────────────────────────────────────────────────────
      if (action === 'smartlink' && config.smartlink.url) {
        if (config.smartlink.delaySeconds > 0) {
          await new Promise<void>(r => setTimeout(r, config.smartlink.delaySeconds * 1000));
        }
        try {
          await WebBrowser.openBrowserAsync(config.smartlink.url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
            showTitle: false,
            enableBarCollapsing: true,
          });
          trackAdEvent('impression', 'smartlink');
        } catch {}
      }

      // ── Navigate to player ─────────────────────────────────────────────────
      // If VAST was selected, pass the URL and skip config as route params so
      // the live-player screen shows the pre-roll before opening the stream.
      const navigate = opts?.replace ? router.replace : router.push;
      navigate({
        pathname: `/live-player/${id}` as any,
        params: {
          ...playerParams,
          ...(action === 'vast' && config.vast.url
            ? {
                globalVastUrl:  config.vast.url,
                globalVastSkip: String(config.vast.skipAfterSeconds ?? 5),
              }
            : {}),
        },
      });
    },
    [config],
  );

  return { requestChannel };
}
