import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { tokenStorage } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

const { width: W, height: H } = Dimensions.get('window');

export default function SplashScreenComponent() {
  const logoScale = useRef(new RNAnimated.Value(0.5)).current;
  const glowOpacity = useRef(new RNAnimated.Value(0.3)).current;
  const barWidth = useRef(new RNAnimated.Value(0)).current;
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.spring(logoScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      RNAnimated.timing(barWidth, {
        toValue: W * 0.6,
        duration: 1800,
        useNativeDriver: false,
      }),
    ]).start();

    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(glowOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
        RNAnimated.timing(glowOpacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    const timer = setTimeout(async () => {
      try {
        const token = await tokenStorage.getAccessToken();
        if (!token) {
          router.replace('/(auth)/onboarding');
          return;
        }
        // Validate token server-side to avoid re-login loop with expired tokens
        await checkAuth();
        const authenticated = useAuthStore.getState().isAuthenticated;
        if (authenticated) {
          router.replace('/(main)');
        } else {
          router.replace('/(auth)/login');
        }
      } catch {
        router.replace('/(auth)/onboarding');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Glow */}
        <RNAnimated.View style={[styles.bgGlow, { opacity: glowOpacity }]} />

        {/* Logo */}
        <RNAnimated.View style={[styles.logoArea, { transform: [{ scale: logoScale }] }]}>
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sIconWrapper}
          >
            <Text style={styles.sIconText}>S</Text>
          </LinearGradient>
          <Text style={styles.appName}>StreamPro</Text>
        </RNAnimated.View>

        <Text style={styles.tagline}>
          Movies • Live TV • Sports
        </Text>
      </View>

      <View style={styles.loadingContainer}>
        <View style={styles.loadingTrack}>
          <RNAnimated.View style={[styles.loadingBar, { width: barWidth }]}>
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </RNAnimated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  bgGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#8B5CF6',
    alignSelf: 'center',
    top: '25%',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 50,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  sIconText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#fff',
    fontFamily: 'Outfit',
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Outfit',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tagline: {
    fontSize: 16,
    color: '#A1A1AA',
    fontFamily: 'Inter',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 60,
    width: W * 0.6,
    alignItems: 'center',
  },
  loadingTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#13131C',
    borderRadius: 3,
    overflow: 'hidden',
  },
  loadingBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
});
