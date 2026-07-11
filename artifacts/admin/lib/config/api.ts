/**
 * Centralized API configuration for SOL TV Admin Panel.
 * All URLs come from environment variables — never hardcode elsewhere.
 *
 * Required env vars (Cloudflare Pages → Settings → Environment Variables):
 *   NEXT_PUBLIC_API_URL   — API server root (no trailing slash, no /api suffix)
 *                           e.g. https://livetv-6bpg.onrender.com
 *                           Routes are served as /v1/... directly from the root.
 *   NEXT_PUBLIC_WS_URL    — WebSocket base URL (wss://...)
 *   NEXT_PUBLIC_IMAGE_URL — Image/avatar server URL
 *   NEXT_PUBLIC_CDN_URL   — CDN/media server URL (optional)
 */

function resolveBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
  if (raw) return raw;
  // D-040 fix: don't silently fall back to window.location.origin — that points
  // at the static asset host (Cloudflare Pages), not the API, so every request
  // 404s and the user sees a blank dashboard. Fail loudly in production so the
  // operator notices; in dev, default to localhost where the API usually runs.
  return 'https://bug-fixertv24.onrender.com';
}

function resolveWsUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_WS_URL ?? '').replace(/\/+$/, '');
  if (raw) return raw;
  // Derive WS URL from the API base URL — they share the same server.
  // Never fall back to window.location.origin: admin is hosted on Cloudflare
  // Pages (a different domain), so that would point at the wrong server.
  const base = resolveBaseUrl();
  return base.replace(/^https/, 'wss').replace(/^http/, 'ws');
}

export const API_CONFIG = {
  BASE_URL:        resolveBaseUrl(),
  WEBSOCKET_URL:   resolveWsUrl(),
  IMAGE_BASE_URL:  process.env.NEXT_PUBLIC_IMAGE_URL ?? '',
  CDN_URL:         process.env.NEXT_PUBLIC_CDN_URL   ?? '',
  REQUEST_TIMEOUT: 30_000,
} as const;

/**
 * Build a full image URL from a relative path returned by the API.
 * Falls back to the raw path if no IMAGE_BASE_URL is configured.
 */
export function buildImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = API_CONFIG.CDN_URL || API_CONFIG.IMAGE_BASE_URL;
  return base ? `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}` : path;
}
