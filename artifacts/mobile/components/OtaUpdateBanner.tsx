import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import Constants from 'expo-constants';

const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  (Constants as any).executionEnvironment === 'storeClient';

type State = 'idle' | 'available' | 'downloading' | 'done';

export default function OtaUpdateBanner() {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (IS_EXPO_GO || Platform.OS === 'web') return;
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      const Updates = await import('expo-updates');
      if (!Updates.isEnabled) return;
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) setState('available');
    } catch {}
  }

  async function applyUpdate() {
    setState('downloading');
    setError('');
    try {
      const Updates = await import('expo-updates');
      await Updates.fetchUpdateAsync();
      setState('done');
      setTimeout(() => Updates.reloadAsync(), 1000);
    } catch (e: any) {
      setError('Update failed. Try again.');
      setState('available');
    }
  }

  if (state === 'idle') return null;

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(18)}
      exiting={SlideOutDown}
      style={styles.banner}
    >
      <View style={styles.left}>
        <Text style={styles.title}>
          {state === 'done' ? '✅ আপডেট হচ্ছে…' : '🔄 নতুন আপডেট এসেছে!'}
        </Text>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <Text style={styles.sub}>
            {state === 'downloading'
              ? 'ডাউনলোড হচ্ছে…'
              : state === 'done'
              ? 'একটু অপেক্ষা করুন'
              : 'ট্যাপ করে এখনই আপডেট করুন'}
          </Text>
        )}
      </View>

      {(state === 'available' || state === 'downloading') && (
        <TouchableOpacity
          style={[styles.btn, state === 'downloading' && styles.btnDisabled]}
          onPress={applyUpdate}
          disabled={state === 'downloading'}
          activeOpacity={0.75}
        >
          {state === 'downloading' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>আপডেট করুন</Text>
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 18,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  left: { flex: 1, marginRight: 12 },
  title: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  sub: { color: '#A1A1AA', fontSize: 12 },
  error: { color: '#F87171', fontSize: 12 },
  btn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
