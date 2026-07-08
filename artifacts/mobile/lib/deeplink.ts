/**
 * Deep Link utility — URL parsing and pending-link store.
 *
 * Supported prefixes:
 *   sol-tv://channel/123        → /channel/123
 *   https://soltv.app/movie/456 → /movie/456
 */

const PREFIXES = ['sol-tv://', 'https://soltv.app/'];

/**
 * Convert a raw deep-link URL to an expo-router path (e.g. "/channel/123").
 * Returns null if the URL doesn't match a known prefix.
 */
export function parseDeepLink(url: string): string | null {
  for (const prefix of PREFIXES) {
    if (url.startsWith(prefix)) {
      const rest = url.slice(prefix.length).replace(/^\/+/, '');
      return '/' + rest;
    }
  }
  return null;
}

/**
 * Simple module-level store for a deep link that arrived before the user was
 * authenticated. Cleared once consumed so it is only followed once.
 */
let _pending: string | null = null;

export const PendingLink = {
  set:   (path: string) => { _pending = path; },
  get:   () => _pending,
  clear: () => { _pending = null; },
};

/**
 * Routes that do not require authentication and can be navigated to directly
 * even if the user is not yet logged in.
 */
export const PUBLIC_PATHS = [
  '/(auth)/login',
  '/(auth)/signup',
  '/(auth)/forgot-password',
  '/(auth)/onboarding',
];

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}
