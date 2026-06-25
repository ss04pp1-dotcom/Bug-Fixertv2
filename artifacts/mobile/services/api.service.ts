import apiClient from '../lib/api';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
  deviceName?: string;
  deviceType?: string;
  platform?: string;
}

export interface RegisterPayload {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  country?: string;
}

const AuthService = {
  login: (data: LoginPayload) =>
    apiClient.post<{ data: { user: unknown; accessToken: string; refreshToken: string } }>('/auth/login', data),

  register: (data: RegisterPayload) =>
    apiClient.post<{ data: { user: unknown } & AuthTokens }>('/auth/register', data),

  logout: () => apiClient.post('/auth/logout'),

  forgotPassword: (identifier: string) =>
    apiClient.post('/auth/forgot-password', { identifier }),

  verifyOtp: (identifier: string, code: string, type = 'forgot_password') =>
    apiClient.post('/auth/verify-otp', { identifier, code, type }),

  resetPassword: (identifier: string, otpCode: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { identifier, otpCode, newPassword }),

  getProfile: () =>
    apiClient.get<{ data: unknown }>('/auth/profile'),

  updateProfile: (data: { name?: string; email?: string; phone?: string; language?: string; country?: string; avatar?: string }) =>
    apiClient.patch('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }),

  getSessions: () =>
    apiClient.get('/auth/sessions'),

  revokeSession: (sessionId: string) =>
    apiClient.delete(`/auth/sessions/${sessionId}`),

  socialLogin: (provider: string, accessToken: string, email?: string, name?: string) =>
    apiClient.post<{ data: unknown & AuthTokens }>('/auth/social', { provider, accessToken, email, name }),
};

const ContentService = {
  getMovies: (params?: Record<string, unknown>) => apiClient.get('/movies', { params }),
  getMovie: (id: string) => apiClient.get(`/movies/${id}`),
  getMovieTrending: () => apiClient.get('/movies/trending'),
  getMovieFeatured: () => apiClient.get('/movies/featured'),

  getSeries: (params?: Record<string, unknown>) => apiClient.get('/series', { params }),
  getSeriesById: (id: string) => apiClient.get(`/series/${id}`),

  getChannels: (params?: Record<string, unknown>) => apiClient.get('/channels', { params }),
  getChannel: (id: string) => apiClient.get(`/channels/${id}`),

  getCategories: () => apiClient.get('/categories'),

  getBanners: () => apiClient.get('/banners'),

  search: (q: string) => apiClient.get('/search', { params: { q } }),
  getSearchHistory: () => apiClient.get('/search/history'),
  clearSearchHistory: () => apiClient.delete('/search/history'),
  getTrending: () => apiClient.get('/search/trending'),
};

const UserService = {
  getWatchHistory: () => apiClient.get('/watch-history'),
  addWatchHistory: (data: { contentType: string; contentId: string; progress?: number }) =>
    apiClient.post('/watch-history', data),

  getFavorites: () => apiClient.get('/favorites'),
  toggleFavorite: (data: { type: string; id: string }) =>
    apiClient.post('/favorites', data),
  removeFavorite: (type: string, id: string) =>
    apiClient.delete(`/favorites/${type}/${id}`),

  getDownloads: () => apiClient.get('/downloads'),
  addDownload: (data: unknown) => apiClient.post('/downloads', data),
  removeDownload: (id: string) => apiClient.delete(`/downloads/${id}`),

  getNotifications: () => apiClient.get('/notifications/user'),
  markRead: (id: string) => apiClient.patch(`/notifications/user/${id}/read`),
  markAllRead: () => apiClient.patch('/notifications/user/read-all'),

  getAnnouncements: () => apiClient.get('/announcements'),

  getParentalControl: () => apiClient.get('/parental-control'),
  updateParentalControl: (data: unknown) => apiClient.put('/parental-control', data),
  verifyParentalPin: (pin: string) => apiClient.post('/parental-control/verify-pin', { pin }),
};

const SubscriptionService = {
  getPlans: () => apiClient.get('/subscriptions/plans'),
  getMySubscription: () => apiClient.get('/subscriptions/me'),
  subscribe: (planId: string, paymentRef?: string) =>
    apiClient.post('/subscriptions', { planId, paymentReference: paymentRef }),
  verifyPayment: (data: unknown) => apiClient.post('/subscriptions/verify', data),
  cancel: () => apiClient.delete('/subscriptions/me'),
};

const SupportService = {
  getTickets: () => apiClient.get('/support/tickets'),
  createTicket: (data: { subject: string; message: string; category?: string }) =>
    apiClient.post('/support/tickets', data),
  replyTicket: (id: string, message: string) =>
    apiClient.post(`/support/tickets/${id}/messages`, { message }),
  getFAQs: () => apiClient.get('/support/faq'),
};

const SportService = {
  getMatches: (params?: Record<string, unknown>) => apiClient.get('/sports/matches', { params }),
  getMatch: (id: string) => apiClient.get(`/sports/matches/${id}`),
  getMatchCommentary: (id: string) => apiClient.get(`/sports/matches/${id}/commentary`),
  setAlert: (matchId: string) => apiClient.post(`/sports/matches/${matchId}/alerts`),
  removeAlert: (matchId: string) => apiClient.delete(`/sports/matches/${matchId}/alerts`),
};

const ReviewService = {
  getReviews: (contentType: string, contentId: string) =>
    apiClient.get('/reviews', { params: { contentType, contentId } }),
  createReview: (data: { contentType: string; contentId: string; rating: number; title?: string; comment?: string }) =>
    apiClient.post('/reviews', data),
  deleteReview: (id: string) => apiClient.delete(`/reviews/${id}`),
};

const EpgService = {
  getEPG: (params?: Record<string, unknown>) => apiClient.get('/epg', { params }),
  getCurrentPrograms: () => apiClient.get('/epg/now'),
};

export {
  AuthService,
  ContentService,
  UserService,
  SubscriptionService,
  SupportService,
  SportService,
  ReviewService,
  EpgService,
};
