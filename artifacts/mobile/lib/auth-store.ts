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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  logout: async () => {
    await tokenStorage.clearTokens();
    set({ user: null, isAuthenticated: false });
  },
  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) {
        set({ isLoading: false, user: null, isAuthenticated: false });
        return;
      }
      const response = await apiClient.get('/auth/profile');
      const userData = response.data.data;
      const user: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar: userData.avatar,
        plan: userData.isPremium ? (userData.subscription?.plan?.name || 'premium') : 'free',
      };
      set({ isLoading: false, user, isAuthenticated: true });
    } catch {
      await tokenStorage.clearTokens();
      set({ isLoading: false, user: null, isAuthenticated: false });
    }
  },
  updateUser: async (data: Partial<User>) => {
    try {
      const response = await apiClient.put('/auth/profile', data);
      const userData = response.data.data;
      const user: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar: userData.avatar,
        plan: userData.isPremium ? (userData.subscription?.plan?.name || 'premium') : 'free',
      };
      set({ user });
    } catch (err) {
      if (__DEV__) console.warn('[auth-store] Profile update failed:', err instanceof Error ? err.message : err);
      throw err;
    }
  },
  refreshProfile: async () => {
    try {
      const response = await apiClient.get('/auth/profile');
      const userData = response.data.data;
      const user: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar: userData.avatar,
        plan: userData.isPremium ? (userData.subscription?.plan?.name || 'premium') : 'free',
      };
      set({ user, isAuthenticated: true });
    } catch (err) {
      if (__DEV__) console.warn('[auth-store] Profile refresh failed:', err instanceof Error ? err.message : err);
    }
  },
}));