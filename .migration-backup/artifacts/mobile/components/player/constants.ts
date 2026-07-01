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

export const BUFFER_LIVE = {
  minBufferMs:                    20_000,   // keep 20s minimum buffer at all times
  maxBufferMs:                    60_000,   // buffer up to 60s when network is good
  bufferForPlaybackMs:             3_000,   // wait for 3s before starting (fewer rebuffers)
  bufferForPlaybackAfterRebufferMs: 5_000, // wait for 5s after a rebuffer before resuming
  backBufferDurationMs:           15_000,   // hold 15s of past buffer for seeks
  cacheSizeMB: 0,
};

export const BUFFER_VOD = {
  minBufferMs:                    15_000,
  maxBufferMs:                    50_000,
  bufferForPlaybackMs:               500,
  bufferForPlaybackAfterRebufferMs: 1_500,
  backBufferDurationMs:           30_000,
  cacheSizeMB: 200,
};
