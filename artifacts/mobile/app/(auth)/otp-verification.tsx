import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/lib/api';

const OTP_LENGTH = 6;

export default function OTPVerificationScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const contact = (params.contact as string) || '';
  const mode = (params.mode as string) || 'reset';

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [timer, setTimer] = useState(59);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const endTimeRef = useRef<number>(0);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // M-044: single interval based on an absolute end-time ref — avoids recreating
  // setInterval on every tick (which the old `[timer]` dep did).
  useEffect(() => {
    endTimeRef.current = Date.now() + 59000;
    const int = setInterval(() => {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setTimer(remaining);
      if (remaining <= 0) clearInterval(int);
    }, 250);
    return () => clearInterval(int);
  }, []);

  // Clear any resend interval on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    };
  }, []);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '');
    // M-025: smart paste — if the user pastes 2+ digits, distribute them across boxes.
    if (digit.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < OTP_LENGTH && i < digit.length; i++) {
        newOtp[i] = digit[i];
      }
      setOtp(newOtp);
      inputRefs.current[Math.min(digit.length, OTP_LENGTH) - 1]?.focus();
      return;
    }
    const singleDigit = digit.slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = singleDigit;
    setOtp(newOtp);

    if (singleDigit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) return;
    setIsLoading(true);
    try {
      // M-009: backend expects `identifier` (not `contact`) and `type` (not `mode`).
      await apiClient.post('/auth/verify-otp', { identifier: contact, code, type: 'forgot_password' });
      if (mode === 'reset') {
        // M-009: forward `contact` and verified `code` so the reset-password screen
        // can include them in the final /auth/reset-password call.
        router.replace({
          pathname: '/(auth)/reset-password' as any,
          params: { contact, code },
        } as any);
      } else {
        router.replace('/(main)');
      }
    } catch (err: any) {
      Alert.alert('Verification Failed', err?.response?.data?.message || 'Invalid OTP');
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    try {
      // M-009: forgot-password endpoint expects `identifier`.
      await apiClient.post('/auth/forgot-password', { identifier: contact });
      // M-044: restart the absolute end-time and re-arm the interval
      endTimeRef.current = Date.now() + 59000;
      setTimer(59);
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
        setTimer(remaining);
        if (remaining <= 0) {
          clearInterval(resendIntervalRef.current!);
          resendIntervalRef.current = null;
        }
      }, 250);
    } catch (err) {
      Alert.alert('Error', 'Failed to resend code');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={28} color="#fff" />
        </TouchableOpacity>

        <View style={s.content}>
          <Text style={s.title}>Verify OTP</Text>
          <Text style={s.desc}>We sent a code to {contact}</Text>

          <View style={s.otpRow}>
            {otp.map((d, i) => (
              <View key={i} style={[s.box, d ? s.boxActive : null]}>
                <TextInput
                  ref={(r: any) => (inputRefs.current[i] = r)}
                  style={s.input}
                  value={d}
                  onChangeText={t => handleChange(t, i)}
                  onKeyPress={e => handleKeyPress(e, i)}
                  keyboardType="number-pad"
                  maxLength={1}
                />
              </View>
            ))}
          </View>

          <View style={s.resendRow}>
            {timer > 0 ? (
              <Text style={s.timer}>Resend in 00:{timer.toString().padStart(2, '0')}</Text>
            ) : (
              <TouchableOpacity onPress={handleResend}>
                <Text style={s.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity onPress={handleVerify} disabled={isLoading || otp.join('').length < OTP_LENGTH} style={s.btn}>
            <LinearGradient colors={['#8B5CF6', '#EC4899']} start={{x:0,y:0}} end={{x:1,y:0}} style={[s.btnGrad, otp.join('').length < OTP_LENGTH && { opacity: 0.5 }]}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnTxt}>Verify</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0F', paddingHorizontal: 24 },
  back: { marginTop: 16, marginBottom: 40 },
  content: { flex: 1 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', fontFamily: 'Outfit', marginBottom: 12 },
  desc: { fontSize: 16, color: '#A1A1AA', fontFamily: 'Inter', marginBottom: 40 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  box: { width: 50, height: 60, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  boxActive: { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.1)' },
  input: { fontSize: 24, fontWeight: 'bold', color: '#fff', fontFamily: 'Inter', textAlign: 'center', width: '100%', outlineWidth: 0 } as any,
  resendRow: { alignItems: 'center', marginBottom: 32 },
  timer: { color: '#A1A1AA', fontSize: 16, fontFamily: 'Inter' },
  resendLink: { color: '#EC4899', fontSize: 16, fontWeight: 'bold', fontFamily: 'Inter' },
  btn: { borderRadius: 16, overflow: 'hidden' },
  btnGrad: { height: 56, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: 'bold', fontFamily: 'Inter' },
});
