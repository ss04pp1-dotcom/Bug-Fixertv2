/**
 * Unified Global Player Store
 *
 * ONE store, ONE Video instance. The player lives at the _layout level
 * and NEVER unmounts during mini ↔ fullscreen transitions.
 * Only the wrapper layout changes — ExoPlayer/AVPlayer keeps playing.
 */
import { create } from 'zustand';

export interface PlayerSource {
  url: string;
  headers?: Record<string, string>;
  label?: string;
  quality?: string;
  cookieExpired?: boolean;
  cookieExpiresAt?: string | null;
}

export type PlayerMode = 'hidden' | 'mini' | 'fullscreen';

interface OpenParams {
  title: string;
  logo: string;
  contentId: string;
  contentType: 'channel' | 'movie' | 'series';
  sources: PlayerSource[];
  isLive?: boolean;
  /** caller can request to start in mini mode (e.g. "play in background") */
  startInMini?: boolean;
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

  /** open + auto enter fullscreen (or mini if startInMini) */
  open: (params: OpenParams) => void;
  /** shrink to corner — Video keeps playing, NO reload */
  enterMini: () => void;
  /** expand corner back to fullscreen — Video keeps playing, NO reload */
  expand: () => void;
  /** fully hide + clear sources (called on close button) */
  hide: () => void;
  setPlaying: (v: boolean) => void;
  setSrcIdx: (i: number) => void;
  /** replace sources for the SAME content (e.g. server refresh) without changing mode */
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
      mode: p.startInMini ? 'mini' : 'fullscreen',
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

// Back-compat: old code that imports usePlayerStore still works.
// It just reads the same singleton.
export const usePlayerStore = useGlobalPlayer;
