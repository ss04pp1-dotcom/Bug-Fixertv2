import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import apiClient from './api';

// ─── Response helpers ─────────────────────────────────────────────────────────
// API wraps all responses: { success, data, errors }
// Paginated list responses: { success, data: { data: [...], meta: {...} } }
// Single-object responses:  { success, data: { id, ... } }
//
// `unwrap`     → returns r.data.data (for single objects / non-paginated lists)
// `unwrapList` → returns the inner array from a paginated response, or falls back
//                to the raw value so non-paginated endpoints still work
const unwrap = (r: any) => r.data.data;
const unwrapList = (r: any) => {
  const d = r.data.data;
  if (d && Array.isArray(d.data)) return d.data;   // paginated: { data:[...], meta:{} }
  if (Array.isArray(d)) return d;                   // already an array
  return d ?? [];
};

// Auth
export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: () => apiClient.get('/auth/profile').then(unwrap) });

// Home
export const useBanners = () => useQuery({ queryKey: ['banners'], queryFn: () => apiClient.get('/banners/active').then(unwrapList) });
export const useContinueWatching = () => useQuery({ queryKey: ['continue-watching'], queryFn: () => apiClient.get('/watch-history/continue-watching').then(unwrapList) });
export const useTrending = () => useQuery({ queryKey: ['trending'], queryFn: () => apiClient.get('/movies/trending').then(unwrapList) });
export const useLiveChannels = (params?: object) => useQuery({ queryKey: ['channels', params], queryFn: () => apiClient.get('/channels', { params: { limit: 200, ...params as any } }).then(unwrapList) });

// Infinite-scroll version — loads 50 channels per page from the server.
// Pass `search` to do server-side full-text search across ALL channels.
export const useLiveChannelsInfinite = (params?: { search?: string; limit?: number }) =>
  useInfiniteQuery({
    queryKey: ['channels-infinite', params],
    queryFn: ({ pageParam }) =>
      apiClient
        .get('/channels', { params: { page: pageParam, limit: params?.limit ?? 50, ...(params?.search ? { search: params.search } : {}) } })
        .then((r: any) => {
          const d = r.data.data;
          const items: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
          const meta = d?.meta ?? { page: pageParam, totalPages: 1, total: items.length };
          return { items, meta };
        }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      const { page, totalPages } = lastPage.meta;
      return page < totalPages ? page + 1 : undefined;
    },
  });
export const useChannel = (id: string) => useQuery({ queryKey: ['channel', id], queryFn: () => apiClient.get(`/channels/${id}`).then(unwrap), enabled: !!id });

// Categories
export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => apiClient.get('/categories').then(unwrapList) });

// Content
export const useMovie = (id: string) => useQuery({ queryKey: ['movie', id], queryFn: () => apiClient.get(`/movies/${id}`).then(unwrap), enabled: !!id });
export const useMovies = (params?: object) => useQuery({ queryKey: ['movies', params], queryFn: () => apiClient.get('/movies', { params }).then(unwrapList) });
export const useSeries = (id: string) => useQuery({ queryKey: ['series', id], queryFn: () => apiClient.get(`/series/${id}`).then(unwrap), enabled: !!id });
export const useSeriesList = (params?: object) => useQuery({ queryKey: ['series', params], queryFn: () => apiClient.get('/series', { params }).then(unwrapList) });

// EPG
export const useEPG = (params?: object) => useQuery({ queryKey: ['epg', params], queryFn: () => apiClient.get('/epg', { params }).then(unwrapList) });

// Favorites
export const useFavorites = () => useQuery({ queryKey: ['favorites'], queryFn: () => apiClient.get('/favorites').then(unwrapList) });
export const useToggleFavorite = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id, action }: { type: 'channel' | 'movie' | 'series'; id: string; action?: 'add' | 'remove' }) => {
      const body =
        type === 'channel' ? { channelId: id } :
        type === 'movie'   ? { movieId: id }   :
                             { seriesId: id };
      return action === 'remove'
        ? apiClient.delete('/favorites', { data: body })
        : apiClient.post('/favorites', body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });
};

// Search
export const useSearch = (query: string) => useQuery({ queryKey: ['search', query], queryFn: () => apiClient.get('/search', { params: { q: query } }).then(unwrapList), enabled: query.length > 0 });

// Subscriptions
export const useSubscriptionPlans = () => useQuery({ queryKey: ['subscription-plans'], queryFn: () => apiClient.get('/subscriptions/plans').then(unwrapList) });
export const useMySubscription = () => useQuery({ queryKey: ['my-subscription'], queryFn: () => apiClient.get('/subscriptions/me').then(unwrap) });

