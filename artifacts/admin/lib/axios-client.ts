import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { getToken, clearToken } from './auth';
import { API_CONFIG } from './config/api';

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
// D-002 / D-007 fix: refresh-token logic removed entirely.
// This app is statically exported (no server runtime for httpOnly refresh
// cookies), so silently refreshing an expired access token would require
// storing a long-lived refresh token in sessionStorage — an XSS-escalation
// risk. Instead, on 401 we clear the token and redirect to /login.
// Users must re-authenticate when the access token expires.
// ───────────────────────────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>): AxiosResponse<ApiResponse<unknown>> => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      clearToken();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// D-045 fix: typed `response` parameter (was `any`). The runtime behaviour is
// unchanged — we still fall back through `data.data → data → response` because
// some legacy call sites pass already-unwrapped payloads, but the type now
// mirrors the canonical AxiosResponse<ApiResponse<T>> shape.
export function extractData<T>(
  response: { data?: { data?: T } | T } | T,
): T {
  const r = response as { data?: { data?: T } | T };
  const inner = r?.data;
  if (inner && typeof inner === 'object' && 'data' in inner) {
    return (inner as { data: T }).data;
  }
  return (inner as T | undefined) ?? (response as T);
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
