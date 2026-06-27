import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Platform, Dimensions, AppState, type AppStateStatus,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '@/lib/player-store';

const { width: SW } = Dimensions.get('window');
const PLAYER_H = 110;
const TAB_BAR_H = 68;

const IS_EXPO_GO = (() => {
  try {
    const C = require('expo-constants').default;
    return C.appOwnership === 'expo' || (C as any).executionEnvironment === 'storeClient';
  } catch { return false; }
})();

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
    const Video = require('react-native-video').default;
    return (
      <Video
        source={{ uri, headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }}
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

export default function MiniPlayer() {
  const insets = useSafeAreaInsets();
  const {
    active, title, logo, contentId, contentType,
    sources, srcIdx, isLive, isPlaying, close, setPlaying,
  } = usePlayerStore();

  const [pip, setPip] = useState(false);

  const translateY = useSharedValue(200);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      setPip(false);
      translateY.value = withSpring(0, { damping: 20, stiffness: 180 });
      opacity.value = withTiming(1, { duration: 220 });
    } else {
      translateY.value = withTiming(200, { duration: 250 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [active]);

  // System PiP when app goes to background
  useEffect(() => {
    if (!active || Platform.OS !== 'android' || IS_EXPO_GO) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') setPip(true);
      else if (state === 'active') setPip(false);
    });
    return () => sub.remove();
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const src = sources[srcIdx];
  const bottom = TAB_BAR_H + Math.max(insets.bottom, 4) + 8;

  const handleExpand = () => {
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
  };

  if (!active) return null;

  return (
    <Animated.View style={[styles.wrapper, { bottom }, animStyle]}>
      <View style={styles.card}>
        {/* ── Left: video thumbnail area ──────────────── */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleExpand}
          style={styles.thumbArea}
        >
          {/* Video player */}
          {src?.url ? (
            <NativeVideo
              uri={src.url}
              headers={src.headers}
              paused={!isPlaying}
              pip={pip}
              onPipChange={(isActive) => { if (!isActive) setPip(false); }}
            />
          ) : null}

          {/* Channel logo overlay (top-left) */}
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logoSmall} resizeMode="contain" />
          ) : (
            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={StyleSheet.absoluteFill}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="tv" size={28} color="rgba(255,255,255,0.8)" />
              </View>
            </LinearGradient>
          )}

          {/* Expand icon (center) */}
          <View style={styles.expandIcon}>
            <Ionicons name="expand" size={18} color="rgba(255,255,255,0.85)" />
          </View>

          {/* LIVE badge */}
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTxt}>LIVE</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Right: info + controls ───────────────────── */}
        <View style={styles.infoCol}>
          <Text style={styles.titleTxt} numberOfLines={1}>{title}</Text>
          <Text style={styles.subTxt} numberOfLines={1}>
            {isLive ? '● Live Streaming' : 'Playing now'}
          </Text>

          {/* Buttons row */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={() => setPlaying(!isPlaying)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={34}
                color="#8B5CF6"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ctrlBtn}
              onPress={close}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={30} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom progress strip */}
      {!isLive && (
        <View style={styles.progressBar}>
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: '100%', width: '40%', borderRadius: 2 }}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#0E0E1A',
    borderRadius: 16,
    height: PLAYER_H,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 16,
  },

  /* Left video thumbnail */
  thumbArea: {
    width: 155,
    height: PLAYER_H,
    backgroundColor: '#050510',
    overflow: 'hidden',
  },
  logoSmall: {
    position: 'absolute',
    top: 6, left: 6,
    width: 32, height: 32,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  expandIcon: {
    position: 'absolute',
    bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    padding: 3,
  },
  liveBadge: {
    position: 'absolute',
    top: 6, right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220,38,38,0.92)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  /* Right info column */
  infoCol: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  titleTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  subTxt: { color: '#8B5CF6', fontSize: 11, marginTop: 2 },

  /* Buttons */
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  ctrlBtn: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Progress */
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
});
