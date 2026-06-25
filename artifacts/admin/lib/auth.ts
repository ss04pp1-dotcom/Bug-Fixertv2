"use client";

export const TOKEN_KEY = "streampro_admin_token";
const REFRESH_KEY = "streampro_refresh_token";

// Access token stored in memory (cleared on page refresh — most XSS-safe option
// for a static SPA without an httpOnly-cookie server). Backed by sessionStorage
// so a same-tab refresh auto-restores it without requiring re-login.
let _memoryToken: string | null = null;

export function getToken(): string | null {
  if (_memoryToken) return _memoryToken;
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(TOKEN_KEY);
  if (stored) _memoryToken = stored;
  return stored;
}

export function setToken(token: string) {
  _memoryToken = token;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  // In production, the httpOnly cookie is sent automatically by the browser.
  // Only fall back to sessionStorage in local dev mode.
  if (process.env.NODE_ENV === 'development') {
    return sessionStorage.getItem(REFRESH_KEY);
  }
  return null; // cookie is sent by browser automatically
}

export function setRefreshToken(token: string) {
  if (typeof window !== 'undefined') {
    // httpOnly cookie is set by the backend on /v1/auth/refresh response.
    // We keep a fallback in sessionStorage ONLY for local dev without a backend proxy.
    // In production, the backend must send: Set-Cookie: streampro_refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api-server;
    // and this function becomes a no-op for production deployments.
    if (process.env.NODE_ENV === 'development') {
      sessionStorage.setItem(REFRESH_KEY, token);
    }
  }
}

export function clearToken() {
  _memoryToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    // Also clear any legacy localStorage entries
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    // In production, clear the httpOnly cookie by calling the backend logout endpoint.
    // The backend sets: Set-Cookie: streampro_refresh_token=; Max-Age=0; Path=/api-server;
    try {
      if (typeof navigator !== 'undefined' && navigator.cookieEnabled) {
        document.cookie = 'streampro_refresh_token=; Max-Age=0; Path=/api-server;';
      }
    } catch {
      // silent — best-effort cleanup
    }
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
