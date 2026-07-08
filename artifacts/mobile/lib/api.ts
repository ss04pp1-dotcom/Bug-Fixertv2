import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { Config } from '@/constants/config';
import { Platform } from 'react-native';

const ACCESS_KEY = 'streampro_access_token';
const REFRESH_KEY = 'streampro_refresh_token';

const isWeb = Platform.OS === 'web';

// Web storage strategy:
// - Access token  → sessionStorage  (cleared on tab close, survives refresh, not accessible by other tabs)
// - Refresh token → NOT stored on web  (avoids XSS-to-persistent-token-theft escalation)
//   Trade-off: web users must re-login after session expires. Acceptable for a mobile-first app
//   where web is a secondary surface. Real fix: move to httpOnly cookies when a server is available.
const webStorage = {
  getItem: (key: string): Promise<string | null> => {
    try {
      // Refresh token is never written to web storage; return null so callers degrade gracefully.
      if (key === REFRESH_KEY) return Promise.resolve(null);
      return Promise.resolve(sessionStorage.getItem(key));
    }
    catch { return Promise.resolve(null); }
  },
  setItem: (key: string, value: string): Promise<void> => {
    // Do NOT store the refresh token on web — keeping a long-lived token in any
    // JS-accessible storage creates an XSS → account-takeover escalation path.
    if (key === REFRESH_KEY) return Promise.resolve();
    try { sessionStorage.setItem(key, value); } catch {}
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    try {
      sessionStorage.removeItem(key);
      // Also clear legacy localStorage copies if they exist from older app versions.
      localStorage.removeItem(key);
    } catch {}
    return Promise.resolve();
  },
};

async function secureGet(key: string): Promise<string | null> {
  if (isWeb) return webStorage.getItem(key);
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (isWeb) return webStorage.setItem(key, value);
  const SecureStore = await import('expo-secure-store');
  return SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (isWeb) return webStorage.removeItem(key);
  const SecureStore = await import('expo-secure-store');
  return SecureStore.deleteItemAsync(key);
}

export const tokenStorage = {
  getAccessToken: () => secureGet(ACCESS_KEY),
  getRefreshToken: () => secureGet(REFRESH_KEY),
  setTokens: async (access: string, refresh?: string | null) => {
    const ops: Promise<void>[] = [secureSet(ACCESS_KEY, access)];
    if (refresh) ops.push(secureSet(REFRESH_KEY, refresh));
    await Promise.all(ops);
  },
  clearTokens: async () => {
    await Promise.all([secureDelete(ACCESS_KEY), secureDelete(REFRESH_KEY)]);
  },
};

// Safe navigation callback — set this from _layout.tsx once router is ready
let _onUnauthenticated: (() => void) | null = null;
export function setUnauthenticatedHandler(handler: () => void) {
  _onUnauthenticated = handler;
}

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
};

const apiClient: AxiosInstance = axios.create({
  baseURL: Config.API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await tokenStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Exponential-backoff retry for transient 5xx errors ─────────────────────
// Retries idempotent requests (GET/PUT/PATCH/DELETE) up to MAX_RETRIES times
// with capped exponential back-off. POST is excluded to avoid duplicate mutations.
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 500; // 500ms → 1000ms → 2000ms (capped at 4s)

function isRetryableError(error: AxiosError): boolean {
  const status = error.response?.status;
  const method = (error.config?.method || 'get').toUpperCase();
  const isSafeMethod = ['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method);
  // Retry on 5xx server errors and network failures (no response). Never retry 4xx.
  return isSafeMethod && (!error.response || (!!status && status >= 500));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type RetryableConfig = InternalAxiosRequestConfig & { _retryCount?: number };

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig & { _retry?: boolean };

    // ── 5xx / network retry ────────────────────────────────────────────────
    const retryCount = originalRequest._retryCount ?? 0;
    if (isRetryableError(error) && retryCount < MAX_RETRIES) {
      originalRequest._retryCount = retryCount + 1;
      const backoff = Math.min(BASE_DELAY_MS * 2 ** retryCount, 4000);
      await delay(backoff);
      return apiClient(originalRequest);
    }

    // Fresh-auth endpoints (login, register, social login, refresh) have no
    // session to "expire" — a 401 here means invalid credentials / OAuth
    // verification failure, not an expired token. Let the real backend
    // message through instead of mislabeling it AUTH_EXPIRED, and never try
    // to refresh a token off the back of one of these calls.
    const requestUrl = originalRequest.url || '';
    const isAuthFlowEndpoint = /\/auth\/(login|register|social|refresh)(\?|$)/.test(requestUrl);

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthFlowEndpoint) {
      // Only exclude POST from auto-retry after 401 — retrying a POST risks creating
      // duplicate resources (e.g. double-adding a favorite). PATCH, DELETE, PUT, GET
      // are idempotent and safe to replay after a token refresh.
      const method = (originalRequest.method || 'get').toUpperCase();
      const isSafeToRetry = method !== 'POST';
      if (!isSafeToRetry) {
        // POST is not retried (would create duplicates). Surface a clear error
        // instead of silently rejecting so the UI can show a "Session expired — please log in" message.
        const postAuthError = new Error('AUTH_EXPIRED: your session has expired. Please log in again.');
        (postAuthError as unknown as { isAuthError: boolean }).isAuthError = true;
        return Promise.reject(postAuthError);
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${Config.API_BASE}/auth/refresh`, { refreshToken }, { headers: { 'X-Client': 'mobile' } });
        // M-001: Some refresh responses omit a new refreshToken — don't overwrite
        // the stored one with undefined. Fall back to the existing refresh token.
        const { accessToken } = data.data;
        const newRefresh = data.data.refreshToken || (await tokenStorage.getRefreshToken());
        if (!newRefresh) throw new Error('No refresh token available');
        await tokenStorage.setTokens(accessToken, newRefresh);
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await tokenStorage.clearTokens();
        // Safe navigation — only navigate if router is ready
        if (_onUnauthenticated) {
          _onUnauthenticated();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
export { Config };
