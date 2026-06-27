import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Platform, Dimensions, PanResponder,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '@/lib/player-store';

const { width: SW } = Dimensions.get('window');
const PLAYER_W = SW - 24;
const PLAYER_H = 68;
const TAB_BAR_H = 68;

const IS_EXPO_GO =
  (() => {
    try {
      const Constants = require('expo-constants').default;
      return (
        Constants.appOwnership === 'expo' ||
        (Constants as any).executionEnvironment === 'storeClient'
      );
    } catch {
      return false;
    }
  })();

function NativeVideo({ uri, headers, paused }: { uri: string; headers?: Record<string, string>; paused: boolean }) {
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
        bufferConfig={{ minBufferMs: 5000, maxBufferMs: 30000, bufferForPlaybackMs: 2000, bufferForPlaybackAfterRebufferMs: 3000 }}
      />
    );
  } catch {
    return null;
  }
}

export default function MiniPlayer() {
  const insets = useSafeAreaInsets();
  const { active, title, logo, contentId, contentType, sources, srcIdx, isLive, isPlaying, close, setPlaying } =
    usePlayerStore();

  const translateY = useSharedValue(120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (active) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withTiming(120, { duration: 250 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const src = sources[srcIdx];
  const bottom = TAB_BAR_H + Math.max(insets.bottom, 8) + 8;

  const handleExpand = () => {
    if (!contentId) return;
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
    <Animated.View style={[styles.wrapper, { bottom }, animStyle]} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={0.95} onPress={handleExpand} style={styles.card}>
        {/* Video thumbnail / live preview */}
        <View style={styles.thumb}>
          {src?.url ? (
            <NativeVideo uri={src.url} headers={src.headers} paused={!isPlaying} />
          ) : null}
          {/* Logo fallback overlay */}
          {logo ? (
            <Image
              source={{ uri: logo }}
              style={styles.logoOverlay}
              resizeMode="contain"
            />
          ) : (
            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={StyleSheet.absoluteFill}>
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Ionicons name="tv" size={22} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          )}
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveTxt}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <View style={styles.info}>
          <Text style={styles.titleTxt} numberOfLines={1}>{title}</Text>
          <Text style={styles.subTxt} numberOfLines={1}>
            {isLive ? '● Live Streaming' : 'Playing now'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            onPress={() => setPlaying(!isPlaying)}
            style={styles.ctrlBtn}
            hitSlop={10}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={close}
            style={styles.ctrlBtn}
            hitSlop={10}
          >
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Progress bar for non-live */}
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
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12121F',
    borderRadius: 14,
    height: PLAYER_H,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  thumb: {
    width: 100,
    height: PLAYER_H,
    backgroundColor: '#050510',
    overflow: 'hidden',
    position: 'relative',
  },
  logoOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  liveBadge: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.9)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },
  info: { flex: 1, paddingHorizontal: 12 },
  titleTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  subTxt: { color: '#8B5CF6', fontSize: 11, marginTop: 3 },
  controls: { flexDirection: 'row', alignItems: 'center', paddingRight: 10, gap: 4 },
  ctrlBtn: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 18,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
});
