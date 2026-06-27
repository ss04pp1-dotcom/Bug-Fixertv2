/**
 * StreamPro IPTV Player — Production Grade
 * react-native-video v6 + ExoPlayer (Android) / AVPlayer (iOS)
 * Supports: HLS, DASH, MPEG-TS, MP4, MKV, Live IPTV
 * Style: TiviMate / OTT Navigator
 */

import React, {
  useState, useRef, useCallback, useEffect, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  ActivityIndicator, StatusBar, Platform, PanResponder, Modal,
  BackHandler, Alert, AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, FadeIn, FadeOut,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import apiClient from '@/lib/api';

// ─── Expo Go detection ────────────────────────────────────────────────────────
const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  (Constants as any).executionEnvironment === 'storeClient';

const IS_WEB = Platform.OS === 'web';

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#050510', card: '#0D0D1A', primary: '#8B5CF6', accent: '#EC4899',
  live: '#EF4444', text: '#FFFFFF', dim: '#9CA3AF', border: 'rgba(255,255,255,0.1)',
  glass: 'rgba(5,5,16,0.82)', liveGlow: 'rgba(239,68,68,0.25)',
  green: '#10B981',
};

// ─── IPTV User-Agent ──────────────────────────────────────────────────────────
const IPTV_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const DEFAULT_HEADERS = {
  'User-Agent': IPTV_UA,
};

// ─── Buffer configs ───────────────────────────────────────────────────────────
const BUFFER_LIVE = {
  minBufferMs: 8000,
  maxBufferMs: 50000,
  bufferForPlaybackMs: 3000,
  bufferForPlaybackAfterRebufferMs: 6000,
};
const BUFFER_VOD = {
  minBufferMs: 15000,
  maxBufferMs: 60000,
  bufferForPlaybackMs: 2500,
  bufferForPlaybackAfterRebufferMs: 5000,
};

// ─── Stream type detection ────────────────────────────────────────────────────
type StreamFormat = 'HLS' | 'DASH' | 'MPEGTS' | 'MP4' | 'MKV' | 'WEBM' | 'MOV' | 'AVI' | 'UNKNOWN';

