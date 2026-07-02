import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Platform, Modal, BackHandler,
} from 'react-native';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence,
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

type State = 'available' | 'downloading' | 'done';

export default function OtaUpdateBanner() {
  const [state, setState]    = useState<State | null>(null);
  const [progress, setProgress] = useState(0);
  const progressAnim         = useSharedValue(0);
  const pulseAnim            = useSharedValue(1);
  const timerRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didCheck             = useRef(false);

  useEffect(() => () => {
    if (timerRef.current)       clearInterval(timerRef.current);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
  }, []);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(withTiming(1.06, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      true,
    );
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (didCheck.current) return;
    if (Platform.OS === 'web') return;
    if (IS_EXPO_GO) return;

    didCheck.current = true;
    try {
      const Updates = await import('expo-updates');
      if (!Updates.isEnabled) return;
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) setState('available');
    } catch (e: any) {
      console.warn('[OTA] check failed:', e?.message ?? e);
    }
  }, []);

  useEffect(() => { checkForUpdate(); }, [checkForUpdate]);

  useEffect(() => {
    if (state === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [state]);

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

  async function applyUpdate() {
    setState('downloading');
    setProgress(0);
    progressAnim.value = 0;
    startProgressTimer();

    try {
      const Updates = await import('expo-updates');
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
        }
      }, 1500);
    } catch (e: any) {
      console.warn('[OTA] fetchUpdate failed:', e?.message ?? e);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setState('available');
    }
  }

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%` as any,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  if (state === null) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>

          {/* Icon */}
          <Animated.View style={[styles.iconWrap, pulseStyle]}>
            <Text style={styles.icon}>
              {state === 'done' ? '✅' : state === 'downloading' ? '⬇️' : '🔄'}
            </Text>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>
            {state === 'done'
              ? 'আপডেট সম্পন্ন!'
              : state === 'downloading'
              ? `ডাউনলোড হচ্ছে… ${progress}%`
              : 'নতুন আপডেট এসেছে!'}
          </Text>

          {/* Subtitle */}
          <Text style={styles.sub}>
            {state === 'done'
              ? 'অ্যাপ restart হচ্ছে…'
              : state === 'downloading'
              ? 'অ্যাপ বন্ধ করবেন না'
              : 'আপডেট না করলে অ্যাপ ব্যবহার করা যাবে না'}
          </Text>

          {/* Progress bar */}
          {state === 'downloading' && (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressBarStyle]} />
              <View style={styles.progressLabels}>
                <Text style={styles.progressPct}>{progress}%</Text>
                <Text style={styles.progressPct}>100%</Text>
              </View>
            </View>
          )}

          {/* Button — only shown when update is available */}
          {state === 'available' && (
            <TouchableOpacity style={styles.btn} onPress={applyUpdate} activeOpacity={0.8}>
              <Text style={styles.btnText}>আপডেট করুন</Text>
            </TouchableOpacity>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#12122A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.5)',
    padding: 28,
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  iconWrap: {
    marginBottom: 16,
  },
  icon: {
    fontSize: 52,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  sub: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  progressTrack: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  progressLabels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 16,
  },
  progressPct: {
    color: '#71717A',
    fontSize: 11,
  },
  btn: {
    width: '100%',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
