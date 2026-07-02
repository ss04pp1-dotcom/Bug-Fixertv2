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
  View, Text, TouchableOpacity,
  Platform, BackHandler, Modal, useWindowDimensions, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGlobalPlayer, type PlayerSource } from '@/lib/player-store';
import { C, IS_EXPO_GO, IS_WEB, BUFFER_LIVE, BUFFER_VOD } from './player/constants';
import { g, db, MINI_W, MINI_H, MINI_TITLE_H, MINI_MARGIN, TAB_BAR_BASE_H } from './player/playerStyles';
import { NativeIPTVPlayer } from './player/NativeIPTVPlayer';
import { SettingsSheet, type AspectMode, type SheetType } from './player/SettingsSheet';
import { PosterFade } from './player/PosterFade';
import { NextEpisodeOverlay } from './player/NextEpisodeOverlay';
import { MiniOverlay } from './player/MiniOverlay';
import { TopOverlay } from './player/TopOverlay';
import { FullscreenOverlay } from './player/FullscreenOverlay';
import { router } from 'expo-router';
import apiClient from '@/lib/api';
import * as ScreenOrientation from 'expo-screen-orientation';


// ─── Stream type detection ────────────────────────────────────────────────────
type StreamFormat = 'HLS' | 'DASH' | 'MPEGTS' | 'MP4' | 'MKV' | 'UNKNOWN';

/**
 * Detect stream format from the URL.
 *
 * Checks query-string params FIRST (most reliable signal when present):
 *   ?output=ts / ?type=ts  → MPEGTS   (raw transport stream)
 *   ?output=m3u8            → HLS
 *
 * Also scans inside query-parameter VALUES for embedded URLs, e.g.:
 *   ?url=https://cdn.example.com/stream.m3u8?id=xyz  → HLS
 *   (Proxy/worker URLs that wrap the real stream URL)
 *
 * Then falls back to path-based detection for common extensions and
 * Xtream-Codes / MAG / Stalker URL patterns.
 */
