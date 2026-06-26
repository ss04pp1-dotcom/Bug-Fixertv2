import Constants from 'expo-constants';

// ─────────────────────────────────────────────────────────────────────────────
//  SINGLE PLACE TO CHANGE THE SERVER
//  Set EXPO_PUBLIC_API_URL in your .env (or Replit Secrets) to override.
//  Example: EXPO_PUBLIC_API_URL=https://my-new-server.com
// ─────────────────────────────────────────────────────────────────────────────
// @ts-ignore
const SERVER_URL: string =
  process.env['EXPO_PUBLIC_API_URL'] ||
  Constants.expoConfig?.extra?.apiUrl ||
  'https://bug-fixertv2.onrender.com';

// WebSocket URL — derived automatically from SERVER_URL
const WS_URL = SERVER_URL
  .replace(/^https/, 'wss')
  .replace(/^http/, 'ws');

// ─────────────────────────────────────────────────────────────────────────────
//  Config object — import this everywhere, never hardcode URLs
// ─────────────────────────────────────────────────────────────────────────────
export const Config = {
  /** Base URL for all REST API calls  e.g. https://my-server.com/v1 */
  API_BASE: `${SERVER_URL}/v1`,

  /** WebSocket server URL */
  WS_URL,

  /** Base URL for images served by the API server */
  IMAGE_BASE: SERVER_URL,

  /** CDN URL for static assets — override via expo config extra.cdnUrl if needed */
  CDN_URL: Constants.expoConfig?.extra?.cdnUrl || SERVER_URL,

  APP_VERSION: Constants.expoConfig?.version ?? '2.4.1',
  BUILD_NUMBER: Constants.expoConfig?.ios?.buildNumber
    ? parseInt(Constants.expoConfig.ios.buildNumber as string, 10)
    : (Constants.expoConfig?.android?.versionCode ?? 842),

  /** Resolves a media path to a full URL. Absolute URLs pass through unchanged. */
  imageUrl(path: string): string {
    if (!path) return '';
    return path.startsWith('http') ? path : `${this.IMAGE_BASE}${path}`;
  },

  isDev: __DEV__,
};
