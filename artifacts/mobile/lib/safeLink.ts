import { Linking } from 'react-native';

// Only permit http(s) targets when opening a server-supplied URL. A malicious
// backend response could otherwise deep-link into javascript:, tel:, sms:, or
// custom app schemes and trigger unintended actions on the user's device.
const SAFE_SCHEME = /^https?:\/\//i;

export function openExternalUrl(raw: string | undefined | null): Promise<void> {
  if (!raw || typeof raw !== 'string') return Promise.resolve();
  const trimmed = raw.trim();
  if (!SAFE_SCHEME.test(trimmed)) {
    if (__DEV__) console.warn('[safeLink] Blocked non-http(s) URL:', trimmed);
    return Promise.resolve();
  }
  return Linking.openURL(trimmed).catch(() => undefined);
}
