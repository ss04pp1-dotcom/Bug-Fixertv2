import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  THEME: 'app_theme',
  LANGUAGE: 'app_language',
  PLAYER_QUALITY: 'player_quality',
  PLAYER_AUTOPLAY: 'player_autoplay',
  LAST_WATCHED: 'last_watched',
  SEARCH_HISTORY: 'search_history',
  ONBOARDING_DONE: 'onboarding_done',
} as const;

async function get<T>(key: string): Promise<T | null> {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

async function set<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

export const StorageService = {
  getTheme: () => get<'light' | 'dark' | 'system'>(KEYS.THEME),
  setTheme: (t: 'light' | 'dark' | 'system') => set(KEYS.THEME, t),

  getLanguage: () => get<string>(KEYS.LANGUAGE),
  setLanguage: (lang: string) => set(KEYS.LANGUAGE, lang),

  getPlayerQuality: () => get<string>(KEYS.PLAYER_QUALITY),
  setPlayerQuality: (q: string) => set(KEYS.PLAYER_QUALITY, q),

  getAutoplay: () => get<boolean>(KEYS.PLAYER_AUTOPLAY),
  setAutoplay: (v: boolean) => set(KEYS.PLAYER_AUTOPLAY, v),

  getLastWatched: () => get<Array<{ id: string; type: string; progress: number; timestamp: number }>>(KEYS.LAST_WATCHED),
  addLastWatched: async (item: { id: string; type: string; progress: number }) => {
    const list = (await get<Array<{ id: string; type: string; progress: number; timestamp: number }>>(KEYS.LAST_WATCHED)) ?? [];
    const filtered = list.filter(i => !(i.id === item.id && i.type === item.type));
    await set(KEYS.LAST_WATCHED, [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 50));
  },
  clearLastWatched: () => remove(KEYS.LAST_WATCHED),

  getLocalSearchHistory: () => get<string[]>(KEYS.SEARCH_HISTORY),
  addLocalSearch: async (query: string) => {
    const history = (await get<string[]>(KEYS.SEARCH_HISTORY)) ?? [];
    const unique = [query, ...history.filter(h => h !== query)].slice(0, 20);
    await set(KEYS.SEARCH_HISTORY, unique);
  },
  clearLocalSearchHistory: () => remove(KEYS.SEARCH_HISTORY),

  isOnboardingDone: () => get<boolean>(KEYS.ONBOARDING_DONE),
  setOnboardingDone: () => set(KEYS.ONBOARDING_DONE, true),

  clearAll: async () => {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};
