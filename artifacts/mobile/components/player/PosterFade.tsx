import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, Animated } from 'react-native';

interface PosterFadeProps {
  uri: string;
  visible: boolean;
}

export function PosterFade({ uri, visible }: PosterFadeProps) {
  const opacity = useRef(new Animated.Value(uri ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: visible ? 0 : 350,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  if (!uri) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, zIndex: 1 }]} pointerEvents="none">
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        blurRadius={2}
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
      />
    </Animated.View>
  );
}
