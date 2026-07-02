import { create } from 'zustand';
import apiClient from './api';
import { tokenStorage } from './api';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function mapUserData(userData: any): User {
  return {
    id: userData.id,
    name: userData.name,
    email: userData.email,
    avatar: userData.avatar,
    plan: userData.isPremium ? (userData.subscription?.plan?.name || 'premium') : 'free',
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: async () => {
    await tokenStorage.clearTokens();
    // Also reset isLoading so a concurrent checkAuth can't leave the store stuck
    set({ user: null, isAuthenticated: false, isLoading: false });
  },
  checkAuth: async () => {
    // Guard: skip if already in progress to avoid race conditions from concurrent calls
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        set({ isLoading: false, user: null, isAuthenticated: false });
        return;
      }
      const response = await apiClient.get('/auth/profile');
      const user = mapUserData(response.data.data);
      set({ isLoading: false, user, isAuthenticated: true });
    } catch (err: unknown) {
      // Re-throw so callers (e.g. splash) can distinguish network vs auth errors.
      // Only clear tokens for explicit auth rejections (HTTP 401/403); leave them
      // intact for network timeouts so offline users stay logged in.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        await tokenStorage.clearTokens();
        set({ isLoading: false, user: null, isAuthenticated: false });
      } else {
        // Network/server error — preserve tokens, mark unauthenticated for now
        set({ isLoading: false, user: null, isAuthenticated: false });
      }
      throw err; // let callers branch on network vs auth failure
    }
  },
  updateUser: async (data: Partial<User>) => {
    try {
      const response = await apiClient.put('/auth/profile', data);
      const user = mapUserData(response.data.data);
      set({ user });
    } catch (err) {
      if (__DEV__) console.warn('[auth-store] Profile update failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
  refreshProfile: async () => {
    try {
      const response = await apiClient.get('/auth/profile');
      const user = mapUserData(response.data.data);
      set({ user, isAuthenticated: true });
    } catch (err) {
      if (__DEV__) console.warn('[auth-store] Profile refresh failed:', err instanceof Error ? err.message : err);
    }
  },
}));