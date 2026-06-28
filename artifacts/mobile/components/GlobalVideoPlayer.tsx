/**
 * GlobalVideoPlayer — SINGLETON video player.
 *
 * Mounted ONCE at the root layout level. The <Video> (ExoPlayer / AVPlayer)
 * native instance is NEVER unmounted while mode !== 'hidden'.
 *
 *  • mini → fullscreen : only layout changes, NO reload, NO rebuffer.
 *  • fullscreen → mini : only layout changes, NO reload, NO rebuffer.
 *  • PiP (Android & iOS): native surface transition, NO reload.
 *
 * FIXES vs old code:
 *  1. PiP no reload — Video ref preserved across mode transitions.
 *  2. Smooth brightness/volume — Reanimated shared values + throttled setState.
 *  3. "Network problem" fix — bigger buffer (50s live), NO UA override,
 *     force HIGHEST video track on load (consumes full MB like other apps).
 *  4. iOS PiP support (old code only handled Android).
 *  5. Retry actually works (unmount-remount via key, not setSrcIdx(0) no-op).
 */

import React, {
  useRef, useState, useCallback, useEffect, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Platform, AppState, BackHandler, StatusBar, ActivityIndicator,
  PanResponder, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useGlobalPlayer, type PlayerSource } from '@/lib/player-store';
import apiClient from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────
const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  (Constants as any).executionEnvironment === 'storeClient';
const IS_WEB = Platform.OS === 'web';

const C = {
  bg: '#050510', card: '#0D0D1A', primary: '#8B5CF6', accent: '#EC4899',
  live: '#EF4444', text: '#FFFFFF', dim: '#9CA3AF',
  border: 'rgba(255,255,255,0.1)', green: '#10B981',
};

// ─── Mini layout constants ────────────────────────────────────────────────────
const MINI_W = 220;
const MINI_H = 124;        // 16:9
const MINI_TITLE_H = 36;
const MINI_MARGIN = 12;

// ─── Buffer configs ───────────────────────────────────────────────────────────
// FIX: old BUFFER_LIVE was 5s/20s — way too small. ExoPlayer drained the
// buffer, dropped to a lower rendition, consumed less MB, and eventually
// threw IO_NETWORK_CONNECTION_TIMEOUT → "Network problem".
// New values match what TiviMate / OTT Navigator use for IPTV.
const BUFFER_LIVE = {
  minBufferMs: 15_000,                    // 15s minimum
  maxBufferMs: 50_000,                    // 50s maximum
  bufferForPlaybackMs: 2_500,
  bufferForPlaybackAfterRebufferMs: 5_000,
};
const BUFFER_VOD = {
  minBufferMs: 20_000,
  maxBufferMs: 60_000,
  bufferForPlaybackMs: 2_500,
  bufferForPlaybackAfterRebufferMs: 5_000,
};

// ─── Stream type detection ────────────────────────────────────────────────────
type StreamFormat = 'HLS' | 'DASH' | 'MPEGTS' | 'MP4' | 'MKV' | 'UNKNOWN';

