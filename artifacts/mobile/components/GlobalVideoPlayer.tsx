/**
 * GlobalVideoPlayer — Singleton video player that lives at the root layout level.
 * The NativeIPTVPlayer (ExoPlayer / AVPlayer) is NEVER unmounted while mode !== 'hidden'.
 * Transitioning fullscreen ↔ mini only changes layout/size — the underlying player
 * instance is preserved. No reload, no rebuffering.
 */

import React, {
  useRef, useState, useCallback, useEffect, useMemo,
} from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Platform, AppState, BackHandler, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useGlobalPlayer } from '@/lib/player-store';

// ─── Constants ────────────────────────────────────────────────────────────────
const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  (Constants as any).executionEnvironment === 'storeClient';

const C = {
  bg: '#050510', primary: '#8B5CF6', accent: '#EC4899',
  live: '#EF4444', text: '#FFFFFF', dim: '#9CA3AF',
  border: 'rgba(255,255,255,0.1)',
};

const MINI_W = 210;
const MINI_H = 118;
const MINI_TITLE_H = 36;
const MINI_MARGIN = 12;

const BUFFER_LIVE = {
  minBufferMs: 8000, maxBufferMs: 50000,
  bufferForPlaybackMs: 3000, bufferForPlaybackAfterRebufferMs: 6000,
};
const BUFFER_VOD = {
  minBufferMs: 15000, maxBufferMs: 60000,
  bufferForPlaybackMs: 2500, bufferForPlaybackAfterRebufferMs: 5000,
};

