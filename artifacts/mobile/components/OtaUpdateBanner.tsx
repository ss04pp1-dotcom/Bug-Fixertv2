import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Platform, AppState,
  type AppStateStatus,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat,
  withSequence, Easing, FadeIn, FadeOut,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

const IS_EXPO_GO: boolean = (() => {
  try {
    const env = (Constants as any).executionEnvironment;
    if (env === 'storeClient') return true;
    if (env === 'standalone' || env === 'bare') return false;
    return Constants.appOwnership === 'expo';
  } catch { return false; }
})();

type Phase = 'idle' | 'downloading' | 'done' | 'error';

export default function OtaUpdateBanner() {
  const [phase, setPhase]       = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg]     = useState('');

  const progressAnim   = useSharedValue(0);
  const pulseAnim      = useSharedValue(1);
  const glowAnim       = useSharedValue(0);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkingRef    = useRef(false);
  const startedRef     = useRef(false);

  useEffect(() => () => {
    if (timerRef.current)       clearInterval(timerRef.current);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
  }, []);

  // ── Pulse animation for the icon ──────────────────────────────────────────
  useEffect(() => {
    if (phase === 'downloading') {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0,  { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      pulseAnim.value = withTiming(1, { duration: 200 });
      glowAnim.value  = withTiming(0, { duration: 200 });
    }
  }, [phase]);

  // ── Start fake progress ticker ────────────────────────────────────────────
  function startProgressTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    let current = 1;
    setProgress(1);
    progressAnim.value = withTiming(0.01, { duration: 100 });

    timerRef.current = setInterval(() => {
      // Accelerate to 40%, slow between 40-85%, crawl 85-95%
      const increment = current < 40
        ? Math.random() * 8 + 4
        : current < 85
        ? Math.random() * 4 + 1.5
        : Math.random() * 1.2 + 0.3;

      current = Math.min(current + increment, 95);
      const rounded = Math.round(current);
      setProgress(rounded);
      progressAnim.value = withTiming(rounded / 100, { duration: 280 });

      if (rounded >= 95) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, 320);
  }

  // ── Download and apply update ─────────────────────────────────────────────
  const applyUpdate = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    setPhase('downloading');
    setProgress(0);
    progressAnim.value = 0;
    setErrMsg('');
    startProgressTimer();

    try {
      const Updates = await import('expo-updates');
      await Updates.fetchUpdateAsync();

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setProgress(100);
      progressAnim.value = withTiming(1, { duration: 400 });
      setPhase('done');

      reloadTimerRef.current = setTimeout(() => {
        (async () => {
          try {
            await Updates.reloadAsync();
          } catch (err: any) {
            console.warn('[OTA] reloadAsync failed:', err?.message ?? err);
            setErrMsg('রিস্টার্ট হয়নি — অ্যাপ বন্ধ করে আবার খুলুন।');
            setPhase('error');
          }
        })();
      }, 1800);

    } catch (err: any) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      console.warn('[OTA] fetchUpdateAsync:', err?.message ?? err);
      setErrMsg('ডাউনলোড ব্যর্থ। ইন্টারনেট চেক করুন।');
      setPhase('error');
      progressAnim.value = withTiming(0, { duration: 300 });
    }
  }, []);

  // ── Check for update ──────────────────────────────────────────────────────
  const checkForUpdate = useCallback(async () => {
    if (checkingRef.current)   return;
    if (Platform.OS === 'web') return;
    if (IS_EXPO_GO)            return;
    if (startedRef.current)    return;

    checkingRef.current = true;
    try {
      const Updates = await import('expo-updates');
      if (!Updates.isEnabled) return;
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        // Auto-start immediately — full-screen overlay will show progress
        applyUpdate();
      }
    } catch (e: any) {
      console.warn('[OTA] checkForUpdate:', e?.message ?? e);
    } finally {
      checkingRef.current = false;
    }
  }, [applyUpdate]);

  useEffect(() => { checkForUpdate(); }, [checkForUpdate]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') checkForUpdate();
    });
    return () => sub.remove();
  }, [checkForUpdate]);

  // ── Animated styles ───────────────────────────────────────────────────────
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%` as any,
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value * 0.6,
  }));

  if (phase === 'idle') return null;

  // ── Phase helpers ─────────────────────────────────────────────────────────
  const isDone  = phase === 'done';
  const isError = phase === 'error';

  const iconEmoji  = isDone ? '✅' : isError ? '❌' : '⬇️';
  const titleText  = isDone
    ? 'আপডেট সম্পন্ন!'
    : isError
    ? 'আপডেট ব্যর্থ হয়েছে'
    : `আপডেট হচ্ছে… ${progress}%`;
  const subText    = isError
    ? errMsg || 'পরে আবার চেষ্টা হবে।'
    : isDone
    ? 'অ্যাপ restart হচ্ছে…'
    : 'অ্যাপ বন্ধ করবেন না';

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
      style={StyleSheet.absoluteFill}
    >
      {/* Dark full-screen backdrop */}
      <LinearGradient
        colors={['rgba(5,5,16,0.97)', 'rgba(12,8,28,0.98)', 'rgba(5,5,16,0.97)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.inner}>
        {/* Glow ring behind icon */}
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.glowRing, glowStyle]} />
          <Animated.Text style={[styles.icon, pulseStyle]}>{iconEmoji}</Animated.Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.sub}>{subText}</Text>

        {/* Progress bar */}
        {!isError && (
          <View style={styles.trackOuter}>
            <View style={styles.trackBg}>
              <Animated.View style={[styles.trackFill, progressBarStyle]}>
                <LinearGradient
                  colors={isDone ? ['#10B981', '#34D399'] : ['#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            </View>

            {/* Numeric markers */}
            <View style={styles.markers}>
              <Text style={styles.markerTxt}>0%</Text>
              {[25, 50, 75].map(v => (
                <Text key={v} style={styles.markerTxt}>{v}%</Text>
              ))}
              <Text style={[styles.markerTxt, { color: isDone ? '#34D399' : '#D1D5DB' }]}>100%</Text>
            </View>

            {/* Big percentage */}
            <Text style={[styles.bigPct, isDone && { color: '#34D399' }]}>
              {progress}%
            </Text>
          </View>
        )}

        {/* Error message */}
        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTxt}>{errMsg || 'অজানা সমস্যা হয়েছে।'}</Text>
          </View>
        )}

        {/* StreamPro watermark */}
        <Text style={styles.watermark}>StreamPro</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    width: 110,
    height: 110,
  },
  glowRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(139,92,246,0.45)',
  },
  icon: {
    fontSize: 56,
    textAlign: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  sub: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  trackOuter: {
    width: '100%',
    alignItems: 'center',
  },
  trackBg: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  trackFill: {
    height: '100%',
    borderRadius: 5,
    overflow: 'hidden',
  },
  markers: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  markerTxt: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '600',
  },
  bigPct: {
    marginTop: 20,
    color: '#8B5CF6',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  errorBox: {
    marginTop: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorTxt: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  watermark: {
    position: 'absolute',
    bottom: 48,
    color: 'rgba(255,255,255,0.15)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
});
