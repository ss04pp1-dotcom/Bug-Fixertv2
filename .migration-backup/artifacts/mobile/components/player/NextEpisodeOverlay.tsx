import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface NextEpisode {
  title: string;
  epNumber: number;
  onPlay: () => void;
  onDismiss: () => void;
}

interface NextEpisodeOverlayProps {
  nextEpisode: NextEpisode | null;
  visible: boolean;
}

const AUTO_PLAY_SEC = 10;

export function NextEpisodeOverlay({ nextEpisode, visible }: NextEpisodeOverlayProps) {
  const [countdown, setCountdown] = useState(AUTO_PLAY_SEC);
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible && nextEpisode ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (visible && nextEpisode) {
      setCountdown(AUTO_PLAY_SEC);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            nextEpisode.onPlay();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, nextEpisode]);

  if (!nextEpisode) return null;

  return (
    <Animated.View style={[s.container, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
      <LinearGradient
        colors={['transparent', 'rgba(5,5,16,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.card}>
        <Text style={s.upNextLabel}>UP NEXT</Text>
        <Text style={s.epTitle} numberOfLines={2}>
          Episode {nextEpisode.epNumber}: {nextEpisode.title}
        </Text>
        <View style={s.actions}>
          <TouchableOpacity style={s.playBtn} onPress={nextEpisode.onPlay}>
            <LinearGradient colors={['#8B5CF6', '#EC4899']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.playGrad}>
              <Ionicons name="play" size={16} color="#fff" style={{ marginLeft: 2 }} />
              <Text style={s.playTxt}>Play Now</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.cancelBtn} onPress={nextEpisode.onDismiss}>
            <Text style={s.cancelTxt}>Cancel ({countdown}s)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    justifyContent: 'flex-end',
    zIndex: 10,
  },
  card: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  upNextLabel: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  epTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  playBtn: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  playGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  playTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cancelTxt: {
    color: '#e5e7eb',
    fontSize: 13,
  },
});
