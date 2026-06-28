import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Platform, Dimensions, AppState, type AppStateStatus,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '@/lib/player-store';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SW, height: SH } = Dimensions.get('window');

/** PiP window size — 16:9 landscape */
const PIP_W   = 210;
const PIP_H   = 118;   // ≈ 16:9
const TITLE_H = 36;
const MARGIN  = 12;
const TAB_BAR = 72;    // rough tab-bar + bottom safe-area

const SNAP_LEFT  = MARGIN;
const SNAP_RIGHT = SW - PIP_W - MARGIN;

// ─── Expo-Go / web guard ──────────────────────────────────────────────────────
const IS_EXPO_GO = (() => {
  try {
    const C = require('expo-constants').default;
    return C.appOwnership === 'expo' || (C as any).executionEnvironment === 'storeClient';
  } catch { return false; }
})();

// ─── Inline native-video component ───────────────────────────────────────────
function NativeVideo({
  uri, headers, paused, pip, onPipChange,
}: {
  uri: string;
  headers?: Record<string, string>;
  paused: boolean;
  pip: boolean;
  onPipChange?: (active: boolean) => void;
}) {
  if (IS_EXPO_GO || Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Video = require('react-native-video').default;
    return (
      <Video
        source={{ uri, headers: { ...headers } }}
        style={StyleSheet.absoluteFill}
        paused={paused}
        muted={false}
        volume={1}
        resizeMode="cover"
        controls={false}
        ignoreSilentSwitch="ignore"
        playInBackground
        playWhenInactive
        pictureInPicture={pip}
        onPictureInPictureStatusChanged={({ isActive }: { isActive: boolean }) =>
          onPipChange?.(isActive)
        }
        bufferConfig={{
          minBufferMs: 5000,
          maxBufferMs: 30000,
          bufferForPlaybackMs: 2000,
          bufferForPlaybackAfterRebufferMs: 3000,
        }}
      />
    );
  } catch { return null; }
}

