import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Platform,
} from 'react-native';
import Animated, {
  SlideInDown, SlideOutDown, useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import Constants from 'expo-constants';

const IS_EXPO_GO: boolean = (() => {
  try {
    const env = (Constants as any).executionEnvironment;
    if (env === 'storeClient') return true;
    if (env === 'standalone' || env === 'bare') return false;
    return Constants.appOwnership === 'expo';
  } catch { return false; }
})();

type State = 'idle' | 'downloading' | 'done' | 'error';

export default function OtaUpdateBanner() {
  const [state, setState]       = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const progressAnim            = useSharedValue(0);
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didCheck                = useRef(false);

  useEffect(() => () => {
    if (timerRef.current)       clearInterval(timerRef.current);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
  }, []);

  function startProgressTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    let current = 0;
    timerRef.current = setInterval(() => {
      current += Math.random() * 12 + 3;
      if (current >= 90) {
        current = 90;
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
      const rounded = Math.min(Math.round(current), 90);
      setProgress(rounded);
      progressAnim.value = withTiming(rounded / 100, { duration: 200 });
    }, 300);
  }

  const runUpdate = useCallback(async () => {
    if (didCheck.current) return;
    if (Platform.OS === 'web') return;
    if (IS_EXPO_GO) return;

    didCheck.current = true;

    try {
      const Updates = await import('expo-updates');
      if (!Updates.isEnabled) return;

      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;

      setState('downloading');
      setProgress(0);
      progressAnim.value = 0;
      startProgressTimer();

      await Updates.fetchUpdateAsync();

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setProgress(100);
      progressAnim.value = withTiming(1, { duration: 300 });
      setState('done');

      reloadTimerRef.current = setTimeout(async () => {
        try {
          await Updates.reloadAsync();
        } catch (e: any) {
          console.warn('[OTA] reloadAsync failed:', e?.message ?? e);
          setState('error');
        }
      }, 1500);

    } catch (e: any) {
      console.warn('[OTA] update failed:', e?.message ?? e);
      setState('error');
    }
  }, []);

  useEffect(() => { runUpdate(); }, [runUpdate]);

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%` as any,
  }));

  if (state === 'idle' || state === 'error') return null;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown}
      style={styles.banner}
    >
      <View style={styles.content}>
        <View style={styles.row}>
          <View style={styles.left}>
            <Text style={styles.title}>
              {state === 'done'
                ? '✅ আপডেট সম্পন্ন!'
                : `⬇️ আপডেট হচ্ছে… ${progress}%`}
            </Text>
            <Text style={styles.sub}>
              {state === 'done'
                ? 'অ্যাপ restart হচ্ছে…'
                : 'অ্যাপ বন্ধ করবেন না'}
            </Text>
          </View>
        </View>

        {state === 'downloading' && (
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, progressBarStyle]} />
            <View style={styles.progressLabels}>
              <Text style={styles.progressPct}>{progress}%</Text>
              <Text style={styles.progressPct}>100%</Text>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#12122A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.5)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 9999,
    overflow: 'hidden',
  },
  content: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left:  { flex: 1 },
  title: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginBottom: 3 },
  sub:   { color: '#A1A1AA', fontSize: 12 },
  progressTrack: {
    marginTop: 12,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressPct: { color: '#71717A', fontSize: 10 },
});