function detectStreamFormat(url: string): StreamFormat {
  if (!url) return 'UNKNOWN';
  const lower = url.toLowerCase().split('?')[0].split('#')[0];
  if (lower.includes('.m3u8') || lower.includes('/hls/') || lower.includes('manifest.m3u8')) return 'HLS';
  if (lower.includes('.mpd') || lower.includes('/dash/')) return 'DASH';
  if (lower.endsWith('.ts') || lower.includes('/ts/') || lower.includes('.ts?') || lower.includes('mpeg-ts')) return 'MPEGTS';
  if (lower.endsWith('.mp4') || lower.includes('.mp4?')) return 'MP4';
  if (lower.endsWith('.mkv') || lower.includes('.mkv?')) return 'MKV';
  if (lower.endsWith('.webm')) return 'WEBM';
  if (lower.endsWith('.mov')) return 'MOV';
  if (lower.endsWith('.avi')) return 'AVI';
  // Common IPTV URL patterns (no extension)
  if (lower.match(/:\d{2,5}\/(live|stream|channel)\//)) return 'HLS';
  if (lower.match(/:\d{2,5}\/(movie|vod)\//)) return 'MP4';
  // Xtream Codes API: /get.php?...type=m3u_plus or ...output=ts
  if (lower.includes('get.php') && lower.includes('type=m3u')) return 'HLS';
  if (lower.includes('get.php') && lower.includes('output=ts')) return 'MPEGTS';
  // Xtream short-format: /live/user/pass/id (no slash after id, bare numeric id)
  if (lower.match(/\/live\/[^/]+\/[^/]+\/\d+$/)) return 'HLS';
  if (lower.match(/\/movie\/[^/]+\/[^/]+\/\d+$/)) return 'MP4';
  if (lower.match(/\/series\/[^/]+\/[^/]+\/\d+$/)) return 'MP4';
  return 'UNKNOWN';
}

// Only force a type hint when the URL has an EXPLICIT extension — we are certain.
// For pattern-based guesses (IPTV /live/user/pass/id) we let ExoPlayer/AVPlayer
// auto-detect via Content-Type header, because the server may serve HLS, TS, or
// anything else on the same URL pattern.
function getVideoType(url: string, fmt: StreamFormat): string | undefined {
  const lower = (url || '').toLowerCase().split('?')[0].split('#')[0];
  const hasExplicitExtension =
    lower.endsWith('.m3u8') || lower.includes('manifest.m3u8') ||
    lower.endsWith('.mpd');
  if (!hasExplicitExtension) return undefined;   // let the player sniff Content-Type
  switch (fmt) {
    case 'HLS':  return 'm3u8';
    case 'DASH': return 'mpd';
    default:     return undefined;
  }
}

// ─── Video Logger ─────────────────────────────────────────────────────────────
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'EVENT';
interface LogEntry { ts: number; level: LogLevel; tag: string; msg: string; data?: any; }

class VideoLoggerClass {
  private entries: LogEntry[] = [];
  private maxEntries = 200;

  private add(level: LogLevel, tag: string, msg: string, data?: any) {
    const entry: LogEntry = { ts: Date.now(), level, tag, msg, data };
    this.entries.unshift(entry);
    if (this.entries.length > this.maxEntries) this.entries.pop();
    if (__DEV__) {
      const prefix = `[IPTV][${level}][${tag}]`;
      if (level === 'ERROR') console.error(prefix, msg, data ?? '');
      else if (level === 'WARN') console.warn(prefix, msg, data ?? '');
      else console.log(prefix, msg, data ? JSON.stringify(data).slice(0, 200) : '');
    }
  }

  info  = (tag: string, msg: string, data?: any) => this.add('INFO',  tag, msg, data);
  warn  = (tag: string, msg: string, data?: any) => this.add('WARN',  tag, msg, data);
  error = (tag: string, msg: string, data?: any) => this.add('ERROR', tag, msg, data);
  event = (tag: string, msg: string, data?: any) => this.add('EVENT', tag, msg, data);

  getEntries = () => this.entries;
  clear      = () => { this.entries = []; };
}

const VideoLog = new VideoLoggerClass();

// ─── Utility ──────────────────────────────────────────────────────────────────
function fmt(s: number) {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  return `${m}:${String(ss).padStart(2,'0')}`;
}

// ─── Watch History ────────────────────────────────────────────────────────────
const WH_KEY = 'streampro_watch_history_v2';

async function saveWatchHistory(entry: {
  contentId: string; contentType: string; title: string;
  position: number; duration: number;
}) {
  try {
    const raw = await AsyncStorage.getItem(WH_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex((e: any) => e.contentId === entry.contentId);
    const item = { ...entry, updatedAt: Date.now() };
    if (idx >= 0) list[idx] = item; else list.unshift(item);
    await AsyncStorage.setItem(WH_KEY, JSON.stringify(list.slice(0, 100)));
    if (entry.contentType !== 'channel' && entry.duration > 0) {
      const payload: Record<string, unknown> = {
        position: Math.floor(entry.position),
        duration: Math.floor(entry.duration),
      };
      if (entry.contentType === 'movie') payload.movieId = entry.contentId;
      else if (entry.contentType === 'series') payload.episodeId = entry.contentId;
      apiClient.post('/watch-history', payload).catch(() => {});
    }
  } catch {}
}

async function loadWatchPosition(contentId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(WH_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return list.find((e: any) => e.contentId === contentId)?.position || 0;
  } catch { return 0; }
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface StreamSource {
  url: string;
  label: string;
  quality: string;
  headers?: Record<string, string>;
  cookieExpired?: boolean;
  cookieExpiresAt?: string | null;
}

export interface PremiumPlayerProps {
  sources:          StreamSource[];
  title:            string;
  isLive?:          boolean;
  isLoading?:       boolean;
  hasError?:        boolean;
  errorMessage?:    string;
  onBack:           () => void;
  onRetry?:         () => void;
  onRefreshStream?: () => void;
  contentId?:       string;
  contentType?:     'movie' | 'series' | 'channel';
  episodes?:        { id: string; title: string; number: number }[];
  currentEpIdx?:    number;
  onEpisodeChange?: (idx: number) => void;
  onNext?:            () => void;
  onPrev?:            () => void;
  style?:             any;
  onPlaybackStart?:   () => void;
  onPlaybackError?:   () => void;
}

// ─── HLS.js CDN loader (web only, no static import needed) ───────────────────
const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js';

function loadHlsFromCdn(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject(new Error('not browser')); return; }
    const win = window as any;
    if (win.Hls) { resolve(win.Hls); return; }
    const existing = document.querySelector(`script[src="${HLS_CDN}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(win.Hls));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = HLS_CDN;
    script.async = true;
    script.onload = () => resolve(win.Hls);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ─── Web HLS Player ───────────────────────────────────────────────────────────
function WebVideoPlayer({ url, paused, rate, onReady, onError, onTimeUpdate, videoRef }: any) {
  const elRef = useRef<any>(null);
  useEffect(() => {
    if (videoRef) videoRef.current = { seek: (t: number) => { if (elRef.current) elRef.current.currentTime = t; } };
  });
  useEffect(() => {
    const v = elRef.current;
    if (!v || !url) return;
    VideoLog.info('WEB_PLAYER', 'Loading URL', { url: url.slice(0, 100) });
    if (url.startsWith('http://') && typeof window !== 'undefined' && (window as any).location?.protocol === 'https:') {
      VideoLog.error('WEB_PLAYER', 'HTTP blocked on HTTPS context');
      onError?.({ code: 'MIXED_CONTENT', description: 'HTTP stream blocked by browser on HTTPS' });
      return;
    }
    let hls: any = null;
    const fmt = detectStreamFormat(url);
    if (fmt === 'HLS') {
      loadHlsFromCdn().then((Hls: any) => {
        if (Hls.isSupported()) {
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            maxBufferSize: 60 * 1000 * 1000,
            maxBufferHole: 0.5,
            highBufferWatchdogPeriod: 2,
            nudgeMaxRetry: 5,
            nudgeOffset: 0.2,
            startFragPrefetch: true,
            testBandwidth: true,
            progressive: true,
            xhrSetup: (xhr: any) => {
              xhr.setRequestHeader('User-Agent', 'Mozilla/5.0');
            },
          });
          hls.loadSource(url);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            VideoLog.event('WEB_HLS', 'Manifest parsed — starting playback');
            v.play().catch(() => {});
            onReady?.();
          });
          hls.on(Hls.Events.ERROR, (_: any, d: any) => {
            VideoLog.error('WEB_HLS', `Error: ${d.type}/${d.details}`, { fatal: d.fatal });
            if (d.fatal) {
              if (d.type === (Hls as any).ErrorTypes?.NETWORK_ERROR) {
                hls.startLoad();
              } else {
                onError?.(d);
              }
            }
          });
        } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
          v.src = url; v.play().catch(() => {});
        } else {
          VideoLog.error('WEB_HLS', 'HLS not supported in this browser');
          onError?.({ code: 'HLS_NOT_SUPPORTED' });
        }
      }).catch(onError);
    } else {
      v.src = url;
      v.play().catch(() => {});
    }
    return () => { hls?.destroy(); };
  }, [url]);
  useEffect(() => { const v = elRef.current; if (!v) return; paused ? v.pause() : v.play().catch(() => {}); }, [paused]);
  useEffect(() => { if (elRef.current) elRef.current.playbackRate = rate || 1; }, [rate]);
  return React.createElement('video', {
    ref: elRef, autoPlay: true, controls: false, playsInline: true,
    onCanPlay: () => { VideoLog.event('WEB_PLAYER', 'canplay'); onReady?.(); },
    onError: (e: any) => { VideoLog.error('WEB_PLAYER', 'Video element error', { code: e?.target?.error?.code }); onError?.(e); },
    onLoadStart: () => VideoLog.event('WEB_PLAYER', 'onLoadStart'),
    onLoadedData: () => VideoLog.event('WEB_PLAYER', 'onLoadedData'),
    onTimeUpdate: () => { if (elRef.current) onTimeUpdate?.(elRef.current.currentTime, elRef.current.duration || 0); },
    style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' },
  } as any);
}

// ─── Native IPTV Player (react-native-video v6) ───────────────────────────────
interface NativePlayerProps {
  source: { uri: string; headers: Record<string, string>; type?: string; };
  paused: boolean;
  rate: number;
  volume: number;
  resizeMode: 'contain' | 'cover' | 'stretch' | 'none';
  videoRef: React.MutableRefObject<any>;
  pip: boolean;
  isLive: boolean;
  selectedVideoTrack: any;
  selectedAudioTrack: any;
  selectedTextTrack: any;
  onLoad: (data: any) => void;
  onLoadStart: () => void;
  onReadyForDisplay: () => void;
  onProgress: (data: any) => void;
  onBuffer: (buffering: boolean) => void;
  onError: (error: any) => void;
  onEnd: () => void;
  onVideoTracks: (tracks: any[]) => void;
  onAudioTracks: (tracks: any[]) => void;
  onTextTracks: (tracks: any[]) => void;
  onPipChange: (active: boolean) => void;
}

function NativeIPTVPlayer({
  source, paused, rate, volume, resizeMode, videoRef, pip, isLive,
  selectedVideoTrack, selectedAudioTrack, selectedTextTrack,
  onLoad, onLoadStart, onReadyForDisplay, onProgress, onBuffer,
  onError, onEnd, onVideoTracks, onAudioTracks, onTextTracks, onPipChange,
}: NativePlayerProps) {
  if (IS_EXPO_GO) {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 24 }]}>
        <Ionicons name="phone-portrait-outline" size={48} color={C.primary} />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
          Development Build Required
        </Text>
        <Text style={{ color: C.dim, fontSize: 12, textAlign: 'center', lineHeight: 20 }}>
          react-native-video cannot run in Expo Go.{'\n'}
          Build with:{'\n'}
          <Text style={{ color: C.primary, fontFamily: 'monospace' }}>npx expo run:android</Text>
        </Text>
      </View>
    );
  }

  try {
    const Video = require('react-native-video').default;

    return (
      <Video
        ref={videoRef}
        source={source}
        style={StyleSheet.absoluteFill}
        paused={paused}
        rate={rate}
        volume={volume}
        muted={false}
        resizeMode={resizeMode}
        controls={false}
        ignoreSilentSwitch="ignore"
        playInBackground={pip}
        playWhenInactive={pip}
        pictureInPicture={pip}
        useTextureView={false}
        hideShutterView={true}
        bufferConfig={isLive ? BUFFER_LIVE : BUFFER_VOD}
        selectedVideoTrack={selectedVideoTrack ?? { type: 'auto' }}
        selectedAudioTrack={selectedAudioTrack ?? { type: 'system' }}
        selectedTextTrack={selectedTextTrack ?? { type: 'disabled' }}
        onLoadStart={() => {
          VideoLog.event('NATIVE', 'onLoadStart', { uri: source.uri.slice(0, 80) });
          onLoadStart();
        }}
        onLoad={(data: any) => {
          VideoLog.event('NATIVE', 'onLoad', {
            duration: data?.duration,
            naturalSize: data?.naturalSize,
            videoTracks: data?.videoTracks?.length ?? 0,
            audioTracks: data?.audioTracks?.length ?? 0,
            textTracks: data?.textTracks?.length ?? 0,
          });
          if (data?.videoTracks?.length) {
            data.videoTracks.forEach((t: any, i: number) =>
              VideoLog.info('VIDEO_TRACK', `Track ${i}`, { codec: t.codecs, bitrate: t.bitrate, size: `${t.width}x${t.height}` })
            );
            onVideoTracks(data.videoTracks);
          }
          if (data?.audioTracks?.length) {
            data.audioTracks.forEach((t: any, i: number) =>
              VideoLog.info('AUDIO_TRACK', `Track ${i}`, { language: t.language, type: t.type, title: t.title })
            );
            onAudioTracks(data.audioTracks);
          }
          if (data?.textTracks?.length) {
            data.textTracks.forEach((t: any, i: number) =>
              VideoLog.info('TEXT_TRACK', `Track ${i}`, { language: t.language, title: t.title })
            );
            onTextTracks(data.textTracks);
          }
          onLoad(data);
        }}
        onReadyForDisplay={() => {
          VideoLog.event('NATIVE', 'onReadyForDisplay');
          onReadyForDisplay();
        }}
        onProgress={(data: any) => {
          onProgress(data);
        }}
        onBuffer={(data: any) => {
          VideoLog.event('NATIVE', `onBuffer: ${data?.isBuffering}`, { buffering: data?.isBuffering });
          onBuffer(data?.isBuffering ?? false);
        }}
        onError={(error: any) => {
          VideoLog.error('NATIVE', 'onError', {
            code: error?.error?.code,
            description: error?.error?.localizedDescription || error?.error?.errorString,
            domain: error?.error?.domain,
          });
          onError(error);
        }}
        onEnd={() => {
          VideoLog.event('NATIVE', 'onEnd — playback finished');
          onEnd();
        }}
        onPlaybackStateChanged={(data: any) => {
          VideoLog.event('NATIVE', `onPlaybackStateChanged: isPlaying=${data?.isPlaying}`);
        }}
        onPictureInPictureStatusChanged={(data: any) => {
          VideoLog.event('NATIVE', `PiP: ${data?.isActive}`);
          onPipChange(data?.isActive ?? false);
        }}
      />
    );
  } catch (e: any) {
    VideoLog.error('NATIVE', 'Failed to load react-native-video', { error: e?.message });
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={48} color={C.accent} />
        <Text style={{ color: '#fff', marginTop: 8, textAlign: 'center' }}>
          Video player failed to load{'\n'}
          <Text style={{ color: C.dim, fontSize: 12 }}>{e?.message}</Text>
        </Text>
      </View>
    );
  }
}

// ─── Settings Sheet ───────────────────────────────────────────────────────────
const SPEED_OPTS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const ASPECT_CYCLE = ['contain', 'cover', 'stretch', 'none'] as const;
type AspectMode = typeof ASPECT_CYCLE[number];
type SheetType = 'none' | 'speed' | 'quality' | 'audio' | 'subtitle';

function SettingsSheet({ visible, sheet, onClose, onSelect, speed, videoTracks, audioTracks, textTracks, selectedVidIdx, selectedAudIdx, selectedSubIdx }: {
  visible: boolean; sheet: SheetType; onClose: () => void;
  onSelect: (type: SheetType, value: any) => void;
  speed: number; videoTracks: any[]; audioTracks: any[]; textTracks: any[];
  selectedVidIdx: number; selectedAudIdx: number; selectedSubIdx: number;
}) {
  if (!visible || sheet === 'none') return null;

  let items: { label: string; value: any; isActive: boolean }[] = [];
  let sheetTitle = '';

  if (sheet === 'speed') {
    sheetTitle = 'Playback Speed';
    items = SPEED_OPTS.map(s => ({ label: s === 1 ? 'Normal' : `${s}×`, value: s, isActive: s === speed }));
  } else if (sheet === 'quality' && videoTracks.length > 0) {
    sheetTitle = 'Video Quality';
    // Deduplicate tracks: keep only the highest-bitrate track per height
    const seen = new Map<number, { idx: number; bitrate: number }>();
    videoTracks.forEach((t, i) => {
      const h = t.height || 0;
      // Skip tracks with suspiciously low bitrate that are likely audio-only renditions
      const br = t.bitrate || 0;
      if (h > 0 && br > 0) {
        const existing = seen.get(h);
        if (!existing || br > existing.bitrate) seen.set(h, { idx: i, bitrate: br });
      } else if (h > 0 && !seen.has(h)) {
        seen.set(h, { idx: i, bitrate: 0 });
      }
    });
    const uniqueTracks = Array.from(seen.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([height, { idx, bitrate }]) => ({
        label: `${height}p${bitrate > 0 ? ` · ${Math.round(bitrate / 1000)}kbps` : ''}`,
        value: idx,
        isActive: idx === selectedVidIdx,
      }));
    items = [
      { label: 'Auto', value: -1, isActive: selectedVidIdx === -1 },
      ...uniqueTracks,
    ];
  } else if (sheet === 'audio') {
    sheetTitle = 'Audio Track';
    items = audioTracks.length
      ? audioTracks.map((t, i) => ({ label: t.language || t.title || `Track ${i + 1}`, value: i, isActive: i === selectedAudIdx }))
      : [{ label: 'Default', value: -1, isActive: true }];
  } else if (sheet === 'subtitle') {
    sheetTitle = 'Subtitles';
    items = [
      { label: 'Off', value: -1, isActive: selectedSubIdx === -1 },
      ...textTracks.map((t, i) => ({ label: t.language || t.title || `Track ${i + 1}`, value: i, isActive: i === selectedSubIdx })),
    ];
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={ss.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e: any) => e.stopPropagation()}>
          <View style={ss.sheet}>
            <View style={ss.handle} />
            <Text style={ss.title}>{sheetTitle}</Text>
            {items.map((item, i) => (
              <TouchableOpacity key={i} onPress={() => { onSelect(sheet, item.value); onClose(); }} style={ss.row}>
                <Text style={[ss.rowTxt, item.isActive && ss.rowActive]}>{item.label}</Text>
                {item.isActive && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111827', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, minHeight: 180 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowTxt: { color: '#d1d5db', fontSize: 15 },
  rowActive: { color: C.primary, fontWeight: '700' },
});

// ─── Seek Feedback ────────────────────────────────────────────────────────────
function SeekFeedback({ side, seconds, onDone }: { side: 'left' | 'right'; seconds: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 800); return () => clearTimeout(t); }, []);
  return (
    <Animated.View entering={FadeIn.duration(80)} exiting={FadeOut.duration(400)}
      style={[sf.wrap, side === 'left' ? { left: 30 } : { right: 30 }]}>
      <View style={sf.inner}>
        <Ionicons name={side === 'left' ? 'play-back' : 'play-forward'} size={28} color="#fff" />
        <Text style={sf.txt}>{seconds}s</Text>
      </View>
    </Animated.View>
  );
}
const sf = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  inner: { backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', gap: 4 },
  txt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// ─── Swipe Indicator ──────────────────────────────────────────────────────────
const MAX_SWIPE = 0.15;  // cap both brightness and volume at 15%

function SwipeIndicator({ type, value }: { type: 'volume' | 'brightness'; value: number }) {
  const pct = Math.round((value / MAX_SWIPE) * 100);
  const side = type === 'brightness' ? { left: 16 } : { right: 16 };
  return (
    <View style={[sw.wrap, side]}>
      <Ionicons name={type === 'volume' ? 'volume-high' : 'sunny'} size={18} color="#fff" />
      <View style={sw.track}>
        <View style={[sw.fill, { height: `${pct}%` as any }]} />
      </View>
      <Text style={sw.val}>{pct}%</Text>
    </View>
  );
}
const sw = StyleSheet.create({
  wrap: { position: 'absolute', top: '20%', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 14, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: C.border, width: 52 },
  track: { width: 6, height: 80, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' },
  fill: { width: '100%', backgroundColor: C.primary, borderRadius: 3 },
  val: { color: '#fff', fontSize: 10, fontWeight: '600' },
});

// ─── Main Player ──────────────────────────────────────────────────────────────
export default function PremiumVideoPlayer({
  sources, title, isLive = false,
  isLoading = false, hasError = false, errorMessage = '',
  onBack, onRetry, onRefreshStream,
  contentId = '', contentType = 'movie',
  episodes = [], currentEpIdx = 0, onEpisodeChange,
  onNext, onPrev, style,
  onPlaybackStart, onPlaybackError,
}: PremiumPlayerProps) {
  const insets = useSafeAreaInsets();
  const [dims, setDims] = useState(Dimensions.get('window'));
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => sub?.remove();
  }, []);

  // ── Stream source state ────────────────────────────────────────────────────
  const [srcIdx, setSrcIdx]         = useState(0);
  const [switching, setSwitching]   = useState(false);  // true during server-switch unmount
  const [streamFormat, setFormat]   = useState<StreamFormat>('UNKNOWN');

  // ── Playback state ─────────────────────────────────────────────────────────
  const [isPlaying, setPlaying]     = useState(true);
  const [currentTime, setTime]      = useState(0);
  const [duration, setDuration]     = useState(0);
  const [buffering, setBuffering]   = useState(true);
  const [isReady, setReady]         = useState(false);
  const [ended, setEnded]           = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // ── Controls state ─────────────────────────────────────────────────────────
  const [fullscreen, setFullscreen] = useState(false);
  const [aspect, setAspect]         = useState<AspectMode>('contain');
  const [showCtrl, setShowCtrl]     = useState(true);
  const showCtrlRef                  = useRef(true);
  const [isLocked, setLocked]       = useState(false);
  const [sheet, setSheet]           = useState<SheetType>('none');
  const [speed, setSpeed]           = useState(1.0);
  const [pip, setPip]               = useState(false);
  const [pipActive, setPipActive]   = useState(false);

  // ── Tracks ─────────────────────────────────────────────────────────────────
  const [videoTracks, setVideoTracks] = useState<any[]>([]);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [textTracks, setTextTracks]   = useState<any[]>([]);
  const [selectedVidIdx, setSelVid]   = useState(-1);  // -1 = auto
  const [selectedAudIdx, setSelAud]   = useState(-1);
  const [selectedSubIdx, setSelSub]   = useState(-1);  // -1 = off

  // ── Gesture feedback ───────────────────────────────────────────────────────
  const [urlCheck, setUrlCheck]       = useState<string | null>(null);
  const [seekSide, setSeekSide]       = useState<{ side: 'left' | 'right'; secs: number } | null>(null);
  const [swipeType, setSwipeType]     = useState<'volume' | 'brightness' | null>(null);
  const [swipeValue, setSwipeValue]   = useState(0.10);  // start at 10% (within 0–MAX_SWIPE range)
  const [videoVolume, setVideoVolume] = useState(0.10);  // start at 10% volume
  const [isAtLiveEdge, setAtLiveEdge] = useState(true);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef        = useRef<any>(null);
  const webContainerRef = useRef<any>(null);
  const hideTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef      = useRef<{ time: number; x: number } | null>(null);
  const swipeStartY     = useRef(0);
  const swipeStartV     = useRef(0.10);
  const swipeSide       = useRef<'left' | 'right'>('right');
  const currentTimeRef  = useRef(0);
  const durationRef     = useRef(0);
  const trackWidthRef   = useRef(200);  // FIX: track actual progress bar width via onLayout
  const stallTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourcesRef      = useRef(sources);

  // ── Animated controls ─────────────────────────────────────────────────────
  const ctrlOpacity = useSharedValue(1);
  const ctrlStyle   = useAnimatedStyle(() => ({ opacity: ctrlOpacity.value }));

  // ── Current source ─────────────────────────────────────────────────────────
  const src = sources[srcIdx];

  // ── URL analysis on source change ─────────────────────────────────────────
  useEffect(() => {
    if (!src?.url) return;
    const fmt = detectStreamFormat(src.url);
    setFormat(fmt);
    setUrlCheck(null);
    setPlayerError(null);
    setReady(false);
    setBuffering(true);
    setVideoTracks([]); setAudioTracks([]); setTextTracks([]);
    setSelVid(-1); setSelAud(-1); setSelSub(-1);

    VideoLog.info('SOURCE', `Loaded source #${srcIdx}`, {
      format: fmt,
      label: src.label,
    });
  }, [src?.url, src?.headers, srcIdx]);

  // ── Build native source object ─────────────────────────────────────────────
  const nativeSource = useMemo(() => {
    if (!src?.url) return null;
    // Only set type for explicit .m3u8 / .mpd extensions.
    // For IPTV pattern-based URLs (/live/user/pass/id) we intentionally omit
    // the type so ExoPlayer / AVPlayer sniffs Content-Type from the server —
    // forcing 'm3u8' on a TS stream breaks playback.
    const videoType = getVideoType(src.url, streamFormat);
    // Merge: DEFAULT_HEADERS (baseline) → src.headers (server-specific Cookie/UA/Referer/Origin)
    // Server headers take priority so they are not overwritten by hardcoded defaults.
    const merged = {
      ...DEFAULT_HEADERS,
      ...(src.headers ?? {}),
    };
    const built = {
      uri: src.url,
      headers: merged,
      ...(videoType ? { type: videoType } : {}),
    };
    VideoLog.info('SOURCE', 'Built native source', {
      type: videoType || 'auto-detect',
      hasCookie: !!merged['Cookie'],
      hasUA: !!merged['User-Agent'],
      hasReferer: !!merged['Referer'],
      headerKeys: Object.keys(merged),
    });
    return built;
  }, [src?.url, src?.headers, streamFormat]);

  // ── Selected tracks for react-native-video ─────────────────────────────────
  const selectedVideoTrack = useMemo(() =>
    selectedVidIdx === -1
      ? { type: 'auto' }
      : { type: 'index', value: selectedVidIdx },
    [selectedVidIdx]);

  const selectedAudioTrack = useMemo(() =>
    selectedAudIdx === -1
      ? { type: 'system' }
      : { type: 'index', value: selectedAudIdx },
    [selectedAudIdx]);

  const selectedTextTrack = useMemo(() =>
    selectedSubIdx === -1
      ? { type: 'disabled' }
      : { type: 'index', value: selectedSubIdx },
    [selectedSubIdx]);

  // ── Resume playback position ───────────────────────────────────────────────
  useEffect(() => {
    if (!contentId || isLive) return;
    loadWatchPosition(contentId).then(pos => {
      if (pos > 10) {
        VideoLog.info('RESUME', `Resuming from ${fmt(pos)}`);
        setTimeout(() => videoRef.current?.seek?.(pos), 1500);
      }
    });
  }, [contentId, isLive]);

  // ── Screen orientation ─────────────────────────────────────────────────────
  // Track whether fullscreen was triggered by user button (vs auto-rotation)
  const manualFsRef = useRef(false);

  useEffect(() => {
    if (IS_WEB) return;
    (async () => {
      try {
        const SO = await import('expo-screen-orientation');
        if (fullscreen && manualFsRef.current) {
          // User pressed fullscreen button in portrait → lock landscape
          await SO.lockAsync(SO.OrientationLock.LANDSCAPE);
        } else if (!fullscreen && manualFsRef.current) {
          // User pressed exit-fullscreen button → unlock so they can rotate freely
          await SO.lockAsync(SO.OrientationLock.PORTRAIT_UP);
          manualFsRef.current = false;
        }
        // Auto-rotation triggered fullscreen: don't touch the lock
      } catch {}
    })();
  }, [fullscreen]);

  // Auto-fullscreen when device rotates to landscape
  useEffect(() => {
    if (IS_WEB) return;
    const isLandscape = dims.width > dims.height;
    if (isLandscape && !fullscreen) {
      setFullscreen(true);
      // In landscape, auto-fill the screen for IPTV (stretch avoids black bars on wide screens)
      setAspect('stretch');
    } else if (!isLandscape && fullscreen && !manualFsRef.current) {
      // Device rotated back to portrait (auto mode) → exit fullscreen, restore contain
      setFullscreen(false);
      setAspect('contain');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.width, dims.height]);

  // ── Web fullscreen sync (Escape key / browser exit) ────────────────────────
  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return;
    // Inject CSS so the fullscreen element fills the screen
    const styleId = '__pvp_fs_style';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = `
        :fullscreen { width: 100vw !important; height: 100vh !important; background: #000; }
        :-webkit-full-screen { width: 100vw !important; height: 100vh !important; background: #000; }
        :-moz-full-screen { width: 100vw !important; height: 100vh !important; background: #000; }
        :fullscreen video { width: 100% !important; height: 100% !important; object-fit: contain; }
        :-webkit-full-screen video { width: 100% !important; height: 100% !important; object-fit: contain; }
      `;
      document.head.appendChild(st);
    }
    const onFsChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // ── Keep awake ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (IS_WEB) return;
    let off: (() => void) | null = null;
    import('expo-keep-awake').then(KA => {
      KA.activateKeepAwakeAsync();
      off = KA.deactivateKeepAwake;
    }).catch(() => {});
    return () => { off?.(); };
  }, []);

  // ── Android back button: fullscreen exit → PiP → back ─────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (fullscreen) { setFullscreen(false); return true; }
      // If video is playing, enter PiP instead of navigating away
      if (!pip && isReady && !hasError) {
        setPip(true);
        return true;
      }
      if (pip) { setPip(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [fullscreen, pip, isReady, hasError]);

  // ── Auto PiP when app goes to background ───────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android' || IS_WEB) return;
    const sub = AppState.addEventListener('change', (nextState) => {
      // When app goes to background and video is ready/playing → enter PiP
      if (nextState === 'background' && isReady && !hasError && !pip) {
        setPip(true);
      }
      // When app comes back to foreground, exit PiP
      if (nextState === 'active' && pip) {
        setPip(false);
      }
    });
    return () => sub.remove();
  }, [isReady, hasError, pip]);

  // ── Auto-hide controls ─────────────────────────────────────────────────────
  const setCtrlHidden = useCallback(() => {
    setShowCtrl(false);
    showCtrlRef.current = false;
  }, []);

  const startHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      // Run setCtrlHidden AFTER animation finishes so showCtrlRef stays true during fade
      ctrlOpacity.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) runOnJS(setCtrlHidden)();
      });
    }, 4500);
  }, [ctrlOpacity, setCtrlHidden]);

  const bumpCtrl = useCallback(() => {
    if (isLocked) return;
    ctrlOpacity.value = withTiming(1, { duration: 200 });
    setShowCtrl(true);
    showCtrlRef.current = true;
    startHide();
  }, [isLocked, ctrlOpacity, startHide]);

  const hideCtrlNow = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    ctrlOpacity.value = withTiming(0, { duration: 300 });
    setShowCtrl(false);
    showCtrlRef.current = false;
  }, [ctrlOpacity]);

  useEffect(() => {
    startHide();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [startHide]);

  // ── Keep sourcesRef in sync ────────────────────────────────────────────────
  useEffect(() => { sourcesRef.current = sources; }, [sources]);

  // ── Reset source index when sources list changes (new channel/content) ──────
  useEffect(() => {
    setSrcIdx(0);
    setPlayerError(null);
    setReady(false);
    setBuffering(true);
    setTime(0);
    setDuration(0);
    currentTimeRef.current = 0;
    durationRef.current = 0;
  }, [sources]);

  // ── Stall detection: auto-switch if buffering > 30s with no data ───────────
  const STALL_MS = 30_000;
  useEffect(() => {
    if (buffering && !playerError && src && !isLoading && !hasError) {
      stallTimerRef.current = setTimeout(() => {
        const srcs = sourcesRef.current;
        setSrcIdx(cur => {
          if (cur >= 0 && cur < srcs.length - 1) {
            VideoLog.warn('STALL', `No data for ${STALL_MS / 1000}s — auto-switching to server ${cur + 2}`);
            setBuffering(true);
            setPlayerError(null);
            return cur + 1;
          }
          VideoLog.error('STALL', 'Stall detected — no more servers to try');
          setPlayerError('Stream stalled. No data received. Try refreshing.');
          setBuffering(false);
          return cur;
        });
      }, STALL_MS);
    } else {
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    }
    return () => {
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    };
  }, [buffering, playerError, src, isLoading, hasError]);

  // ── Watch history auto-save ────────────────────────────────────────────────
  useEffect(() => {
    if (!contentId || isLive) return;
    saveTimer.current = setInterval(() => {
      if (currentTimeRef.current > 5 && durationRef.current > 0) {
        saveWatchHistory({ contentId, contentType, title, position: currentTimeRef.current, duration: durationRef.current });
      }
    }, 10000);
    return () => { if (saveTimer.current) clearInterval(saveTimer.current); };
  }, [contentId, contentType, title, isLive]);

  // ── Seek ───────────────────────────────────────────────────────────────────
  const seek = useCallback((delta: number) => {
    const t = Math.max(0, Math.min(durationRef.current || 0, currentTimeRef.current + delta));
    videoRef.current?.seek?.(t);
    setTime(t);
    currentTimeRef.current = t;
    bumpCtrl();
  }, [bumpCtrl]);

  const seekToFrac = useCallback((frac: number) => {
    if (!durationRef.current) return;
    const t = Math.max(0, Math.min(1, frac)) * durationRef.current;
    videoRef.current?.seek?.(t);
    setTime(t);
    currentTimeRef.current = t;
    bumpCtrl();
  }, [bumpCtrl]);

  // ── Settings handler ───────────────────────────────────────────────────────
  const handleSheetSelect = useCallback((type: SheetType, value: any) => {
    if (type === 'speed') { setSpeed(value); videoRef.current?.setSpeed?.(value); }
    if (type === 'quality') setSelVid(value);
    if (type === 'audio') setSelAud(value);
    if (type === 'subtitle') setSelSub(value);
  }, []);

  // ── Source refresh ─────────────────────────────────────────────────────────
  const refreshSource = useCallback(() => {
    setReady(false); setBuffering(true); setPlayerError(null);
    const cur = srcIdx; setSrcIdx(-1);
    setTimeout(() => setSrcIdx(cur), 400);
    onRefreshStream?.();
    VideoLog.info('PLAYER', 'Stream refreshed');
    bumpCtrl();
  }, [srcIdx, onRefreshStream, bumpCtrl]);

  // ── Smooth server switch (unmount → pause → remount) ───────────────────────
  const switchToSource = useCallback((i: number) => {
    if (i === srcIdx || switching) return;
    VideoLog.info('PLAYER', `User switching to server ${i + 1}`);
    setReady(false);
    setBuffering(true);
    setPlayerError(null);
    setSwitching(true);
    setSrcIdx(-1);  // unmount video so old stream stops immediately
    setTimeout(() => {
      setSrcIdx(i);
      setSwitching(false);
    }, 150);  // brief pause for clean teardown
    bumpCtrl();
  }, [srcIdx, switching, bumpCtrl]);

  // ── PanResponder ───────────────────────────────────────────────────────────
  const vidW = fullscreen ? Math.max(dims.width, dims.height) : dims.width;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onPanResponderGrant: (evt) => {
      swipeStartY.current = evt.nativeEvent.pageY;
      swipeStartV.current = swipeValue;
      swipeSide.current = evt.nativeEvent.locationX < vidW / 2 ? 'left' : 'right';
    },
    onPanResponderMove: (_, gs) => {
      if (Math.abs(gs.dy) < 10) return;
      // Smooth: divisor 1500 → small precise steps per swipe
      // Cap: clamp within [0, MAX_SWIPE] so neither brightness nor volume exceed 15%
      const delta = -gs.dy / 1500;
      const newVal = Math.max(0, Math.min(MAX_SWIPE, swipeStartV.current + delta));
      setSwipeValue(newVal);
      const sideType = swipeSide.current === 'left' ? 'brightness' : 'volume';
      setSwipeType(sideType);
      if (sideType === 'volume') setVideoVolume(newVal);
    },
    onPanResponderRelease: (evt, gs) => {
      if (Math.abs(gs.dy) < 8 && Math.abs(gs.dx) < 8) {
        const now = Date.now();
        const tapX = evt.nativeEvent.locationX;
        if (lastTapRef.current && now - lastTapRef.current.time < 350) {
          // Double-tap seek
          const side = tapX < vidW / 2 ? 'left' : 'right';
          const secs = side === 'left' ? -10 : 10;
          lastTapRef.current = null;
          seek(secs);
          setSeekSide({ side, secs: Math.abs(secs) });
        } else {
          lastTapRef.current = { time: now, x: tapX };
          setTimeout(() => {
            if (lastTapRef.current && Date.now() - lastTapRef.current.time >= 340) {
              lastTapRef.current = null;
              if (showCtrlRef.current) {
                hideCtrlNow();
              } else {
                bumpCtrl();
              }
            }
          }, 360);
        }
        return;
      }
      setTimeout(() => setSwipeType(null), 1200);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [vidW, swipeValue, seek, bumpCtrl, hideCtrlNow]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const progress   = durationRef.current > 0 ? currentTime / durationRef.current : 0;
  const isLiveNow  = isLive && duration === 0;
  const vidH       = fullscreen
    ? Math.min(dims.width, dims.height)
    : Math.round(dims.width * 9 / 16);
  const isHttpBlocked = IS_WEB && !!src?.url && src.url.startsWith('http://') &&
    typeof window !== 'undefined' && window.location?.protocol === 'https:';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View
      ref={IS_WEB ? webContainerRef : undefined}
      style={[
        p.container,
        (!IS_WEB && fullscreen) ? p.fullscreen : { width: vidW, height: vidH },
        style,
      ]}
    >
      <StatusBar hidden={fullscreen} barStyle="light-content" backgroundColor="#000" />

      {/* ── Video layer ─────────────────────────────────────────────────── */}
      {!isLoading && !hasError && !isHttpBlocked && src && srcIdx >= 0 && (
        IS_WEB
          ? <WebVideoPlayer
              url={src.url} paused={!isPlaying} rate={speed} videoRef={videoRef}
              onReady={() => { setReady(true); setBuffering(false); onPlaybackStart?.(); }}
              onError={(e: any) => {
                VideoLog.error('PLAYER', 'Web player error', e);
                // FIX: auto-fallback to next server before showing error UI
                if (srcIdx < sources.length - 1) {
                  setSrcIdx(i => i + 1);
                  setBuffering(true);
                } else {
                  setPlayerError('Stream failed to load');
                  setBuffering(false);
                  onPlaybackError?.();
                }
              }}
              onTimeUpdate={(t: number, d: number) => {
                setTime(t); currentTimeRef.current = t;
                if (d > 0) { setDuration(d); durationRef.current = d; }
              }}
            />
          : nativeSource && (
            <NativeIPTVPlayer
              source={nativeSource}
              paused={!isPlaying}
              rate={speed}
              volume={videoVolume}
              resizeMode={aspect}
              videoRef={videoRef}
              pip={pip}
              isLive={isLive}
              selectedVideoTrack={selectedVideoTrack}
              selectedAudioTrack={selectedAudioTrack}
              selectedTextTrack={selectedTextTrack}
              onLoadStart={() => { setBuffering(true); setReady(false); }}
              onLoad={(data) => {
                setDuration(data?.duration || 0);
                durationRef.current = data?.duration || 0;
                setBuffering(false); setReady(true); setEnded(false); setPlayerError(null);
                onPlaybackStart?.();
              }}
              onReadyForDisplay={() => { setBuffering(false); setReady(true); }}
              onProgress={(data) => {
                setTime(data.currentTime);
                currentTimeRef.current = data.currentTime;
                if (data.seekableDuration > 0) {
                  setDuration(data.seekableDuration);
                  durationRef.current = data.seekableDuration;
                }
                if (isLive) setAtLiveEdge(data.currentTime >= data.seekableDuration - 8);
              }}
              onBuffer={setBuffering}
              onError={(error) => {
                const desc = error?.error?.localizedDescription || error?.error?.errorString || 'Unknown error';
                VideoLog.error('PLAYER', `Error: ${desc}`);
                // FIX: auto-fallback to next server before showing error UI
                if (srcIdx < sources.length - 1) {
                  VideoLog.info('PLAYER', `Auto-switching to server ${srcIdx + 2}`);
                  setSrcIdx(i => i + 1);
                  setBuffering(true);
                  setPlayerError(null);
                } else {
                  setPlayerError(desc);
                  setBuffering(false);
                  onPlaybackError?.();
                }
              }}
              onEnd={() => { setEnded(true); setPlaying(false); onNext?.(); }}
              onVideoTracks={setVideoTracks}
              onAudioTracks={setAudioTracks}
              onTextTracks={setTextTracks}
              onPipChange={(active) => {
                setPipActive(active);
                // When system dismisses PiP, sync the pip toggle back to false
                if (!active) setPip(false);
              }}
            />
          )
      )}

      {/* ── Overlays ────────────────────────────────────────────────────── */}
      {/* Buffering */}
      {(isLoading || (buffering && !playerError && src)) && !hasError && (
        <View style={p.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={p.overlayTxt}>
            {isLoading ? 'Loading…' : isLive ? 'Buffering live stream…' : 'Buffering…'}
          </Text>
        </View>
      )}

      {/* Player error */}
      {playerError && (
        <View style={p.overlay}>
          <Ionicons name="alert-circle-outline" size={52} color={C.live} />
          <Text style={p.errorTxt}>Playback Failed</Text>
          <Text style={p.errorSub} numberOfLines={3}>{playerError}</Text>
          <View style={p.errorActions}>
            {sources.length > 1 && srcIdx < sources.length - 1 && (
              <TouchableOpacity onPress={() => { setSrcIdx(i => i + 1); setPlayerError(null); }} style={p.altBtn}>
                <Text style={p.altBtnTxt}>Try Server {srcIdx + 2}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => {
                setPlayerError(null);
                setSrcIdx(0);
                setReady(false);
                setBuffering(true);
                onRetry?.();
              }} style={p.retryBtn}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={p.retryTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* HTTP blocked (web preview) */}
      {isHttpBlocked && (
        <View style={p.overlay}>
          <Ionicons name="phone-portrait-outline" size={48} color={C.primary} />
          <Text style={p.errorTxt}>Open in Mobile App</Text>
          <Text style={p.errorSub}>HTTP streams are blocked in the browser preview.{'\n'}Use the Expo app to watch.</Text>
        </View>
      )}

      {/* API error */}
      {hasError && !playerError && (
        <View style={p.overlay}>
          <Ionicons name="alert-circle-outline" size={52} color={C.accent} />
          <Text style={p.errorTxt}>Stream Unavailable</Text>
          {!!errorMessage && (
            <Text style={[p.errorSub, { textAlign: 'center', marginHorizontal: 24 }]} numberOfLines={5}>
              {errorMessage}
            </Text>
          )}
          <TouchableOpacity onPress={onRetry} style={p.retryBtn}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={p.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Connecting / switching state */}
      {!isLoading && !hasError && !src && !isHttpBlocked && (
        <View style={p.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={p.overlayTxt}>{switching ? 'Switching server…' : 'Connecting to stream…'}</Text>
        </View>
      )}

      {/* ── Gesture layer ───────────────────────────────────────────────── */}
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />

      {/* ── Controls overlay ────────────────────────────────────────────── */}
      {showCtrl && !hasError && !playerError && (
        <Animated.View style={[StyleSheet.absoluteFill, ctrlStyle]} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.25, 0.65, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* ── Top bar ─────────────────────────────────────────────────── */}
          {!isLocked && (
            <View style={[p.topBar, { paddingTop: (fullscreen ? insets.top : 0) + 12 }]}>
              <TouchableOpacity
                onPress={fullscreen ? () => { setFullscreen(false); setAspect('contain'); } : onBack}
                style={p.iconBtn}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>

              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={p.titleTxt} numberOfLines={1}>{title}</Text>
                {streamFormat !== 'UNKNOWN' && (
                  <Text style={p.formatBadge}>{streamFormat}</Text>
                )}
              </View>

              <View style={p.topRight}>
                {/* Cast — native only */}
                {!IS_WEB && (
                  <TouchableOpacity style={p.iconBtn} onPress={() => Alert.alert('Chromecast', 'Cast requires a dev build with react-native-google-cast installed.')}>
                    <MaterialIcons name="cast" size={22} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                )}
                {/* PiP */}
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={p.iconBtn} onPress={() => setPip(v => !v)}>
                    <MaterialIcons name="picture-in-picture-alt" size={20} color={pip ? C.primary : '#fff'} />
                  </TouchableOpacity>
                )}
                {/* Refresh */}
                <TouchableOpacity style={p.iconBtn} onPress={refreshSource}>
                  <Ionicons name="refresh-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Server pills ─────────────────────────────────────────────── */}
          {!isLocked && sources.length > 1 && (
            <View style={p.serverRow}>
              {sources.map((s, i) => {
                const isActive = i === srcIdx;
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => switchToSource(i)}
                    disabled={switching}
                    style={[
                      p.pill,
                      isActive && p.pillActive,
                      s.cookieExpired && p.pillExpired,
                    ]}
                  >
                    <Text style={[p.pillTxt, isActive && p.pillActiveTxt, s.cookieExpired && p.pillExpiredTxt]}>
                      {isActive && switching ? '⟳ ' : isActive ? '● ' : ''}{s.label || s.quality}
                      {s.cookieExpired ? ' ⚠' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── LIVE badge ───────────────────────────────────────────────── */}
          {isLive && !isLocked && (
            <View style={p.liveRow}>
              <View style={p.liveBadge}>
                <View style={p.liveDot} />
                <Text style={p.liveTxt}>LIVE</Text>
              </View>
              {!isAtLiveEdge && (
                <TouchableOpacity
                  onPress={() => { videoRef.current?.seek?.(durationRef.current); setAtLiveEdge(true); }}
                  style={p.goLive}
                >
                  <Text style={p.goLiveTxt}>▶ GO LIVE</Text>
                </TouchableOpacity>
              )}
              {isReady && !buffering && (
                <View style={p.livePing}>
                  <Ionicons name="wifi" size={11} color={C.green} />
                  <Text style={p.livePingTxt}>HD</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Center controls ──────────────────────────────────────────── */}
          {!isLocked && (
            <View style={p.centerPanel} pointerEvents="box-none">
              <View style={p.glassRow}>
                {onPrev && (
                  <TouchableOpacity onPress={onPrev} style={p.ctrlBtn}>
                    <Ionicons name="play-skip-back" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { seek(-10); setSeekSide({ side: 'left', secs: 10 }); }} style={p.ctrlBtn}>
                  <Ionicons name="play-back" size={22} color="#fff" />
                  <Text style={p.seekLabel}>10s</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setPlaying(v => !v); bumpCtrl(); }} style={p.playBtn}>
                  {buffering && isReady
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#fff" style={isPlaying ? {} : { marginLeft: 3 }} />
                  }
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { seek(10); setSeekSide({ side: 'right', secs: 10 }); }} style={p.ctrlBtn}>
                  <Ionicons name="play-forward" size={22} color="#fff" />
                  <Text style={p.seekLabel}>10s</Text>
                </TouchableOpacity>
                {onNext && (
                  <TouchableOpacity onPress={onNext} style={p.ctrlBtn}>
                    <Ionicons name="play-skip-forward" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── Bottom bar ───────────────────────────────────────────────── */}
          {!isLocked && (
            <View style={p.bottomBar}>
              {/* Progress */}
              {!isLiveNow && (
                <View style={p.progressRow}>
                  <Text style={p.timeTxt}>{fmt(currentTime)}</Text>
                  <TouchableOpacity
                    style={p.trackWrap}
                    activeOpacity={1}
                    onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
                    onPress={(e) => {
                      seekToFrac(e.nativeEvent.locationX / trackWidthRef.current);
                    }}
                  >
                    <View style={p.trackBg}>
                      <View style={[p.trackBuf, { width: `${Math.min(100, progress * 100 + 10)}%` as any }]} />
                      <LinearGradient
                        colors={[C.primary, C.accent]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[p.trackFill, { width: `${progress * 100}%` as any }]}
                      />
                      <View style={[p.trackThumb, { left: `${Math.min(97, progress * 100)}%` as any }]} />
                    </View>
                  </TouchableOpacity>
                  <Text style={p.timeTxt}>{fmt(duration)}</Text>
                </View>
              )}

              {/* Tool row */}
              <View style={p.toolRow}>
                {/* Speed */}
                <TouchableOpacity onPress={() => { setSheet('speed'); bumpCtrl(); }} style={p.toolBtn}>
                  <Text style={p.speedTxt}>{speed}×</Text>
                </TouchableOpacity>

                {/* Quality — native only (no video tracks in web) */}
                {!IS_WEB && (
                  <TouchableOpacity onPress={() => { setSheet('quality'); bumpCtrl(); }} style={p.toolBtn}>
                    <MaterialIcons name="hd" size={22} color={selectedVidIdx !== -1 ? C.primary : '#fff'} />
                  </TouchableOpacity>
                )}

                {/* Audio */}
                <TouchableOpacity onPress={() => { setSheet('audio'); bumpCtrl(); }} style={p.toolBtn}>
                  <Ionicons name="musical-note-outline" size={20} color={selectedAudIdx !== -1 ? C.primary : '#fff'} />
                </TouchableOpacity>

                {/* Subtitles */}
                <TouchableOpacity onPress={() => { setSheet('subtitle'); bumpCtrl(); }} style={p.toolBtn}>
                  <MaterialCommunityIcons name="subtitles-outline" size={20} color={selectedSubIdx !== -1 ? C.primary : '#fff'} />
                </TouchableOpacity>

                {/* Aspect ratio */}
                <TouchableOpacity onPress={() => { setAspect(a => ASPECT_CYCLE[(ASPECT_CYCLE.indexOf(a) + 1) % ASPECT_CYCLE.length]); bumpCtrl(); }} style={p.toolBtn}>
                  <MaterialIcons name="aspect-ratio" size={20} color="#fff" />
                </TouchableOpacity>

                {/* Lock */}
                <TouchableOpacity onPress={() => { setLocked(v => !v); bumpCtrl(); }} style={p.toolBtn}>
                  <Ionicons name={isLocked ? 'lock-closed' : 'lock-open-outline'} size={20} color="#fff" />
                </TouchableOpacity>

                {/* Fullscreen */}
                <TouchableOpacity onPress={() => {
                  if (IS_WEB && typeof document !== 'undefined') {
                    if (!document.fullscreenElement) {
                      const el = webContainerRef.current as any;
                      const target = el || document.documentElement;
                      (target.requestFullscreen?.() ?? Promise.resolve()).catch(() => {});
                      setFullscreen(true);
                      setAspect('stretch');
                    } else {
                      document.exitFullscreen?.().catch(() => {});
                      setFullscreen(false);
                      setAspect('contain');
                    }
                  } else {
                    manualFsRef.current = true;
                    const goingFs = !fullscreen;
                    setFullscreen(goingFs);
                    setAspect(goingFs ? 'stretch' : 'contain');
                  }
                  bumpCtrl();
                }} style={p.toolBtn}>
                  <Ionicons name={fullscreen ? 'contract' : 'expand'} size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Locked badge ─────────────────────────────────────────────── */}
          {isLocked && (
            <TouchableOpacity onPress={() => { setLocked(false); bumpCtrl(); }} style={p.lockBadge}>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={p.lockTxt}>Tap to unlock</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* ── Double-tap seek feedback ────────────────────────────────────── */}
      {seekSide && (
        <SeekFeedback
          key={seekSide.side + Date.now()}
          side={seekSide.side}
          seconds={seekSide.secs}
          onDone={() => setSeekSide(null)}
        />
      )}

      {/* ── Swipe indicator ─────────────────────────────────────────────── */}
      {swipeType && <SwipeIndicator type={swipeType} value={swipeValue} />}

      {/* ── Settings sheets ──────────────────────────────────────────────── */}
      <SettingsSheet
        visible={sheet !== 'none'} sheet={sheet}
        onClose={() => setSheet('none')} onSelect={handleSheetSelect}
        speed={speed} videoTracks={videoTracks} audioTracks={audioTracks} textTracks={textTracks}
        selectedVidIdx={selectedVidIdx} selectedAudIdx={selectedAudIdx} selectedSubIdx={selectedSubIdx}
      />

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const p = StyleSheet.create({
  container: { backgroundColor: '#000', overflow: 'hidden' },
  fullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  overlayTxt:  { color: C.dim, fontSize: 13, marginTop: 6 },
  errorTxt:    { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  errorSub:    { color: C.dim, fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 },
  errorActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  retryBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 22 },
  retryTxt:    { color: '#fff', fontWeight: '700', fontSize: 14 },
  altBtn:      { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22, borderWidth: 1, borderColor: C.border },
  altBtnTxt:   { color: '#fff', fontSize: 14 },

  // Top bar
  topBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 12, paddingBottom: 6 },
  iconBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  titleTxt:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  formatBadge: { color: C.dim, fontSize: 10, marginTop: 1 },
  topRight:  { flexDirection: 'row', gap: 8 },

  // Server pills
  serverRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, flexWrap: 'wrap', marginTop: 2 },
  pill:         { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, borderWidth: 1, borderColor: C.border },
  pillActive:   { borderColor: C.primary, backgroundColor: 'rgba(139,92,246,0.2)' },
  pillExpired:  { borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.12)' },
  pillTxt:       { color: '#ccc', fontSize: 12 },
  pillActiveTxt: { color: C.primary, fontWeight: '700' },
  pillExpiredTxt: { color: '#f87171' },

  // LIVE
  liveRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 4 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.live, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveTxt:   { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  goLive:    { backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: C.live, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4 },
  goLiveTxt: { color: C.live, fontSize: 11, fontWeight: '700' },
  livePing:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  livePingTxt: { color: C.green, fontSize: 10, fontWeight: '600' },

  // Center
  centerPanel: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  glassRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(5,5,16,0.72)', borderRadius: 30, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 12 },
  ctrlBtn:   { alignItems: 'center', justifyContent: 'center', width: 54, height: 48, gap: 2 },
  seekLabel: { color: '#fff', fontSize: 9, fontWeight: '700', opacity: 0.8 },
  playBtn:   { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },

  // Bottom
  bottomBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  timeTxt:     { color: '#e5e7eb', fontSize: 11, minWidth: 40, textAlign: 'center' },
  trackWrap:   { flex: 1, height: 24, justifyContent: 'center' },
  trackBg:     { height: 3.5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, position: 'relative', overflow: 'visible' },
  trackBuf:    { position: 'absolute', top: 0, left: 0, height: '100%', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
  trackFill:   { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2 },
  trackThumb:  { position: 'absolute', top: -5.5, width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', marginLeft: -7, elevation: 4, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  toolRow:     { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  toolBtn:     { width: 40, height: 36, justifyContent: 'center', alignItems: 'center' },
  speedTxt:    { color: '#e5e7eb', fontSize: 13, fontWeight: '700' },

  // Lock
  lockBadge: { position: 'absolute', alignSelf: 'center', top: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  lockTxt:   { color: '#fff', fontSize: 13 },
});
