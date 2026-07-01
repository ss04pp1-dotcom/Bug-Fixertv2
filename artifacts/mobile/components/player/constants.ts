import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  (Constants as any).executionEnvironment === 'storeClient';

export const IS_WEB = Platform.OS === 'web';

export const C = {
  bg: '#050510', card: '#0D0D1A', primary: '#8B5CF6', accent: '#EC4899',
  live: '#EF4444', text: '#FFFFFF', dim: '#9CA3AF',
  border: 'rgba(255,255,255,0.1)', green: '#10B981',
};

// Tuned for smooth, uninterrupted IPTV playback: the player keeps a larger
// safety margin of buffered media so short network dips (typical on mobile
// data / weak wifi) are absorbed silently instead of surfacing as a visible
// rebuffer. Start latency is controlled separately by bufferForPlaybackMs,
// so raising minBufferMs/maxBufferMs improves in-playback smoothness without
// slowing down channel switches.
export const BUFFER_LIVE = {
  minBufferMs:                    25_000,   // keep 25s minimum buffer at all times — absorbs brief network drops
  maxBufferMs:                    90_000,   // bank up to 90s when network is good, for long-run smoothness
  bufferForPlaybackMs:             3_000,   // wait for 3s before starting (fewer rebuffers)
  bufferForPlaybackAfterRebufferMs: 4_000, // wait for 4s after a rebuffer before resuming — recovers a bit faster
  backBufferDurationMs:           15_000,   // hold 15s of past buffer for seeks
  cacheSizeMB: 0,
};

export const BUFFER_VOD = {
  minBufferMs:                    20_000,   // larger cushion than live — VOD has no live-edge constraint
  maxBufferMs:                    60_000,
  bufferForPlaybackMs:               500,   // instant-feeling start
  bufferForPlaybackAfterRebufferMs: 1_500,
  backBufferDurationMs:           30_000,
  cacheSizeMB: 200,
};