// ─── MiniPlayer (YouTube-style draggable PiP) ─────────────────────────────────
export default function MiniPlayer() {
  const insets = useSafeAreaInsets();

  const {
    mode, title, logo, contentId, contentType,
    sources, srcIdx, isLive, isPlaying, hide, setPlaying,
  } = usePlayerStore();

  const active = mode !== 'hidden';

  const [showCtrl, setShowCtrl] = React.useState(true);
  const [pip, setPip]           = React.useState(false);

  const ctrlTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Animated values ───────────────────────────────────────────────────────
  const posX  = useSharedValue(SNAP_RIGHT);
  const posY  = useSharedValue(SH * 0.60);
  const scale = useSharedValue(0);
  const opac  = useSharedValue(0);

  // saved at drag-start
  const sx = useSharedValue(SNAP_RIGHT);
  const sy = useSharedValue(SH * 0.60);

  // safe-area clamp stored as shared values (worklets can't read JS refs)
  const clampMinY = useSharedValue(40 + MARGIN);
  const clampMaxY = useSharedValue(SH - PIP_H - TITLE_H - TAB_BAR - MARGIN);

  useEffect(() => {
    clampMinY.value = (insets.top  || 20) + MARGIN;
    clampMaxY.value = SH - PIP_H - TITLE_H - TAB_BAR - (insets.bottom || 0) - MARGIN;
  }, [insets.top, insets.bottom]);

  // ── Enter / leave animation ───────────────────────────────────────────────
  useEffect(() => {
    if (active) {
      setPip(false);
      posX.value = SNAP_RIGHT;
      posY.value = SH * 0.60;
      sx.value   = SNAP_RIGHT;
      sy.value   = SH * 0.60;
      scale.value = withSpring(1, { damping: 20, stiffness: 260 });
      opac.value  = withTiming(1, { duration: 200 });
      setShowCtrl(true);
      clearTimeout(ctrlTimer.current);
      ctrlTimer.current = setTimeout(() => setShowCtrl(false), 3000);
    } else {
      scale.value = withSpring(0, { damping: 20, stiffness: 260 });
      opac.value  = withTiming(0, { duration: 180 });
    }
    return () => clearTimeout(ctrlTimer.current);
  }, [active]);

  // ── System PiP — Android background ──────────────────────────────────────
  useEffect(() => {
    if (!active || Platform.OS !== 'android' || IS_EXPO_GO) return;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'background' || s === 'inactive') setPip(true);
      else if (s === 'active') setPip(false);
    });
    return () => sub.remove();
  }, [active]);

  // ── Show controls briefly ─────────────────────────────────────────────────
  const showControlsBriefly = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(ctrlTimer.current);
    ctrlTimer.current = setTimeout(() => setShowCtrl(false), 2500);
  }, []);

  // ── Pan gesture (drag + edge-snap) ───────────────────────────────────────
  // minDistance(8): taps < 8 px pass through to inner TouchableOpacity
  const panGesture = Gesture.Pan()
    .minDistance(8)
    .onStart(() => {
      sx.value = posX.value;
      sy.value = posY.value;
    })
    .onUpdate((e) => {
      posX.value = sx.value + e.translationX;
      posY.value = sy.value + e.translationY;
    })
    .onEnd((e) => {
      // Snap to nearest left / right edge
      const centerX = posX.value + PIP_W / 2;
      const snapX   = centerX < SW / 2 ? SNAP_LEFT : SNAP_RIGHT;

      // Velocity-based fling overrides center check
      const flingX = e.velocityX > 600
        ? SNAP_RIGHT
        : e.velocityX < -600
        ? SNAP_LEFT
        : snapX;

      // Clamp Y
      const clampedY = Math.max(
        clampMinY.value,
        Math.min(clampMaxY.value, posY.value),
      );

      posX.value = withSpring(flingX,   { damping: 22, stiffness: 240 });
      posY.value = withSpring(clampedY, { damping: 22, stiffness: 240 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
      { scale: scale.value },
    ],
    opacity: opac.value,
  }));

  // ── Expand to full player ─────────────────────────────────────────────────
  const handleExpand = useCallback(() => {
    if (!contentId) return;
    setPip(false);
    if (contentType === 'channel') {
      router.push({
        pathname: `/live-player/${contentId}` as any,
        params: { title, logo, fromMini: '1' },
      });
    } else {
      router.push(`/player/${contentId}?type=${contentType}` as any);
    }
  }, [contentId, contentType, title, logo]);

  if (!active) return null;

  const src = sources[srcIdx];

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[s.root, animStyle]}>

        {/* ══ Video window ══════════════════════════════════════════════════ */}
        <View style={s.videoBox}>

          {/* Video stream */}
          {src?.url ? (
            <NativeVideo
              uri={src.url}
              headers={src.headers}
              paused={!isPlaying}
              pip={pip}
              onPipChange={(active) => { if (!active) setPip(false); }}
            />
          ) : logo ? (
            <Image
              source={{ uri: logo }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              style={[StyleSheet.absoluteFill, s.gradCenter]}
            >
              <Ionicons name="tv-outline" size={28} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          )}

          {/* LIVE badge */}
          {isLive && (
            <View style={s.liveBadge} pointerEvents="none">
              <View style={s.liveDot} />
              <Text style={s.liveTxt}>LIVE</Text>
            </View>
          )}

          {/* Tap-area — shows / hides controls */}
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={showControlsBriefly}
          >
            {/* Controls overlay */}
            {showCtrl && (
              <View style={s.overlay}>

                {/* ✕ close — top-right */}
                <TouchableOpacity
                  style={s.closeBtn}
                  onPress={hide}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={13} color="#fff" />
                </TouchableOpacity>

                {/* Center: play/pause + expand */}
                <View style={s.centerRow}>
                  <TouchableOpacity
                    style={s.ctrlBtn}
                    onPress={() => { setPlaying(!isPlaying); showControlsBriefly(); }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={22}
                      color="#fff"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.ctrlBtn}
                    onPress={handleExpand}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="expand-outline" size={19} color="#fff" />
                  </TouchableOpacity>
                </View>

              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ══ Title bar ═════════════════════════════════════════════════════ */}
        <View style={s.titleBar}>
          {logo ? (
            <Image source={{ uri: logo }} style={s.titleLogo} resizeMode="contain" />
          ) : (
            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={s.titleLogo} />
          )}

          <Text style={s.titleTxt} numberOfLines={1}>{title}</Text>

          {/* Always-visible play/pause in title bar */}
          <TouchableOpacity
            style={s.titleBtn}
            onPress={() => setPlaying(!isPlaying)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={14}
              color="rgba(255,255,255,0.78)"
            />
          </TouchableOpacity>
        </View>

      </Animated.View>
    </GestureDetector>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PIP_W,
    zIndex: 9999,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.70,
    shadowRadius: 24,
  },

  // ── Video box ──────────────────────────────────────────────────────────────
  videoBox: {
    width: PIP_W,
    height: PIP_H,
    backgroundColor: '#030310',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: 'rgba(139,92,246,0.65)',
  },
  gradCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── LIVE badge ─────────────────────────────────────────────────────────────
  liveBadge: {
    position: 'absolute', top: 7, left: 7,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.95)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, gap: 3,
    zIndex: 2,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  // ── Controls overlay ───────────────────────────────────────────────────────
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center', alignItems: 'center',
  },
  centerRow: {
    flexDirection: 'row', gap: 18, alignItems: 'center',
  },
  ctrlBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Title bar ──────────────────────────────────────────────────────────────
  titleBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 9,
    height: TITLE_H,
    backgroundColor: '#0D0D1F',
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    borderWidth: 1.5, borderTopWidth: 0,
    borderColor: 'rgba(139,92,246,0.65)',
  },
  titleLogo: {
    width: 20, height: 20, borderRadius: 4,
  },
  titleTxt: {
    flex: 1, color: '#EFEFEF',
    fontSize: 10.5, fontWeight: '600', letterSpacing: 0.1,
  },
  titleBtn: {
    width: 24, height: 24,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 2,
  },
});
