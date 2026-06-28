import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '@/lib/api';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  // M-032: hold the navigation timeout so we can clear it on unmount.
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated glow
  const glowOpacity = useSharedValue(0.25);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.12, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [glowOpacity]);

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // M-032: clear any pending navigation timer on unmount.
  useEffect(() => {
    return () => {
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, []);

  const handleBack = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleSubmit = useCallback(async () => {
    Keyboard.dismiss();
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setError('');

    if (!emailOrPhone.trim()) {
      setError('Please enter your email or phone number');
      return;
    }

    setIsLoading(true);
    try {
      // M-009: backend expects `identifier`. The downstream OTP / reset-password
      // screens keep using `contact` as the nav param name; we normalize at the
      // API boundary so the navigation contract stays stable.
      await apiClient.post('/auth/forgot-password', {
        identifier: emailOrPhone.trim(),
      });
      setSuccess(true);
      navTimer.current = setTimeout(() => {
        router.replace({
          pathname: '/(auth)/otp-verification' as any,
          params: { contact: emailOrPhone.trim(), mode: 'reset' },
        } as any);
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to send reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [emailOrPhone]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.backRow}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#F2F2F7" />
          </TouchableOpacity>
        </Animated.View>

        {/* Icon with glow */}
        <Animated.View
          entering={FadeIn.delay(100).duration(500)}
          style={styles.iconSection}
        >
          <Animated.View style={[styles.glowCircle, glowAnimatedStyle]} />
          <View style={styles.iconOuterRing}>
            <LinearGradient
              colors={['#7C3AED', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <MaterialCommunityIcons name={"lock" as any} size={32} color="#FFFFFF" />
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Heading */}
        <Animated.Text
          entering={FadeIn.delay(200).duration(500)}
          style={styles.heading}
        >
          Forgot Password?
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.delay(300).duration(500)}
          style={styles.description}
        >
          Enter your email or phone number and we'll send you a reset code to get back into your account.
        </Animated.Text>

        {/* Email/Phone Input */}
        <Animated.View
          entering={FadeIn.delay(400).duration(500)}
          style={styles.inputWrapper}
        >
          <View style={styles.inputContainer}>
            <MaterialCommunityIcons
              name="email-outline"
              size={20}
              color="#6B6B80"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Email or phone number"
              placeholderTextColor="#6B6B80"
              value={emailOrPhone}
              onChangeText={setEmailOrPhone}
              autoComplete="email"
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="done"
              textContentType="emailAddress"
              editable={!isLoading}
              onSubmitEditing={handleSubmit}
            />
          </View>
        </Animated.View>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#FF3B30" />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={16} color="#34C759" />
            <Text style={styles.successTxt}>Code sent! Redirecting...</Text>
          </View>
        )}

        {/* Submit Button */}
        <Animated.View entering={FadeIn.delay(500).duration(500)}>
          <TouchableOpacity
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isLoading}
            style={styles.buttonTouchable}
          >
            <LinearGradient
              colors={['#7C3AED', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Send Reset Link</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Back to login hint */}
        <Animated.View
          entering={FadeIn.delay(600).duration(500)}
          style={styles.loginHintRow}
        >
          <Text style={styles.loginHintLabel}>Remember your password? </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(auth)/login' as any);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.loginHintLink}>Login</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070F',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backRow: {
    marginBottom: 32,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#121A2F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSection: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  glowCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#7C3AED',
  },
  iconOuterRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F2F2F7',
    fontFamily: 'Inter',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#B3B8C8',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 28,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C2A',
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#F2F2F7',
    fontFamily: 'Inter',
    height: '100%',
    outlineWidth: 0,
    padding: 0,
  },
  buttonTouchable: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
  },
  gradientButton: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Inter',
    letterSpacing: 0.3,
  },
  loginHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  loginHintLabel: {
    fontSize: 14,
    color: '#6B6B80',
    fontFamily: 'Inter',
  },
  loginHintLink: {
    fontSize: 14,
    color: '#7C3AED',
    fontFamily: 'Inter',
    fontWeight: '700',
  },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,59,48,0.12)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  errorTxt: { color: '#FF3B30', fontSize: 14, fontFamily: 'Inter', flex: 1 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(52,199,89,0.12)', borderWidth: 1, borderColor: 'rgba(52,199,89,0.3)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  successTxt: { color: '#34C759', fontSize: 14, fontFamily: 'Inter', flex: 1 },
});