// Notifications
// FIX: user notifications endpoint is '/notifications/user' not '/notifications' (that's admin-only)
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => apiClient.get('/notifications/user').then(unwrapList) });
export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/user/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};
export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post('/notifications/user/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
};

// Announcements
export const useAnnouncements = () => useQuery({ queryKey: ['announcements'], queryFn: () => apiClient.get('/announcements/active').then(unwrapList) });

// Settings
// M-024: Use the user's own preference endpoint instead of the admin `/settings` route.
// NOTE: backend may not yet expose `/auth/profile/preferences` — fall back gracefully in UI.
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => apiClient.get('/auth/profile/preferences').then(unwrap) });
export const useUpdateSetting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; value: unknown }) => apiClient.put('/auth/profile/preferences', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });
};

// Support
export const useCreateTicket = () => useMutation({
  mutationFn: (data: { subject: string; message: string }) =>
    apiClient.post('/support', { subject: data.subject, description: data.message }),
});

// Geo-check — server reads CF-IPCountry header; falls back to unblocked if header absent
export const useGeoCheck = () => useQuery({ queryKey: ['geo-check'], queryFn: () => apiClient.get('/geo-block/check/auto').then(unwrap), retry: false });

// Force update — correct path is /force-update/check
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const useForceUpdate = () => useQuery({ queryKey: ['force-update'], queryFn: () => apiClient.get('/force-update/check', { params: { version: APP_VERSION, platform: Platform.OS } }).then(unwrap), retry: false });

// Feature flags
export const useFeatureFlags = () => useQuery({ queryKey: ['feature-flags'], queryFn: () => apiClient.get('/feature-flags/enabled').then(unwrapList) });

// Stream URL — with full source/server list
export const useStreamUrl = (type: 'movie' | 'channel', id: string) => useQuery({
  queryKey: ['stream', type, id],
  queryFn: () => apiClient.get(`/${type === 'movie' ? 'movies' : 'channels'}/${id}/stream`).then(unwrap),
  enabled: !!id,
});

// Related content
export const useRelatedMovies = (id: string) => useQuery({
  queryKey: ['related', 'movies', id],
  queryFn: () => apiClient.get(`/movies/${id}/related`, { params: { limit: 12 } }).then(unwrapList),
  enabled: !!id,
  retry: 1,
});

export const useRecommendations = (type: 'movie' | 'series', id: string) => useQuery({
  queryKey: ['recommendations', type, id],
  queryFn: () => apiClient.get(`/${type === 'movie' ? 'movies' : 'series'}/${id}/related`, { params: { limit: 12 } }).then(unwrapList),
  enabled: !!id,
  retry: 1,
});

// Watch history (save progress)
export const useSaveWatchProgress = () => useMutation({
  mutationFn: (data: { contentType: string; contentId: string; progress: number; duration?: number }) =>
    apiClient.post('/watch-history', data),
});

// ─── Sports ──────────────────────────────────────────────────
export const useLiveMatches = (sportId?: string) => useQuery({
  queryKey: ['sports', 'live', sportId],
  queryFn: () => apiClient.get('/sports/live', { params: sportId ? { sportId } : {} }).then(unwrapList),
});

export const useUpcomingMatches = (params?: { sportId?: string; limit?: number }) => useQuery({
  queryKey: ['sports', 'upcoming', params],
  queryFn: () => apiClient.get('/sports/upcoming', { params }).then(unwrapList),
});

export const useMatches = (params?: { sportId?: string; status?: string; tournamentId?: string; page?: number; search?: string }) => useQuery({
  queryKey: ['sports', 'matches', params],
  queryFn: () => apiClient.get('/sports', { params }).then(unwrapList),
});

export const useMatch = (id: string) => useQuery({
  queryKey: ['sports', 'match', id],
  queryFn: () => apiClient.get(`/sports/${id}`).then(unwrap),
  enabled: !!id,
});

export const useMatchCommentary = (matchId: string, page?: number) => useQuery({
  queryKey: ['sports', 'commentary', matchId, page],
  queryFn: () => apiClient.get(`/sports/${matchId}/commentary`, { params: { page: page || 1, limit: 50 } }).then(unwrapList),
  enabled: !!matchId,
});

export const useMatchAlerts = () => useQuery({
  queryKey: ['sports', 'my-alerts'],
  queryFn: () => apiClient.get('/sports/matches/my-alerts').then(unwrapList),
});

