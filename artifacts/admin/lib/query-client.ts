import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          5 * 60 * 1000,
      gcTime:             10 * 60 * 1000,
      // D-052 fix: don't silently retry on responses that will never succeed
      // (auth / permission / not-found). For everything else, retry once.
      retry: (failureCount: number, error: any) => {
        const status = error?.response?.status;
        if ([401, 403, 404].includes(status)) return false;
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
