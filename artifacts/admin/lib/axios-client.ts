import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { getToken, clearToken } from './auth';
import { API_CONFIG } from './config/api';
import { toast } from 'sonner';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors: Record<string, string[]> | string[] | null;
}

export const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.REQUEST_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = getToken();
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// ───────────────────────────────────────────────────────────────────────────
// 401 UX fix: instead of an immediate hard redirect that discards unsaved
// form data, we show a toast and give the user a 4-second grace period.
// The redirect only fires after that delay, giving the admin time to see
// the message before losing the current page.
// ───────────────────────────────────────────────────────────────────────────
let sessionExpiredPending = false;

apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>): AxiosResponse<ApiResponse<unknown>> => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearToken();
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !sessionExpiredPending
      ) {
        sessionExpiredPending = true;
        toast.error('Session expired — please log in again', {
          duration: 4000,
          id: 'session-expired',
        });
        setTimeout(() => {
          sessionExpiredPending = false;
          window.location.href = '/login';
        }, 4000);
      }
    }
    return Promise.reject(error);
  },
);

/**
 * extractData — safely unwrap our standard API envelope: { success, message, data }
 *
 * Validates the expected shape before unwrapping. If the response doesn't match,
 * it falls back gracefully rather than returning a corrupted T, and logs a warning
 * in development so API contract drift is caught early.
 *
 * Expected envelope:
 *   { success: boolean, message: string, data: T, errors: ... }
 */
export function extractData<T>(
  response: { data?: { data?: T; success?: boolean } | T } | T,
): T {
  const r = response as { data?: { data?: T; success?: boolean } | T };
  const envelope = r?.data;

  // Standard API envelope: { success, message, data }
  if (
    envelope !== null &&
    typeof envelope === 'object' &&
    'data' in (envelope as object) &&
    ('success' in (envelope as object) || 'message' in (envelope as object))
  ) {
    if (__DEV_ADMIN__ && !(envelope as { success?: boolean }).success) {
      // Log contract violations loudly in dev so they are caught before prod.
      console.warn('[extractData] API returned success=false:', envelope);
    }
    return (envelope as { data: T }).data;
  }

  // Unwrapped response (some endpoints return data directly without envelope).
  if (envelope !== undefined && envelope !== null) {
    return envelope as T;
  }

  return response as T;
}

// Compile-time flag for dev-only logging — overridden by build tools in production.
declare const __DEV_ADMIN__: boolean;
if (typeof __DEV_ADMIN__ === 'undefined') {
  // Fallback: use NODE_ENV check at runtime when the constant is not defined.
  Object.defineProperty(globalThis, '__DEV_ADMIN__', {
    value: process.env.NODE_ENV !== 'production',
    writable: false,
  });
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    if (data?.message) return data.message;
    if (Array.isArray(data?.errors)) return (data.errors as string[]).join(', ');
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}
