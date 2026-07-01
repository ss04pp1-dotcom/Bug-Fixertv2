import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, AppState,
  type AppStateStatus,
} from 'react-native';
import Animated, {
  SlideInDown, SlideOutDown, useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import Constants from 'expo-constants';

// ── Expo Go detection ──────────────────────────────────────────────────────
const IS_EXPO_GO: boolean = (() => {
  try {
    const env = (Constants as any).executionEnvironment;
    if (env === 'storeClient') return true;
    if (env === 'standalone' || env === 'bare') return false;
    return Constants.appOwnership === 'expo';
  } catch { return false; }
})();

type State = 'idle' | 'available' | 'downloading' | 'done' | 'error';

export default function OtaUpdateBanner() {
  const [state, setState]       = useState<State>('idle');
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg]     = useState('');
  const progressAnim            = useSharedValue(0);
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null);
  const reloadTimerRef          = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkingRef             = useRef(false);

  useEffect(() => () => {
    if (timerRef.current)       clearInterval(timerRef.current);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
  }, []);

  // ── Check for OTA update ───────────────────────────────────────────────────
  const checkForUpdate = useCallback(async () => {
    if (checkingRef.current)   return;
    if (Platform.OS === 'web') return;
    if (IS_EXPO_GO)            return;

    checkingRef.current = true;
    try {
      const Updates = await import('expo-updates');
      if (!Updates.isEnabled) return;
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) setState('available');
    } catch (e: any) {
      console.warn('[OTA] checkForUpdate:', e?.message ?? e);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => { checkForUpdate(); }, [checkForUpdate]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') checkForUpdate();
    });
    return () => sub.remove();
  }, [checkForUpdate]);

  // ── Fake progress ticker ───────────────────────────────────────────────────
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

  // ── Apply update (user-triggered) ─────────────────────────────────────────
  async function applyUpdate() {
    setState('downloading');
    setProgress(0);
    progressAnim.value = 0;
    setErrMsg('');
    startProgressTimer();

    try {
      const Updates = await import('expo-updates');
      await Updates.fetchUpdateAsync();

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setProgress(100);
      progressAnim.value = withTiming(1, { duration: 300 });
      setState('done');

      reloadTimerRef.current = setTimeout(() => {
        (async () => {
          try {
            await Updates.reloadAsync();
          } catch (reloadErr: any) {
            console.warn('[OTA] reloadAsync failed:', reloadErr?.message ?? reloadErr);
            setErrMsg('রিস্টার্ট হয়নি — অ্যাপ বন্ধ করে আবার খুলুন।');
            setState('error');
          }
        })();
      }, 1200);

    } catch (fetchErr: any) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      console.warn('[OTA] fetchUpdateAsync:', fetchErr?.message ?? fetchErr);
      setErrMsg('ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।');
      setState('error');
      setProgress(0);
      progressAnim.value = withTiming(0, { duration: 200 });
    }
  }

  function retry() {
    setErrMsg('');
    setState('available');
    setProgress(0);
    progressAnim.value = 0;
  }

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%` as any,
  }));

  if (state === 'idle') return null;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown}
      style={styles.banner}
    >
      <View style={styles.content}>
        <View style={styles.row}>
          {/* Left: title + subtitle / error */}
          <View style={styles.left}>
            <Text style={styles.title}>
              {state === 'done'
                ? '✅ আপডেট সম্পন্ন!'
                : state === 'downloading'
                ? `⬇️ ডাউনলোড হচ্ছে… ${progress}%`
                : state === 'error'
                ? '❌ আপডেট ব্যর্থ'
                : '🔄 নতুন আপডেট এসেছে!'}
            </Text>
            {errMsg ? (
              <Text style={styles.errText}>{errMsg}</Text>
            ) : (
              <Text style={styles.sub}>
                {state === 'downloading'
                  ? 'অ্যাপ বন্ধ করবেন না'
                  : state === 'done'
                  ? 'অ্যাপ restart হচ্ছে…'
                  : 'Play Store ছাড়াই আপডেট করুন'}
              </Text>
            )}
          </View>

          {/* Right: action button */}
          {state === 'available' && (
            <TouchableOpacity style={styles.btn} onPress={applyUpdate} activeOpacity={0.75}>
              <Text style={styles.btnText}>আপডেট</Text>
            </TouchableOpacity>
          )}
          {state === 'done' && (
            <View style={[styles.btn, styles.btnDone]}>
              <Text style={styles.btnText}>✓</Text>
            </View>
          )}
          {state === 'error' && (
            <TouchableOpacity style={[styles.btn, styles.btnRetry]} onPress={retry} activeOpacity={0.75}>
              <Text style={styles.btnText}>আবার</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Animated progress bar — visible while downloading */}
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
  left:    { flex: 1, marginRight: 12 },
  title:   { color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginBottom: 3 },
  sub:     { color: '#A1A1AA', fontSize: 12 },
  errText: { color: '#F87171', fontSize: 12 },
  btn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 76,
  },
  btnDone:  { backgroundColor: '#10B981' },
  btnRetry: { backgroundColor: '#EF4444' },
  btnText:  { color: '#fff', fontWeight: '700', fontSize: 13 },
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
