import { create } from 'zustand';

export interface PlayerSource {
  url: string;
  headers?: Record<string, string>;
  label?: string;
  quality?: string;
  cookieExpired?: boolean;
  cookieExpiresAt?: string | null;
}

export interface NextEpisodeInfo {
  title: string;
  epNumber: number;
  onPlay: () => void;
  onDismiss: () => void;
}

export type PlayerMode = 'hidden' | 'mini' | 'fullscreen' | 'top';

interface OpenParams {
  title: string;
  logo: string;
  contentId: string;
  contentType: 'channel' | 'movie' | 'series';
  sources: PlayerSource[];
  isLive?: boolean;
  startInTop?: boolean;
  /** Route to navigate back to when the mini player is tapped (YouTube-like). */
  playerRoute?: string;
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
  nextEpisode: NextEpisodeInfo | null;
  /** Route to navigate back to when the mini player expand button is tapped. */
  playerRoute: string | null;

  open: (params: OpenParams) => void;
  enterMini: () => void;
  enterTop: () => void;
  expand: () => void;
  hide: () => void;
  setPlaying: (v: boolean) => void;
  setSrcIdx: (i: number) => void;
  setSources: (s: PlayerSource[]) => void;
  setNextEpisode: (ep: NextEpisodeInfo | null) => void;
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
  nextEpisode: null,
  playerRoute: null,

  open: (p) =>
    set({
      mode: p.startInTop ? 'top' : 'fullscreen',
      title: p.title,
      logo: p.logo,
      contentId: p.contentId,
      contentType: p.contentType,
      sources: p.sources,
      srcIdx: 0,
      isLive: p.isLive ?? false,
      isPlaying: true,
      nextEpisode: null,
      playerRoute: p.playerRoute ?? null,
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
      nextEpisode: null,
    }),

  setPlaying: (v) => set({ isPlaying: v }),
  setSrcIdx: (i) =>
    set((s) => ({ srcIdx: Math.max(0, Math.min(s.sources.length - 1, i)) })),
  setSources: (sources) => set({ sources, srcIdx: 0 }),
  setNextEpisode: (ep) => set({ nextEpisode: ep }),
}));

export const usePlayerStore = useGlobalPlayer;