export const useToggleMatchAlert = () => {
  const qc = useQueryClient();
  return useMutation({
    // M-007: support both add (POST) and remove (DELETE) actions
    mutationFn: ({ matchId, action }: { matchId: string; action: 'add' | 'remove' }) =>
      action === 'remove'
        ? apiClient.delete(`/sports/matches/${matchId}/alert`)
        : apiClient.post(`/sports/matches/${matchId}/alert`),
    // M-048: invalidate both the alerts list and the individual match query
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['sports', 'my-alerts'] });
      qc.invalidateQueries({ queryKey: ['sports', 'match'] });
      qc.invalidateQueries({ queryKey: ['sports', 'match', variables.matchId] });
    },
  });
};

export const useSportsTeams = (params?: { sportId?: string; tournamentId?: string }) => useQuery({
  queryKey: ['sports', 'teams', params],
  queryFn: () => apiClient.get('/sports/teams', { params }).then(unwrapList),
});

export const useSportsTournaments = (params?: { sportId?: string }) => useQuery({
  queryKey: ['sports', 'tournaments', params],
  queryFn: () => apiClient.get('/sports/tournaments', { params }).then(unwrapList),
});

export const useMyTeams = () => useQuery({
  queryKey: ['sports', 'my-teams'],
  queryFn: () => apiClient.get('/sports/my-teams').then(unwrapList),
});

export const useToggleFavoriteTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, action }: { teamId: string; action: 'add' | 'remove' }) =>
      action === 'add' ? apiClient.post(`/sports/my-teams/${teamId}`) : apiClient.delete(`/sports/my-teams/${teamId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sports', 'my-teams'] }); },
  });
};

// ─── Downloads ───────────────────────────────────────────────
export const useDownloads = (params?: { status?: string; contentType?: string; page?: number }) => useQuery({
  queryKey: ['downloads', params],
  queryFn: () => apiClient.get('/downloads', { params }).then(unwrapList),
});

export const useDownloadStats = () => useQuery({
  queryKey: ['downloads', 'stats'],
  queryFn: () => apiClient.get('/downloads/stats').then(unwrap),
});

export const useCreateDownload = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { contentType: string; contentId: string; title: string; poster?: string; streamUrl: string; quality?: string }) =>
      apiClient.post('/downloads', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['downloads'] }),
  });
};

export const useUpdateDownload = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; progress?: number; status?: string; filePath?: string; fileSize?: number }) =>
      apiClient.put(`/downloads/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['downloads'] }),
  });
};

export const useDeleteDownload = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/downloads/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['downloads'] }),
  });
};

export const useClearCompletedDownloads = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete('/downloads/clear-completed'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['downloads'] }),
  });
};

// ─── Reviews ─────────────────────────────────────────────────
export const useReviews = (contentType: string, contentId: string) => useQuery({
  queryKey: ['reviews', contentType, contentId],
  queryFn: () => apiClient.get('/reviews', { params: { contentType, contentId } }).then(unwrapList),
  enabled: !!contentType && !!contentId,
});

export const useReviewStats = (contentType: string, contentId: string) => useQuery({
  queryKey: ['reviews', 'stats', contentType, contentId],
  queryFn: () => apiClient.get(`/reviews/stats/${contentType}/${contentId}`).then(unwrap),
  enabled: !!contentType && !!contentId,
});

export const useCreateReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { contentType: string; contentId: string; rating: number; title?: string; comment?: string }) =>
      apiClient.post('/reviews', data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['reviews', variables.contentType, variables.contentId] });
      qc.invalidateQueries({ queryKey: ['reviews', 'stats', variables.contentType, variables.contentId] });
    },
  });
};

export const useDeleteReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/reviews/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews'] }),
  });
};

// ─── Parental Control ────────────────────────────────────────
export const useParentalControl = () => useQuery({
  queryKey: ['parental-control'],
  queryFn: () => apiClient.get('/parental-control').then(unwrap),
});

export const useUpdateParentalControl = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { pin?: string; maxAgeRating?: string; restrictedCategories?: string[]; isEnabled?: boolean }) =>
      apiClient.put('/parental-control', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parental-control'] }),
  });
};

export const useVerifyParentalPin = () => useMutation({
  mutationFn: (pin: string) => apiClient.post('/parental-control/verify-pin', { pin }),
});

// ─── Public Settings ──────────────────────────────────────────────────────────
// Fetches all settings marked isPublic=true — no auth required.
// Returns a key→value map for easy lookup.
export const usePublicSettings = () => useQuery({
  queryKey: ['public-settings'],
  queryFn: async () => {
    const r = await apiClient.get('/settings/public');
    const list: { key: string; value: any }[] = r.data?.data ?? [];
    return list.reduce((acc: Record<string, any>, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, any>);
  },
  staleTime: 1000 * 60 * 10,
  retry: false,
});
