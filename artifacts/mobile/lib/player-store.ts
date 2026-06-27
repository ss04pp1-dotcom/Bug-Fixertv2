import { create } from 'zustand';

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
