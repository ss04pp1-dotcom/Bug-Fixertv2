import React, { useState, useMemo, useCallback } from 'react';
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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '@/lib/api';

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', color: '#1C1C2A' };

  let score = 0;
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (hasLength) score++;
  if (hasUpper) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;

  const levels: PasswordStrength[] = [
    { score: 0, label: 'Too Short', color: '#EF4444' },
    { score: 1, label: 'Weak', color: '#F97316' },
    { score: 2, label: 'Fair', color: '#F5C518' },
    { score: 3, label: 'Strong', color: '#84CC16' },
    { score: 4, label: 'Very Strong', color: '#10B981' },
  ];

  return levels[score] || levels[0];
}

const STRENGTH_COLORS = ['#EF4444', '#F97316', '#F5C518', '#10B981'];

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const strength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword]);

  const validations = useMemo(() => {
    return {
      hasLength: newPassword.length >= 8,
      hasComplex: /[A-Z]/.test(newPassword) && /\d/.test(newPassword),
      passwordsMatch: newPassword.length > 0 && newPassword === confirmPassword,
    };
  }, [newPassword, confirmPassword]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleReset = useCallback(async () => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (!validations.hasComplex) {
      Alert.alert('Error', 'Password must contain at least one uppercase letter and one number');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        newPassword,
        confirmPassword,
      });
      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. Please log in with your new password.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/(auth)/login'),
          },
        ],
      );
    } catch (err: any) {
      const message =
        err?.response?.data?.message || 'Failed to reset password. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setIsLoading(false);
    }
  }, [newPassword, confirmPassword, validations]);

  const isButtonDisabled = isLoading || !validations.hasLength || !validations.hasComplex || !validations.passwordsMatch;

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

        {/* Icon */}
        <Animated.View entering={FadeIn.delay(100).duration(500)} style={styles.iconSection}>
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
          Reset Password
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.delay(250).duration(500)}
          style={styles.description}
        >
          Create a strong password that you haven't used before
        </Animated.Text>

        {/* New Password Input */}
        <Animated.View entering={FadeIn.delay(300).duration(500)} style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#6B6B80"
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="New Password"
              placeholderTextColor="#6B6B80"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              autoComplete="password"
              autoCapitalize="none"
              keyboardType="default"
              returnKeyType="next"
              textContentType="newPassword"
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowNewPassword((prev) => !prev);
              }}
              activeOpacity={0.7}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#6B6B80"
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Password Strength Indicator */}
        {newPassword.length > 0 && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.strengthContainer}>
            <View style={styles.strengthBarContainer}>
              {STRENGTH_COLORS.map((color, index) => (
                <View
                  key={index}
                  style={[
                    styles.strengthSegment,
                    {
                      backgroundColor:
                        index < strength.score ? STRENGTH_COLORS[strength.score - 1] : '#1C1C2A',
                    },
                  ]}
                />
              ))}
            </View>
            <Text
              style={[
                styles.strengthLabel,
                { color: strength.color },
              ]}
            >
              {strength.label}
            </Text>
          </Animated.View>
        )}

        {/* Confirm Password Input */}
        <Animated.View entering={FadeIn.delay(400).duration(500)} style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#6B6B80"
              style={styles.inputIcon}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Confirm Password"
              placeholderTextColor="#6B6B80"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoComplete="password"
              autoCapitalize="none"
              keyboardType="default"
              returnKeyType="done"
              textContentType="newPassword"
              editable={!isLoading}
              onSubmitEditing={handleReset}
            />
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowConfirmPassword((prev) => !prev);
              }}
              activeOpacity={0.7}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#6B6B80"
              />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Validation Checklist */}
        <Animated.View
          entering={FadeIn.delay(450).duration(500)}
          style={styles.checklistContainer}
        >
          {/* 8+ characters */}
          <View style={styles.checkItem}>
            <MaterialCommunityIcons
              name={validations.hasLength ? 'check-circle' : 'close-circle'}
              size={20}
              color={validations.hasLength ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.checkLabel,
                validations.hasLength ? styles.checkLabelValid : styles.checkLabelInvalid,
              ]}
            >
              8+ characters
            </Text>
          </View>

          {/* Number + Uppercase */}
          <View style={styles.checkItem}>
            <MaterialCommunityIcons
              name={validations.hasComplex ? 'check-circle' : 'close-circle'}
              size={20}
              color={validations.hasComplex ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.checkLabel,
                validations.hasComplex ? styles.checkLabelValid : styles.checkLabelInvalid,
              ]}
            >
              Number + Uppercase
            </Text>
          </View>

          {/* Passwords match */}
          <View style={styles.checkItem}>
            <MaterialCommunityIcons
              name={validations.passwordsMatch ? 'check-circle' : 'close-circle'}
              size={20}
              color={validations.passwordsMatch ? '#10B981' : '#EF4444'}
            />
            <Text
              style={[
                styles.checkLabel,
                validations.passwordsMatch ? styles.checkLabelValid : styles.checkLabelInvalid,
              ]}
            >
              Passwords match
            </Text>
          </View>
        </Animated.View>

        {/* Reset Button */}
        <Animated.View entering={FadeIn.delay(550).duration(500)}>
          <TouchableOpacity
            onPress={handleReset}
            activeOpacity={0.85}
            disabled={isButtonDisabled}
            style={styles.buttonTouchable}
          >
            <LinearGradient
              colors={['#7C3AED', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.gradientButton,
                isButtonDisabled && styles.buttonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Reset Password</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Back to login */}
        <Animated.View
          entering={FadeIn.delay(650).duration(500)}
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
    marginBottom: 28,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconOuterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(124, 58, 237, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
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
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#B3B8C8',
    fontFamily: 'Inter',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 12,
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
  eyeButton: {
    padding: 8,
    marginLeft: 4,
  },
  strengthContainer: {
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  strengthBarContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 13,
    fontFamily: 'Inter',
    fontWeight: '600',
    textAlign: 'right',
  },
  checklistContainer: {
    width: '100%',
    backgroundColor: '#121A2F',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkLabel: {
    fontSize: 14,
    fontFamily: 'Inter',
    fontWeight: '500',
  },
  checkLabelValid: {
    color: '#10B981',
  },
  checkLabelInvalid: {
    color: '#6B6B80',
  },
  buttonTouchable: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
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
  buttonDisabled: {
    opacity: 0.4,
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
    marginTop: 24,
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
});