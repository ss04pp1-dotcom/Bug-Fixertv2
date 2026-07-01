import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

const C = { primary: '#8B5CF6', accent: '#EC4899', dim: '#9CA3AF' };

function fmt(s: number): string {
  if (!s || isNaN(s) || !isFinite(s)) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

interface SeekBarProps {
  progressSV: SharedValue<number>;
  currentTime: number;
  duration: number;
  trackWidthRef: React.MutableRefObject<number>;
  onSeekFrac: (frac: number) => void;
}

export function SeekBar({ progressSV, currentTime, duration, trackWidthRef, onSeekFrac }: SeekBarProps) {
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, progressSV.value * 100)}%` as any,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    left: `${Math.min(100, progressSV.value * 100)}%` as any,
  }));

  const tapGesture = useCallback(() => Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      if (!trackWidthRef.current) return;
      const frac = Math.max(0, Math.min(1, e.x / trackWidthRef.current));
      onSeekFrac(frac);
    }), [onSeekFrac, trackWidthRef]);

  return (
    <View style={s.row}>
      <Text style={s.time}>{fmt(currentTime)}</Text>
      <GestureDetector gesture={tapGesture()}>
        <View
          style={s.trackWrap}
          onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
        >
          <View style={s.trackBg}>
            <Animated.View style={[s.trackFill, fillStyle]}>
              <LinearGradient
                colors={[C.primary, C.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View style={[s.thumb, thumbStyle]} />
          </View>
        </View>
      </GestureDetector>
      <Text style={s.time}>{fmt(duration)}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  time: { color: '#e5e7eb', fontSize: 11, minWidth: 40, textAlign: 'center' },
  trackWrap: { flex: 1, height: 24, justifyContent: 'center' },
  trackBg: {
    height: 3.5, backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 2, position: 'relative', overflow: 'visible',
  },
  trackFill: {
    position: 'absolute', top: 0, left: 0, height: '100%',
    borderRadius: 2, overflow: 'hidden',
  },
  thumb: {
    position: 'absolute', top: -5.5, width: 14, height: 14,
    borderRadius: 7, backgroundColor: '#fff', marginLeft: -7,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.4,
    shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
});
