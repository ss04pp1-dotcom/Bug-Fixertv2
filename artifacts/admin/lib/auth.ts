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
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string) {
  if (typeof window !== 'undefined' && token) {
    sessionStorage.setItem(REFRESH_KEY, token);
  }
}

export function clearToken() {
  _memoryToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
