import { useCallback } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

interface ChannelParams extends Record<string, any> {
  isSmartlinkEnabled?: boolean;
  smartlinkUrl?: string;
}

/**
 * Gates channel playback behind an optional Monetag/Adsterra Smartlink.
 *
 * Flow:
 *  1. User taps a channel card — caller passes channel data including
 *     isSmartlinkEnabled + smartlinkUrl returned by the API.
 *  2. If isSmartlinkEnabled is true and smartlinkUrl is set, opens the
 *     Smartlink in an in-app browser (Chrome Custom Tab) via expo-web-browser.
 *  3. After the user closes the browser (or instantly if disabled), the
 *     live-player screen opens.
 *
 * Fail-safe: if WebBrowser throws for any reason, playback still proceeds
 * so a broken ad URL never blocks channel access.
 */
export function useChannelAdGate() {
  const requestChannel = useCallback(
    async (id: string, params?: ChannelParams) => {
      const { isSmartlinkEnabled, smartlinkUrl, ...playerParams } = params ?? {};

      if (isSmartlinkEnabled && smartlinkUrl) {
        try {
          await WebBrowser.openBrowserAsync(smartlinkUrl, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC,
            showTitle: false,
            enableBarCollapsing: true,
          });
        } catch {
        }
      }

      router.push({
        pathname: `/live-player/${id}` as any,
        params: playerParams,
      });
    },
    [],
  );

  return { requestChannel };
}
