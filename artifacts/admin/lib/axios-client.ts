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
