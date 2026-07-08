"use client";

export const TOKEN_KEY = "soltv_admin_token";

// ───────────────────────────────────────────────────────────────────────────
// Known limitation (D-002 fix):
// This Next.js app is statically exported (`output: "export"` in next.config.ts),
// so there is no Node.js server runtime available to issue httpOnly cookies.
// We therefore store ONLY the access token client-side and deliberately drop
// the refresh token entirely. Storing a long-lived refresh token in
// sessionStorage/localStorage is an XSS-escalation risk — anyone who can
// inject script can mint fresh access tokens indefinitely.
//
// Trade-off: when the access token expires, the user must re-login. The
// axios-client 401 interceptor will clear the token and bounce to /login.
// Real refresh handling requires either deploying this admin panel to a
// Node host (remove `output: "export"`) or proxying auth through the API
// server with httpOnly cookies.
// ───────────────────────────────────────────────────────────────────────────

// Access token kept in memory + mirrored to sessionStorage so a same-tab
// refresh auto-restores it without forcing a re-login.
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

export function clearToken() {
  _memoryToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
