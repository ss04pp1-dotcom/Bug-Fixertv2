import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { getToken, setToken, clearToken, getRefreshToken, setRefreshToken } from './auth';
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

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

function drainQueue(token: string | null, error: unknown = null): void {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>): AxiosResponse<ApiResponse<unknown>> => {
    return response;
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          if (original.headers) original.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();

        // FIX: Production তে refreshToken null কারণ httpOnly cookie use হয়।
        // Cookie automatically browser দ্বারা send হয় withCredentials:true দিলে।
        // Development তে sessionStorage থেকে body তে পাঠাই।
        if (!refreshToken && process.env.NODE_ENV === 'development') {
          throw new Error('No refresh token');
        }
        const requestBody = refreshToken ? { refreshToken } : {};

        const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
          `${API_CONFIG.BASE_URL}/v1/auth/refresh`,
          requestBody,
          { withCredentials: true },
        );

        const newToken = data.data.accessToken;
        setToken(newToken);

        if (data.data.refreshToken) {
          setRefreshToken(data.data.refreshToken);
        }

        drainQueue(newToken);
        if (original.headers) original.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(original);
      } catch (refreshError) {
        drainQueue(null, refreshError);
        clearToken();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export function extractData<T>(response: any): T {
  return response?.data?.data ?? response?.data ?? response;
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
