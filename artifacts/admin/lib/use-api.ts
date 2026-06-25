
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { apiClient, extractData, getApiErrorMessage, ApiResponse } from './axios-client';

// ─── Generic typed GET hook via React Query ──────────────────────────────────

export function useApiQuery<T>(
  key: unknown[],
  path: string,
  options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<T>>(path);
      return extractData(res);
    },
    ...options,
  });
}

// ─── Generic typed mutation hook ─────────────────────────────────────────────

type MutationMethod = 'post' | 'put' | 'patch' | 'delete';

export function useApiMutation<TData = unknown, TVariables = unknown>(
  method: MutationMethod,
  path: string | ((variables: TVariables) => string),
  options?: UseMutationOptions<TData, Error, TVariables>,
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      const url    = typeof path === 'function' ? path(variables) : path;
      const hasBody = method !== 'delete';
      const res    = await apiClient[method]<ApiResponse<TData>>(
        url,
        hasBody ? variables : undefined,
      );
      return extractData(res);
    },
    ...options,
  });
}

// ─── Imperative call hook — dynamic method+url per call ──────────────────────

export function useApiCallState() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const call = async (method: MutationMethod, url: string, body?: unknown) => {
    setLoading(true);
    try {
      const hasBody = method !== 'delete';
      const res = await apiClient[method]<ApiResponse<unknown>>(
        url,
        hasBody ? body : undefined,
      );
      return extractData(res);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { call, loading, error };
}

// ─── Invalidate helpers ───────────────────────────────────────────────────────

export function useInvalidate() {
  const queryClient = useQueryClient();
  return (key: unknown[]) => queryClient.invalidateQueries({ queryKey: key });
}

// ─── Error message extractor ─────────────────────────────────────────────────

export { getApiErrorMessage };

// ─── Legacy compat shim — keeps existing pages working while migrating ────────

export function useApi<T = unknown>(path: string | null) {
  return useApiQuery<T>(
    path ? [path] : ['__null__'],
    path ?? '',
    { enabled: path !== null },
  );
}
