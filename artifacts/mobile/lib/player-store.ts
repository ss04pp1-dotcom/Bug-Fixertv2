import { create } from 'zustand';

export interface PlayerSource {
  url: string;
  headers?: Record<string, string>;
  label?: string;
  quality?: string;
}

// ─── Global Video Player Store ────────────────────────────────────────────────
// Single source of truth for the one-and-only video player instance.
// The GlobalVideoPlayer component reads this and NEVER unmounts its NativeIPTVPlayer
// while mode !== 'hidden'. Transitioning fullscreen ↔ mini only changes layout,
// the underlying ExoPlayer/AVPlayer instance is preserved with no reload.

export type PlayerMode = 'hidden' | 'fullscreen' | 'mini';

export interface GlobalPlayerState {
  mode: PlayerMode;
  sources: PlayerSource[];
  srcIdx: number;
  title: string;
  logo: string;
  contentId: string;
  contentType: 'channel' | 'movie' | 'series';
  isLive: boolean;
  isPlaying: boolean;

  enterFullscreen: (params: {
    sources: PlayerSource[];
    title: string;
    logo?: string;
    contentId: string;
    contentType: 'channel' | 'movie' | 'series';
    isLive?: boolean;
  }) => void;
  enterMini: () => void;
  hide: () => void;
  setPlaying: (v: boolean) => void;
  setSrcIdx: (i: number) => void;
}

export const useGlobalPlayer = create<GlobalPlayerState>((set, get) => ({
  mode: 'hidden',
  sources: [],
  srcIdx: 0,
  title: '',
  logo: '',
  contentId: '',
  contentType: 'channel',
  isLive: false,
  isPlaying: true,

  enterFullscreen: (params) => set({
    mode: 'fullscreen',
    sources: params.sources,
    srcIdx: 0,
    title: params.title,
    logo: params.logo ?? '',
    contentId: params.contentId,
    contentType: params.contentType,
    isLive: params.isLive ?? false,
    isPlaying: true,
  }),

  enterMini: () => {
    if (get().mode === 'fullscreen') set({ mode: 'mini' });
  },

  hide: () => set({ mode: 'hidden', sources: [], srcIdx: 0 }),

  setPlaying: (v) => set({ isPlaying: v }),
  setSrcIdx: (i) => set({ srcIdx: i }),
}));

// ─── Legacy MiniPlayer store (kept for backward compat, no longer drives video) ─
export interface MiniPlayerSource {
  url: string;
  headers?: Record<string, string>;
  label?: string;
}

export interface MiniPlayerState {
  active: boolean;
  title: string;
  logo: string;
  contentId: string;
  contentType: 'channel' | 'movie' | 'series';
  sources: MiniPlayerSource[];
  srcIdx: number;
  isLive: boolean;
  isPlaying: boolean;

  open: (params: {
    title: string;
    logo: string;
    contentId: string;
    contentType: 'channel' | 'movie' | 'series';
    sources: MiniPlayerSource[];
    isLive?: boolean;
  }) => void;
  close: () => void;
  setPlaying: (v: boolean) => void;
  setSrcIdx: (i: number) => void;
}

export const usePlayerStore = create<MiniPlayerState>((set) => ({
  active: false,
  title: '',
  logo: '',
  contentId: '',
  contentType: 'channel',
  sources: [],
  srcIdx: 0,
  isLive: false,
  isPlaying: true,

  open: (params) =>
    set({
      active: true,
      title: params.title,
      logo: params.logo,
      contentId: params.contentId,
      contentType: params.contentType,
      sources: params.sources,
      srcIdx: 0,
      isLive: params.isLive ?? false,
      isPlaying: true,
    }),

  close: () => set({ active: false, sources: [], srcIdx: 0 }),
  setPlaying: (v) => set({ isPlaying: v }),
  setSrcIdx: (i) => set({ srcIdx: i }),
}));
