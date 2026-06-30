import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { C } from './constants';

function volIcon(step: number): any {
  if (step === 0) return 'volume-mute';
  if (step <= 3) return 'volume-low';
  if (step <= 6) return 'volume-medium';
  return 'volume-high';
}

export function SeekFeedback({ side, seconds, onDone }: { side: 'left' | 'right'; seconds: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 800); return () => clearTimeout(t); }, [onDone]);
  return (
    <Animated.View
      entering={FadeIn.duration(80)}
      exiting={FadeOut.duration(400)}
      style={[sf.wrap, side === 'left' ? { left: 30 } : { right: 30 }]}
    >
      <View style={sf.inner}>
        <Ionicons name={side === 'left' ? 'play-back' : 'play-forward'} size={28} color="#fff" />
        <Text style={sf.txt}>{seconds}s</Text>
      </View>
    </Animated.View>
  );
}

export function SwipeIndicator({ type, value }: { type: 'volume' | 'brightness'; value: number }) {
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

const sf = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  inner: { backgroundColor: 'rgba(0,0,0,0.58)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', gap: 4 },
  txt: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

const sw = StyleSheet.create({
  wrap: { position: 'absolute', top: '20%', backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 16, padding: 12, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', width: 58 },
  track: { width: 8, height: 100, gap: 2, flexDirection: 'column-reverse', alignItems: 'center' },
  block: { width: 8, height: 7, borderRadius: 2 },
  val: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
