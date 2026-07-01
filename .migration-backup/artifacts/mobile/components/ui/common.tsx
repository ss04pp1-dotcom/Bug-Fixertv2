import { View, Text, Pressable, PressableProps, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/theme';
import React from 'react';

interface GradientButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'accent';
  size?: 'lg' | 'md' | 'sm';
  icon?: React.ReactNode;
}

export function GradientButton({ title, variant = 'primary', size = 'lg', icon, style, disabled, ...props }: GradientButtonProps) {
  const colors = (variant === 'primary' ? [Colors.gradientStart, Colors.gradientEnd] : [Colors.accent, Colors.primary]) as [string, string];
  return (
    <Pressable disabled={disabled} {...props}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.button, size === 'sm' && styles.buttonSm, disabled && styles.disabled, style as any]}
      >
        {icon}
        <Text style={[styles.text, size === 'sm' && styles.textSm]}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 32,
  },
  buttonSm: { height: 44, borderRadius: 14, paddingHorizontal: 20 },
  text: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Inter' },
  textSm: { fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});

export function GlassCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ backgroundColor: 'rgba(18, 26, 47, 0.8)', borderRadius: 24, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' }, style]}>
      {children}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', fontFamily: 'Inter' }}>{title}</Text>
      {action && (
        <Pressable onPress={action.onPress}>
          <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '600' }}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function LiveBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dotSize = size === 'sm' ? 6 : 8;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: Colors.live }} />
      <Text style={{ color: Colors.live, fontSize: size === 'sm' ? 10 : 12, fontWeight: '700', textTransform: 'uppercase' }}>Live</Text>
    </View>
  );
}

export function StarRating({ rating, size = 14, showValue = true }: { rating: number; size?: number; showValue?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ color: Colors.starYellow, fontSize: size }}>★</Text>
      {showValue && <Text style={{ color: '#fff', fontSize: size - 1, fontWeight: '600' }}>{rating?.toFixed(1)}</Text>}
    </View>
  );
}

export function ContentCard({ title, imageUrl, subtitle, rating, badge, onPress, style }: {
  title: string; imageUrl: string; subtitle?: string; rating?: number; badge?: string; onPress?: () => void; style?: object;
}) {
  return (
    <Pressable onPress={onPress} style={[{ width: 140 }, style]}>
      <View style={{ width: 140, height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
        <View style={{ width: 140, height: 200, borderRadius: 16, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted, fontSize: 12 }}>🎬</Text>
        </View>
        {badge && (
          <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(124, 58, 237, 0.9)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{badge}</Text>
          </View>
        )}
        {rating !== undefined && (
          <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={{ color: Colors.starYellow, fontSize: 10 }}>★</Text>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{rating}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 8 }}>{title}</Text>
      {subtitle && <Text numberOfLines={1} style={{ color: Colors.textMuted, fontSize: 11 }}>{subtitle}</Text>}
    </Pressable>
  );
}

export function Skeleton({ width, height, style }: { width: number | string; height: number | string; style?: object }) {
  return <View style={[{ width, height, backgroundColor: Colors.surfaceLight, borderRadius: 12 }, style]} />;
}

export function EmptyState({ icon, title, subtitle, action }: { icon: string; title: string; subtitle?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>{icon}</Text>
      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>{title}</Text>
      {subtitle && <Text style={{ color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>{subtitle}</Text>}
      {action && <GradientButton title={action.label} onPress={action.onPress} size="sm" />}
    </View>
  );
}