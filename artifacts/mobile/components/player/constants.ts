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

// ─── Live stream buffer ────────────────────────────────────────────────────
//
// Goal: channel switch feels instant ("jano ak tana load hoy").
//
// Key insight: bufferForPlaybackMs controls how long the user WAITS before
// playback starts. Dropping it from 3 000 ms → 1 000 ms makes channels feel
// like they pop open instantly. ExoPlayer keeps filling the buffer in the
// background while the first second of video plays, so smoothness is unaffected.
//
// minBufferMs is the threshold below which ExoPlayer starts downloading more.
// 12 000 ms is still a strong safety net against brief WiFi/LTE dips while
// letting the player switch channels without a multi-second dead gap.
//
// targetOffsetMs (live-only) keeps ExoPlayer 3 s behind the live edge by
// default instead of the spec-minimum. Lower latency = smaller buffer to
// absorb = fewer rebuffer events.
export const BUFFER_LIVE = {
  minBufferMs:                     12_000,  // 12 s floor — absorbs brief LTE/WiFi drops
  maxBufferMs:                     50_000,  // bank 50 s when network is strong
  bufferForPlaybackMs:              1_000,  // ★ 1 s to first frame — instant-feeling switch
  bufferForPlaybackAfterRebufferMs: 2_500,  // 2.5 s after a stall — fast recovery
  backBufferDurationMs:            10_000,  // 10 s back-buffer
  cacheSizeMB: 0,                           // no disk cache for live
  // ExoPlayer Media3 live configuration
  targetOffsetMs:                   3_000,  // stay 3 s behind live edge (low-latency feel)
  maxPlaybackSpeed:                    1.04, // allow up to 4 % speedup to catch up to edge
  minPlaybackSpeed:                    0.97, // allow 3 % slowdown to reduce jitter
};

// ─── VOD (movies / episodes) buffer ──────────────────────────────────────
//
// VOD has no live-edge constraint so we can bank a large buffer and seek
// freely. 500 ms to first frame gives an instant-play feel.
export const BUFFER_VOD = {
  minBufferMs:                     15_000,  // 15 s — keep user moving smoothly
  maxBufferMs:                     60_000,  // 60 s ahead
  bufferForPlaybackMs:                500,  // ★ 0.5 s to first frame — snappy
  bufferForPlaybackAfterRebufferMs: 1_500,  // 1.5 s after stall
  backBufferDurationMs:            30_000,  // 30 s back-buffer for seeking
  cacheSizeMB: 200,                         // 200 MB disk cache speeds up replays/seeks
};