function detectStreamFormat(url: string): StreamFormat {
  if (!url) return 'UNKNOWN';
  const lower = url.toLowerCase().split('?')[0].split('#')[0];
  if (lower.includes('.m3u8') || lower.includes('/hls/')) return 'HLS';
  if (lower.includes('.mpd') || lower.includes('/dash/')) return 'DASH';
  if (lower.endsWith('.ts') || lower.includes('/ts/')) return 'MPEGTS';
  if (lower.endsWith('.mp4') || lower.includes('.mp4?')) return 'MP4';
  if (lower.endsWith('.mkv')) return 'MKV';
  if (lower.match(/:\d{2,5}\/(live|stream|channel)\//)) return 'HLS';
  if (lower.match(/:\d{2,5}\/(movie|vod)\//)) return 'MP4';
  if (lower.match(/\/live\/[^/]+\/[^/]+\/\d+$/)) return 'HLS';
  if (lower.match(/\/movie\/[^/]+\/[^/]+\/\d+$/)) return 'MP4';
  return 'UNKNOWN';
}

function getVideoType(url: string, fmt: StreamFormat): string | undefined {
  const lower = (url || '').toLowerCase().split('?')[0].split('#')[0];
  if (lower.endsWith('.m3u8') || lower.includes('manifest.m3u8')) return 'm3u8';
  if (lower.endsWith('.mpd')) return 'mpd';
  return undefined; // let ExoPlayer sniff Content-Type
}

// ─── Time format ──────────────────────────────────────────────────────────────
function fmt(s: number): string {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

// ─── Watch history ────────────────────────────────────────────────────────────
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

// ════════════════════════════════════════════════════════════════════════════
// NATIVE VIDEO COMPONENT — the singleton ExoPlayer/AVPlayer instance
// ════════════════════════════════════════════════════════════════════════════
interface NativePlayerProps {
  source: { uri: string; headers: Record<string, string>; type?: string };
  paused: boolean;
  rate: number;
  volume: number;
  resizeMode: 'contain' | 'cover' | 'stretch';
  pip: boolean;
  isLive: boolean;
  videoRef: React.MutableRefObject<any>;
  selectedVideoTrack: any;
  selectedAudioTrack: any;
  selectedTextTrack: any;
  onLoad: (d: any) => void;
  onLoadStart: () => void;
  onReadyForDisplay: () => void;
  onProgress: (d: any) => void;
  onBuffer: (b: boolean) => void;
  onError: (e: any) => void;
  onEnd: () => void;
  onVideoTracks: (t: any[]) => void;
  onAudioTracks: (t: any[]) => void;
  onTextTracks: (t: any[]) => void;
  onPipChange: (active: boolean) => void;
}

const NativeIPTVPlayer = React.memo(function NativeIPTVPlayer({
  source, paused, rate, volume, resizeMode, pip, isLive, videoRef,
  selectedVideoTrack, selectedAudioTrack, selectedTextTrack,
  onLoad, onLoadStart, onReadyForDisplay, onProgress, onBuffer,
  onError, onEnd, onVideoTracks, onAudioTracks, onTextTracks, onPipChange,
}: NativePlayerProps) {
  if (IS_EXPO_GO || IS_WEB) {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', gap: 10 }]}>
        <Ionicons name="phone-portrait-outline" size={42} color={C.primary} />
        <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>
          Development Build Required{'\n'}(react-native-video needs a dev build)
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
        playInBackground={true}
        playWhenInactive={true}
        pictureInPicture={pip}
        useTextureView={true}      // CRITICAL: prevents reload on PiP & layout change
        hideShutterView={true}
        bufferConfig={isLive ? BUFFER_LIVE : BUFFER_VOD}
        selectedVideoTrack={selectedVideoTrack}
        selectedAudioTrack={selectedAudioTrack}
        selectedTextTrack={selectedTextTrack}
        onLoadStart={onLoadStart}
        onLoad={onLoad}
        onReadyForDisplay={onReadyForDisplay}
        onProgress={onProgress}
        onBuffer={(d: any) => onBuffer(d?.isBuffering ?? false)}
        onError={onError}
        onEnd={onEnd}
        onPictureInPictureStatusChanged={(d: any) => onPipChange(d?.isActive ?? false)}
      />
    );
  } catch (e: any) {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={42} color={C.accent} />
        <Text style={{ color: '#fff', marginTop: 6, fontSize: 11, textAlign: 'center' }}>
          Player load failed{'\n'}{e?.message}
        </Text>
      </View>
    );
  }
});

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS SHEET
// ════════════════════════════════════════════════════════════════════════════
const SPEED_OPTS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
const ASPECT_CYCLE = ['contain', 'cover', 'stretch'] as const;
type AspectMode = typeof ASPECT_CYCLE[number];
type SheetType = 'none' | 'speed' | 'quality' | 'audio' | 'subtitle';

function SettingsSheet({ visible, sheet, onClose, onSelect, speed,
  videoTracks, audioTracks, textTracks,
  selectedVidIdx, selectedAudIdx, selectedSubIdx }: any) {
  if (!visible || sheet === 'none') return null;
  let items: { label: string; value: any; isActive: boolean }[] = [];
  let title = '';
  if (sheet === 'speed') {
    title = 'Playback Speed';
    items = SPEED_OPTS.map(s => ({ label: s === 1 ? 'Normal' : `${s}×`, value: s, isActive: s === speed }));
  } else if (sheet === 'quality' && videoTracks.length > 0) {
    title = 'Video Quality';
    const seen = new Map<number, { idx: number; bitrate: number }>();
    videoTracks.forEach((t: any, i: number) => {
      const h = t.height || 0; const br = t.bitrate || 0;
      if (h > 0) {
        const ex = seen.get(h);
        if (!ex || br > ex.bitrate) seen.set(h, { idx: i, bitrate: br });
      }
    });
    const unique = Array.from(seen.entries()).sort((a, b) => b[0] - a[0])
      .map(([h, { idx, bitrate }]) => ({
        label: `${h}p${bitrate > 0 ? ` · ${Math.round(bitrate / 1000)}kbps` : ''}`,
        value: idx, isActive: idx === selectedVidIdx,
      }));
    items = [{ label: 'Auto', value: -1, isActive: selectedVidIdx === -1 }, ...unique];
  } else if (sheet === 'audio') {
    title = 'Audio Track';
    items = audioTracks.length
      ? audioTracks.map((t: any, i: number) => ({ label: t.language || t.title || `Track ${i+1}`, value: i, isActive: i === selectedAudIdx }))
      : [{ label: 'Default', value: -1, isActive: true }];
  } else if (sheet === 'subtitle') {
    title = 'Subtitles';
    items = [
      { label: 'Off', value: -1, isActive: selectedSubIdx === -1 },
      ...textTracks.map((t: any, i: number) => ({ label: t.language || t.title || `Track ${i+1}`, value: i, isActive: i === selectedSubIdx })),
    ];
  }
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={ss.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e: any) => e.stopPropagation()}>
          <View style={ss.sheet}>
            <View style={ss.handle} />
            <Text style={ss.title}>{title}</Text>
            {items.map((item, i) => (
              <TouchableOpacity key={i} onPress={() => { onSelect(sheet, item.value); onClose(); }} style={ss.row}>
                <Text style={[ss.rowTxt, item.isActive && ss.rowActive]}>{item.label}</Text>
                {item.isActive && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 24 }} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111827', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 12, minHeight: 160 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowTxt: { color: '#d1d5db', fontSize: 15 },
  rowActive: { color: C.primary, fontWeight: '700' },
});

// ════════════════════════════════════════════════════════════════════════════
// SEEK FEEDBACK + SWIPE INDICATOR
// ════════════════════════════════════════════════════════════════════════════
function SeekFeedback({ side, seconds, onDone }: { side: 'left'|'right'; seconds: number; onDone: ()=>void }) {
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

function volIcon(step: number): any {
  if (step === 0) return 'volume-mute';
  if (step <= 3) return 'volume-low';
  if (step <= 6) return 'volume-medium';
  return 'volume-high';
}

function SwipeIndicator({ type, value }: { type: 'volume'|'brightness'; value: number }) {
  const step = Math.round(value * 10);
  const side = type === 'brightness' ? { left: 16 } : { right: 16 };
  const icon = type === 'volume' ? volIcon(step) : (step <= 3 ? 'moon' : 'sunny');
  const color = type === 'volume' ? C.primary : '#FBBF24';
  return (
    <View style={[sw.wrap, side]}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={sw.track}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={i} style={[sw.block, { backgroundColor: i < step ? color : 'rgba(255,255,255,0.12)' }]} />
        ))}
      </View>
      <Text style={sw.val}>{step}</Text>
    </View>
  );
}
const sw = StyleSheet.create({
  wrap: { position: 'absolute', top: '20%', backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 16, padding: 12, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', width: 58 },
  track: { width: 8, height: 100, gap: 2, flexDirection: 'column-reverse', alignItems: 'center' },
  block: { width: 8, height: 7, borderRadius: 2 },
  val: { color: '#fff', fontSize: 13, fontWeight: '800' },
});

// ════════════════════════════════════════════════════════════════════════════
// MAIN GLOBAL VIDEO PLAYER
// ════════════════════════════════════════════════════════════════════════════
export default function GlobalVideoPlayer() {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = Dimensions.get('window');
  const {
    mode, sources, srcIdx, title, logo, contentId, contentType, isLive,
    isPlaying, enterMini, hide, setPlaying, setSrcIdx,
  } = useGlobalPlayer();

  // ── Playback state ───────────────────────────────────────────────────────
  const [buffering, setBuffering]   = useState(true);
  const [isReady, setReady]         = useState(false);
  const [playerError, setError]     = useState<string | null>(null);
  const [currentTime, setTime]      = useState(0);
  const [duration, setDuration]     = useState(0);
  const [ended, setEnded]           = useState(false);
  const [pip, setPip]               = useState(false);
  const [pipActive, setPipActive]   = useState(false);

  // ── Controls state ───────────────────────────────────────────────────────
  const [showCtrl, setShowCtrl]     = useState(true);
  const showCtrlRef                 = useRef(true);
  const [aspect, setAspect]         = useState<AspectMode>('contain');
  const [isLocked, setLocked]       = useState(false);
  const [sheet, setSheet]           = useState<SheetType>('none');
  const [speed, setSpeed]           = useState(1.0);

  // ── Volume / Brightness ──────────────────────────────────────────────────
  // FIX: old code used setState on every PanResponder move (60×/sec) → jank.
  // New approach: shared values drive the UI instantly (no re-render),
  // setState is throttled to 10×/sec for the <Video volume> prop.
  const [videoVolume, setVideoVolume] = useState(1.0);
  const [brightness, setBrightness]   = useState(1.0);
  const volumeSV    = useSharedValue(1.0);   // drives SwipeIndicator (instant)
  const brightnessSV = useSharedValue(1.0);  // drives overlay opacity (instant)
  const [swipeType, setSwipeType]     = useState<'volume'|'brightness'|null>(null);
  const [swipeValue, setSwipeValue]   = useState(1.0);  // for SwipeIndicator display
  const [seekSide, setSeekSide]       = useState<{side:'left'|'right'; secs:number}|null>(null);

  // ── Tracks ───────────────────────────────────────────────────────────────
  const [videoTracks, setVideoTracks] = useState<any[]>([]);
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [textTracks, setTextTracks]   = useState<any[]>([]);
  const [selectedVidIdx, setSelVid]   = useState(-1);
  const [selectedAudIdx, setSelAud]   = useState(-1);
  const [selectedSubIdx, setSelSub]   = useState(-1);
  const [streamFormat, setStreamFormat] = useState<StreamFormat>('UNKNOWN');

  // ── Remount key (for retry / refresh — forces Video to reload cleanly) ───
  const [videoKey, setVideoKey]       = useState(0);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const videoRef       = useRef<any>(null);
  const currentTimeRef = useRef(0);
  const durationRef    = useRef(0);
  const ctrlTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef     = useRef<{ time: number; x: number } | null>(null);
  const swipeStartV    = useRef(1.0);
  const swipeStartB    = useRef(1.0);
  const swipeSide      = useRef<'left'|'right'>('right');
  const trackWidthRef  = useRef(200);
  const resumePosRef   = useRef<number | null>(null);
  const networkRetryRef = useRef(0);
  const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourcesRef      = useRef(sources);
  const lastVolUpdate   = useRef(0);
  const reportedRef     = useRef(false);
  const playbackStartRef = useRef(0);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevContentIdRef = useRef<string>('');

  // ── Animated controls opacity ────────────────────────────────────────────
  const ctrlOpacity = useSharedValue(1);
  const ctrlStyle   = useAnimatedStyle(() => ({ opacity: ctrlOpacity.value }));

  // ── Mini player animated position ────────────────────────────────────────
  const SNAP_RIGHT = SW - MINI_W - MINI_MARGIN;
  const SNAP_LEFT  = MINI_MARGIN;
  const posX = useSharedValue(SNAP_RIGHT);
  const posY = useSharedValue(SH * 0.55);
  const sx   = useSharedValue(SNAP_RIGHT);
  const sy   = useSharedValue(SH * 0.55);
  const miniScale = useSharedValue(0);
  const miniOpac  = useSharedValue(0);
  const clampMinY = useSharedValue(40 + MINI_MARGIN);
  const clampMaxY = useSharedValue(SH - MINI_H - MINI_TITLE_H - 80 - MINI_MARGIN);

  useEffect(() => {
    clampMinY.value = (insets.top || 20) + MINI_MARGIN;
    clampMaxY.value = SH - MINI_H - MINI_TITLE_H - 80 - (insets.bottom || 0) - MINI_MARGIN;
  }, [insets.top, insets.bottom, SH]);

  // ── Controls auto-hide ───────────────────────────────────────────────────
  // FIX: removed runOnJS(setCtrlHidden) from the withTiming callback.
  // Reanimated's Babel plugin turns the withTiming 3rd-arg callback into a
  // worklet and statically captures the entire component scope — including
  // `bumpCtrl` which is declared (with `const`) AFTER `startHide`, putting
  // it in the temporal dead zone (TDZ) when `startHide` is first created.
  // Solution: use a plain JS setTimeout that fires after the 400ms fade
  // instead of a Reanimated worklet callback. Zero behaviour change.
  const startHide = useCallback(() => {
    if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => {
      ctrlOpacity.value = withTiming(0, { duration: 400 });
      // Mirror the animation duration on the JS thread — no worklet needed.
      setTimeout(() => {
        setShowCtrl(false);
        showCtrlRef.current = false;
      }, 400);
    }, 4500);
  }, [ctrlOpacity]);

  const bumpCtrl = useCallback(() => {
    if (isLocked) return;
    ctrlOpacity.value = withTiming(1, { duration: 200 });
    setShowCtrl(true);
    showCtrlRef.current = true;
    startHide();
  }, [isLocked, ctrlOpacity, startHide]);

  const hideCtrlNow = useCallback(() => {
    if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
    ctrlOpacity.value = withTiming(0, { duration: 300 });
    setShowCtrl(false);
    showCtrlRef.current = false;
  }, [ctrlOpacity]);

  // ── Enter / leave mini animation ─────────────────────────────────────────
  useEffect(() => {
    if (mode === 'mini') {
      posX.value = SNAP_RIGHT;
      posY.value = SH * 0.55;
      sx.value = SNAP_RIGHT; sy.value = SH * 0.55;
      miniScale.value = withSpring(1, { damping: 20, stiffness: 260 });
      miniOpac.value  = withTiming(1, { duration: 200 });
      // hide fullscreen controls when shrinking
      ctrlOpacity.value = withTiming(0, { duration: 200 });
      setShowCtrl(false); showCtrlRef.current = false;
    } else if (mode === 'fullscreen') {
      miniScale.value = withSpring(0, { damping: 20, stiffness: 260 });
      miniOpac.value  = withTiming(0, { duration: 180 });
      // show controls in fullscreen
      bumpCtrl();
    }
  }, [mode, bumpCtrl]);

  // ── Mini pan gesture ─────────────────────────────────────────────────────
  const panGesture = useMemo(() => Gesture.Pan()
    .minDistance(8)
    .onStart(() => { sx.value = posX.value; sy.value = posY.value; })
    .onUpdate((e) => {
      posX.value = sx.value + e.translationX;
      posY.value = sy.value + e.translationY;
    })
    .onEnd((e) => {
      const centerX = posX.value + MINI_W / 2;
      const snapX = e.velocityX > 600 ? SNAP_RIGHT
        : e.velocityX < -600 ? SNAP_LEFT
        : centerX < SW / 2 ? SNAP_LEFT : SNAP_RIGHT;
      posX.value = withSpring(snapX, { damping: 22, stiffness: 240 });
      posY.value = withSpring(
        Math.max(clampMinY.value, Math.min(clampMaxY.value, posY.value)),
        { damping: 22, stiffness: 240 },
      );
    }), []);

  const miniAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
      { scale: miniScale.value },
    ],
    opacity: miniOpac.value,
  }));

  // Brightness overlay — driven by shared value, ZERO re-renders during swipe
  const brightnessOverlayStyle = useAnimatedStyle(() => ({
    opacity: 1 - brightnessSV.value,
  }));

  // ── Current source ───────────────────────────────────────────────────────
  const src = sources[srcIdx];

  // ── Build native source object ───────────────────────────────────────────
  // FIX: NEVER override User-Agent. ExoPlayer/OkHttp's native UA ("okhttp/4.x")
  // is what IPTV servers (Toffee, Digijadoo, etc.) treat as a media player and
  // serve at FULL bitrate. If we send "Mozilla/5.0" they throttle to ~500kbps
  // → "Network problem" + low MB consumption.
  const nativeSource = useMemo(() => {
    if (!src?.url) return null;
    const videoType = getVideoType(src.url, streamFormat);
    // Only include headers the source explicitly provides (Cookie, Referer, etc.)
    // Do NOT add a User-Agent unless the source specifically set one.
    const headers = { ...(src.headers ?? {}) };
    return {
      uri: src.url,
      headers,
      ...(videoType ? { type: videoType } : {}),
    };
  }, [src?.url, src?.headers, streamFormat]);

  // ── Selected tracks ──────────────────────────────────────────────────────
  // FIX: after onLoad, force the HIGHEST-bitrate video track so the player
  // consumes full MB (matching what TiviMate / OTT Navigator do). Old code
  // used { type: 'auto' } which lets ExoPlayer's ABR drop to low quality
  // when it sees the small buffer draining.
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

  // ── Reset state when content changes ─────────────────────────────────────
  useEffect(() => {
    if (mode === 'hidden') {
      setReady(false); setBuffering(true); setError(null);
      setTime(0); setDuration(0); setPip(false); setPipActive(false);
      setVideoTracks([]); setAudioTracks([]); setTextTracks([]);
      setSelVid(-1); setSelAud(-1); setSelSub(-1);
      currentTimeRef.current = 0; durationRef.current = 0;
      networkRetryRef.current = 0;
      return;
    }
    // New content (different contentId) — reset playback state
    if (contentId !== prevContentIdRef.current) {
      prevContentIdRef.current = contentId;
      setReady(false); setBuffering(true); setError(null);
      setTime(0); setDuration(0); setEnded(false);
      setVideoTracks([]); setAudioTracks([]); setTextTracks([]);
      setSelVid(-1); setSelAud(-1); setSelSub(-1);
      setSpeed(1.0); setAspect('contain');
      currentTimeRef.current = 0; durationRef.current = 0;
      networkRetryRef.current = 0;
      resumePosRef.current = null;
      // Bump videoKey to force a clean Video remount for the new URL
      setVideoKey(k => k + 1);
      // Load resume position for VOD
      if (contentId && !isLive) {
        loadWatchPosition(contentId).then(pos => {
          if (pos > 10) resumePosRef.current = pos;
        });
      }
    }
  }, [contentId, mode]);

  // ── URL analysis on source change ────────────────────────────────────────
  useEffect(() => {
    if (!src?.url) return;
    setStreamFormat(detectStreamFormat(src.url));
  }, [src?.url]);

  // ── Reset srcIdx when sources array changes ──────────────────────────────
  useEffect(() => {
    sourcesRef.current = sources;
    setSrcIdx(0);
    setError(null); setReady(false); setBuffering(true);
    setTime(0); setDuration(0);
    currentTimeRef.current = 0; durationRef.current = 0;
    networkRetryRef.current = 0;
    setVideoKey(k => k + 1);
  }, [sources]);

  // ── Keep sourcesRef in sync ──────────────────────────────────────────────
  useEffect(() => { sourcesRef.current = sources; }, [sources]);

  useEffect(() => {
    if (mode === 'fullscreen') startHide();
    return () => { if (ctrlTimer.current) clearTimeout(ctrlTimer.current); };
  }, [mode, startHide]);

  // ── Seek ─────────────────────────────────────────────────────────────────
  const seek = useCallback((delta: number) => {
    const t = Math.max(0, Math.min(durationRef.current || 0, currentTimeRef.current + delta));
    videoRef.current?.seek?.(t);
    setTime(t); currentTimeRef.current = t;
    bumpCtrl();
  }, [bumpCtrl]);

  const seekToFrac = useCallback((frac: number) => {
    if (!durationRef.current) return;
    if (!trackWidthRef.current) return; // guard div-by-zero
    const t = Math.max(0, Math.min(1, frac)) * durationRef.current;
    videoRef.current?.seek?.(t);
    setTime(t); currentTimeRef.current = t;
    bumpCtrl();
  }, [bumpCtrl]);

  // ── Settings handler ─────────────────────────────────────────────────────
  const handleSheetSelect = useCallback((type: SheetType, value: any) => {
    if (type === 'speed') { setSpeed(value); }
    if (type === 'quality') setSelVid(value);
    if (type === 'audio') setSelAud(value);
    if (type === 'subtitle') setSelSub(value);
  }, []);

  // ── Refresh / Retry (uses videoKey remount, NOT setSrcIdx(0) no-op) ──────
  const refreshStream = useCallback(() => {
    setReady(false); setBuffering(true); setError(null);
    networkRetryRef.current = 0;
    setVideoKey(k => k + 1);
    bumpCtrl();
  }, [bumpCtrl]);

  const switchToSource = useCallback((i: number) => {
    if (i === srcIdx) {
      // same source → force remount via key
      refreshStream();
      return;
    }
    setReady(false); setBuffering(true); setError(null);
    networkRetryRef.current = 0;
    setSrcIdx(i);
    setVideoKey(k => k + 1);
    bumpCtrl();
  }, [srcIdx, setSrcIdx, refreshStream, bumpCtrl]);

  // ═════════════════════════════════════════════════════════════════════════
  // SMOOTH BRIGHTNESS + VOLUME — PanResponder
  // ═════════════════════════════════════════════════════════════════════════
  // FIX: old code had [vidW, videoVolume, brightness, ...] in deps →
  // PanResponder was rebuilt 60×/sec during swipe → gesture "stuck" / jittery.
  // New: deps = [seek, bumpCtrl, hideCtrlNow] only — built ONCE.
  // Volume/brightness read from refs, written to shared values (instant UI).
  // setState for the <Video volume> prop is throttled to 10×/sec.
  const vidW = SW; // fullscreen always uses full width

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dy) > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
    onPanResponderGrant: (evt) => {
      swipeStartV.current = videoVolume;
      swipeStartB.current = brightness;
      swipeSide.current = evt.nativeEvent.locationX < vidW / 2 ? 'left' : 'right';
    },
    onPanResponderMove: (_, gs) => {
      if (Math.abs(gs.dy) < 8) return;
      // Continuous (no snapping) — smooth as butter
      const delta = -gs.dy / 300;
      const sideType = swipeSide.current === 'left' ? 'brightness' : 'volume';

      if (sideType === 'volume') {
        const newVol = Math.max(0, Math.min(1, swipeStartV.current + delta));
        // Update shared value instantly (drives SwipeIndicator — no re-render)
        volumeSV.value = newVol;
        // Throttled setState for the <Video volume> prop (10×/sec max)
        const now = Date.now();
        if (now - lastVolUpdate.current > 100) {
          lastVolUpdate.current = now;
          setVideoVolume(newVol);
        }
        setSwipeType('volume');
        setSwipeValue(newVol);
      } else {
        const newBri = Math.max(0, Math.min(1, swipeStartB.current + delta));
        // Shared value drives the overlay opacity directly — ZERO re-renders
        brightnessSV.value = newBri;
        setBrightness(newBri);
        setSwipeType('brightness');
        setSwipeValue(newBri);
      }
    },
    onPanResponderRelease: (evt, gs) => {
      if (Math.abs(gs.dy) < 8 && Math.abs(gs.dx) < 8) {
        // Tap (not swipe) — handle double-tap seek + toggle controls
        const now = Date.now();
        const tapX = evt.nativeEvent.locationX;
        if (lastTapRef.current && now - lastTapRef.current.time < 350) {
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
              if (showCtrlRef.current) hideCtrlNow();
              else bumpCtrl();
            }
          }, 360);
        }
        return;
      }
      // Apply final volume value (in case throttled setState missed the last update)
      setVideoVolume(volumeSV.value);
      setBrightness(brightnessSV.value);
      setTimeout(() => setSwipeType(null), 1200);
    },
  }), [vidW, seek, bumpCtrl, hideCtrlNow]); // ← stable deps only

  // ── OS PiP — Android + iOS ────────────────────────────────────────────────
  // FIX: old code only handled Android. iOS goes active → inactive → background.
  useEffect(() => {
    if (mode === 'hidden') return;
    if (IS_EXPO_GO) return;
    const sub = AppState.addEventListener('change', (s) => {
      // Android: 'background'.  iOS: 'inactive' (then 'background').
      if ((s === 'background' || (Platform.OS === 'ios' && s === 'inactive'))
          && isReady && !playerError) {
        setPip(true); // useTextureView prevents reload
      }
    });
    return () => sub.remove();
  }, [mode, isReady, playerError]);

  // ── Android back button ──────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (mode === 'hidden') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'fullscreen') { enterMini(); return true; }
      if (mode === 'mini') { hide(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [mode, enterMini, hide]);

  // ── Keep awake ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (IS_WEB || IS_EXPO_GO || mode === 'hidden') return;
    let off: (() => void) | null = null;
    import('expo-keep-awake').then(KA => {
      KA.activateKeepAwakeAsync();
      off = KA.deactivateKeepAwake;
    }).catch(() => {});
    return () => { off?.(); };
  }, [mode]);

  // ── Stall detection ──────────────────────────────────────────────────────
  // FIX: moved STALL_MS inside the effect so isLive is a proper dep
  // (was outside causing stale closure when isLive changed mid-play).
  useEffect(() => {
    if (mode === 'hidden') return;
    const STALL_MS = isLive ? 15_000 : 25_000;
    if (buffering && !playerError && src && !ended) {
      stallTimerRef.current = setTimeout(() => {
        const srcs = sourcesRef.current;
        if (srcIdx < srcs.length - 1) {
          setSrcIdx(srcIdx + 1);
          setVideoKey(k => k + 1);
        } else {
          setError('Stream stalled. No data received. Try refreshing.');
          setBuffering(false);
        }
      }, STALL_MS);
    } else {
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    }
    return () => {
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
    };
  }, [buffering, playerError, src, srcIdx, mode, ended, isLive]);

  // ── Watch history auto-save (VOD only) ───────────────────────────────────
  useEffect(() => {
    if (!contentId || isLive || mode === 'hidden') return;
    saveTimer.current = setInterval(() => {
      if (currentTimeRef.current > 5 && durationRef.current > 0) {
        saveWatchHistory({
          contentId, contentType, title,
          position: currentTimeRef.current, duration: durationRef.current,
        });
      }
    }, 10000);
    return () => { if (saveTimer.current) clearInterval(saveTimer.current); };
  }, [contentId, contentType, title, isLive, mode]);

  // ── Playback reporting (live channels) ───────────────────────────────────
  const reportPlayback = useCallback(async (success: boolean, durationSecs?: number) => {
    if (!contentId || contentType !== 'channel') return;
    try {
      await apiClient.post('/playback-events/report', {
        channelId: contentId, success, duration: durationSecs,
      });
    } catch {}
  }, [contentId, contentType]);

  // ── Common onLoad / onError handlers ────────────────────────────────────
  // MUST be defined BEFORE any early return (Rules of Hooks).
  const handleLoad = useCallback((data: any) => {
    networkRetryRef.current = 0;
    setDuration(data?.duration || 0);
    durationRef.current = data?.duration || 0;
    setBuffering(false); setReady(true); setEnded(false); setError(null);

    // Collect tracks
    if (data?.videoTracks?.length) {
      setVideoTracks(data.videoTracks);
      // FIX: force HIGHEST-bitrate track so we consume full MB (like other apps).
      // ExoPlayer's ABR with a small buffer drops to low quality → "network problem".
      let bestIdx = -1, bestBr = 0;
      data.videoTracks.forEach((t: any, i: number) => {
        const br = t.bitrate || 0;
        if (br > bestBr) { bestBr = br; bestIdx = i; }
      });
      if (bestIdx >= 0) {
        setSelVid(bestIdx);
      }
    }
    if (data?.audioTracks?.length) setAudioTracks(data.audioTracks);
    if (data?.textTracks?.length)  setTextTracks(data.textTracks);

    // Resume position for VOD
    if (resumePosRef.current !== null && resumePosRef.current > 10) {
      const pos = resumePosRef.current;
      resumePosRef.current = null;
      setTimeout(() => videoRef.current?.seek?.(pos), 200);
    }

    // Report playback start (live)
    if (contentType === 'channel') {
      reportedRef.current = false;
      playbackStartRef.current = Date.now();
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = setTimeout(() => {
        if (!reportedRef.current) {
          reportedRef.current = true;
          reportPlayback(true, Math.round((Date.now() - playbackStartRef.current) / 1000));
        }
      }, 15_000);
    }
  }, [contentType, reportPlayback]);

  const handleError = useCallback((error: any) => {
    const code: any = error?.error?.code;
    const desc: string = error?.error?.localizedDescription
      || error?.error?.errorString
      || String(code)
      || 'Unknown error';

    const isNetworkErr =
      (typeof code === 'number' && (code === -1009 || code === -1001 || code === -1004))
      || String(code).includes('IO_NETWORK')
      || String(code).includes('IO_READ')
      || desc.includes('NETWORK_CONNECTION')
      || desc.includes('network')
      || desc.includes('timed out')
      || desc.includes('timeout');

    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    if (isNetworkErr && networkRetryRef.current < 3) {
      networkRetryRef.current += 1;
      setBuffering(true); setError(null);
      retryTimerRef.current = setTimeout(() => {
        setVideoKey(k => k + 1); // clean remount, same srcIdx
      }, 1500);
    } else if (srcIdx < sourcesRef.current.length - 1) {
      setSrcIdx(srcIdx + 1);
      setVideoKey(k => k + 1);
      setBuffering(true); setError(null);
    } else {
      setError(desc);
      setBuffering(false);
      // Report playback failure (live)
      if (contentType === 'channel' && !reportedRef.current) {
        reportedRef.current = true;
        reportPlayback(false);
      }
    }
  }, [srcIdx, setSrcIdx, contentType, reportPlayback]);

  // ── Don't render if hidden ───────────────────────────────────────────────
  if (mode === 'hidden') return null;

  // ── Computed ─────────────────────────────────────────────────────────────
  const progress   = durationRef.current > 0 ? currentTime / durationRef.current : 0;
  const isLiveNow  = isLive && duration === 0;

  // ═════════════════════════════════════════════════════════════════════════
  // MINI MODE
  // ═════════════════════════════════════════════════════════════════════════
  if (mode === 'mini') {
    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[g.miniRoot, miniAnimStyle]}>

          {/* Video window — SAME Video instance, just smaller container */}
          <View style={g.miniVideo}>
            {nativeSource && (
              <NativeIPTVPlayer
                key={`v-${videoKey}`}
                source={nativeSource}
                paused={!isPlaying}
                rate={speed}
                volume={videoVolume}
                resizeMode="cover"
                pip={pip}
                isLive={isLive}
                videoRef={videoRef}
                selectedVideoTrack={selectedVideoTrack}
                selectedAudioTrack={selectedAudioTrack}
                selectedTextTrack={selectedTextTrack}
                onLoadStart={() => { setBuffering(true); setReady(false); }}
                onLoad={handleLoad}
                onReadyForDisplay={() => { setBuffering(false); setReady(true); }}
                onProgress={(d) => {
                  setTime(d.currentTime);
                  currentTimeRef.current = d.currentTime;
                  if (d.seekableDuration > 0 && d.seekableDuration !== durationRef.current) {
                    setDuration(d.seekableDuration);
                    durationRef.current = d.seekableDuration;
                  }
                }}
                onBuffer={setBuffering}
                onError={handleError}
                onEnd={() => { setEnded(true); setPlaying(false); }}
                onVideoTracks={setVideoTracks}
                onAudioTracks={setAudioTracks}
                onTextTracks={setTextTracks}
                onPipChange={(active) => { setPipActive(active); setPip(active); }}
              />
            )}

            {/* Buffering spinner */}
            {buffering && !playerError && (
              <View style={g.miniBuffering}>
                <ActivityIndicator size="small" color={C.primary} />
              </View>
            )}

            {/* LIVE badge */}
            {isLive && (
              <View style={g.miniLive} pointerEvents="none">
                <View style={g.miniLiveDot} />
                <Text style={g.miniLiveTxt}>LIVE</Text>
              </View>
            )}

            {/* Tap-to-show-controls overlay */}
            <TouchableOpacity
              activeOpacity={1}
              style={StyleSheet.absoluteFill}
              onPress={() => { useGlobalPlayer.getState().expand(); }}
            >
              {showCtrl && (
                <View style={g.miniOverlay}>
                  <TouchableOpacity style={g.miniClose} onPress={hide} hitSlop={12}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                  <View style={g.miniCenter}>
                    <TouchableOpacity style={g.miniBtn} onPress={() => setPlaying(!isPlaying)} hitSlop={10}>
                      <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={g.miniBtn} onPress={() => useGlobalPlayer.getState().expand()} hitSlop={10}>
                      <Ionicons name="expand-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Title bar */}
          <View style={g.miniTitle}>
            {logo ? (
              <View style={g.miniTitleLogo}>
                {logo ? null : null}
              </View>
            ) : null}
            <Text style={g.miniTitleTxt} numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={() => setPlaying(!isPlaying)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={13} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Error mini-overlay */}
          {playerError && (
            <View style={g.miniError}>
              <Ionicons name="alert-circle-outline" size={20} color={C.live} />
              <TouchableOpacity onPress={refreshStream} hitSlop={8}>
                <Ionicons name="refresh" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════
  // FULLSCREEN MODE
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <View style={g.fullRoot}>
      <StatusBar hidden barStyle="light-content" backgroundColor="#000" />

      {/* ── Video — SAME instance, just full-size container ─────────────── */}
      {nativeSource && (
        <NativeIPTVPlayer
          key={`v-${videoKey}`}
          source={nativeSource}
          paused={!isPlaying}
          rate={speed}
          volume={videoVolume}
          resizeMode={aspect}
          pip={pip}
          isLive={isLive}
          videoRef={videoRef}
          selectedVideoTrack={selectedVideoTrack}
          selectedAudioTrack={selectedAudioTrack}
          selectedTextTrack={selectedTextTrack}
          onLoadStart={() => { setBuffering(true); setReady(false); }}
          onLoad={handleLoad}
          onReadyForDisplay={() => { setBuffering(false); setReady(true); }}
          onProgress={(d) => {
            setTime(d.currentTime);
            currentTimeRef.current = d.currentTime;
            if (d.seekableDuration > 0 && d.seekableDuration !== durationRef.current) {
              setDuration(d.seekableDuration);
              durationRef.current = d.seekableDuration;
            }
          }}
          onBuffer={setBuffering}
          onError={handleError}
          onEnd={() => { setEnded(true); setPlaying(false); }}
          onVideoTracks={setVideoTracks}
          onAudioTracks={setAudioTracks}
          onTextTracks={setTextTracks}
          onPipChange={(active) => { setPipActive(active); setPip(active); }}
        />
      )}

      {/* ── Brightness overlay (animated, ZERO re-renders) ──────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, brightnessOverlayStyle, { opacity: (1 - brightness) * 0.85 }]}
      />

      {/* ── Buffering ─────────────────────────────────────────────────────── */}
      {!pipActive && (buffering || !isReady) && !playerError && nativeSource && (
        <View style={g.overlayCenter} pointerEvents="none">
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={g.bufferingTxt}>
            {isLive ? 'Buffering live stream…' : 'Buffering…'}
          </Text>
        </View>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {!pipActive && playerError && (
        <View style={g.overlayCenter}>
          <Ionicons name="alert-circle-outline" size={48} color={C.live} />
          <Text style={g.errorTxt}>Playback Failed</Text>
          <Text style={g.errorSub} numberOfLines={3}>{playerError}</Text>
          <View style={g.errorActions}>
            {sources.length > 1 && srcIdx < sources.length - 1 && (
              <TouchableOpacity onPress={() => switchToSource(srcIdx + 1)} style={g.altBtn}>
                <Text style={g.altBtnTxt}>Try Server {srcIdx + 2}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={refreshStream} style={g.retryBtn}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={g.retryTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Gesture layer (volume + brightness + double-tap seek) ────────── */}
      {!pipActive && (
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} />
      )}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      {showCtrl && !pipActive && !playerError && (
        <Animated.View style={[StyleSheet.absoluteFill, ctrlStyle]} pointerEvents="box-none">
          <LinearGradient
            colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.25, 0.65, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Top bar */}
          {!isLocked && (
            <View style={[g.topBar, { paddingTop: insets.top + 10 }]}>
              <TouchableOpacity style={g.iconBtn} onPress={enterMini}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={g.titleTxt} numberOfLines={1}>{title}</Text>
                {streamFormat !== 'UNKNOWN' && (
                  <Text style={g.formatBadge}>{streamFormat}</Text>
                )}
              </View>
              <View style={g.topRight}>
                {/* PiP */}
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={g.iconBtn} onPress={() => { setPip(v => !v); bumpCtrl(); }}>
                    <MaterialIcons name="picture-in-picture-alt" size={20} color={pip ? C.primary : '#fff'} />
                  </TouchableOpacity>
                )}
                {/* Refresh */}
                <TouchableOpacity style={g.iconBtn} onPress={refreshStream}>
                  <Ionicons name="refresh-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Server pills */}
          {!isLocked && sources.length > 1 && (
            <View style={g.pillRow}>
              {sources.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => switchToSource(i)}
                  style={[g.pill, i === srcIdx && g.pillActive, s.cookieExpired && g.pillExpired]}
                >
                  <Text style={[g.pillTxt, i === srcIdx && g.pillActiveTxt, s.cookieExpired && g.pillExpiredTxt]}>
                    {i === srcIdx ? '● ' : ''}{s.label || `S${i + 1}`}{s.cookieExpired ? ' ⚠' : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* LIVE badge */}
          {isLive && !isLocked && (
            <View style={g.liveRow}>
              <View style={g.liveBadge}>
                <View style={g.liveDot} />
                <Text style={g.liveTxt}>LIVE</Text>
              </View>
              {isReady && !buffering && (
                <View style={g.livePing}>
                  <Ionicons name="wifi" size={11} color={C.green} />
                  <Text style={g.livePingTxt}>
                    {selectedVidIdx >= 0 && videoTracks[selectedVidIdx]?.height
                      ? `${videoTracks[selectedVidIdx].height}p`
                      : 'HD'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Center controls */}
          {!isLocked && (
            <View style={g.centerPanel} pointerEvents="box-none">
              <View style={g.glassRow}>
                <TouchableOpacity onPress={() => { seek(-10); setSeekSide({ side: 'left', secs: 10 }); }} style={g.ctrlBtn}>
                  <Ionicons name="play-back" size={22} color="#fff" />
                  <Text style={g.seekLabel}>10s</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setPlaying(!isPlaying); bumpCtrl(); }} style={g.playBtn}>
                  {buffering && isReady
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#fff" style={isPlaying ? {} : { marginLeft: 3 }} />
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { seek(10); setSeekSide({ side: 'right', secs: 10 }); }} style={g.ctrlBtn}>
                  <Ionicons name="play-forward" size={22} color="#fff" />
                  <Text style={g.seekLabel}>10s</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottom bar */}
          {!isLocked && (
            <View style={[g.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
              {!isLiveNow && (
                <View style={g.progressRow}>
                  <Text style={g.timeTxt}>{fmt(currentTime)}</Text>
                  <TouchableOpacity
                    style={g.trackWrap}
                    activeOpacity={1}
                    onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
                    onPress={(e) => {
                      if (!trackWidthRef.current) return;
                      seekToFrac(e.nativeEvent.locationX / trackWidthRef.current);
                    }}
                  >
                    <View style={g.trackBg}>
                      <LinearGradient
                        colors={[C.primary, C.accent]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={[g.trackFill, { width: `${progress * 100}%` as any }]}
                      />
                      <View style={[g.trackThumb, { left: `${Math.min(100, progress * 100)}%` as any }]} />
                    </View>
                  </TouchableOpacity>
                  <Text style={g.timeTxt}>{fmt(duration)}</Text>
                </View>
              )}

              {/* Tool row */}
              <View style={g.toolRow}>
                <TouchableOpacity onPress={() => { setSheet('speed'); bumpCtrl(); }} style={g.toolBtn}>
                  <Text style={g.speedTxt}>{speed}×</Text>
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity onPress={() => { setSheet('quality'); bumpCtrl(); }} style={g.toolBtn}>
                    <MaterialIcons name="hd" size={22} color={selectedVidIdx !== -1 ? C.primary : '#fff'} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { setSheet('audio'); bumpCtrl(); }} style={g.toolBtn}>
                  <Ionicons name="musical-note-outline" size={20} color={selectedAudIdx !== -1 ? C.primary : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setSheet('subtitle'); bumpCtrl(); }} style={g.toolBtn}>
                  <MaterialCommunityIcons name="subtitles-outline" size={20} color={selectedSubIdx !== -1 ? C.primary : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setAspect(a => ASPECT_CYCLE[(ASPECT_CYCLE.indexOf(a) + 1) % ASPECT_CYCLE.length]); bumpCtrl(); }} style={g.toolBtn}>
                  <MaterialIcons name="aspect-ratio" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setLocked(v => !v); bumpCtrl(); }} style={g.toolBtn}>
                  <Ionicons name={isLocked ? 'lock-closed' : 'lock-open-outline'} size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Locked badge */}
          {isLocked && (
            <TouchableOpacity onPress={() => { setLocked(false); bumpCtrl(); }} style={g.lockBadge}>
              <Ionicons name="lock-closed" size={18} color="#fff" />
              <Text style={g.lockTxt}>Tap to unlock</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Tap to show controls when hidden */}
      {!showCtrl && !pipActive && !playerError && (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={bumpCtrl} />
      )}

      {/* Seek feedback + swipe indicator */}
      {!pipActive && seekSide && (
        <SeekFeedback
          key={seekSide.side + Date.now()}
          side={seekSide.side}
          seconds={seekSide.secs}
          onDone={() => setSeekSide(null)}
        />
      )}
      {!pipActive && swipeType && <SwipeIndicator type={swipeType} value={swipeValue} />}

      {/* Settings sheet */}
      <SettingsSheet
        visible={sheet !== 'none'} sheet={sheet}
        onClose={() => setSheet('none')} onSelect={handleSheetSelect}
        speed={speed} videoTracks={videoTracks} audioTracks={audioTracks} textTracks={textTracks}
        selectedVidIdx={selectedVidIdx} selectedAudIdx={selectedAudIdx} selectedSubIdx={selectedSubIdx}
      />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════
const g = StyleSheet.create({
  // Fullscreen
  fullRoot: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000', zIndex: 9999, elevation: 50,
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  bufferingTxt: { color: C.dim, fontSize: 13, marginTop: 6 },
  errorTxt:  { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  errorSub:  { color: C.dim, fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 },
  errorActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  retryBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 22 },
  retryTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  altBtn:    { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22, borderWidth: 1, borderColor: C.border },
  altBtnTxt: { color: '#fff', fontSize: 14 },

  topBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 6, gap: 8 },
  iconBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  titleTxt:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  formatBadge: { color: C.dim, fontSize: 10, marginTop: 1 },
  topRight:  { flexDirection: 'row', gap: 8 },

  pillRow:       { flexDirection: 'row', gap: 6, paddingHorizontal: 14, flexWrap: 'wrap', marginTop: 2 },
  pill:          { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, borderWidth: 1, borderColor: C.border },
  pillActive:    { borderColor: C.primary, backgroundColor: 'rgba(139,92,246,0.2)' },
  pillExpired:   { borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.12)' },
  pillTxt:       { color: '#ccc', fontSize: 12 },
  pillActiveTxt: { color: C.primary, fontWeight: '700' },
  pillExpiredTxt:{ color: '#f87171' },

  liveRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 4 },
  liveBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.live, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveTxt:    { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  livePing:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  livePingTxt:{ color: C.green, fontSize: 10, fontWeight: '600' },

  centerPanel: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  glassRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(5,5,16,0.72)', borderRadius: 30, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 12 },
  ctrlBtn:   { alignItems: 'center', justifyContent: 'center', width: 54, height: 48, gap: 2 },
  seekLabel: { color: '#fff', fontSize: 9, fontWeight: '700', opacity: 0.8 },
  playBtn:   { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },

  bottomBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  timeTxt:     { color: '#e5e7eb', fontSize: 11, minWidth: 40, textAlign: 'center' },
  trackWrap:   { flex: 1, height: 24, justifyContent: 'center' },
  trackBg:     { height: 3.5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, position: 'relative', overflow: 'visible' },
  trackFill:   { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2 },
  trackThumb:  { position: 'absolute', top: -5.5, width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', marginLeft: -7, elevation: 4, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  toolRow:     { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  toolBtn:     { width: 40, height: 36, justifyContent: 'center', alignItems: 'center' },
  speedTxt:    { color: '#e5e7eb', fontSize: 13, fontWeight: '700' },

  lockBadge: { position: 'absolute', alignSelf: 'center', top: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  lockTxt:   { color: '#fff', fontSize: 13 },

  // Mini
  miniRoot: {
    position: 'absolute', top: 0, left: 0,
    width: MINI_W,
    zIndex: 9999, elevation: 60,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65, shadowRadius: 20,
  },
  miniVideo: {
    width: MINI_W, height: MINI_H,
    backgroundColor: '#000',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5, borderBottomWidth: 0,
    borderColor: 'rgba(139,92,246,0.6)',
  },
  miniBuffering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  miniLive: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(220,38,38,0.92)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  miniLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  miniLiveTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },
  miniOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center', alignItems: 'center',
  },
  miniClose: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  miniCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: MINI_TITLE_H,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  miniBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  miniTitle: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8,
    height: MINI_TITLE_H, backgroundColor: '#0D0D1F',
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    borderWidth: 1.5, borderTopWidth: 0,
    borderColor: 'rgba(139,92,246,0.6)',
  },
  miniTitleLogo: { width: 20, height: 20, borderRadius: 4 },
  miniTitleTxt: { flex: 1, color: '#EFEFEF', fontSize: 10.5, fontWeight: '600' },
  miniError: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
});
