import { create } from 'zustand';

export interface PlayerSource {
  url: string;
  headers?: Record<string, string>;
  label?: string;
  quality?: string;
  cookieExpired?: boolean;
  cookieExpiresAt?: string | null;
}

export type PlayerMode = 'hidden' | 'mini' | 'fullscreen' | 'top';

interface OpenParams {
  title: string;
  logo: string;
  contentId: string;
  contentType: 'channel' | 'movie' | 'series';
  sources: PlayerSource[];
  isLive?: boolean;
  startInMini?: boolean;
  startInTop?: boolean;
}

interface GlobalPlayerState {
  mode: PlayerMode;
  sources: PlayerSource[];
  srcIdx: number;
  title: string;
  logo: string;
  contentId: string;
  contentType: 'channel' | 'movie' | 'series';
  isLive: boolean;
  isPlaying: boolean;

  open: (params: OpenParams) => void;
  enterMini: () => void;
  enterTop: () => void;
  expand: () => void;
  hide: () => void;
  setPlaying: (v: boolean) => void;
  setSrcIdx: (i: number) => void;
  setSources: (s: PlayerSource[]) => void;
}

export const useGlobalPlayer = create<GlobalPlayerState>((set) => ({
  mode: 'hidden',
  sources: [],
  srcIdx: 0,
  title: '',
  logo: '',
  contentId: '',
  contentType: 'channel',
  isLive: false,
  isPlaying: true,

  open: (p) =>
    set({
      mode: p.startInTop ? 'top' : p.startInMini ? 'mini' : 'fullscreen',
      title: p.title,
      logo: p.logo,
      contentId: p.contentId,
      contentType: p.contentType,
      sources: p.sources,
      srcIdx: 0,
      isLive: p.isLive ?? false,
      isPlaying: true,
    }),

  enterMini: () => set({ mode: 'mini' }),
  enterTop: () => set({ mode: 'top' }),
  expand: () => set({ mode: 'fullscreen' }),
  hide: () =>
    set({
      mode: 'hidden',
      sources: [],
      srcIdx: 0,
      title: '',
      logo: '',
      contentId: '',
      isPlaying: false,
    }),

  setPlaying: (v) => set({ isPlaying: v }),
  setSrcIdx: (i) =>
    set((s) => ({ srcIdx: Math.max(0, Math.min(s.sources.length - 1, i)) })),
  setSources: (sources) => set({ sources, srcIdx: 0 }),
}));

export const usePlayerStore = useGlobalPlayer;