function detectStreamFormat(url: string): StreamFormat {
  if (!url) return 'UNKNOWN';
  const lower = url.toLowerCase();
  const qIdx  = lower.indexOf('?');
  const path  = (qIdx >= 0 ? lower.slice(0, qIdx) : lower).split('#')[0];
  const query = qIdx >= 0 ? lower.slice(qIdx) : '';

  // ── Query-string signals (authoritative when present) ─────────────────────
  if (query.includes('output=ts') || query.includes('type=ts'))   return 'MPEGTS';
  if (query.includes('output=m3u_plus') || query.includes('output=m3u8') ||
      query.includes('type=m3u'))                                  return 'HLS';

  // ── Path / extension ──────────────────────────────────────────────────────
  if (path.includes('.m3u8') || path.includes('/hls/'))           return 'HLS';
  if (path.includes('.mpd')  || path.includes('/dash/'))          return 'DASH';
  if (path.endsWith('.ts')   || path.includes('/ts/'))            return 'MPEGTS';
  if (path.endsWith('.mp4')  || path.includes('.mp4'))            return 'MP4';
  if (path.endsWith('.mkv'))                                       return 'MKV';

  // ── Embedded URL inside query value (e.g. proxy/worker pattern) ──────────
  // e.g. https://worker.dev/?url=https://cdn.example.com/stream.m3u8?id=...
  // The .m3u8 appears in the query value, not the outer path or key.
  if (query.includes('.m3u8'))   return 'HLS';
  if (query.includes('.mpd'))    return 'DASH';

  // ── Xtream Codes / MAG / Stalker URL patterns ─────────────────────────────
  // /live/user/pass/<id>   — live channels: always HLS by default
  if (path.match(/\/live\/[^/]+\/[^/]+\/\d+(?:\.\w+)?$/))        return 'HLS';
  // /movie/user/pass/<id>  — VOD movies
  if (path.match(/\/movie\/[^/]+\/[^/]+\/\d+(?:\.\w+)?$/))       return 'MP4';
  // Generic path segments (/live/, /stream/, /channel/ → HLS; /vod/, /movie/ → MP4)
  if (path.match(/(:\d{2,5})?\/(live|stream|channel)\//))         return 'HLS';
  if (path.match(/(:\d{2,5})?\/(movie|vod)\//))                   return 'MP4';

  return 'UNKNOWN';
}

/**
 * Return the react-native-video `type` hint for ExoPlayer.
 *
 * Providing the type avoids an extra HTTP round-trip where ExoPlayer would
 * otherwise sniff the Content-Type header — on some IPTV servers this
 * sniff causes a 5-30 s delay before the first frame.
 *
 * For Xtream Codes live paths (no extension, but format=HLS) we now pass
 * 'm3u8' explicitly so ExoPlayer uses the HLS renderer from the first byte.
 * If the server actually returns raw TS instead, ExoPlayer's HLS parser
 * rejects it within ~1 s and re-probes — still faster than a blind sniff
 * that blocks for 20+ s on many IPTV CDNs.
 */
// getVideoType: return an ExoPlayer type hint ONLY when the URL itself gives
// an unambiguous signal.  Never guess from path patterns like /live/ or /movie/
// because Xtream Codes servers can serve either HLS *or* raw MPEG-TS on those
// same paths depending on server config — forcing 'm3u8' causes a silent black
// screen on TS-serving nodes.  ExoPlayer's content-type sniff is < 500 ms on
// live streams; that is a better trade-off than a wrong type that never plays.
//
// Signals we trust:
//  .m3u8 / manifest.m3u8 / /hls/  → definitely HLS
//  .mpd  / manifest.mpd  / /dash/ → definitely DASH
//  .mp4 / .mkv / .ts              → progressive/TS — let ExoPlayer handle natively
//  query: output=m3u8|m3u_plus    → panel said HLS explicitly
//  query: output=ts|type=ts       → panel said TS explicitly
//  everything else (Xtream /live/, /movie/, plain HTTP, RTSP, UNKNOWN) → sniff
function getVideoType(url: string, fmt: StreamFormat): string | undefined {
  const raw   = (url || '').toLowerCase();
  const noQ   = raw.split('?')[0].split('#')[0];
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';

  // Query-string hints (authoritative — panel declared the format explicitly)
  if (query.includes('output=m3u8') || query.includes('output=m3u_plus') || query.includes('type=m3u')) return 'm3u8';
  if (query.includes('output=ts')   || query.includes('type=ts'))                                       return undefined; // TS — ExoPlayer auto

  // Explicit file extensions in the path
  if (noQ.endsWith('.m3u8') || noQ.includes('manifest.m3u8')) return 'm3u8';
  if (noQ.endsWith('.mpd')  || noQ.includes('manifest.mpd'))  return 'mpd';
  if (noQ.endsWith('.mp4')  || noQ.endsWith('.mkv') || noQ.endsWith('.ts')) return undefined;

  // Explicit path segments (high confidence — dedicated HLS/DASH origin paths)
  if (noQ.includes('/hls/'))  return 'm3u8';
  if (noQ.includes('/dash/')) return 'mpd';

  // Embedded URL inside query value (proxy/worker pattern).
  // e.g. https://worker.dev/?url=https://cdn.example.com/stream.m3u8?id=...
  // The .m3u8 is inside the query value — trust it as a strong HLS signal.
  if (query.includes('.m3u8')) return 'm3u8';
  if (query.includes('.mpd'))  return 'mpd';

  // DASH format from detectStreamFormat (e.g. .mpd already caught above, but fmt is a safety net)
  if (fmt === 'DASH') return 'mpd';

  // Everything else — Xtream /live/, /movie/, plain HTTP streams, RTSP, UNKNOWN:
  // Let ExoPlayer sniff the content type from the server's Content-Type header.
  // Do NOT force 'm3u8' here — a TS-serving Xtream node will silently black-screen.
  return undefined;
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
    if (entry.contentType === 'channel') {
      // Track channel watch: just record the channel was watched (no position needed for live TV).
      apiClient.post('/watch-history', { channelId: entry.contentId, position: 0 }).catch(() => {});
    } else if (entry.duration > 0) {
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

// NativeIPTVPlayer    → ./player/NativeIPTVPlayer.tsx
// SettingsSheet       → ./player/SettingsSheet.tsx  (ASPECT_CYCLE, AspectMode, SheetType also exported)
// SeekFeedback / SwipeIndicator → ./player/SwipeOverlays.tsx

// Progressive backoff schedule for same-source network-error retries (ms).
// Increasing gaps give transient network drops a real chance to clear before
// we give up on the current server and switch to the next one.
const NETWORK_RETRY_DELAYS_MS = [1_500, 3_000, 5_000];

// ════════════════════════════════════════════════════════════════════════════
// MAIN GLOBAL VIDEO PLAYER
// ════════════════════════════════════════════════════════════════════════════
export default function GlobalVideoPlayer() {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = useWindowDimensions();
  const {
    mode, sources, srcIdx, title, logo, contentId, contentType, isLive,
    isPlaying, enterTop, enterMini, hide, setPlaying, setSrcIdx, nextEpisode, setNextEpisode,
    playerRoute,
  } = useGlobalPlayer();

  // ── Landscape / Orientation ──────────────────────────────────────────────
  const [isLandscape, setIsLandscape] = useState(false);

  const lockLandscape = useCallback(async () => {
    if (IS_EXPO_GO || IS_WEB) return;
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      setIsLandscape(true);
    } catch {}
  }, []);

  const unlockOrientation = useCallback(async () => {
    if (IS_EXPO_GO || IS_WEB) return;
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      setIsLandscape(false);
    } catch {}
  }, []);

  const toggleLandscapeRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    toggleLandscapeRef.current = async () => {
      if (!isLandscape) {
        await lockLandscape();
        useGlobalPlayer.getState().expand();
      } else {
        await unlockOrientation();
        enterTop();
      }
    };
  }, [isLandscape, lockLandscape, unlockOrientation, enterTop]);

  const toggleLandscape = useCallback(() => toggleLandscapeRef.current(), []);

  // ── Playback state ───────────────────────────────────────────────────────
  const [buffering, setBuffering]   = useState(true);
  const [isReady, setReady]         = useState(false);
  const [playerError, setError]     = useState<string | null>(null);
  const [currentTime, setTime]      = useState(0);
  const [duration, setDuration]     = useState(0);
  const [ended, setEnded]           = useState(false);
  const [pip, setPip]               = useState(false);
  const [pipActive, setPipActive]   = useState(false);

  // ── Mode ref — lets gesture worklets read current mode without stale closure ──
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Controls state ───────────────────────────────────────────────────────
  const [showCtrl, setShowCtrl]     = useState(true);
  const showCtrlRef                 = useRef(true);
  const [aspect, setAspect]         = useState<AspectMode>('contain');
  const [isLocked, setLocked]       = useState(false);
  const [sheet, setSheet]           = useState<SheetType>('none');
  const [speed, setSpeed]           = useState(1.0);
  const [showDebug, setShowDebug]   = useState(false);

  // ── Volume / Brightness ──────────────────────────────────────────────────
  // FIX: old code used setState on every gesture move (60×/sec) → jank.
  // New approach: shared values drive the UI instantly (no re-render),
  // setState is throttled to 10×/sec for the <Video volume> prop.
  const [videoVolume, setVideoVolume] = useState(1.0);
  const [brightness, setBrightness]   = useState(1.0);
  const volumeSV    = useSharedValue(1.0);   // drives SwipeIndicator (instant)
  const brightnessSV = useSharedValue(1.0);  // drives overlay opacity (instant)
  // Refs that stay in sync with state — used by gesture worklets (memoized, can't
  // read state variables without stale closure).
  const videoVolumeRef = useRef(1.0);
  const brightnessRef  = useRef(1.0);
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
  const miniCtrlTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef     = useRef<{ time: number; x: number } | null>(null);
  // Keep refs in sync with state so gesture worklets read correct values
  useEffect(() => { videoVolumeRef.current = videoVolume; }, [videoVolume]);
  useEffect(() => { brightnessRef.current  = brightness;  }, [brightness]);

  const swipeStartV    = useRef(1.0);
  const swipeStartB    = useRef(1.0);
  const swipeSide      = useRef<'left'|'right'>('right');
  const trackWidthRef  = useRef(200);
  const resumePosRef   = useRef<number | null>(null);
  const networkRetryRef = useRef(0);
  const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourcesRef      = useRef(sources);
  const lastVolUpdateSV = useSharedValue(0); // UI-thread throttle for setVideoVolume
  const reportedRef     = useRef(false);
  const playbackStartRef = useRef(0);
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevContentIdRef = useRef<string>('');

  // ── Animated controls opacity ────────────────────────────────────────────
  const ctrlOpacity = useSharedValue(1);
  const ctrlStyle   = useAnimatedStyle(() => ({ opacity: ctrlOpacity.value }));

  // ── SharedValue seek bar (Phase 2 — zero re-renders on every progress tick) ─
  // progressSV drives SeekBar component (percentage-based, no px needed)
  const progressSV = useSharedValue(0);
  const lastProgressUpdateRef = useRef(0);

  // ── Poster crossfade (Phase 1) ───────────────────────────────────────────
  const [posterVisible, setPosterVisible] = useState(false);

  // ── Mini player animated position ────────────────────────────────────────
  const SNAP_RIGHT = SW - MINI_W - MINI_MARGIN;
  const SNAP_LEFT  = MINI_MARGIN;
  const posX = useSharedValue(SNAP_RIGHT);
  const posY = useSharedValue(SH * 0.55);
  const sx   = useSharedValue(SNAP_RIGHT);
  const sy   = useSharedValue(SH * 0.55);
  const miniScale = useSharedValue(0);
  const miniOpac  = useSharedValue(0);
  // Gate shared value: 1 when mini, 0 otherwise.
  // Prevents stale translateX/Y from leaking into top/fullscreen mode on
  // React Native's new architecture (Fabric) where conditional animated
  // styles don't always detach cleanly between renders.
  const isMiniSV = useSharedValue(0);
  const clampMinY = useSharedValue(40 + MINI_MARGIN);
  const clampMaxY = useSharedValue(SH - MINI_H - MINI_TITLE_H - 80 - MINI_MARGIN);

  useEffect(() => {
    clampMinY.value = (insets.top || 20) + MINI_MARGIN;
    // Keep mini player fully above the tab bar.
    // Tab bar height = TAB_BAR_BASE_H + Math.max(insets.bottom, 8).
    // insets.bottom is already handled by Math.max so we use the raw value here.
    clampMaxY.value = SH - MINI_H - MINI_TITLE_H - TAB_BAR_BASE_H - Math.max(insets.bottom || 0, 8) - MINI_MARGIN;
  }, [insets.top, insets.bottom, SH]);

  // ── Fullscreen gesture SharedValues (T1.2 — UI-thread volume/brightness) ─
  // These drive the volume/brightness gesture math entirely on the UI thread.
  // No JS-thread re-renders during swipe — only runOnJS for final setState.
  const swipeStartVolSV = useSharedValue(1.0);
  const swipeStartBriSV = useSharedValue(1.0);
  const swipeSideSV     = useSharedValue(1);  // 0 = left/brightness, 1 = right/volume
  const modeSV_fs       = useSharedValue(0);  // 0 = fullscreen, 1 = top
  useEffect(() => { modeSV_fs.value = mode === 'top' ? 1 : 0; }, [mode]);
  // Mirrors isLocked for UI-thread worklet access (gesture blocking when locked)
  const isLockedSV = useSharedValue(false);
  useEffect(() => { isLockedSV.value = isLocked; }, [isLocked]);

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
    }, 3000);
  }, [ctrlOpacity]);

  const bumpCtrl = useCallback(() => {
    if (isLocked) return;
    ctrlOpacity.value = withTiming(1, { duration: 200 });
    setShowCtrl(true);
    showCtrlRef.current = true;
    startHide();
  }, [isLocked, ctrlOpacity, startHide]);

  // Like bumpCtrl but bypasses the lock — used when unlocking so controls
  // immediately become visible after setLocked(false).
  const forceShowCtrl = useCallback(() => {
    ctrlOpacity.value = withTiming(1, { duration: 200 });
    setShowCtrl(true);
    showCtrlRef.current = true;
    startHide();
  }, [ctrlOpacity, startHide]);

  const hideCtrlNow = useCallback(() => {
    if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
    ctrlOpacity.value = withTiming(0, { duration: 300 });
    setShowCtrl(false);
    showCtrlRef.current = false;
  }, [ctrlOpacity]);

  // ── Enter fullscreen / top — show controls ───────────────────────────────
  useEffect(() => {
    if (mode === 'fullscreen' || mode === 'top') {
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
      { translateX: isMiniSV.value === 1 ? posX.value : 0 },
      { translateY: isMiniSV.value === 1 ? posY.value : 0 },
      { scale: isMiniSV.value === 1 ? miniScale.value : 1 },
    ],
    opacity: isMiniSV.value === 1 ? miniOpac.value : 1,
  }));

  // Brightness overlay — driven by shared value, ZERO re-renders during swipe
  const brightnessOverlayStyle = useAnimatedStyle(() => ({
    opacity: 1 - brightnessSV.value,
  }));

  // ── Current source ───────────────────────────────────────────────────────
  const src = sources[srcIdx];

  // ── Source object passed to react-native-video / ExoPlayer ─────────────────
  //
  // KEY RULES:
  // 1. headers must NEVER be empty — DataSourceUtil.kt caches a singleton
  //    DataSource.Factory and only rebuilds it when requestHeaders is non-empty.
  //    An empty map triggers the cache path → old headers leak between streams.
  // 2. User-Agent MUST be present. Without it DataSourceUtil falls back to
  //    Util.getUserAgent(ctx, packageName) = "StreamPro/2.4.1 (Linux;Android…)"
  //    which many IPTV/CDN servers block or rate-limit to ~500 kbps.
  //    "Mini Player/1.1.2 (Linux;Android 16) AndroidXMedia3/1.8.0" is the
  //    default Media3/AndroidX UA — whitelisted by IPTV panels and CDNs.
  // 3. Cookie strings from IPTV panels often use '&' as separator
  //    (e.g. "session=abc&token=xyz") but the HTTP Cookie header requires '; '.
  //    Normalize here before ExoPlayer/OkHttp sees them.
  // 4. Pass 'type' hint only for unambiguous extensions (.m3u8, .mpd) so
  //    ExoPlayer doesn't waste a HEAD request sniffing. For Xtream codes paths
  //    (/live/, /movie/) we now PASS the type hint based on detected format.
  //
  // CRITICAL — why streamFormat is NOT a dependency here:
  // streamFormat is a React state updated by a useEffect AFTER the first render.
  // If it were a dep, nativeSource would recompute (and Video would re-assign
  // its source) twice every time a channel opens:
  //   render 1 → streamFormat='UNKNOWN' → nativeSource v1 → ExoPlayer starts
  //   useEffect → setStreamFormat('HLS') → re-render
  //   render 2 → streamFormat='HLS'     → nativeSource v2 → ExoPlayer RESTARTS ← BUG
  // Fix: compute format inline so nativeSource only recalculates when the URL
  // or headers actually change — ExoPlayer starts exactly once.
  const nativeSource = useMemo(() => {
    if (!src?.url) return null;

    // Inline format detection — always current, never stale.
    const fmt = detectStreamFormat(src.url);

    const raw = src.headers ?? {};

    // Normalize Cookie to HTTP-spec format: 'k=v; k2=v2'
    // Handles three common IPTV panel formats:
    //   1. '&'-separated only     → 'k=v; k2=v2'   (e.g. "session=abc&token=xyz")
    //   2. '&'-and-';' mixed      → normalize both  (e.g. "session=abc&token=xyz; expires=…")
    //   3. bare ';' without space → 'k=v; k2=v2'
    // Process '&' first so that mixed cookies ("k=v&k2=v2; expires=...") are fully normalized.
    const normalizeCookie = (c: string): string => {
      if (!c) return c;
      // Replace '&' separators with '; ' before normalizing existing semicolons.
      // Only replace '&' that are between cookie pairs (not inside encoded values
      // like URLs), but a global replace is safe because cookie values rarely
      // contain literal '&' in IPTV auth cookies.
      return c.replace(/&/g, '; ').replace(/;\s*/g, '; ').trim();
    };

    // Headers must be non-empty — DataSourceUtil.kt caches a singleton
    // OkHttpDataSource.Factory and only rebuilds when requestHeaders is non-empty.
    // User-Agent alone ensures the factory always gets a fresh instance.
    //
    // DO NOT add 'Icy-MetaData: 1' — it causes Shoutcast/Icecast-based IPTV
    // servers to stall 20-30 s embedding audio metadata before the first byte.
    // TiviMate / Mini Player never send that header — that is one reason they
    // start faster.
    //
    // Default UA = 'Mini Player/1.1.2 (Linux;Android 16) AndroidXMedia3/1.8.0'
    // (Media3 / AndroidX UA). Whitelisted by IPTV panels and CDNs.
    // Source-provided UA overrides the default.
    const headers: Record<string, string> = {
      'User-Agent': raw['User-Agent'] || 'Mini Player/1.1.2 (Linux;Android 16) AndroidXMedia3/1.8.0',
    };
    if (raw['Cookie'])  headers['Cookie']  = normalizeCookie(raw['Cookie']);
    if (raw['Referer']) headers['Referer'] = raw['Referer'];
    if (raw['Origin'])  headers['Origin']  = raw['Origin'];
    // Forward any additional headers the server requires
    Object.keys(raw).forEach((k) => {
      if (!headers[k]) headers[k] = raw[k];
    });

    const videoType = getVideoType(src.url, fmt);
    return {
      uri: src.url,
      headers,
      ...(videoType ? { type: videoType } : {}),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src?.url, src?.headers]);  // intentionally excludes streamFormat — see comment above

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
      // 'default' picks the first audio track in the stream, which is always the
      // primary/only track on most IPTV servers.  'system' makes ExoPlayer match
      // on the device language — if the stream has no language metadata (very
      // common in IPTV) ExoPlayer selects nothing and audio is silent.
      ? { type: 'default' }
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
      progressSV.value = 0;
      // Phase 1: show poster crossfade while video loads
      setPosterVisible(true);
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
  // NOTE: setVideoKey is intentionally NOT called here.
  // When open() is called for a new channel, BOTH contentId AND sources change
  // in the same Zustand set(). React fires both this effect AND the contentId
  // effect above — if both called setVideoKey++ the player would mount twice
  // (double startup, double buffering). The contentId effect owns the remount.
  // For same-content source changes (quality switch, fallback), switchToSource()
  // and refreshStream() already call setVideoKey explicitly.
  useEffect(() => {
    sourcesRef.current = sources;
    setSrcIdx(0);
    setError(null); setReady(false); setBuffering(true);
    setTime(0); setDuration(0);
    currentTimeRef.current = 0; durationRef.current = 0;
    networkRetryRef.current = 0;
  }, [sources]);

  // ── Keep sourcesRef in sync ──────────────────────────────────────────────
  useEffect(() => { sourcesRef.current = sources; }, [sources]);

  useEffect(() => {
    if (mode === 'fullscreen' || mode === 'top') startHide();
    return () => {
      if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
      if (miniCtrlTimer.current) clearTimeout(miniCtrlTimer.current);
    };
  }, [mode, startHide]);

  // ── Seek ─────────────────────────────────────────────────────────────────
  const seek = useCallback((delta: number) => {
    const t = Math.max(0, Math.min(durationRef.current || 0, currentTimeRef.current + delta));
    videoRef.current?.seek?.(t);
    currentTimeRef.current = t;
    if (durationRef.current > 0) progressSV.value = t / durationRef.current;
    setTime(t);
    bumpCtrl();
  }, [bumpCtrl, progressSV]);

  const seekToFrac = useCallback((frac: number) => {
    if (!durationRef.current) return;
    const t = Math.max(0, Math.min(1, frac)) * durationRef.current;
    videoRef.current?.seek?.(t);
    currentTimeRef.current = t;
    progressSV.value = Math.max(0, Math.min(1, frac));
    setTime(t);
    bumpCtrl();
  }, [bumpCtrl, progressSV]);

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
  // ── Fullscreen surface gesture — UI-thread volume/brightness (T1.2) ─────
  // Replaces PanResponder. Volume/brightness SharedValue updates run on the
  // UI thread (zero re-renders per frame). JS-thread state (setVideoVolume,
  // setSwipeType) is called via runOnJS only at end or on significant change.
  const _fsSingleTap = useCallback(() => {
    if (isLocked) {
      // Locked: show/flash the "Tap to unlock" badge briefly so the user
      // can see and tap it, then auto-hide again.
      forceShowCtrl();
      return;
    }
    if (showCtrlRef.current) {
      // Controls are visible — tap on the video area starts a short
      // delayed hide instead of hiding immediately. This avoids the race
      // where a button press fires the video-surface single-tap gesture
      // concurrently and causes controls to vanish right after tapping.
      if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
      ctrlTimer.current = setTimeout(() => {
        ctrlOpacity.value = withTiming(0, { duration: 400 });
        setTimeout(() => { setShowCtrl(false); showCtrlRef.current = false; }, 400);
      }, 1800);
    } else {
      bumpCtrl();
    }
  }, [isLocked, forceShowCtrl, bumpCtrl, ctrlOpacity]);

  const _fsDoubleTap = useCallback((isLeft: boolean) => {
    seek(isLeft ? -10 : 10);
    setSeekSide({ side: isLeft ? 'left' : 'right', secs: 10 });
  }, [seek]);

  const _fsSwipeDown = useCallback(() => {
    // Swipe-down in fullscreen → go back to top (portrait inline) mode,
    // not mini, so the user can still see the player in the screen.
    useGlobalPlayer.getState().enterTop();
  }, []);

  const _fsFinalizeSwipe = useCallback(() => {
    setVideoVolume(volumeSV.value);
    setBrightness(brightnessSV.value);
    setTimeout(() => setSwipeType(null), 1200);
  }, [volumeSV, brightnessSV]);

  const fsGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(8)
      .onBegin((e) => {
        'worklet';
        swipeStartVolSV.value = volumeSV.value;
        swipeStartBriSV.value = brightnessSV.value;
        swipeSideSV.value = e.x < SW / 2 ? 0 : 1; // 0 = brightness (left), 1 = volume (right)
      })
      .onUpdate((e) => {
        'worklet';
        // Block ALL swipe gestures (volume/brightness) when screen is locked
        if (isLockedSV.value) return;
        if (Math.abs(e.translationY) < 8) return;
        const delta = -e.translationY / 300;
        if (swipeSideSV.value === 1) {
          const v = Math.max(0, Math.min(1, swipeStartVolSV.value + delta));
          volumeSV.value = v; // UI thread — instant SwipeIndicator update
          runOnJS(setSwipeType)('volume');
          runOnJS(setSwipeValue)(v);
          // T1.2: throttle Video volume prop to ≤10×/sec — SharedValue on UI thread
          const now = Date.now();
          if (now - lastVolUpdateSV.value > 100) {
            lastVolUpdateSV.value = now;
            runOnJS(setVideoVolume)(v);
          }
        } else {
          const b = Math.max(0, Math.min(1, swipeStartBriSV.value + delta));
          brightnessSV.value = b; // UI thread — instant brightness overlay update
          runOnJS(setBrightness)(b);
          runOnJS(setSwipeType)('brightness');
          runOnJS(setSwipeValue)(b);
        }
      })
      .onEnd((e) => {
        'worklet';
        // Swipe DOWN in TOP mode → minimize to mini player
        if (modeSV_fs.value === 1 && e.translationY > 80 && e.velocityY > 0.2) {
          runOnJS(_fsSwipeDown)();
          return;
        }
        if (Math.abs(e.translationY) >= 8) {
          runOnJS(_fsFinalizeSwipe)();
        }
      });

    const dTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(300)
      .onEnd((e, success) => {
        'worklet';
        if (success) runOnJS(_fsDoubleTap)(e.x < SW / 2);
      });

    const sTap = Gesture.Tap()
      .requireExternalGestureToFail(dTap)
      .onEnd((_e, success) => {
        'worklet';
        if (success) runOnJS(_fsSingleTap)();
      });

    return Gesture.Simultaneous(pan, Gesture.Exclusive(dTap, sTap));
  }, [SW, volumeSV, brightnessSV, swipeStartVolSV, swipeStartBriSV, swipeSideSV, modeSV_fs,
      lastVolUpdateSV, _fsSingleTap, _fsDoubleTap, _fsSwipeDown, _fsFinalizeSwipe]);

  // ── PiP is MANUAL ONLY — no auto-PiP on home/background ────────────────
  // Auto-PiP was removed: it triggered unintentionally when the user
  // swiped the notification bar or switched apps, causing jarring PiP pops.
  // PiP now only activates when the user explicitly taps the PiP button.
  const autoPipRef = useRef(false);

  // ── Shared "back" behaviour for TOP mode ─────────────────────────────────
  // Used by BOTH the Android hardware back button AND the visible on-screen
  // back arrow in the top bar (iOS has no hardware back button, and the
  // live-player screen disables the OS edge-swipe gesture while a video is
  // mounted — so the on-screen arrow is the ONLY way back on iOS and MUST
  // behave identically to Android's hardware back).
  // Shrinks to mini player, then navigates back (or falls back to the
  // live-tv tab if there is no navigation history, e.g. deep-link launch).
  const goBackFromTop = useCallback(() => {
    enterMini();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(main)/live-tv' as any);
    }
  }, [enterMini]);

  // ── Android back button ──────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (mode === 'hidden') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'fullscreen') {
        // Landscape fullscreen → exit landscape, go back to top (portrait).
        unlockOrientation();
        enterTop();
        return true; // consumed — no navigation
      }
      if (mode === 'top') {
        // Top mode → shrink to mini, then navigate back (same as the
        // on-screen back arrow — see goBackFromTop above).
        // We consume the event (return true) so Expo Router does NOT also
        // fire a second back action.
        goBackFromTop();
        return true; // consumed
      }
      return false; // mini: let default back action handle it
    });
    return () => sub.remove();
  }, [mode, enterTop, unlockOrientation, goBackFromTop]);

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
    // Phase 1: faster stall detection (7s live / 8s VOD vs old 15s / 25s)
    const STALL_MS = isLive ? 7_000 : 8_000;
    if (buffering && !playerError && src && !ended) {
      stallTimerRef.current = setTimeout(() => {
        const srcs = sourcesRef.current;
        if (srcIdx < srcs.length - 1) {
          setSrcIdx(srcIdx + 1);
          setVideoKey(k => k + 1);
        } else {
          setError('Stream stalled. No data received. Try refreshing.');
          setBuffering(false);
          if (!reportedRef.current) {
            reportedRef.current = true;
            reportPlayback(false);
          }
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
    // Fade out the poster/logo overlay here too — NOT only in
    // onReadyForDisplay. Live raw-TS / MPEGTS streams (common on IPTV
    // panels) frequently never fire onReadyForDisplay on ExoPlayer, which
    // left the blurred-logo poster + its rgba(0,0,0,0.45) dark layer stuck
    // over the video for the entire session (looked like a permanent black
    // tint over live channels). onLoad fires reliably for every format, so
    // clearing it here guarantees the poster always goes away once metadata
    // is loaded, even if onReadyForDisplay never comes.
    setPosterVisible(false);

    // Collect tracks — leave selectedVideoTrack as 'auto' so ExoPlayer ABR
    // starts at a quality it can sustain immediately and ramps up as bandwidth
    // is measured. Forcing the highest bitrate up-front causes an extra segment
    // fetch at max quality before playback begins → slower start, more rebuffers.
    // (Mini Player also leaves ABR on auto for fast start.)
    if (data?.videoTracks?.length) setVideoTracks(data.videoTracks);
    if (data?.audioTracks?.length) setAudioTracks(data.audioTracks);
    if (data?.textTracks?.length)  setTextTracks(data.textTracks);

    // Resume position for VOD
    if (resumePosRef.current !== null && resumePosRef.current > 10) {
      const pos = resumePosRef.current;
      resumePosRef.current = null;
      setTimeout(() => videoRef.current?.seek?.(pos), 200);
    }

    // Record to watch history when live channel starts
    if (contentType === 'channel' && contentId) {
      saveWatchHistory({ contentId, contentType: 'channel', title, position: 0, duration: 0 });
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

    // Normalise to lowercase once — all checks below use these
    const codeStr = String(code).toLowerCase();
    const descStr = desc.toLowerCase();

    const isNetworkErr =
      (typeof code === 'number' && (code === -1009 || code === -1001 || code === -1004))
      || codeStr.includes('io_network')
      || codeStr.includes('io_read')
      || descStr.includes('network_connection')
      || descStr.includes('network')
      || descStr.includes('timed out')
      || descStr.includes('timeout');

    // Unsupported container/format — skip immediately to next server (no retry on same source).
    // ExoPlayer: ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED
    const isUnsupportedFormat =
      codeStr.includes('parsing_container_unsupported')
      || codeStr.includes('error_code_parsing_container')
      || descStr.includes('parsing_container_unsupported')
      || descStr.includes('error_code_parsing_container');

    // Behind live window — player fell behind the DVR buffer.
    // Safe recovery: clean remount on the same source (ExoPlayer re-prepares from live edge).
    // If remount still fails, the next handleError call will fall through to server switch.
    const isBehindLiveWindow =
      codeStr.includes('behind_live_window')
      || descStr.includes('behind_live_window')
      || descStr.includes('behind live window');

    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    if (isBehindLiveWindow) {
      // Remount the player on the same source — ExoPlayer re-prepares from the live edge.
      // Do NOT seek(Infinity): react-native-video does not document that as a valid live-edge seek.
      networkRetryRef.current += 1; // count against retry budget so infinite loops are impossible
      if (networkRetryRef.current <= 2) {
        setBuffering(true); setError(null);
        retryTimerRef.current = setTimeout(() => {
          setVideoKey(k => k + 1);
        }, 800);
      } else {
        // Too many behind-live-window errors — switch server
        if (srcIdx < sourcesRef.current.length - 1) {
          setSrcIdx(srcIdx + 1);
          setVideoKey(k => k + 1);
          setBuffering(true); setError(null);
        } else {
          setError(desc);
          setBuffering(false);
        }
      }
      return;
    }

    if (isUnsupportedFormat) {
      // This source will never play — skip to next server immediately
      if (srcIdx < sourcesRef.current.length - 1) {
        setSrcIdx(srcIdx + 1);
        setVideoKey(k => k + 1);
        setBuffering(true); setError(null);
      } else {
        setError('Unsupported stream format — no more servers available');
        setBuffering(false);
        if (contentType === 'channel' && !reportedRef.current) {
          reportedRef.current = true;
          reportPlayback(false);
        }
      }
      return;
    }

    if (isNetworkErr && networkRetryRef.current < NETWORK_RETRY_DELAYS_MS.length) {
      // Progressive backoff (1.5s → 3s → 5s): most mobile-data / wifi blips
      // clear up within a few seconds, so we give the SAME server increasing
      // breathing room before giving up on it. This avoids switching servers
      // on every tiny hiccup (which itself causes a visible reload/rebuffer)
      // while still recovering quickly from real drops.
      const delay = NETWORK_RETRY_DELAYS_MS[networkRetryRef.current];
      networkRetryRef.current += 1;
      setBuffering(true); setError(null);
      retryTimerRef.current = setTimeout(() => {
        setVideoKey(k => k + 1); // clean remount, same srcIdx
      }, delay);
    } else if (srcIdx < sourcesRef.current.length - 1) {
      // Backoff budget exhausted — the network problem is persistent, not a blip.
      // Wait a short grace period (so the switch doesn't feel abrupt/instant),
      // then move on to the next server.
      retryTimerRef.current = setTimeout(() => {
        setSrcIdx(srcIdx + 1);
        setVideoKey(k => k + 1);
      }, 2500);
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

  // ── Orientation management ────────────────────────────────────────────────
  // fullscreen mode ALWAYS locks landscape (portrait fullscreen is removed).
  // top/mini/hidden → restore portrait.
  // Also reset aspect to 'contain' on fullscreen entry so the video fills
  // the landscape screen correctly without needing manual cycling.
  useEffect(() => {
    if (IS_EXPO_GO || IS_WEB) return;
    if (mode === 'fullscreen') {
      lockLandscape();
      setAspect('contain');
    } else {
      unlockOrientation();
    }
  }, [mode, lockLandscape, unlockOrientation]);

  // ── Mini mode enter/exit animation ──────────────────────────────────────
  useEffect(() => {
    if (mode === 'mini') {
      isMiniSV.value = 1;
      posX.value = SNAP_RIGHT;
      posY.value = SH * 0.55;
      sx.value   = SNAP_RIGHT;
      sy.value   = SH * 0.55;
      miniScale.value = withSpring(1, { damping: 20, stiffness: 260 });
      miniOpac.value  = withTiming(1, { duration: 200 });
    } else {
      isMiniSV.value = 0;
      miniScale.value = 0;
      miniOpac.value  = 0;
    }
  }, [mode]);

  if (mode === 'hidden') return null;

  const isLiveNow = isLive && duration === 0;
  const topH      = Math.round(SW * 9 / 16);

  // ── Video surface position/size by mode ──────────────────────────────────
  // The NativeIPTVPlayer (ExoPlayer/AVPlayer) lives inside this Animated.View.
  // When mode changes, only the style updates — NO unmount, NO reload.
  const videoSurfaceBaseStyle: any =
    mode === 'fullscreen'
      ? { position: 'absolute', top: 0, left: 0, width: SW, height: SH,
          backgroundColor: '#000', zIndex: 9999, elevation: 50 }
      : mode === 'top'
      ? { position: 'absolute', top: 0, left: 0, right: 0,
          height: insets.top + topH, backgroundColor: '#000', zIndex: 9999, elevation: 50 }
      : { position: 'absolute', top: 0, left: 0, width: MINI_W, height: MINI_H,
          backgroundColor: '#000', overflow: 'hidden',
          borderTopLeftRadius: 12, borderTopRightRadius: 12,
          zIndex: 9998, elevation: 59 };

  // ── Shared NativeIPTVPlayer callbacks (same for all modes) ───────────────
  // NOTE: These are inline here (not extracted to an object) so that the

  // ═════════════════════════════════════════════════════════════════════════
  // UNIFIED RENDER — single NativeIPTVPlayer, mode-specific overlays on top
  // ═════════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFIED RETURN — ONE NativeIPTVPlayer always alive at the same tree depth.
  //
  // Architecture:
  //   Fragment
  //     └─ Animated.View [videoSurfaceBaseStyle + miniAnimStyle when mini]
  //          └─ NativeIPTVPlayer  ← SINGLE ExoPlayer/AVPlayer instance
  //     └─ Mini overlay (GestureDetector + controls)  — only when mini
  //     └─ Top overlay (controls, buffering, error)   — only when top
  //     └─ Fullscreen overlay                         — only when fullscreen
  //
  // Why this prevents reload:
  //   React sees NativeIPTVPlayer at the same JSX position every render.
  //   It updates props (style, paused, rate…) in-place without unmounting.
  //   ExoPlayer/AVPlayer never gets destroyed → no rebuffer, no reload.
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={g.playerRoot} pointerEvents="box-none">
      {/* ══════════════════════════════════════════════════════════════════
          SINGLE VIDEO SURFACE — never unmounts between mode transitions.
          style changes (position/size) are applied without remounting.
          pointerEvents="none" → all touches handled by the overlay layers.
          ══════════════════════════════════════════════════════════════════ */}
      {nativeSource && (
        <Animated.View
          style={[videoSurfaceBaseStyle, miniAnimStyle]}
          pointerEvents="none"
        >
          <NativeIPTVPlayer
            key={`v-${videoKey}`}
            source={nativeSource}
            paused={!isPlaying}
            rate={mode === 'mini' ? 1 : speed}
            volume={videoVolume}
            resizeMode={mode === 'mini' ? 'cover' : aspect}
            pip={mode === 'mini' ? false : pip}
            isLive={isLive}
            videoRef={videoRef}
            selectedVideoTrack={selectedVideoTrack}
            selectedAudioTrack={selectedAudioTrack}
            selectedTextTrack={selectedTextTrack}
            // T3.4: MediaSession / lock-screen notification metadata
            metadata={{ title: title || 'StreamPro', artist: isLive ? 'Live TV' : 'StreamPro', imageUri: logo || undefined }}
            onLoadStart={() => { setBuffering(true); setReady(false); }}
            onLoad={handleLoad}
            onReadyForDisplay={() => {
              setBuffering(false);
              setReady(true);
              // Phase 1: fade out poster once first frame is displayed
              setPosterVisible(false);
            }}
            onProgress={(d) => {
              // Phase 2: update SharedValue on every tick (drives seek bar, zero re-renders)
              currentTimeRef.current = d.currentTime;
              if (d.seekableDuration > 0 && d.seekableDuration !== durationRef.current) {
                durationRef.current = d.seekableDuration;
              }
              if (durationRef.current > 0) {
                progressSV.value = currentTimeRef.current / durationRef.current;
              }
              // Throttle setState to 2×/sec — enough for time display, zero seek-bar jank
              const now = Date.now();
              if (now - lastProgressUpdateRef.current > 500) {
                lastProgressUpdateRef.current = now;
                setTime(d.currentTime);
                if (d.seekableDuration > 0 && d.seekableDuration !== durationRef.current) {
                  setDuration(d.seekableDuration);
                }
              }
            }}
            onBuffer={setBuffering}
            onError={handleError}
            onEnd={() => { setEnded(true); setPlaying(false); }}
            onVideoTracks={setVideoTracks}
            onAudioTracks={setAudioTracks}
            onTextTracks={setTextTracks}
            onPipChange={(active) => {
              setPipActive(active);
              setPip(active);
              if (!active) {
                autoPipRef.current = false;
                useGlobalPlayer.getState().enterTop();
              }
            }}
          />

          {/* Phase 1: Poster crossfade — shown while video loads, fades when first frame arrives */}
          {mode !== 'mini' && (
            <PosterFade uri={logo} visible={posterVisible} />
          )}
        </Animated.View>
      )}

      {mode === 'mini' && (
        <MiniOverlay
          panGesture={panGesture}
          miniAnimStyle={miniAnimStyle}
          isLive={isLive}
          title={title}
          isPlaying={isPlaying}
          showCtrl={showCtrl}
          onToggleCtrl={() => {
            setShowCtrl(v => {
              const next = !v;
              if (miniCtrlTimer.current) clearTimeout(miniCtrlTimer.current);
              if (next) {
                miniCtrlTimer.current = setTimeout(() => setShowCtrl(false), 1500);
              }
              return next;
            });
          }}
          onSetPlaying={setPlaying}
          onExpand={() => {
            if (playerRoute) {
              try { router.navigate(playerRoute as any); } catch {}
            }
            enterTop();
          }}
          onClose={hide}
        />
      )}

      {mode === 'top' && (
        <TopOverlay
          insetsTop={insets.top}
          topH={topH}
          brightness={brightness}
          buffering={buffering}
          isReady={isReady}
          playerError={playerError}
          hasSource={!!nativeSource}
          isLive={isLive}
          src={src}
          sources={sources}
          srcIdx={srcIdx}
          onSwitchSource={switchToSource}
          onRefresh={refreshStream}
          onShowDebug={() => setShowDebug(true)}
          pipActive={pipActive}
          fsGesture={fsGesture}
          showCtrl={showCtrl}
          ctrlStyle={ctrlStyle}
          isLocked={isLocked}
          onGoBack={goBackFromTop}
          title={title}
          streamFormat={streamFormat}
          pip={pip}
          onTogglePip={() => { setPip(v => !v); bumpCtrl(); }}
          selectedVidIdx={selectedVidIdx}
          videoTracks={videoTracks}
          onSeek={seek}
          onSeekSide={setSeekSide}
          seekSide={seekSide}
          isPlaying={isPlaying}
          onSetPlaying={setPlaying}
          duration={duration}
          currentTime={currentTime}
          progressSV={progressSV}
          trackWidthRef={trackWidthRef}
          onSeekFrac={seekToFrac}
          speed={speed}
          onOpenSheet={setSheet}
          selectedAudIdx={selectedAudIdx}
          selectedSubIdx={selectedSubIdx}
          aspect={aspect}
          onSetAspect={(a) => setAspect(a)}
          onToggleLandscape={toggleLandscape}
          onSetLocked={(v) => setLocked(v)}
          onForceShowCtrl={forceShowCtrl}
          swipeType={swipeType}
          swipeValue={swipeValue}
          bumpCtrl={bumpCtrl}
        />
      )}

      {mode === 'fullscreen' && (
        <FullscreenOverlay
          insetsTop={insets.top}
          insetsBottom={insets.bottom}
          brightnessOverlayStyle={brightnessOverlayStyle}
          buffering={buffering}
          isReady={isReady}
          playerError={playerError}
          hasSource={!!nativeSource}
          isLive={isLive}
          isLiveNow={isLiveNow}
          src={src}
          sources={sources}
          srcIdx={srcIdx}
          onSwitchSource={switchToSource}
          onRefresh={refreshStream}
          onShowDebug={() => setShowDebug(true)}
          pipActive={pipActive}
          fsGesture={fsGesture}
          showCtrl={showCtrl}
          ctrlStyle={ctrlStyle}
          isLocked={isLocked}
          onGoBack={() => { unlockOrientation(); enterTop(); }}
          title={title}
          streamFormat={streamFormat}
          pip={pip}
          onTogglePip={() => { setPip(v => !v); bumpCtrl(); }}
          selectedVidIdx={selectedVidIdx}
          videoTracks={videoTracks}
          onSeek={seek}
          onSeekSide={setSeekSide}
          seekSide={seekSide}
          isPlaying={isPlaying}
          onSetPlaying={setPlaying}
          duration={duration}
          currentTime={currentTime}
          progressSV={progressSV}
          trackWidthRef={trackWidthRef}
          onSeekFrac={seekToFrac}
          speed={speed}
          onOpenSheet={setSheet}
          selectedAudIdx={selectedAudIdx}
          selectedSubIdx={selectedSubIdx}
          aspect={aspect}
          onSetAspect={(a) => setAspect(a)}
          isLandscape={isLandscape}
          onToggleLandscape={toggleLandscape}
          onSetLocked={(v) => setLocked(v)}
          onForceShowCtrl={forceShowCtrl}
          swipeType={swipeType}
          swipeValue={swipeValue}
          bumpCtrl={bumpCtrl}
        />
      )}
      {/* ══════════════════════════════════════════════════════════════════
          PHASE 3: NEXT EPISODE OVERLAY
          Shown when VOD ends and nextEpisode is registered in the store.
          ══════════════════════════════════════════════════════════════════ */}
      {(mode === 'fullscreen' || mode === 'top') && (
        <NextEpisodeOverlay
          nextEpisode={nextEpisode}
          visible={ended && !!nextEpisode}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          SETTINGS BOTTOM SHEET — T2.3
          Rendered at root level (sibling to all overlays) so @gorhom's
          BottomSheet with style={{ zIndex: 10001 }} floats above the
          fullscreen overlay (zIndex 9999). One instance shared by both
          'top' and 'fullscreen' modes.
          ══════════════════════════════════════════════════════════════════ */}
      {(mode === 'fullscreen' || mode === 'top') && (
        <SettingsSheet
          sheet={sheet}
          onClose={() => setSheet('none')} onSelect={handleSheetSelect}
          speed={speed} videoTracks={videoTracks} audioTracks={audioTracks} textTracks={textTracks}
          selectedVidIdx={selectedVidIdx} selectedAudIdx={selectedAudIdx} selectedSubIdx={selectedSubIdx}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════
          STREAM DEBUG PANEL — shown when Debug button is tapped on error
          ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showDebug}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDebug(false)}
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        statusBarTranslucent
      >
        <View style={db.backdrop}>
          <View style={db.panel}>
            {/* Header */}
            <View style={db.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="settings-outline" size={18} color={C.primary} />
                <Text style={db.headerTxt}>Stream Debug Info</Text>
              </View>
              <View style={[db.statusBadge, { backgroundColor: playerError ? 'rgba(239,68,68,0.18)' : buffering ? 'rgba(245,158,11,0.18)' : 'rgba(16,185,129,0.18)' }]}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: playerError ? C.live : buffering ? '#f59e0b' : C.green, marginRight: 5 }} />
                <Text style={[db.statusTxt, { color: playerError ? C.live : buffering ? '#f59e0b' : C.green }]}>
                  {playerError ? 'Error' : buffering ? 'Buffering...' : 'Playing'}
                </Text>
              </View>
            </View>

            <ScrollView style={db.scrollWrap} showsVerticalScrollIndicator={false}>
              {/* Stream URL */}
              <Text style={db.sectionTitle}>STREAM URL</Text>
              <View style={db.codeBox}>
                <Text style={db.codeText} selectable>{src?.url || 'N/A'}</Text>
              </View>
              <Text style={db.metaLine}>
                Server {srcIdx + 1} of {sources.length} · {src?.label || 'N/A'}
              </Text>

              {/* Format Detection */}
              <Text style={[db.sectionTitle, { marginTop: 14 }]}>FORMAT DETECTION</Text>
              <View style={db.row}>
                <Text style={db.rowLabel}>Detected format</Text>
                <View style={[db.badge, { backgroundColor: 'rgba(16,185,129,0.18)' }]}>
                  <Text style={[db.badgeTxt, { color: C.green }]}>{streamFormat}</Text>
                </View>
              </View>
              <View style={db.row}>
                <Text style={db.rowLabel}>ExoPlayer type hint</Text>
                <View style={[db.badge, { backgroundColor: 'rgba(139,92,246,0.18)' }]}>
                  <Text style={[db.badgeTxt, { color: C.primary }]}>
                    {nativeSource?.type ?? 'auto (sniff)'}
                  </Text>
                </View>
              </View>

              {/* HTTP Headers → ExoPlayer (from nativeSource — what actually reaches OkHttp) */}
              <Text style={[db.sectionTitle, { marginTop: 14, color: C.primary }]}>HTTP HEADERS → EXOPLAYER</Text>
              {(Object.entries(nativeSource?.headers ?? {
                'User-Agent': 'not set',
                Cookie: 'not set',
                Referer: 'not set',
                Origin: 'not set',
              }) as [string, string][]).map(([key, val]) => (
                <View key={key} style={db.row}>
                  <Text style={db.rowLabel}>{key}</Text>
                  <View style={[db.badge, { backgroundColor: val === 'not set' ? 'rgba(255,255,255,0.06)' : 'rgba(139,92,246,0.18)', maxWidth: '62%' }]}>
                    <Text style={[db.badgeTxt, { color: val === 'not set' ? C.dim : C.primary }]} numberOfLines={1}>{val}</Text>
                  </View>
                </View>
              ))}

              {/* Raw source headers (pre-normalization) */}
              <Text style={[db.sectionTitle, { marginTop: 14, color: C.dim }]}>RAW SOURCE HEADERS (PRE-NORMALIZATION)</Text>
              {['User-Agent', 'Cookie', 'Referer', 'Origin'].map((key) => {
                const val = (src as any)?.headers?.[key] || 'not set';
                return (
                  <View key={key} style={db.row}>
                    <Text style={db.rowLabel}>{key}</Text>
                    <View style={[db.badge, { backgroundColor: val === 'not set' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)', maxWidth: '62%' }]}>
                      <Text style={[db.badgeTxt, { color: val === 'not set' ? C.dim : '#e5e7eb' }]} numberOfLines={1}>{val}</Text>
                    </View>
                  </View>
                );
              })}

              {/* Video Tracks */}
              <Text style={[db.sectionTitle, { marginTop: 14, color: videoTracks.length ? C.green : C.dim }]}>
                VIDEO TRACKS {videoTracks.length ? `(${videoTracks.length} DETECTED)` : '(NONE DETECTED)'}
              </Text>
              {videoTracks.length === 0 ? (
                <Text style={db.emptyNote}>No video tracks reported yet — stream may still be loading</Text>
              ) : videoTracks.slice(0, 5).map((t: any, i: number) => (
                <View key={i} style={db.row}>
                  <Text style={db.rowLabel}>Track {i + 1}</Text>
                  <Text style={db.rowVal}>{t.height ? `${t.height}p` : '?'}{t.bitrate ? ` · ${Math.round(t.bitrate / 1000)}kbps` : ''}</Text>
                </View>
              ))}

              {/* Audio Tracks */}
              <Text style={[db.sectionTitle, { marginTop: 14, color: audioTracks.length ? C.green : C.dim }]}>
                AUDIO TRACKS {audioTracks.length ? `(${audioTracks.length} DETECTED)` : '(NONE DETECTED)'}
              </Text>
              {audioTracks.length === 0 ? (
                <Text style={db.emptyNote}>No audio tracks reported yet — stream may still be loading</Text>
              ) : audioTracks.slice(0, 5).map((t: any, i: number) => (
                <View key={i} style={db.row}>
                  <Text style={db.rowLabel}>Track {i + 1}</Text>
                  <Text style={db.rowVal}>{t.language || t.title || `Audio ${i + 1}`}</Text>
                </View>
              ))}

              {/* Error detail */}
              {playerError && (
                <>
                  <Text style={[db.sectionTitle, { marginTop: 14, color: C.live }]}>ERROR DETAIL</Text>
                  <View style={db.codeBox}>
                    <Text style={[db.codeText, { color: '#fca5a5' }]} selectable>{playerError}</Text>
                  </View>
                </>
              )}
              <View style={{ height: 8 }} />
            </ScrollView>

            {/* Close */}
            <TouchableOpacity style={db.closeBtn} onPress={() => setShowDebug(false)}>
              <Text style={db.closeTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

