import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });

  return (
    <Animated.View
      style={[s.base, { width: width as any, height, borderRadius, opacity }, style]}
    />
  );
}

export function SkeletonCard({ width = 120, height = 180 }: { width?: number; height?: number }) {
  return (
    <View style={{ gap: 8 }}>
      <Skeleton width={width} height={height} borderRadius={12} />
      <Skeleton width={width * 0.75} height={12} borderRadius={6} />
    </View>
  );
}

export function SkeletonChannelRow() {
  return (
    <View style={s.row}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={s.channelItem}>
          <Skeleton width={72} height={72} borderRadius={36} />
          <Skeleton width={56} height={10} borderRadius={5} />
        </View>
      ))}
    </View>
  );
}

export function SkeletonHeroCard() {
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, overflow: 'hidden' }}>
      <Skeleton width="100%" height={200} borderRadius={0} />
    </View>
  );
}

const s = StyleSheet.create({
  base: { backgroundColor: 'rgba(255,255,255,0.12)' },
  row: { flexDirection: 'row', gap: 16, paddingHorizontal: 16 },
  channelItem: { alignItems: 'center', gap: 6, width: 72 },
});