const IPTV_UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function fmt(s: number) {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

// ─── Native video wrapper ─────────────────────────────────────────────────────
function NativeIPTVPlayer({
  source, paused, pip, isLive, volume,
  onLoad, onLoadStart, onReadyForDisplay, onProgress,
  onBuffer, onError, onEnd, onPipChange, videoRef,
}: {
  source: { uri: string; headers: Record<string, string>; type?: string };
  paused: boolean;
  pip: boolean;
  isLive: boolean;
  volume: number;
  videoRef: React.MutableRefObject<any>;
  onLoad: (data: any) => void;
  onLoadStart: () => void;
  onReadyForDisplay: () => void;
  onProgress: (data: any) => void;
  onBuffer: (buffering: boolean) => void;
  onError: (error: any) => void;
  onEnd: () => void;
  onPipChange: (active: boolean) => void;
}) {
  if (IS_EXPO_GO || Platform.OS === 'web') {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="phone-portrait-outline" size={36} color={C.primary} />
        <Text style={{ color: '#fff', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          Development Build Required
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
        volume={volume}
        muted={false}
        resizeMode="contain"
        controls={false}
        ignoreSilentSwitch="ignore"
        playInBackground={true}
        playWhenInactive={true}
        pictureInPicture={pip}
        hideShutterView={true}
        bufferConfig={isLive ? BUFFER_LIVE : BUFFER_VOD}
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
  } catch {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={36} color={C.accent} />
        <Text style={{ color: '#fff', fontSize: 11, marginTop: 6 }}>Player load failed</Text>
      </View>
    );
  }
}

// ─── GlobalVideoPlayer ────────────────────────────────────────────────────────
export default function GlobalVideoPlayer() {
  const insets = useSafeAreaInsets();
  const { width: SW, height: SH } = Dimensions.get('window');

  const {
    mode, sources, srcIdx, title, logo, contentId, contentType, isLive,
    isPlaying, enterMini, hide, setPlaying, setSrcIdx,
  } = useGlobalPlayer();

  // ── Playback state ─────────────────────────────────────────────────────────
  const [buffering, setBuffering] = useState(true);
  const [isReady, setReady]       = useState(false);
  const [playerError, setError]   = useState<string | null>(null);
  const [currentTime, setTime]    = useState(0);
  const [duration, setDuration]   = useState(0);
  const [pip, setPip]             = useState(false);
  const [pipActive, setPipActive] = useState(false);
  const [volume, setVolume]       = useState(1.0);
  const [brightness, setBrightness] = useState(1.0);
  const [showCtrl, setShowCtrl]   = useState(true);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef       = useRef<any>(null);
  const currentTimeRef = useRef(0);
  const durationRef    = useRef(0);
  const ctrlTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevModeRef    = useRef<string>('hidden');
  const prevSrcIdxRef  = useRef<number>(-1);
  const trackWidthRef  = useRef(200);

  // ── Mini position (draggable) ──────────────────────────────────────────────
  const SNAP_RIGHT = SW - MINI_W - MINI_MARGIN;
  const SNAP_LEFT  = MINI_MARGIN;
  const posX = useSharedValue(SNAP_RIGHT);
  const posY = useSharedValue(SH * 0.55);
  const sx   = useSharedValue(SNAP_RIGHT);
  const sy   = useSharedValue(SH * 0.55);
  const clampMinY = useSharedValue((insets.top || 20) + MINI_MARGIN);
  const clampMaxY = useSharedValue(SH - MINI_H - MINI_TITLE_H - 80 - MINI_MARGIN);

  useEffect(() => {
    clampMinY.value = (insets.top || 20) + MINI_MARGIN;
    clampMaxY.value = SH - MINI_H - MINI_TITLE_H - 80 - (insets.bottom || 0) - MINI_MARGIN;
  }, [insets.top, insets.bottom]);

  const panGesture = Gesture.Pan()
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
    });

  const miniAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: posX.value }, { translateY: posY.value }],
  }));

  // ── Reset player state when new content loads ──────────────────────────────
  useEffect(() => {
    const modeChanged = mode !== prevModeRef.current;
    const srcChanged  = srcIdx !== prevSrcIdxRef.current;
    prevModeRef.current  = mode;
    prevSrcIdxRef.current = srcIdx;

    if (mode === 'hidden') {
      setReady(false); setBuffering(true); setError(null);
      setTime(0); setDuration(0); setPip(false); setPipActive(false);
      return;
    }

    if (modeChanged && mode === 'fullscreen') {
      // New content entering fullscreen — reset state
      setReady(false); setBuffering(true); setError(null);
      setTime(0); setDuration(0);
      setPip(false); setPipActive(false);
      bumpCtrl();
    }

    if (srcChanged) {
      setReady(false); setBuffering(true); setError(null);
    }
  }, [mode, srcIdx]);

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const bumpCtrl = useCallback(() => {
    setShowCtrl(true);
    if (ctrlTimer.current) clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => setShowCtrl(false), 4500);
  }, []);

  useEffect(() => {
    bumpCtrl();
    return () => { if (ctrlTimer.current) clearTimeout(ctrlTimer.current); };
  }, []);

  // ── OS PiP — Android auto-enter on Home press ─────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android' || mode === 'hidden') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' && isReady && !playerError) {
        setPip(true);
        setTimeout(() => setPip(false), 600);
      }
    });
    return () => sub.remove();
  }, [mode, isReady, playerError]);

  // ── Back button handling ───────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android' || mode !== 'fullscreen') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      enterMini();
      return true;
    });
    return () => sub.remove();
  }, [mode, enterMini]);

  // ── Source object ──────────────────────────────────────────────────────────
  const src = sources[srcIdx];
  const nativeSource = useMemo(() => {
    if (!src?.url) return null;
    return {
      uri: src.url,
      headers: { 'User-Agent': IPTV_UA, ...(src.headers ?? {}) },
    };
  }, [src?.url, src?.headers]);

  // ── Seek ───────────────────────────────────────────────────────────────────
  const seek = useCallback((delta: number) => {
    const t = Math.max(0, Math.min(durationRef.current || 0, currentTimeRef.current + delta));
    videoRef.current?.seek?.(t);
    setTime(t); currentTimeRef.current = t;
  }, []);

  const seekToFrac = useCallback((frac: number) => {
    if (!durationRef.current) return;
    const t = Math.max(0, Math.min(1, frac)) * durationRef.current;
    videoRef.current?.seek?.(t);
    setTime(t); currentTimeRef.current = t;
  }, []);

  // ── Expand from mini — just switch mode, no navigation (avoids reload) ────
  const handleExpand = useCallback(() => {
    useGlobalPlayer.setState({ mode: 'fullscreen' });
    bumpCtrl();
  }, [bumpCtrl]);

  // ── Swipe gesture for brightness (left) and volume (right) ────────────────
  // Divisor 1500 → ~100px swipe ≈ 6-7%, full gesture (~200px) ≈ 13-14%
  // This gives smooth 10-15% change per natural swipe gesture
  const swipeSide = useRef<'left' | 'right'>('right');
  const swipeStartV = useRef(1.0);
  const swipeStartB = useRef(1.0);

  const swipeGesture = Gesture.Pan()
    .minDistance(10)
    .onStart((e) => {
      swipeSide.current = e.x < (SW / 2) ? 'left' : 'right';
      swipeStartV.current = volume;
      swipeStartB.current = brightness;
    })
    .onUpdate((e) => {
      if (Math.abs(e.translationY) < 10) return;
      const delta = -e.translationY / 1500;
      if (swipeSide.current === 'right') {
        const v = Math.max(0, Math.min(1, swipeStartV.current + delta));
        setVolume(v);
      } else {
        const b = Math.max(0, Math.min(1, swipeStartB.current + delta));
        setBrightness(b);
      }
    });

  // ── Don't render if hidden ─────────────────────────────────────────────────
  if (mode === 'hidden') return null;

  const progress = durationRef.current > 0 ? currentTime / durationRef.current : 0;
  const isLiveNow = isLive && duration === 0;

  // ─────────────────────────────────────────────────────────────────────────
  // MINI MODE
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'mini') {
    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[g.miniRoot, miniAnimStyle]}>
          {/* Video */}
          <View style={g.miniVideo}>
            {nativeSource && (
              <NativeIPTVPlayer
                source={nativeSource}
                paused={!isPlaying}
                pip={pip}
                isLive={isLive}
                volume={volume}
                videoRef={videoRef}
                onLoadStart={() => { setBuffering(true); setReady(false); }}
                onLoad={(d) => { setDuration(d?.duration || 0); durationRef.current = d?.duration || 0; setBuffering(false); setReady(true); setError(null); }}
                onReadyForDisplay={() => { setBuffering(false); setReady(true); }}
                onProgress={(d) => { setTime(d.currentTime); currentTimeRef.current = d.currentTime; }}
                onBuffer={setBuffering}
                onError={(err) => {
                  const next = srcIdx + 1;
                  if (next < sources.length) { setSrcIdx(next); }
                  else setError(err?.error?.localizedDescription || 'Stream error');
                }}
                onEnd={() => {}}
                onPipChange={(active) => { setPipActive(active); }}
              />
            )}
            {/* Buffering */}
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
          </View>

          {/* Mini controls overlay */}
          <View style={StyleSheet.absoluteFill}>
            {/* Close */}
            <TouchableOpacity style={g.miniClose} onPress={hide} hitSlop={12}>
              <Ionicons name="close" size={13} color="#fff" />
            </TouchableOpacity>
            {/* Center: play + expand */}
            <View style={g.miniCenter}>
              <TouchableOpacity style={g.miniBtn} onPress={() => setPlaying(!isPlaying)} hitSlop={10}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={g.miniBtn} onPress={handleExpand} hitSlop={10}>
                <Ionicons name="expand-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Title bar */}
          <View style={g.miniTitle}>
            <Text style={g.miniTitleTxt} numberOfLines={1}>{title}</Text>
            <TouchableOpacity onPress={() => setPlaying(!isPlaying)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
              <Ionicons name={isPlaying ? 'pause' : 'play'} size={13} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FULLSCREEN MODE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={g.fullRoot}>
      <StatusBar hidden barStyle="light-content" backgroundColor="#000" />

      {/* ── Video ─────────────────────────────────────────────────── */}
      {nativeSource && (
        <NativeIPTVPlayer
          source={nativeSource}
          paused={!isPlaying}
          pip={pip}
          isLive={isLive}
          volume={volume}
          videoRef={videoRef}
          onLoadStart={() => { setBuffering(true); setReady(false); }}
          onLoad={(d) => {
            setDuration(d?.duration || 0);
            durationRef.current = d?.duration || 0;
            setBuffering(false); setReady(true); setError(null);
          }}
          onReadyForDisplay={() => { setBuffering(false); setReady(true); }}
          onProgress={(d) => {
            setTime(d.currentTime);
            currentTimeRef.current = d.currentTime;
            if (d.seekableDuration > 0) {
              setDuration(d.seekableDuration);
              durationRef.current = d.seekableDuration;
            }
          }}
          onBuffer={setBuffering}
          onError={(err) => {
            const next = srcIdx + 1;
            if (next < sources.length) {
              setSrcIdx(next); setBuffering(true); setError(null);
            } else {
              setError(err?.error?.localizedDescription || err?.error?.errorString || 'Playback failed');
              setBuffering(false);
            }
          }}
          onEnd={() => { setPlaying(false); }}
          onPipChange={(active) => { setPipActive(active); }}
        />
      )}

      {/* ── Brightness overlay ────────────────────────────────────── */}
      {brightness < 1 && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${(1 - brightness) * 0.85})` }]}
        />
      )}

      {/* ── Buffering ─────────────────────────────────────────────── */}
      {!pipActive && (buffering || !isReady) && !playerError && nativeSource && (
        <View style={g.overlayCenter} pointerEvents="none">
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={g.bufferingTxt}>{isLive ? 'Buffering live stream…' : 'Buffering…'}</Text>
        </View>
      )}

      {/* ── Error ─────────────────────────────────────────────────── */}
      {!pipActive && playerError && (
        <View style={g.overlayCenter}>
          <Ionicons name="alert-circle-outline" size={48} color={C.live} />
          <Text style={g.errorTxt}>Playback Failed</Text>
          <Text style={g.errorSub} numberOfLines={3}>{playerError}</Text>
          <TouchableOpacity style={g.retryBtn} onPress={() => {
            setError(null); setBuffering(true); setReady(false); setSrcIdx(0);
          }}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={g.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Swipe gesture layer (volume + brightness) ──────────────── */}
      {!pipActive && (
        <GestureDetector gesture={swipeGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      )}

      {/* ── Controls ──────────────────────────────────────────────── */}
      {showCtrl && !pipActive && !playerError && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={bumpCtrl}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.75)', 'transparent', 'transparent', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.25, 0.65, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Top bar */}
          <View style={[g.topBar, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={g.iconBtn} onPress={enterMini}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <Text style={g.titleTxt} numberOfLines={1}>{title}</Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              {/* PiP button */}
              {Platform.OS === 'android' && (
                <TouchableOpacity style={g.iconBtn} onPress={() => {
                  if (!pipActive) {
                    setPip(true);
                    setTimeout(() => setPip(false), 600);
                  }
                  bumpCtrl();
                }}>
                  <MaterialIcons name="picture-in-picture-alt" size={20} color={pipActive ? C.primary : '#fff'} />
                </TouchableOpacity>
              )}
              {/* Refresh */}
              <TouchableOpacity style={g.iconBtn} onPress={() => {
                setError(null); setBuffering(true); setReady(false); setSrcIdx(0);
              }}>
                <Ionicons name="refresh-outline" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Server pills */}
          {sources.length > 1 && (
            <View style={g.pillRow}>
              {sources.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  style={[g.pill, i === srcIdx && g.pillActive]}
                  onPress={() => {
                    if (i !== srcIdx) {
                      setError(null); setBuffering(true); setReady(false);
                      setSrcIdx(i);
                    }
                  }}
                >
                  <Text style={[g.pillTxt, i === srcIdx && g.pillActiveTxt]}>
                    {i === srcIdx ? '● ' : ''}{s.label || `S${i + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* LIVE badge */}
          {isLive && (
            <View style={g.liveRow}>
              <View style={g.liveBadge}>
                <View style={g.liveDot} />
                <Text style={g.liveTxt}>LIVE</Text>
              </View>
            </View>
          )}

          {/* Center controls */}
          <View style={g.centerRow} pointerEvents="box-none">
            <TouchableOpacity style={g.ctrlBtn} onPress={() => seek(-10)}>
              <Ionicons name="play-back" size={22} color="#fff" />
              <Text style={g.seekLbl}>10s</Text>
            </TouchableOpacity>

            <TouchableOpacity style={g.playBtn} onPress={() => { setPlaying(!isPlaying); bumpCtrl(); }}>
              {buffering && isReady
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" style={isPlaying ? {} : { marginLeft: 3 }} />
              }
            </TouchableOpacity>

            <TouchableOpacity style={g.ctrlBtn} onPress={() => seek(10)}>
              <Ionicons name="play-forward" size={22} color="#fff" />
              <Text style={g.seekLbl}>10s</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom bar */}
          <View style={[g.bottomBar, { paddingBottom: insets.bottom + 14 }]}>
            {!isLiveNow && (
              <View style={g.progressRow}>
                <Text style={g.timeTxt}>{fmt(currentTime)}</Text>
                <TouchableOpacity
                  style={g.trackWrap}
                  activeOpacity={1}
                  onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
                  onPress={(e) => seekToFrac(e.nativeEvent.locationX / trackWidthRef.current)}
                >
                  <View style={g.trackBg}>
                    <LinearGradient
                      colors={[C.primary, C.accent]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[g.trackFill, { width: `${progress * 100}%` as any }]}
                    />
                    <View style={[g.trackThumb, { left: `${Math.min(97, progress * 100)}%` as any }]} />
                  </View>
                </TouchableOpacity>
                <Text style={g.timeTxt}>{fmt(duration)}</Text>
              </View>
            )}

            {/* Volume / Brightness hints */}
            <View style={g.hintRow} pointerEvents="none">
              <View style={g.hintItem}>
                <Ionicons name="sunny-outline" size={12} color={C.dim} />
                <Text style={g.hintTxt}>{Math.round(brightness * 100)}%</Text>
              </View>
              <View style={g.hintItem}>
                <Ionicons name="volume-medium-outline" size={12} color={C.dim} />
                <Text style={g.hintTxt}>{Math.round(volume * 100)}%</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Tap to show controls when hidden */}
      {!showCtrl && !pipActive && !playerError && (
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={bumpCtrl} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const g = StyleSheet.create({
  // ── Fullscreen ──────────────────────────────────────────────────────────────
  fullRoot: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000', zIndex: 1000, elevation: 50,
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bufferingTxt: { color: '#9CA3AF', fontSize: 13, marginTop: 4 },
  errorTxt:  { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8 },
  errorSub:  { color: '#9CA3AF', fontSize: 12, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 10, backgroundColor: '#8B5CF6', borderRadius: 22, marginTop: 8 },
  retryTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 6, gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  titleTxt: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', marginHorizontal: 4 },

  pillRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, flexWrap: 'wrap', marginTop: 2 },
  pill:    { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  pillActive: { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.2)' },
  pillTxt: { color: '#ccc', fontSize: 12 },
  pillActiveTxt: { color: '#8B5CF6', fontWeight: '700' },

  liveRow:   { flexDirection: 'row', paddingHorizontal: 14, marginTop: 4 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EF4444', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveTxt:   { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  centerRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14 },
  ctrlBtn:   { alignItems: 'center', justifyContent: 'center', width: 54, height: 48, gap: 2 },
  seekLbl:   { color: '#fff', fontSize: 9, fontWeight: '700', opacity: 0.8 },
  playBtn:   { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },

  bottomBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  timeTxt:     { color: '#e5e7eb', fontSize: 11, minWidth: 40, textAlign: 'center' },
  trackWrap:   { flex: 1, height: 24, justifyContent: 'center' },
  trackBg:     { height: 3.5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, overflow: 'visible', position: 'relative' },
  trackFill:   { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 2 },
  trackThumb:  { position: 'absolute', top: -5.5, width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', marginLeft: -7 },

  hintRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 4 },
  hintItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintTxt:  { color: '#9CA3AF', fontSize: 10 },

  // ── Mini ────────────────────────────────────────────────────────────────────
  miniRoot: {
    position: 'absolute', top: 0, left: 0,
    width: MINI_W,
    zIndex: 2000, elevation: 60,
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
  miniTitleTxt: { flex: 1, color: '#EFEFEF', fontSize: 10.5, fontWeight: '600' },
});
